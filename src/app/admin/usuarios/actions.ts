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

/** Cria um novo usuário administrador (equipe) com permissões e dados anexados. */
export async function createStaffUser(input: {
  full_name: string;
  email: string;
  username: string;
  phone: string;
  password: string;
  funcao: string;
  permissions: string[];
}): Promise<{ ok: boolean; error?: string }> {
  await assertAdmin();
  const { full_name, email, username, phone, password, funcao, permissions } = input;
  if (!full_name || !email || !username || password.length < 10) {
    return { ok: false, error: "Preencha nome, e-mail, usuário e uma senha forte (10+)." };
  }
  const admin = createAdminClient();

  // usuário único
  const { data: dup } = await admin.from("profiles_private").select("id").ilike("username", username).maybeSingle();
  if (dup) return { ok: false, error: "Este nome de usuário já existe." };

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });
  if (error) {
    const already = /registered|already|exists/i.test(error.message);
    return { ok: false, error: already ? "Este e-mail já está cadastrado." : error.message };
  }
  const uid = data.user!.id;
  await admin.from("profiles").upsert({
    id: uid, role: "admin", status: "aprovado", full_name, funcao, permissions,
  });
  await admin.from("profiles_private").upsert({ id: uid, email, phone, username });
  revalidatePath("/admin/usuarios");
  return { ok: true };
}

/** Atualiza as permissões (e função) de um usuário admin. */
export async function updateStaffPermissions(input: {
  id: string;
  funcao: string;
  permissions: string[];
}): Promise<{ ok: boolean; error?: string }> {
  const { adminId } = await assertAdmin();
  const admin = createAdminClient();
  // não permita remover as próprias permissões (evita se trancar de fora)
  const permissions = input.id === adminId ? [] : input.permissions;
  await admin.from("profiles").update({ funcao: input.funcao, permissions }).eq("id", input.id);
  revalidatePath("/admin/usuarios");
  return { ok: true };
}
