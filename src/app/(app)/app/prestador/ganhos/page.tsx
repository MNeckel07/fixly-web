import { redirect } from "next/navigation";
import { Briefcase, Banknote } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { CategoryIcon } from "@/components/ui/icons";
import { GanhoItem } from "@/components/prestador/GanhoItem";
import { Carteira, type Pending, type Withdrawal } from "@/components/prestador/Carteira";
import { getBalance } from "./actions";
import { brl, providerNet } from "@/lib/pricing";
import { diaBR, diaDaSemanaBR, semanaAtualBR } from "@/lib/fuso";

export const dynamic = "force-dynamic";

const GATEWAY_MSG: Record<string, { text: string; tone: string }> = {
  conectado: { text: "Conta do gateway conectada com sucesso.", tone: "text-success bg-success/5" },
  recusado: { text: "Você recusou a autorização no gateway.", tone: "text-gray bg-black/[0.03]" },
  falha: { text: "Não foi possível conectar a conta. Tente novamente.", tone: "text-danger bg-danger/5" },
  "state-invalido": { text: "Link de conexão expirado. Tente de novo.", tone: "text-danger bg-danger/5" },
  "sem-codigo": { text: "O gateway não devolveu a autorização.", tone: "text-danger bg-danger/5" },
  "nao-configurado": { text: "O recebimento direto ainda não está configurado.", tone: "text-warning bg-warning/10" },
  "sem-permissao": { text: "Apenas prestadores aprovados podem conectar a conta.", tone: "text-danger bg-danger/5" },
};

