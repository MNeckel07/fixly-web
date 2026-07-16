"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { paymentBreakdown } from "@/lib/pricing";

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { data: me } = await supabase.from("profiles").select("role, status").eq("id", user.id).single();
  if (me?.role !== "admin" || me?.status !== "aprovado") throw new Error("Acesso restrito");
  return { adminId: user.id };
}

/** Gera um link mágico de login para uma CONTA DE TESTE (nunca usuário real). */
export async function impersonationLink(userId: string): Promise<{ ok: boolean; url?: string; error?: string }> {
  await assertAdmin();
  const admin = createAdminClient();
  const { data: prof } = await admin.from("profiles").select("is_test").eq("id", userId).single();
  if (!prof?.is_test) return { ok: false, error: "Só é permitido entrar em contas de teste." };
  const { data: priv } = await admin.from("profiles_private").select("email").eq("id", userId).single();
  if (!priv?.email) return { ok: false, error: "Conta sem e-mail." };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: priv.email,
    options: { redirectTo: appUrl },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, url: data.properties?.action_link };
}

/** Cria um pedido de teste (como o contratante de teste) e dispara propostas. */
export async function createTestRequest(): Promise<{ ok: boolean; error?: string }> {
  await assertAdmin();
  const admin = createAdminClient();

  const { data: client } = await admin
    .from("profiles")
    .select("id, lat, lng, city")
    .eq("is_test", true).eq("role", "contratante").limit(1).maybeSingle();
  if (!client) return { ok: false, error: "Nenhum contratante de teste encontrado." };

  const { data: cat } = await admin.from("service_categories").select("id, name").eq("slug", "eletricista").maybeSingle();

  const { error } = await admin.from("service_requests").insert({
    client_id: client.id,
    category_id: cat?.id ?? null,
    description: "[TESTE] Serviço de exemplo para validação do fluxo",
    urgent: false,
    address: "Endereço de teste, nº 100",
    lat: client.lat ?? -23.5505,
    lng: client.lng ?? -46.6333,
    status: "buscando",
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/testes");
  return { ok: true };
}

type Step = "propostas" | "aceitar" | "pagar" | "andamento" | "concluir" | "avaliar" | "apagar";

/** Força uma etapa em um serviço de TESTE (client is_test). */
export async function forceStep(requestId: string, step: Step): Promise<{ ok: boolean; error?: string }> {
  await assertAdmin();
  const admin = createAdminClient();

  const { data: req } = await admin
    .from("service_requests")
    .select("id, client_id, category_id, provider_id, estimated_min, estimated_max, estimated_price, status, client:profiles!service_requests_client_id_fkey(is_test)")
    .eq("id", requestId).single();
  if (!req) return { ok: false, error: "Pedido não encontrado." };
  const clientTest = Array.isArray(req.client) ? req.client[0]?.is_test : (req.client as any)?.is_test;
  if (!clientTest) return { ok: false, error: "Só é possível forçar etapas em serviços de teste." };

  if (step === "apagar") {
    await admin.from("service_requests").delete().eq("id", requestId);
    revalidatePath("/admin/testes");
    return { ok: true };
  }

  if (step === "propostas") {
    const ids = new Set<string>();
    if (req.category_id) {
      const { data: pc } = await admin.from("provider_categories").select("provider_id").eq("category_id", req.category_id);
      (pc ?? []).forEach((r: any) => ids.add(r.provider_id));
      const { data: prim } = await admin.from("profiles").select("id").eq("role", "prestador").eq("status", "aprovado").eq("category_id", req.category_id);
      (prim ?? []).forEach((r: any) => ids.add(r.id));
    }
    let provs: { id: string; base_price: number | null }[] | null = null;
    if (ids.size) {
      ({ data: provs } = await admin.from("profiles").select("id, base_price").eq("status", "aprovado").in("id", Array.from(ids)).limit(3));
    } else {
      ({ data: provs } = await admin.from("profiles").select("id, base_price").eq("role", "prestador").eq("status", "aprovado").limit(3));
    }
    for (const p of provs ?? []) {
      // preço do próprio prestador (base ± variação)
      const price = Math.max(50, Math.round((p.base_price ?? 120) + (Math.random() * 40 - 15)));
      await admin.from("proposals").upsert(
        { request_id: requestId, provider_id: p.id, price, eta_minutes: 20 + Math.round(Math.random() * 40), status: "enviada" },
        { onConflict: "request_id,provider_id" },
      );
    }
    await admin.from("service_requests").update({ status: "proposta_enviada" }).eq("id", requestId);
  }

  if (step === "aceitar") {
    const { data: prop } = await admin
      .from("proposals").select("provider_id, price")
      .eq("request_id", requestId).order("price", { ascending: true }).limit(1).maybeSingle();
    if (!prop) return { ok: false, error: "Gere propostas primeiro." };
    await admin.from("proposals").update({ status: "aceita" }).eq("request_id", requestId).eq("provider_id", prop.provider_id);
    await admin.from("service_requests").update({ provider_id: prop.provider_id, final_price: prop.price, status: "aceito" }).eq("id", requestId);
  }

  if (step === "pagar") {
    const { data: prop } = await admin
      .from("proposals").select("price").eq("request_id", requestId).eq("status", "aceita").maybeSingle();
    const amount = Number(prop?.price ?? req.final_price ?? req.estimated_price ?? 150);
    const bd = paymentBreakdown(amount, "pix");
    const { data: existing } = await admin.from("payments").select("id").eq("request_id", requestId).maybeSingle();
    if (!existing) {
      await admin.from("payments").insert({
        request_id: requestId, amount: bd.amount, fee: bd.platformFee, gateway_fee: bd.gatewayFee,
        provider_net: bd.providerNet, method: "pix", gateway: "teste", gateway_status: "approved", status: "retido",
      });
    }
    await admin.from("service_requests").update({ status: "a_caminho" }).eq("id", requestId);
  }

  if (step === "andamento") {
    await admin.from("service_requests").update({ status: "em_andamento" }).eq("id", requestId);
  }

  if (step === "concluir") {
    await admin.from("payments").update({ status: "liberado", released_at: new Date().toISOString() }).eq("request_id", requestId);
    await admin.from("service_requests").update({ status: "concluido" }).eq("id", requestId);
  }

  if (step === "avaliar") {
    await admin.from("service_requests").update({ rating: 5, review: "[TESTE] Excelente serviço, muito atencioso e pontual." }).eq("id", requestId);
  }

  revalidatePath("/admin/testes");
  return { ok: true };
}
