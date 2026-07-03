"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { data: me } = await supabase.from("profiles").select("role, status").eq("id", user.id).single();
  if (me?.role !== "admin" || me?.status !== "aprovado") throw new Error("Acesso restrito");
  return supabase;
}

export async function addDocumentType(formData: FormData) {
  const supabase = await assertAdmin();
  const label = String(formData.get("label")).trim();
  const applies_to = String(formData.get("applies_to"));
  const required = formData.get("required") === "on";
  if (!label) throw new Error("Informe o nome do documento");
  const slug =
    label.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") +
    "_" + Math.random().toString(36).slice(2, 5);
  await supabase.from("document_types").insert({ slug, label, applies_to, required });
  revalidatePath("/admin/documentos");
}

export async function toggleDocRequired(formData: FormData) {
  const supabase = await assertAdmin();
  const id = String(formData.get("id"));
  const required = formData.get("required") === "true";
  await supabase.from("document_types").update({ required: !required }).eq("id", id);
  revalidatePath("/admin/documentos");
}

export async function toggleDocActive(formData: FormData) {
  const supabase = await assertAdmin();
  const id = String(formData.get("id"));
  const active = formData.get("active") === "true";
  await supabase.from("document_types").update({ active: !active }).eq("id", id);
  revalidatePath("/admin/documentos");
}

export async function deleteDocumentType(formData: FormData) {
  const supabase = await assertAdmin();
  const id = String(formData.get("id"));
  await supabase.from("document_types").delete().eq("id", id);
  revalidatePath("/admin/documentos");
}
