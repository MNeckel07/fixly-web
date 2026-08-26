"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
// ⚠️ NÃO reexportar daqui: arquivo "use server" só pode exportar funções async
// (ver o comentário em lib/reports.ts — foi o que quebrou cancelar/editar).
import { MOTIVOS, type MotivoDenuncia } from "@/lib/reports";

/**
 * DENÚNCIAS
 * =========
 * Canal para as duas pontas relatarem o que não pode acontecer dentro do
 * Fixly: cobrança por fora, fraude, dano, assédio/ameaça, manipulação de
 * avaliação. Entra pela tela do serviço e pela hora de avaliar.
 *
 * O denunciado NÃO enxerga a denúncia (a RLS da 0028 garante isso) — sem esse
 * cuidado o canal viraria motivo de retaliação e ninguém usaria.
 */

export async function createReport(input: {
  targetId: string;
  requestId?: string | null;
  category: MotivoDenuncia;
  description: string;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const descricao = input.description.trim();
  if (descricao.length < 15) {
    return { ok: false, error: "Conte o que aconteceu com pelo menos 15 caracteres — é o que permite apurar." };
  }
  if (!MOTIVOS.some((m) => m.id === input.category)) {
    return { ok: false, error: "Selecione um motivo." };
  }

  // a policy `reports_insert` confere de novo (participante do serviço, e não
  // denunciar a si mesmo). Aqui é só para a mensagem de erro ficar humana.
  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    target_id: input.targetId,
    request_id: input.requestId ?? null,
    category: input.category,
    description: descricao,
  });
  if (error) {
    console.error("[denuncia] recusada:", error.message);
    return { ok: false, error: "Não foi possível registrar a denúncia. Se persistir, fale com o suporte." };
  }
  return { ok: true };
}

/** Painel: tratar a denúncia (só admin — a RLS confere). */
export async function handleReport(input: {
  id: string;
  status: "em_analise" | "resolvida" | "arquivada";
  resolution?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const admin = createAdminClient();
  const { data: me } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin") return { ok: false, error: "Acesso restrito" };

  const { error } = await admin
    .from("reports")
    .update({
      status: input.status,
      resolution: input.resolution?.trim() || null,
      handled_by: user.id,
      handled_at: new Date().toISOString(),
    })
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Painel: julgar a CONTESTAÇÃO de uma avaliação (0036).
 *
 * Acolher esconde a avaliação da média e do perfil público; negar mantém tudo.
 * A nota nunca é reescrita — o histórico continua auditável, e o cliente não
 * perde o que escreveu.
 *
 * ⚠️ A checagem de admin é feita DE NOVO aqui, mesmo com o
 * `resolve_review_dispute` conferindo `is_admin()` no banco. Não é redundância
 * inútil: a RPC roda com a sessão do usuário, e uma falha de configuração de
 * `is_admin()` viraria "qualquer logado esconde a própria nota ruim". Duas
 * portas, dois cadeados.
 */
export async function resolveReviewDispute(input: {
  requestId: string;
  acolhida: boolean;
  note?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const admin = createAdminClient();
  const { data: me } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin") return { ok: false, error: "Acesso restrito" };

  const { error } = await supabase.rpc("resolve_review_dispute", {
    p_request_id: input.requestId,
    p_acolhida: input.acolhida,
    p_note: input.note?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
