"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { data: me } = await supabase.from("profiles").select("role, status").eq("id", user.id).single();
  if (me?.role !== "admin" || me?.status !== "aprovado") throw new Error("Acesso restrito");
}

export async function setEmpreiteiroSubscription(id: string, active: boolean): Promise<{ ok: boolean }> {
  await assertAdmin();
  const admin = createAdminClient();
  const until = new Date();
  until.setDate(until.getDate() + 30);
  await admin
    .from("empreiteiros")
    .update({ subscription_active: active, subscription_until: active ? until.toISOString().slice(0, 10) : null })
    .eq("id", id);
  revalidatePath("/admin/empreiteiros");
  return { ok: true };
}
