"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { sendEmailBestEffort, serviceNotificationEmailHtml } from "@/lib/email";
import { brl } from "@/lib/pricing";

/**
 * AVISOS POR E-MAIL DO SERVIÇO
 * ============================
 * "vc recebeu uma proposta", "vc recebeu uma contraproposta", "tal pessoa te
 * mandou mensagem" — o pedido do dono na parte 7.
 *
 * Por que server action e não trigger no banco: o Postgres do Supabase não
 * manda e-mail sozinho (precisaria de pg_net/Edge Function), e a Brevo já está
 * modelada aqui. Cada função **reconfere no servidor** quem é o destinatário a
 * partir do banco — nada do que o cliente manda vira e-mail sem checagem.
 *
 * `notification_log` evita repetição: proposta e contra-proposta avisam uma vez
 * por rodada, e mensagem no chat no máximo uma vez a cada 15 minutos (senão uma
 * conversa normal vira 40 e-mails).
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://fixly.company";
const MESSAGE_COOLDOWN_MIN = 15;

async function me() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** Já avisamos isso? (evita e-mail duplicado quando a tela repete a chamada) */
async function alreadyNotified(
  admin: ReturnType<typeof createAdminClient>,
  profileId: string,
  kind: string,
  refId: string,
  withinMinutes?: number,
) {
  let q = admin
    .from("notification_log")
    .select("id")
    .eq("profile_id", profileId)
    .eq("kind", kind)
    .eq("ref_id", refId)
    .limit(1);
  if (withinMinutes) {
    q = q.gte("created_at", new Date(Date.now() - withinMinutes * 60_000).toISOString());
  }
  const { data } = await q;
  return (data ?? []).length > 0;
}

async function logNotification(
  admin: ReturnType<typeof createAdminClient>,
  profileId: string,
  kind: string,
  refId: string,
) {
  await admin.from("notification_log").insert({ profile_id: profileId, kind, ref_id: refId });
}

async function contactOf(admin: ReturnType<typeof createAdminClient>, profileId: string) {
  const { data: prof } = await admin.from("profiles").select("full_name, role").eq("id", profileId).single();
  const { data: priv } = await admin.from("profiles_private").select("email").eq("id", profileId).maybeSingle();
  if (!prof || !priv?.email) return null;
  return { name: prof.full_name as string, role: prof.role as string, email: priv.email as string };
}

/** Prestador enviou/atualizou a proposta → avisa o contratante. */
export async function notifyProposal(requestId: string) {
  const uid = await me();
  if (!uid) return;
  const admin = createAdminClient();

  const { data: req } = await admin
    .from("service_requests")
    .select("id, client_id, provider_id, category:service_categories(name)")
    .eq("id", requestId)
    .maybeSingle();
  if (!req || req.provider_id) return;

  const { data: prop } = await admin
    .from("proposals")
    .select("id, price")
    .eq("request_id", requestId)
    .eq("provider_id", uid)
    .maybeSingle();
  if (!prop) return; // quem chamou não tem proposta neste pedido

  if (await alreadyNotified(admin, req.client_id, "proposta", prop.id)) return;

  const cliente = await contactOf(admin, req.client_id);
  const prestador = await contactOf(admin, uid);
  if (!cliente || !prestador) return;
  const categoria = (Array.isArray(req.category) ? req.category[0] : req.category)?.name ?? "serviço";

  await sendEmailBestEffort({
    to: cliente.email,
    subject: "Você recebeu uma proposta no Fixly",
    html: serviceNotificationEmailHtml({
      name: cliente.name,
      title: "Você recebeu uma proposta",
      lead: `<b>${prestador.name}</b> enviou uma proposta para o seu pedido de <b>${categoria}</b>. Você pode aceitar, fazer uma contra-proposta ou conversar antes de decidir.`,
      highlight: brl(Number(prop.price)),
      cta: "Ver a proposta",
      url: `${APP_URL}/app/contratante/servico/${requestId}`,
    }),
  });
  await logNotification(admin, req.client_id, "proposta", prop.id);
}

