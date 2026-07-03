import "server-only";
import type { Role } from "./brand";
import { ROLE_LABELS } from "./brand";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** Template HTML moderno do e-mail de aprovação de cadastro. */
export function approvalEmailHtml(name: string, role: Role) {
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

/** Envia e-mail via Resend. Sem RESEND_API_KEY, apenas registra (modo preview). */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Fixly <onboarding@resend.dev>";

  if (!key) {
    console.log(
      `\n[E-MAIL PREVIEW — RESEND_API_KEY não configurada]\n  Para: ${opts.to}\n  Assunto: ${opts.subject}\n  (HTML gerado com sucesso — configure RESEND_API_KEY para enviar de verdade)\n`,
    );
    return { previewed: true };
  }

  const { Resend } = await import("resend");
  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });
  if (error) throw new Error(error.message);
  return { sent: true };
}
