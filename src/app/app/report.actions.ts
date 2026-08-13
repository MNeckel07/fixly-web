"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";

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

export const MOTIVOS = [
  { id: "fora_da_plataforma", label: "Pediu para pagar por fora do Fixly" },
  { id: "fraude", label: "Fraude ou tentativa de golpe" },
  { id: "dano", label: "Dano ao imóvel, a bens ou a terceiros" },
  { id: "assedio", label: "Assédio, ameaça, violência ou discriminação" },
  { id: "avaliacao", label: "Manipulação de avaliações" },
  { id: "outro", label: "Outro motivo" },
] as const;

export type MotivoDenuncia = (typeof MOTIVOS)[number]["id"];

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
