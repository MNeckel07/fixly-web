import "server-only";
import type { Role } from "./brand";
import { ROLE_LABELS } from "./brand";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * E-mail de "conta liberada", enviado no instante em que o admin aprova.
 * Leva o e-mail de acesso (o mesmo que a pessoa cadastrou) e o link de login —
 * o pedido do dono era que desse para entrar direto daqui.
 */
export function approvalEmailHtml(name: string, role: Role, loginEmail?: string) {
  const firstName = name.split(" ")[0];
  const cta =
    role === "prestador"
      ? "Começar a receber pedidos"
      : "Encontrar profissionais";
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Cadastro aprovado — Fixly</title></head>
<body style="margin:0;background:#FAFAFA;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1F2329">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px">
    <div style="text-align:center;padding:8px 0 24px">
      <span style="font-size:28px;font-weight:700;color:#1F2329">Fi<span style="color:#FFC107">x</span>ly</span>
    </div>
    <div style="background:#FFFFFF;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px -8px rgba(31,35,41,.12)">
      <div style="background:linear-gradient(135deg,#FFC107,#E6A800);padding:40px 32px;text-align:center">
        <div style="width:72px;height:72px;margin:0 auto 16px;background:rgba(255,255,255,.25);border-radius:50%;display:flex;align-items:center;justify-content:center"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#1F2329" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></div>
        <h1 style="margin:0;color:#1F2329;font-size:24px">Cadastro aprovado!</h1>
      </div>
      <div style="padding:32px">
        <p style="font-size:16px;line-height:1.6;margin:0 0 16px">Olá, <b>${firstName}</b>!</p>
        <p style="font-size:16px;line-height:1.6;color:#4A4A4A;margin:0 0 16px">
          Ótimas notícias: seu cadastro como <b>${ROLE_LABELS[role]}</b> foi
          <b style="color:#16A34A">aprovado</b> pela nossa equipe. Sua conta já está ativa
          e pronta para uso.
        </p>
        ${loginEmail
          ? `<div style="background:#FAFAFA;border:1px solid rgba(31,35,41,.08);border-radius:12px;padding:16px 20px;margin:0 0 8px">
               <p style="margin:0 0 4px;font-size:12px;letter-spacing:.06em;color:#9AA0A8;text-transform:uppercase">Entre com</p>
               <p style="margin:0;font-size:16px;font-weight:700;color:#1F2329">${loginEmail}</p>
               <p style="margin:6px 0 0;font-size:13px;color:#5B616B">e a senha que você criou no cadastro.</p>
             </div>`
          : ""}
        <div style="text-align:center;margin:28px 0">
          <a href="${APP_URL}/login" style="display:inline-block;background:#FFC107;color:#1F2329;text-decoration:none;font-weight:700;font-size:16px;padding:14px 32px;border-radius:12px">${cta} →</a>
        </div>
        <div style="background:#FAFAFA;border-radius:12px;padding:16px 20px;margin-top:8px">
          <p style="margin:0;font-size:14px;color:#5B616B">
            ${role === "prestador"
              ? "Deixe seu perfil online para começar a receber propostas de serviço na sua região."
              : "Já pode solicitar seu primeiro serviço com preço estimado na hora."}
          </p>
        </div>
      </div>
    </div>
    <p style="text-align:center;color:#9AA0A8;font-size:12px;margin-top:24px">
      Você recebeu este e-mail porque se cadastrou no Fixly.<br>Fixly © ${new Date().getFullYear()}
    </p>
  </div>
</body></html>`;
}

/**
 * Aviso de movimento no serviço (proposta, contra-proposta, convite de conversa,
 * mensagem nova). Um template só, porque o que muda é o texto — e-mail de
 * notificação que vira cinco arquivos diferentes é e-mail que ninguém mantém.
 */
export function serviceNotificationEmailHtml(opts: {
  name: string;
  title: string;
  lead: string;
  highlight?: string;
  cta: string;
  url: string;
}) {
  const firstName = opts.name.split(" ")[0];
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${opts.title} — Fixly</title></head>
<body style="margin:0;background:#FAFAFA;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1F2329">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px">
    <div style="text-align:center;padding:8px 0 24px">
      <span style="font-size:28px;font-weight:700;color:#1F2329">Fi<span style="color:#FFC107">x</span>ly</span>
    </div>
    <div style="background:#FFFFFF;border-radius:20px;padding:32px;box-shadow:0 4px 24px -8px rgba(31,35,41,.12)">
      <h1 style="font-size:22px;margin:0 0 12px">${opts.title}</h1>
      <p style="font-size:15px;line-height:1.6;color:#4A4A4A;margin:0 0 8px">Olá, <b>${firstName}</b>!</p>
      <p style="font-size:15px;line-height:1.6;color:#4A4A4A;margin:0">${opts.lead}</p>
      ${opts.highlight
        ? `<div style="background:#FFFBEB;border-radius:12px;padding:16px 20px;margin:20px 0;text-align:center">
             <p style="margin:0;font-size:20px;font-weight:700;color:#1F2329">${opts.highlight}</p>
           </div>`
        : ""}
      <div style="text-align:center;margin:26px 0 6px">
        <a href="${opts.url}" style="display:inline-block;background:#FFC107;color:#1F2329;text-decoration:none;font-weight:700;font-size:15px;padding:14px 30px;border-radius:12px">${opts.cta} →</a>
      </div>
      <p style="font-size:13px;color:#9AA0A8;margin:18px 0 0">
        Toda a negociação acontece dentro do Fixly — é o que garante o pagamento
        protegido e o histórico da conversa para os dois lados.
      </p>
    </div>
    <p style="text-align:center;color:#9AA0A8;font-size:12px;margin-top:24px">Fixly © ${new Date().getFullYear()}</p>
  </div>
</body></html>`;
}

