"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { sendEmailBestEffort, serviceNotificationEmailHtml, sealEmailHtml } from "@/lib/email";
import { brl } from "@/lib/pricing";
import { siteUrl } from "@/lib/appRole";

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

/**
 * Texto digitado pela pessoa entrando em HTML de e-mail (o assunto do chamado).
 * Sem isso, um `<` no assunto quebra o layout — e um `<a>` viraria link de
 * verdade dentro de um e-mail com a marca do Fixly.
 */
function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

/**
 * Pedido DIRETO (Profiler / perfil público) → avisa o profissional escolhido.
 *
 * Pedido comum cai na vitrine e ele descobre quando abre o app. Pedido direto
 * não: é uma pessoa que escolheu ELE pelo nome, e ficar horas sem responder
 * porque não abriu o app é justamente o que faz o cliente desistir e ligar
 * para outro. Foi o pedido do dono no Fixly 12 — *"colocar uma notificação por
 * email: você recebeu uma proposta de serviço pelo seu profiler"*.
 *
 * ⚠️ O destinatário NÃO vem de quem chamou: sai de `target_provider_id`, lido
 * do banco. Assim nem uma tela adulterada consegue disparar e-mail para um
 * terceiro qualquer.
 */
export async function notifyDirectRequest(requestId: string) {
  const uid = await me();
  if (!uid) return;
  const admin = createAdminClient();

  const { data: req } = await admin
    .from("service_requests")
    .select("id, client_id, target_provider_id, description, category:service_categories(name)")
    .eq("id", requestId)
    .maybeSingle();
  // só o dono do pedido dispara, e só quando ele é mesmo direcionado
  if (!req || !req.target_provider_id || req.client_id !== uid) return;

  if (await alreadyNotified(admin, req.target_provider_id, "pedido_direto", req.id)) return;

  const prestador = await contactOf(admin, req.target_provider_id);
  const cliente = await contactOf(admin, req.client_id);
  if (!prestador || !cliente) return;
  const categoria = (Array.isArray(req.category) ? req.category[0] : req.category)?.name ?? "serviço";

  await sendEmailBestEffort({
    to: prestador.email,
    subject: "Você recebeu um pedido pelo seu Profiler",
    html: serviceNotificationEmailHtml({
      name: prestador.name,
      title: "Você recebeu um pedido pelo seu Profiler",
      lead: `<b>${cliente.name}</b> pediu um serviço de <b>${categoria}</b> escolhendo você diretamente pelo seu Profiler. Ele está esperando o seu valor: "${escapeHtml(req.description ?? "")}"`,
      cta: "Ver o pedido e enviar o valor",
      url: `${APP_URL}/app/prestador`,
    }),
  });
  await logNotification(admin, req.target_provider_id, "pedido_direto", req.id);
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
  if (!conv) return;

  // Suporte tem outro destinatário e outro link — mesma porta de entrada.
  if (conv.type === "ticket") {
    await notifyTicketReply(admin, conversationId, uid);
    return;
  }

  if (conv.type !== "servico" || conv.chat_status !== "ativa") return;

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

/**
 * Resposta do suporte → avisa por e-mail quem abriu o chamado.
 *
 * O selo vermelho no menu (`UnreadNavBadge`) só resolve para quem está com o
 * site aberto; o chamado de suporte é justamente o caso em que a pessoa fecha
 * a aba e vai esperar. Era a segunda metade do pedido da parte 10:
 * "colocar um símbolo de notificação ali, **e das respostas por email**".
 *
 * Avisa SÓ o autor do chamado. O admin acompanha a fila pelo painel — mandar
 * e-mail a cada mensagem do cliente entulharia a caixa da equipe e ninguém
 * leria nenhum dos dois.
 */
async function notifyTicketReply(
  admin: ReturnType<typeof createAdminClient>,
  conversationId: string,
  senderId: string,
) {
  const { data: ticket } = await admin
    .from("tickets")
    .select("id, number, subject, opener_id")
    .eq("conversation_id", conversationId)
    .maybeSingle();
  // Sem ticket não há a quem avisar; e quem escreveu não recebe o próprio texto.
  if (!ticket || ticket.opener_id === senderId) return;

  if (await alreadyNotified(admin, ticket.opener_id, "suporte", conversationId, MESSAGE_COOLDOWN_MIN)) return;

  const destino = await contactOf(admin, ticket.opener_id);
  if (!destino) return;

  const area = destino.role === "prestador" ? "prestador" : "contratante";

  await sendEmailBestEffort({
    to: destino.email,
    subject: `O suporte respondeu seu chamado #${ticket.number} — Fixly`,
    html: serviceNotificationEmailHtml({
      name: destino.name,
      title: "O suporte respondeu",
      lead: `Seu chamado <b>#${ticket.number} — ${escapeHtml(String(ticket.subject ?? ""))}</b> tem uma resposta nova. Responda por aqui mesmo: o histórico do chamado fica registrado.`,
      cta: "Ver a resposta",
      // `siteUrl()`, não `APP_URL`: quem responde é o admin, e no serviço
      // `fixly-admin` a NEXT_PUBLIC_APP_URL aponta para o PAINEL — o link
      // sairia para fixly.fun/app/..., que responde 404 de propósito.
      url: `${siteUrl()}/app/${area}/suporte`,
    }),
  });
  await logNotification(admin, ticket.opener_id, "suporte", conversationId);
}

/**
 * Selo ganho ou perdido → avisa o profissional.
 *
 * Lê os eventos que o banco registrou (`seal_events`, migração 0028) e ainda
 * não foram avisados. Fica assim, e não num gatilho de e-mail dentro do
 * Postgres, porque o banco do Supabase não manda e-mail sozinho — e porque
 * assim uma falha de envio não desfaz a mudança do selo.
 *
 * Chamado depois de aprovar um serviço (é quando a nota muda) e depois de o
 * admin revogar/devolver o selo. Idempotente: marca `notified_at`.
 */
export async function notifySealChanges(profileId?: string) {
  const admin = createAdminClient();

  let q = admin
    .from("seal_events")
    .select("id, profile_id, gained, reason, created_at")
    .is("notified_at", null)
    .order("created_at", { ascending: true })
    .limit(20);
  if (profileId) q = q.eq("profile_id", profileId);

  const { data: eventos } = await q;
  for (const ev of eventos ?? []) {
    const destino = await contactOf(admin, ev.profile_id as string);
    if (!destino) continue;

    const { data: prof } = await admin
      .from("profiles")
      .select("seal_revoked_at")
      .eq("id", ev.profile_id)
      .maybeSingle();

    await sendEmailBestEffort({
      to: destino.email,
      subject: ev.gained ? "Você conquistou o Selo Fixly!" : "Sobre o seu Selo Fixly",
      html: sealEmailHtml({
        name: destino.name,
        gained: !!ev.gained,
        reason: ev.reason as string | null,
        revoked: !ev.gained && !!prof?.seal_revoked_at,
      }),
    });
    await admin.from("seal_events").update({ notified_at: new Date().toISOString() }).eq("id", ev.id);
  }
}
