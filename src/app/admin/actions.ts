"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  approvalEmailHtml,
  rejectionEmailHtml,
  sendEmailBestEffort,
} from "@/lib/email";
import type { Role } from "@/lib/brand";
import { notifySealChanges } from "@/app/app/notify.actions";

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
    await sendEmailBestEffort({
      to: priv.email,
      subject: "Sua conta no Fixly já está liberada!",
      html: approvalEmailHtml(profile.full_name, profile.role as Role, priv.email),
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
    await sendEmailBestEffort({
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

/**
 * Revoga (ou devolve) o Selo Fixly de um profissional.
 *
 * A regra dos Termos: fraude, manipulação de avaliações, dano grave apurado,
 * assédio/ameaça/violência/discriminação e insistência em cobrar por fora da
 * plataforma revogam o Selo NA HORA, sem prazo de regularização. O motivo é
 * obrigatório porque vai no e-mail que o profissional recebe.
 */
export async function setSealRevocation(
  providerId: string,
  revogar: boolean,
  reason?: string,
): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await assertAdmin();

  const { error } = await supabase.rpc("set_seal_revocation", {
    p_provider: providerId,
    p_revogar: revogar,
    p_reason: reason ?? null,
  });
  if (error) return { ok: false, error: error.message };

  // o trigger já registrou o evento; aqui só disparamos o aviso
  try {
    await notifySealChanges(providerId);
  } catch (e: any) {
    console.error("[selo] falha ao avisar revogação:", e?.message ?? e);
  }

  revalidatePath("/admin/denuncias");
  revalidatePath("/admin/usuarios");
  return { ok: true };
}
