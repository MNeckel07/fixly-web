import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { releaseEscrow } from "@/lib/gateway";
import { sendEmailBestEffort, serviceNotificationEmailHtml } from "@/lib/email";
import {
  AUTO_RELEASE_DAYS,
  AUTO_RELEASE_WARN_DAYS,
  settlementDate,
  brl,
  type PayMethod,
} from "@/lib/pricing";
import { notifySealChanges } from "@/app/(app)/app/notify.actions";
import { siteUrl } from "@/lib/appRole";

/**
 * LIBERAÇÃO AUTOMÁTICA DO ESCROW (chamado pelo `pg_cron`, migração 0032)
 * ======================================================================
 *
 * O buraco que isto fecha: só o contratante conclui o serviço, e concluir é o
 * que libera o dinheiro. Se ele simplesmente some — e some —, o profissional
 * trabalhou, marcou concluído e **nunca recebe**. Não havia nenhuma saída: o
 * valor ficava `retido` indefinidamente.
 *
 * POR QUE UM ENDPOINT, E NÃO SQL PURO
 * -----------------------------------
 * A liberação de verdade acontece no gateway (`releaseEscrow` → Mercado Pago).
 * Reescrever isso em PL/pgSQL criaria um SEGUNDO lugar que mexe em dinheiro,
 * com regra de negócio duplicada e destinada a divergir. Aqui o cron só puxa o
 * gatilho; o caminho do dinheiro continua sendo um só, o mesmo do
 * `approveService`.
 *
 * SEGURANÇA
 * ---------
 * Exige `Authorization: Bearer <CRON_SECRET>`. Sem a variável no servidor,
 * responde **503** e não faz nada — o mesmo padrão das rotas de carteira: é
 * melhor não funcionar de forma visível do que funcionar sem proteção.
 *
 * Ainda assim, a rota foi desenhada para ser **inofensiva se acionada**: ela é
 * idempotente e travada no tempo. Só toca em serviço cujo prazo JÁ venceu, e
 * um serviço já concluído nunca é reprocessado. Disparar a rota antes da hora
 * não antecipa a liberação de ninguém.
 *
 * O guard do banco (`guard_request_changes`, 0022) exige que quem conclui seja
 * o contratante — mas ele abre exceção para `auth.uid() is null`, que é o
 * contexto do `createAdminClient()`. Por isso aqui não é preciso mexer no GUC
 * de bypass.
 */

export const dynamic = "force-dynamic";

const DIA_MS = 86_400_000;

type Alvo = {
  id: string;
  client_id: string;
  provider_done_at: string;
  category: { name: string } | { name: string }[] | null;
};

function nomeCategoria(c: Alvo["category"]) {
  return (Array.isArray(c) ? c[0] : c)?.name ?? "serviço";
}

async function contatoDe(admin: ReturnType<typeof createAdminClient>, id: string) {
  const { data: prof } = await admin.from("profiles").select("full_name").eq("id", id).maybeSingle();
  const { data: priv } = await admin.from("profiles_private").select("email").eq("id", id).maybeSingle();
  if (!prof || !priv?.email) return null;
  return { name: prof.full_name as string, email: priv.email as string };
}