export function rejectionEmailHtml(name: string, role: Role, reason?: string) {
  const firstName = name.split(" ")[0];
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#FAFAFA;font-family:'Segoe UI',Roboto,Arial,sans-serif;color:#1F2329">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px">
    <div style="text-align:center;padding:8px 0 24px">
      <span style="font-size:28px;font-weight:700">Fi<span style="color:#FFC107">x</span>ly</span>
    </div>
    <div style="background:#FFFFFF;border-radius:20px;padding:32px;box-shadow:0 4px 24px -8px rgba(31,35,41,.12)">
      <h1 style="font-size:22px;margin:0 0 12px">Sobre o seu cadastro</h1>
      <p style="font-size:16px;line-height:1.6;color:#4A4A4A">
        Olá, <b>${firstName}</b>. Após a análise, não foi possível aprovar seu
        cadastro como <b>${ROLE_LABELS[role]}</b> neste momento.
      </p>
      ${reason ? `<div style="background:#FEF2F2;border-radius:12px;padding:14px 18px;margin:16px 0"><p style="margin:0;font-size:14px;color:#DC2626"><b>Motivo:</b> ${reason}</p></div>` : ""}
      <p style="font-size:15px;line-height:1.6;color:#4A4A4A">
        Você pode revisar seus documentos e enviar um novo cadastro a qualquer momento.
      </p>
      <div style="text-align:center;margin-top:24px">
        <a href="${APP_URL}/cadastro" style="display:inline-block;background:#1F2329;color:#fff;text-decoration:none;font-weight:600;padding:12px 28px;border-radius:12px">Refazer cadastro</a>
      </div>
    </div>
  </div>
</body></html>`;
}

/**
 * E-mail com o código de verificação (cadastro ou recuperação de senha).
 * O código aparece grande e separado por dígitos, para ler no celular.
 */
export function verificationCodeEmailHtml(
  code: string,
  purpose: "cadastro" | "recuperacao",
  minutes: number,
) {
  const isSignup = purpose === "cadastro";
  const title = isSignup ? "Confirme seu e-mail" : "Redefinir sua senha";
  const lead = isSignup
    ? "Use o código abaixo para confirmar que este e-mail é seu e concluir seu cadastro no Fixly."
    : "Use o código abaixo para criar uma nova senha da sua conta Fixly.";
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${title} — Fixly</title></head>
<body style="margin:0;background:#FAFAFA;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1F2329">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px">
    <div style="text-align:center;padding:8px 0 24px">
      <span style="font-size:28px;font-weight:700;color:#1F2329">Fi<span style="color:#FFC107">x</span>ly</span>
    </div>
    <div style="background:#FFFFFF;border-radius:20px;padding:32px;box-shadow:0 4px 24px -8px rgba(31,35,41,.12)">
      <h1 style="font-size:22px;margin:0 0 12px">${title}</h1>
      <p style="font-size:15px;line-height:1.6;color:#4A4A4A;margin:0 0 24px">${lead}</p>
      <div style="background:#FAFAFA;border:1px solid rgba(31,35,41,.08);border-radius:16px;padding:22px;text-align:center">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;color:#9AA0A8;text-transform:uppercase">Seu código</p>
        <p style="margin:0;font-size:40px;font-weight:800;letter-spacing:.22em;color:#1F2329">${code}</p>
      </div>
      <p style="font-size:14px;color:#5B616B;margin:22px 0 0">
        O código vale por <b>${minutes} minutos</b> e só pode ser usado uma vez.
      </p>
      <div style="background:#FFFBEB;border-radius:12px;padding:14px 18px;margin-top:18px">
        <p style="margin:0;font-size:13px;color:#8A6100">
          Não foi você que pediu? Ignore este e-mail — ${isSignup ? "nenhuma conta será criada" : "sua senha continua a mesma"}.
          <b>Nunca compartilhe este código.</b>
        </p>
      </div>
    </div>
    <p style="text-align:center;color:#9AA0A8;font-size:12px;margin-top:24px">Fixly © ${new Date().getFullYear()}</p>
  </div>
</body></html>`;
}