/** Alguém fez uma contra-proposta → avisa o outro lado. */
export async function notifyCounter(proposalId: string) {
  const uid = await me();
  if (!uid) return;
  const admin = createAdminClient();

  const { data: prop } = await admin
    .from("proposals")
    .select("id, request_id, provider_id, counter_price, counter_status, counter_by")
    .eq("id", proposalId)
    .maybeSingle();
  if (!prop || prop.counter_status !== "pendente" || prop.counter_by !== uid) return;

  const { data: req } = await admin
    .from("service_requests")
    .select("id, client_id, category:service_categories(name)")
    .eq("id", prop.request_id)
    .maybeSingle();
  if (!req) return;

  const paraPrestador = uid === req.client_id;
  const destinoId = paraPrestador ? prop.provider_id : req.client_id;
  // a referência inclui o valor: cada rodada da negociação avisa uma vez
  const ref = prop.id;
  if (await alreadyNotified(admin, destinoId, `contra_${prop.counter_price}`, ref)) return;

  const destino = await contactOf(admin, destinoId);
  const autor = await contactOf(admin, uid);
  if (!destino || !autor) return;

  await sendEmailBestEffort({
    to: destino.email,
    subject: "Você recebeu uma contra-proposta no Fixly",
    html: serviceNotificationEmailHtml({
      name: destino.name,
      title: "Você recebeu uma contra-proposta",
      lead: `<b>${autor.name}</b> respondeu à negociação com um novo valor. Você pode aceitar, recusar ou responder com outra proposta.`,
      highlight: brl(Number(prop.counter_price ?? 0)),
      cta: "Responder agora",
      url: paraPrestador ? `${APP_URL}/app/prestador` : `${APP_URL}/app/contratante/servico/${req.id}`,
    }),
  });
  await logNotification(admin, destinoId, `contra_${prop.counter_price}`, ref);
}

/** Convite de conversa → avisa quem precisa aceitar. */
export async function notifyChatInvite(requestId: string, providerId: string) {
  const uid = await me();
  if (!uid) return;
  const admin = createAdminClient();

  const { data: conv } = await admin
    .from("conversations")
    .select("id, chat_status, requested_by, request_id, provider_id")
    .eq("type", "servico")
    .eq("request_id", requestId)
    .eq("provider_id", providerId)
    .maybeSingle();
  if (!conv || conv.chat_status !== "pendente" || conv.requested_by !== uid) return;

  const { data: req } = await admin
    .from("service_requests")
    .select("id, client_id")
    .eq("id", requestId)
    .maybeSingle();
  if (!req) return;

  const destinoId = uid === req.client_id ? providerId : req.client_id;
  if (await alreadyNotified(admin, destinoId, "convite_chat", conv.id)) return;

  const destino = await contactOf(admin, destinoId);
  const autor = await contactOf(admin, uid);
  if (!destino || !autor) return;

  await sendEmailBestEffort({
    to: destino.email,
    subject: `${autor.name} quer conversar sobre um serviço`,
    html: serviceNotificationEmailHtml({
      name: destino.name,
      title: "Convite para conversar",
      lead: `<b>${autor.name}</b> pediu para abrir uma conversa sobre este serviço. Você decide se aceita — e, aceitando, o chat vale até o serviço terminar.`,
      cta: "Ver o convite",
      url: uid === req.client_id ? `${APP_URL}/app/prestador` : `${APP_URL}/app/contratante/servico/${req.id}`,
    }),
  });
  await logNotification(admin, destinoId, "convite_chat", conv.id);
}

/** Mensagem nova no chat → avisa o outro participante (no máximo 1 a cada 15 min). */
export async function notifyNewMessage(conversationId: string) {
  const uid = await me();
  if (!uid) return;
  const admin = createAdminClient();

  const { data: conv } = await admin
    .from("conversations")
    .select("id, type, request_id, chat_status")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv || conv.type !== "servico" || conv.chat_status !== "ativa") return;

  const { data: parts } = await admin
    .from("conversation_participants")
    .select("profile_id")
    .eq("conversation_id", conversationId);
  const ids = (parts ?? []).map((p: { profile_id: string }) => p.profile_id);
  if (!ids.includes(uid)) return;

  const destinoId = ids.find((id: string) => id !== uid);
  if (!destinoId) return;
  if (await alreadyNotified(admin, destinoId, "mensagem", conversationId, MESSAGE_COOLDOWN_MIN)) return;

  const destino = await contactOf(admin, destinoId);
  const autor = await contactOf(admin, uid);
  if (!destino || !autor) return;

  const url =
    destino.role === "prestador"
      ? `${APP_URL}/app/prestador`
      : `${APP_URL}/app/contratante/servico/${conv.request_id}`;

  await sendEmailBestEffort({
    to: destino.email,
    subject: `${autor.name.split(" ")[0]} te mandou uma mensagem no Fixly`,
    html: serviceNotificationEmailHtml({
      name: destino.name,
      title: "Nova mensagem",
      lead: `<b>${autor.name}</b> te mandou uma mensagem sobre um serviço. Responda por aqui — a conversa fica registrada para os dois lados.`,
      cta: "Abrir a conversa",
      url,
    }),
  });
  await logNotification(admin, destinoId, "mensagem", conversationId);
}
