"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { data: me } = await supabase.from("profiles").select("role, status").eq("id", user.id).single();
  if (me?.role !== "admin" || me?.status !== "aprovado") throw new Error("Acesso restrito");
  return { supabase, adminId: user.id };
}

export async function setUserActive(formData: FormData) {
  const id = String(formData.get("id"));
  const active = formData.get("active") === "true";
  const { supabase } = await assertAdmin();
  await supabase.from("profiles").update({ active: !active }).eq("id", id);
  revalidatePath("/admin/usuarios");
}

export async function deleteUser(formData: FormData) {
  const id = String(formData.get("id"));
  const { adminId } = await assertAdmin();
  if (id === adminId) throw new Error("Você não pode excluir a própria conta.");
  // Remove o usuário de auth (cascata apaga o profile via FK on delete cascade)
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/usuarios");
}
