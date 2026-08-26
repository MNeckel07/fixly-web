"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  gatewayEnsureCustomer,
  gatewayListCards,
  gatewaySaveCard,
  gatewayDeleteCard,
  isGatewaySandbox,
} from "@/lib/gateway";
import type { SavedCard } from "@/lib/types";

/**
 * CARTÕES SALVOS
 * ==============
 * Regra que não se negocia: **o Fixly não guarda dados de cartão**. Número,
 * validade e CVV vão do navegador direto para o Mercado Pago, que devolve um
 * token de uso único; o cartão fica guardado lá, dentro de um "customer".
 * Aqui em casa fica só o ID desse customer.
 *
 * O CVV é pedido de novo a cada compra (exigência do MP, e o que garante que
 * nem um vazamento do nosso banco vira compra no cartão de alguém).
 */

/** Ambiente atual das credenciais — customer de teste não vale em produção. */
function env(): "test" | "prod" {
  return isGatewaySandbox() ? "test" : "prod";
}

/**
 * Devolve o customer do usuário logado, criando se precisar.
 *
 * Se o ID guardado foi criado em outro ambiente (a conta virou de teste para
 * produção), ele é descartado e um novo é criado — senão o pagamento quebraria
 * com um "customer not found" que ninguém entenderia.
 */
async function ensureCustomerId(): Promise<{ userId: string; customerId: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { userId: "", customerId: null };

  const admin = createAdminClient();
  const { data: priv } = await admin
    .from("profiles_private")
    .select("email, mp_customer_id, mp_customer_env, cpf")
    .eq("id", user.id)
    .maybeSingle();

  const email = (priv?.email as string) ?? user.email;
  if (!email) return { userId: user.id, customerId: null };

  if (priv?.mp_customer_id && priv?.mp_customer_env === env()) {
    return { userId: user.id, customerId: priv.mp_customer_id as string };
  }

  const { data: prof } = await admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const partes = String(prof?.full_name ?? "").trim().split(/\s+/);

  try {
    const customerId = await gatewayEnsureCustomer({
      email,
      firstName: partes[0] || undefined,
      lastName: partes.length > 1 ? partes.slice(1).join(" ") : undefined,
      document: (priv?.cpf as string) ?? undefined,
    });
    if (!customerId) return { userId: user.id, customerId: null };

    await admin
      .from("profiles_private")
      .update({ mp_customer_id: customerId, mp_customer_env: env() })
      .eq("id", user.id);
    return { userId: user.id, customerId };
  } catch (e: any) {
    console.error("[cartoes] não foi possível criar o customer no gateway:", e?.message ?? e);
    return { userId: user.id, customerId: null };
  }
}

/** Cartões que o usuário já usou e mandou guardar. */
export async function listSavedCards(): Promise<SavedCard[]> {
  const { customerId } = await ensureCustomerId();
  if (!customerId) return [];
  try {
    return await gatewayListCards(customerId);
  } catch (e: any) {
    console.error("[cartoes] falha ao listar:", e?.message ?? e);
    return [];
  }
}

/**
 * Guarda o cartão. Recebe um token **próprio para isso** — o token do pagamento
 * é de uso único e já foi gasto na cobrança, então a tela gera dois.
 */
export async function saveCard(token: string): Promise<{ ok: boolean; error?: string }> {
  if (!token) return { ok: false, error: "Token do cartão ausente." };
  const { customerId } = await ensureCustomerId();
  if (!customerId) return { ok: false, error: "Não foi possível preparar sua carteira de cartões." };
  try {
    await gatewaySaveCard(customerId, token);
    return { ok: true };
  } catch (e: any) {
    // salvar é conveniência: se falhar, o pagamento já aconteceu e não pode
    // parecer que deu errado. O erro vai para o log e a tela avisa em tom leve.
    console.error("[cartoes] falha ao salvar:", e?.message ?? e);
    return { ok: false, error: "Não conseguimos guardar este cartão desta vez." };
  }
}

export async function removeSavedCard(cardId: string): Promise<{ ok: boolean; error?: string }> {
  const { customerId } = await ensureCustomerId();
  if (!customerId) return { ok: false, error: "Carteira indisponível." };
  try {
    await gatewayDeleteCard(customerId, cardId);
    return { ok: true };
  } catch (e: any) {
    console.error("[cartoes] falha ao remover:", e?.message ?? e);
    return { ok: false, error: "Não foi possível remover o cartão." };
  }
}

/** Uso interno do pagamento: o customer dono dos cartões salvos. */
export async function currentCustomerId(): Promise<string | null> {
  const { customerId } = await ensureCustomerId();
  return customerId;
}
