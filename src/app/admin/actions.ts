"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  approvalEmailHtml,
  rejectionEmailHtml,
  sendEmail,
} from "@/lib/email";
import type { Role } from "@/lib/brand";

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { data: me } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .single();
  if (me?.role !== "admin" || me?.status !== "aprovado") {
    throw new Error("Acesso restrito a administradores");
  }
  return { supabase, adminId: user.id };
}

export async function approveProfile(formData: FormData) {
  const id = String(formData.get("id"));
  const { supabase, adminId } = await assertAdmin();

  const { data: profile, error } = await supabase
    .from("profiles")
    .update({
      status: "aprovado",
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminId,
      reject_reason: null,
    })
    .eq("id", id)
    .select("full_name, role")
    .single();

  if (error) throw new Error(error.message);

  await supabase.from("documents").update({ status: "aprovado" }).eq("profile_id", id);

  const { data: priv } = await supabase.from("profiles_private").select("email").eq("id", id).single();
  if (priv?.email) {
    await sendEmail({
      to: priv.email,
      subject: "Seu cadastro no Fixly foi aprovado!",
      html: approvalEmailHtml(profile.full_name, profile.role as Role),
    });
  }

  revalidatePath("/admin");
}

export async function rejectProfile(formData: FormData) {
  const id = String(formData.get("id"));
  const reason = String(formData.get("reason") ?? "").trim();
  const { supabase, adminId } = await assertAdmin();

  const { data: profile, error } = await supabase
    .from("profiles")
    .update({
      status: "reprovado",
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminId,
      reject_reason: reason || null,
    })
    .eq("id", id)
    .select("full_name, role")
    .single();

  if (error) throw new Error(error.message);

  const { data: priv } = await supabase.from("profiles_private").select("email").eq("id", id).single();
  if (priv?.email) {
    await sendEmail({
      to: priv.email,
      subject: "Sobre o seu cadastro no Fixly",
      html: rejectionEmailHtml(profile.full_name, profile.role as Role, reason),
    });
  }

  revalidatePath("/admin");
}

/** Gera uma URL assinada temporária para visualizar um documento privado. */
export async function getDocumentUrl(path: string): Promise<string | null> {
  const { supabase } = await assertAdmin();
  const { data } = await supabase.storage
    .from("documentos")
    .createSignedUrl(path, 60 * 10);
  return data?.signedUrl ?? null;
}