/* ─────────────────────────── envio ─────────────────────────── */

/**
 * ENVIO DE E-MAIL — Brevo (API HTTP) com Resend como alternativa.
 *
 * Por que Brevo primeiro: é o provedor que a DVN já usa no sistema-producao
 * (`backend/app/mailer.py`), com a conta pronta, e o plano gratuito dela dá
 * **300 e-mails/dia** contra 100/dia da Resend — código de verificação chega em
 * rajada, então o teto DIÁRIO é o que aperta.
 *
 * ⚠️ Só API HTTP, nunca SMTP: o **Render bloqueia as portas SMTP (25/465/587)
 * nos serviços gratuitos**, então uma conexão SMTP simplesmente estoura o tempo.
 * As duas APIs aqui falam HTTPS na 443, que passa. (Armadilha descoberta no
 * sistema-producao — está documentada lá também.)
 *
 * Variáveis (qualquer um dos dois caminhos resolve):
 *   BREVO_API_KEY  + EMAIL_FROM   → recomendado (reaproveita a conta da DVN)
 *   RESEND_API_KEY + EMAIL_FROM   → alternativa
 */

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

/** Separa "Fixly <nao-responda@fixly.company>" em nome e endereço. */
function parseFrom(raw: string): { name: string; email: string } {
  const m = raw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1] || "Fixly", email: m[2].trim() };
  return { name: "Fixly", email: raw.trim() };
}

export function emailProvider(): "brevo" | "resend" | null {
  if (process.env.BREVO_API_KEY) return "brevo";
  if (process.env.RESEND_API_KEY) return "resend";
  return null;
}

async function sendViaBrevo(opts: { to: string; subject: string; html: string }, from: string) {
  const sender = parseFrom(from);
  const res = await fetch(BREVO_URL, {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY!,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender,
      // destinatário único e direto no `to` (sem bcc): é transacional, o cliente
      // precisa ver o próprio endereço, e bcc piora a entrega
      to: [{ email: opts.to }],
      subject: opts.subject,
      htmlContent: opts.html,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    // o corpo traz o motivo real (remetente não verificado, chave inválida,
    // cota do dia estourada) — sem ele o erro é inútil para diagnosticar
    const detail = await res.text().catch(() => "");
    throw new Error(`Brevo recusou o envio (HTTP ${res.status}): ${detail.slice(0, 300)}`);
  }
}

async function sendViaResend(opts: { to: string; subject: string; html: string }, from: string) {
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY!);
  const { error } = await resend.emails.send({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });
  if (error) throw new Error(error.message);
}

/**
 * Envia e-mail CRÍTICO — aquele em que o fluxo não faz sentido sem a mensagem
 * chegar (código de verificação).
 *
 * **Falha alto de propósito:** se não há como enviar, o usuário precisa ver um
 * erro, não ficar esperando um código eterno. Para aviso que não pode derrubar a
 * operação, use `sendEmailBestEffort`.
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}) {
  const from = process.env.EMAIL_FROM ?? "Fixly <onboarding@resend.dev>";
  const provider = emailProvider();

  if (!provider) {
    console.log(
      `\n[E-MAIL PREVIEW — nenhum provedor configurado]\n  Para: ${opts.to}\n  Assunto: ${opts.subject}\n  (HTML gerado com sucesso — configure BREVO_API_KEY ou RESEND_API_KEY para enviar de verdade)\n`,
    );
    // Modo de teste (código na tela): seguir em frente é o comportamento certo.
    if (process.env.EMAIL_DEV_CODES === "1") return { previewed: true };
    // Sem provedor e sem modo de teste, NÃO fingir sucesso.
    throw new Error(
      "O envio de e-mails ainda não está configurado no servidor. Avise a equipe do Fixly.",
    );
  }

  if (provider === "brevo") await sendViaBrevo(opts, from);
  else await sendViaResend(opts, from);
  return { sent: true, provider };
}

/**
 * Envia um e-mail de AVISO (aprovação/reprovação de cadastro, notificações).
 *
 * Nunca derruba a operação: aprovar um cadastro tem que funcionar mesmo que o
 * e-mail falhe — a aprovação já foi gravada no banco, e estourar aqui faria o
 * admin ver erro numa ação que deu certo. A falha vai para o log.
 */
export async function sendEmailBestEffort(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ sent: boolean; error?: string }> {
  try {
    await sendEmail(opts);
    return { sent: true };
  } catch (e: any) {
    console.error(`[E-MAIL] falha ao enviar "${opts.subject}" para ${opts.to}:`, e?.message ?? e);
    return { sent: false, error: e?.message };
  }
}