export default async function GanhosPage({
  searchParams,
}: {
  searchParams: Promise<{ gateway?: string }>;
}) {
  const { gateway } = await searchParams;
  const supabase = await createClient();
  const { profile } = await getProfile();
  if (!profile) redirect("/login");

  const [{ data }, balance, { data: wds }, { data: connected }] = await Promise.all([
    supabase
      .from("service_requests")
      .select(
        "id, final_price, estimated_price, created_at, category:service_categories(name, slug), payment:payments(amount, fee, gateway_fee, provider_net, method, status, available_at, released_at, advance_amount, advance_released_at)",
      )
      .eq("provider_id", profile!.id)
      .eq("status", "concluido")
      .order("created_at", { ascending: false }),
    getBalance(),
    supabase
      .from("withdrawals")
      .select("id, amount, status, requested_at, paid_at, pix_key")
      .eq("provider_id", profile!.id)
      .order("requested_at", { ascending: false })
      .limit(10),
    supabase.rpc("gateway_connected"),
  ]);

  const jobs = (data ?? []).map((j: any) => {
    const cat = Array.isArray(j.category) ? j.category[0] : j.category;
    const pay = Array.isArray(j.payment) ? j.payment[0] : j.payment;
    const val = j.final_price ?? j.estimated_price ?? 0;
    const net = pay?.provider_net ?? providerNet(val);
    return { id: j.id, created_at: j.created_at, catName: cat?.name ?? "Serviço", catSlug: cat?.slug, val, pay, net };
  });

  // "A caminho da sua conta": aprovado, mas o prazo de crédito ainda não venceu
  const pending: Pending[] = jobs
    .filter((j) => j.pay?.status === "liberado" && j.pay?.available_at && new Date(j.pay.available_at) > new Date())
    .map((j) => ({
      id: j.id,
      categoryName: j.catName,
      net: Number(j.net),
      availableAt: j.pay!.available_at as string,
      isAdvance: false,
    }));

  // Adiantamentos liberados de serviços AINDA em andamento (não aparecem na
  // lista de concluídos — era a reclamação "liberei adiantamento e não apareceu")
  const { data: adv } = await supabase
    .from("service_requests")
    .select("id, category:service_categories(name), payment:payments(advance_amount, advance_released_at)")
    .eq("provider_id", profile!.id)
    .in("status", ["a_caminho", "em_andamento"]);
  for (const a of adv ?? []) {
    const pay: any = Array.isArray((a as any).payment) ? (a as any).payment[0] : (a as any).payment;
    if (!pay?.advance_released_at) continue;
    const cat: any = Array.isArray((a as any).category) ? (a as any).category[0] : (a as any).category;
    pending.push({
      id: `adv-${(a as any).id}`,
      categoryName: cat?.name ?? "Serviço",
      net: Number(pay.advance_amount ?? 0),
      availableAt: pay.advance_released_at as string,
      isAdvance: true,
    });
  }

  const grossNet = jobs.reduce((s, j) => s + Number(j.net), 0);
  const gross = jobs.reduce((s, j) => s + Number(j.val), 0);

  /**
   * 🔴 "VAI RECEBER 3,40 MAS SÓ TEM UM SERVIÇO DE 1 REAL NA CONTA" (Fixly 13, pág. 5).
   *
   * O dono estava certo, e o dinheiro estava certo — quem estava errada era a
   * PÁGINA. Repare no que ela mostrava:
   *
   *   • a carteira, em cima, soma "ainda vai cair" = disponível + a liberar +
   *     **em serviço** + saque em processamento. "Em serviço" é dinheiro que o
   *     cliente JÁ PAGOU e está retido até ele aprovar a conclusão;
   *   • a lista, embaixo, se chama "Serviços concluídos" e filtra
   *     `status = 'concluido'`.
   *
   * Ou seja: todo serviço pago e ainda não aprovado entrava no TOTAL e não
   * entrava em NENHUMA lista. Quatro serviços de R$ 1 retidos somam
   * 4 × R$ 0,85 = **R$ 3,40** — o número exato do relato — enquanto a lista
   * mostrava só o que já tinha sido aprovado. Não havia como conferir a conta,
   * porque as parcelas dela não estavam em lugar nenhum da tela.
   *
   * A correção é dar nome a esse dinheiro: listar os serviços retidos, com
   * valor, para que a soma de cima seja verificável linha a linha.
   */
  const { data: retidos } = await supabase
    .from("service_requests")
    .select("id, final_price, estimated_price, created_at, category:service_categories(name, slug), payment:payments!inner(provider_net, status, method)")
    .eq("provider_id", profile!.id)
    .in("status", ["aceito", "a_caminho", "em_andamento"])
    .eq("payment.status", "retido");

  const emServico = (retidos ?? []).map((j: any) => {
    const cat = Array.isArray(j.category) ? j.category[0] : j.category;
    const pay = Array.isArray(j.payment) ? j.payment[0] : j.payment;
    return {
      id: j.id as string,
      catName: cat?.name ?? "Serviço",
      catSlug: cat?.slug as string | undefined,
      net: Number(pay?.provider_net ?? 0),
    };
  });
  const totalEmServico = emServico.reduce((s, j) => s + j.net, 0);

  /**
   * GANHOS DA SEMANA — duas correções de uma vez (Fixly 13, págs. 7 e 8).
   *
   * 1) O DIA ERRADO. Era `new Date(j.created_at).getDay()`, que responde no
   *    fuso do SERVIDOR (UTC no Render). Serviço feito às 21h em Curitiba já é
   *    o dia seguinte em UTC — daí *"só fiz serviços hoje e deu que fiz hoje e
   *    amanhã, dia 02 e 03"*. Agora quem responde é `diaDaSemanaBR`.
   *
   * 2) A SEMANA ERRADA. O gráfico somava o HISTÓRICO INTEIRO por dia da
   *    semana: uma quarta de julho entrava na barra da quarta de hoje. Com o
   *    total da semana ao lado do título (pedido do dono), isso passaria de
   *    feio a mentiroso — o número não bateria com nada. Agora só entram os
   *    sete dias da semana corrente.
   *
   * 3) A DATA CERTA É A DA LIBERAÇÃO, não a da criação do pedido. "Ganhos" é
   *    quando o dinheiro virou dele; um pedido aberto na segunda e aprovado na
   *    quinta é ganho de quinta. É a mesma régua que o painel de "Ganhos no
   *    mês" já usava (`payments.released_at`).
   */
  const week = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const diasDaSemana = semanaAtualBR();
  const byDay = new Array(7).fill(0);
  for (const j of jobs) {
    const quando = j.pay?.released_at ?? j.created_at;
    if (!quando) continue;
    const dia = diaBR(quando);
    if (!diasDaSemana.includes(dia)) continue;
    byDay[diaDaSemanaBR(quando)] += Number(j.net);
  }
  const max = Math.max(...byDay, 1);
  const totalSemana = byDay.reduce((s, v) => s + v, 0);

  const msg = gateway ? GATEWAY_MSG[gateway] : null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {msg && <p className={`text-sm rounded-xl px-4 py-3 ${msg.tone}`}>{msg.text}</p>}

      <Carteira
        balance={balance}
        pending={pending}
        withdrawals={(wds as Withdrawal[]) ?? []}
        pixKey={(profile as any).pix_key ?? null}
        gatewayConnected={!!connected}
        gatewayAvailable={!!process.env.MP_CLIENT_ID}
      />

      {/* Total histórico */}
      <div className="bg-white rounded-2xl border border-black/5 p-6">
        <p className="text-gray text-sm">Ganho líquido total (histórico)</p>
        <p className="text-2xl font-bold text-ink mt-1">{brl(grossNet)}</p>
        <div className="flex gap-6 mt-3 text-sm text-gray">
          <span className="inline-flex items-center gap-1.5"><Briefcase className="h-4 w-4" /> {jobs.length} serviços</span>
          <span className="inline-flex items-center gap-1.5"><Banknote className="h-4 w-4" /> bruto {brl(gross)}</span>
        </div>
      </div>

      {/*
        O VALOR SAI DO TOOLTIP E VAI PARA A TELA (Fixly 13, pág. 7):
        *"colocar o valor feito no dia em cima do gráfico, ou em baixo de
        quarta ali. E o total ao lado de ganhos na semana"*.

        Antes o valor de cada dia só existia no `title=` da barra — invisível
        no celular, que é onde o profissional abre isto. O gráfico dizia qual
        dia foi o melhor e nunca quanto foi.
      */}
      <div className="bg-white rounded-2xl border border-black/5 p-6">
        <div className="flex items-baseline justify-between gap-3 mb-4">
          <h2 className="font-semibold text-ink">Ganhos na semana</h2>
          <span className="text-lg font-bold text-ink">{brl(totalSemana)}</span>
        </div>
        <div className="flex items-end justify-between gap-2 h-44">
          {byDay.map((v, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              {/* o valor fica ACIMA da barra; espaço reservado mesmo quando é
                  zero, senão as barras dançam de altura entre os dias */}
              <span className={`text-[10px] font-semibold h-4 ${v > 0 ? "text-ink" : "text-transparent"}`}>
                {v > 0 ? brl(v) : "–"}
              </span>
              <div className="w-full flex items-end justify-center h-28">
                <div
                  className="w-full max-w-8 rounded-t-lg bg-primary/80 transition-all"
                  style={{ height: `${(v / max) * 100}%`, minHeight: v > 0 ? 6 : 2 }}
                />
              </div>
              <span className="text-[11px] text-gray-light">{week[i]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* O dinheiro que a carteira conta em "Em serviço", agora com nome e
          valor — sem esta lista o total de cima não fechava com nada. */}
      {emServico.length > 0 && (
        <div className="bg-white rounded-2xl border border-black/5 overflow-hidden">
          <div className="px-6 py-4 border-b border-black/5 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-ink">Em serviço (pago, aguardando aprovação)</h2>
              <p className="text-xs text-gray-light mt-0.5">
                O cliente já pagou. O valor fica retido até ele aprovar a conclusão — depois
                disso entra na sua carteira.
              </p>
            </div>
            <span className="font-bold text-ink shrink-0">{brl(totalEmServico)}</span>
          </div>
          <ul className="divide-y divide-black/5">
            {emServico.map((j) => (
              <li key={j.id} className="flex items-center justify-between px-6 py-3.5">
                <span className="flex items-center gap-3 min-w-0">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-canvas text-ink">
                    <CategoryIcon slug={j.catSlug} className="h-5 w-5" />
                  </span>
                  <span className="font-medium text-ink text-sm truncate">{j.catName}</span>
                </span>
                <span className="font-semibold text-gray shrink-0">{brl(j.net)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-black/5 overflow-hidden">
        <div className="px-6 py-4 border-b border-black/5">
          <h2 className="font-semibold text-ink">Serviços concluídos</h2>
          <p className="text-xs text-gray-light mt-0.5">Toque em um serviço para ver o detalhamento dos descontos.</p>
        </div>
        {jobs.length === 0 ? (
          <p className="px-6 py-10 text-center text-gray">
            Você ainda não concluiu serviços. O valor entra aqui quando o contratante aprova a conclusão.
          </p>
        ) : (
          <ul className="divide-y divide-black/5">
            {jobs.map((j) => (
              <GanhoItem key={j.id} job={j}>
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-canvas text-ink">
                  <CategoryIcon slug={j.catSlug} className="h-5 w-5" />
                </span>
              </GanhoItem>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