export async function POST(request: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET não configurada no servidor." },
      { status: 503 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();
  const agora = new Date();
  const corteLiberar = new Date(agora.getTime() - AUTO_RELEASE_DAYS * DIA_MS).toISOString();
  const corteAvisar = new Date(agora.getTime() - AUTO_RELEASE_WARN_DAYS * DIA_MS).toISOString();

  let avisados = 0;
  let liberados = 0;
  const erros: string[] = [];

  /* ── 1) AVISO no 5º dia ────────────────────────────────────────────────
     Entre o 5º e o 7º dia. `notification_log` garante uma única mensagem —
     sem isso o contratante receberia o mesmo aviso todo dia até o prazo. */
  const { data: aAvisar } = await admin
    .from("service_requests")
    .select("id, client_id, provider_done_at, category:service_categories(name)")
    .eq("status", "aceito")
    .not("provider_done_at", "is", null)
    .lte("provider_done_at", corteAvisar)
    .gt("provider_done_at", corteLiberar);

  for (const req of (aAvisar ?? []) as Alvo[]) {
    try {
      const { data: jaAvisado } = await admin
        .from("notification_log")
        .select("id")
        .eq("profile_id", req.client_id)
        .eq("kind", "escrow_aviso")
        .eq("ref_id", req.id)
        .limit(1);
      if ((jaAvisado ?? []).length) continue;

      const { data: pay } = await admin
        .from("payments")
        .select("status, amount")
        .eq("request_id", req.id)
        .maybeSingle();
      if (pay?.status !== "retido") continue;

      const cliente = await contatoDe(admin, req.client_id);
      if (!cliente) continue;

      const restantes = AUTO_RELEASE_DAYS - AUTO_RELEASE_WARN_DAYS;
      await sendEmailBestEffort({
        to: cliente.email,
        subject: "Confirme o serviço no Fixly — liberação automática em breve",
        html: serviceNotificationEmailHtml({
          name: cliente.name,
          title: "Seu serviço está aguardando confirmação",
          lead:
            `O profissional marcou como concluído o seu serviço de <b>${nomeCategoria(req.category)}</b>, ` +
            `e você ainda não confirmou. Em <b>${restantes} dias</b> o pagamento é liberado automaticamente para ele. ` +
            `Se algo não saiu como combinado, abra o serviço e fale com o profissional ou registre uma denúncia antes disso.`,
          highlight: pay?.amount ? brl(Number(pay.amount)) : undefined,
          cta: "Conferir o serviço",
          url: `${siteUrl()}/app/contratante/servico/${req.id}`,
        }),
      });
      await admin
        .from("notification_log")
        .insert({ profile_id: req.client_id, kind: "escrow_aviso", ref_id: req.id });
      avisados++;
    } catch (e: any) {
      erros.push(`aviso ${req.id}: ${e?.message ?? e}`);
    }
  }

  /* ── 2) LIBERAÇÃO no 7º dia ────────────────────────────────────────────
     Mesma sequência do `approveService`: solta no gateway, marca o pagamento
     e só então conclui o serviço. A ordem importa — concluir primeiro e
     falhar no gateway deixaria um serviço fechado com dinheiro presto. */
  const { data: aLiberar } = await admin
    .from("service_requests")
    .select("id, client_id, provider_done_at, category:service_categories(name)")
    .eq("status", "aceito")
    .not("provider_done_at", "is", null)
    .lte("provider_done_at", corteLiberar);

  for (const req of (aLiberar ?? []) as Alvo[]) {
    try {
      const { data: pay } = await admin
        .from("payments")
        .select("gateway_id, method, status")
        .eq("request_id", req.id)
        .maybeSingle();

      // Serviço sem pagamento retido não tem o que liberar (Selo Fixly roda o
      // fluxo inteiro sem gateway, `no_charge`), mas ainda precisa ser fechado.
      if (pay && pay.status === "retido") {
        if (pay.gateway_id) await releaseEscrow(pay.gateway_id);
        const quando = new Date();
        await admin
          .from("payments")
          .update({
            status: "liberado",
            released_at: quando.toISOString(),
            available_at: settlementDate((pay.method as PayMethod) ?? "pix", quando).toISOString(),
          })
          .eq("request_id", req.id);
      }

      await admin.from("service_requests").update({ status: "concluido" }).eq("id", req.id);
      liberados++;

      const cliente = await contatoDe(admin, req.client_id);
      if (cliente) {
        await sendEmailBestEffort({
          to: cliente.email,
          subject: "Serviço concluído automaticamente no Fixly",
          html: serviceNotificationEmailHtml({
            name: cliente.name,
            title: "Serviço concluído automaticamente",
            lead:
              `Passaram-se ${AUTO_RELEASE_DAYS} dias desde que o profissional concluiu o seu serviço de ` +
              `<b>${nomeCategoria(req.category)}</b> sem confirmação, então o pagamento foi liberado para ele. ` +
              `Se houve algum problema com o serviço, fale com a gente pelo suporte.`,
            cta: "Ver o serviço",
            url: `${siteUrl()}/app/contratante/servico/${req.id}`,
          }),
        });
      }
    } catch (e: any) {
      erros.push(`liberação ${req.id}: ${e?.message ?? e}`);
    }
  }

  /**
   * Concluir recalcula a nota do profissional (trigger `on_request_completed`),
   * e é aí que o Selo Fixly entra ou cai. Mesmo motivo do `approveService`:
   * o Postgres não manda e-mail sozinho, então o aviso sai daqui.
   */
  if (liberados > 0) {
    try {
      await notifySealChanges();
    } catch (e: any) {
      erros.push(`selo: ${e?.message ?? e}`);
    }
  }

  return NextResponse.json(
    { ok: true, at: agora.toISOString(), avisados, liberados, erros },
    { headers: { "Cache-Control": "no-store" } },
  );
}
