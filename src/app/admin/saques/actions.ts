"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * Marca um saque como pago ou recusado. Só admin.
 *
 * O PIX em si é feito na conta do Fixly (manual ou pela ferramenta do gateway)
 * e registrado aqui — é o que fecha a conta do prestador. Recusar devolve o
 * valor ao saldo disponível (o cálculo em `provider_balance` ignora recusados).
 */
export async function settleWithdrawal(
  id: string,
  action: "pago" | "recusado",
  note?: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin") return { ok: false, error: "Sem permissão" };

  const admin = createAdminClient();
  const { data: wd } = await admin.from("withdrawals").select("id, status").eq("id", id).maybeSingle();
  if (!wd) return { ok: false, error: "Saque não encontrado" };
  if (wd.status !== "solicitado") return { ok: false, error: "Este saque já foi processado." };

  const { error } = await admin
    .from("withdrawals")
    .update({
      status: action,
      note: note?.trim() || null,
      paid_at: action === "pago" ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
