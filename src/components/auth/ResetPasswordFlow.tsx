"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, KeyRound, MailCheck, RefreshCw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { Logo } from "@/components/ui/Logo";
import { PasswordField } from "@/components/auth/PasswordField";
import { CodeInput } from "@/components/auth/CodeInput";
import { requestResetCode, confirmResetCode, resetPassword } from "@/app/recuperar-senha/actions";

type Step = "email" | "codigo" | "senha" | "pronto";

/** Recuperação de senha em 3 passos, com confirmação por código no e-mail. */
export function ResetPasswordFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [devCode, setDevCode] = useState("");
  const [resent, setResent] = useState(false);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setError("");
    setLoading(true);
    const res = await requestResetCode(email);
    setLoading(false);
    if (!res.ok) return setError(res.error ?? "Não foi possível enviar o código.");
    setDevCode(res.devCode ?? "");
    setCode("");
    setStep("codigo");
  }

  async function resend() {
    setError("");
    setLoading(true);
    const res = await requestResetCode(email);
    setLoading(false);
    if (!res.ok) return setError(res.error ?? "Não foi possível reenviar.");
    setDevCode(res.devCode ?? "");
    setResent(true);
    setTimeout(() => setResent(false), 4000);
  }

  async function checkCode(value?: string) {
    const c = (value ?? code).replace(/\D/g, "");
    if (c.length !== 6) return setError("Digite os 6 dígitos do código.");
    setError("");
    setLoading(true);
    const res = await confirmResetCode(email, c);
    setLoading(false);
    if (!res.ok || !res.token) return setError(res.error ?? "Código inválido.");
    setToken(res.token);
    setStep("senha");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await resetPassword(email, token, password, confirm);
    setLoading(false);
    if (!res.ok) return setError(res.error ?? "Não foi possível trocar a senha.");
    setStep("pronto");
  }

  return (
    <div className="flex flex-1 min-h-screen flex-col items-center justify-center bg-canvas px-6 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-8">
          <Logo size={26} variant="dark" />
          <Link href="/login" className="inline-flex items-center gap-1 text-sm text-gray hover:text-ink">
            <ArrowLeft className="h-4 w-4" /> Voltar ao login
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-black/5 p-6">
          {/* ── 1) e-mail ── */}
          {step === "email" && (
            <form onSubmit={sendCode}>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary-dark">
                <KeyRound className="h-7 w-7" strokeWidth={1.75} />
              </div>
              <h1 className="text-xl font-bold text-ink mt-4">Esqueceu a senha?</h1>
              <p className="text-gray text-sm mt-1.5 mb-5">
                Informe o e-mail da sua conta. Enviaremos um código de 6 dígitos para confirmar que é você.
              </p>
              <Label>E-mail</Label>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" autoComplete="email" />
              {error && <p className="mt-4 text-sm text-danger bg-danger/5 rounded-lg px-4 py-3">{error}</p>}
              <div className="mt-5">
                <Button type="submit" size="lg" fullWidth loading={loading}>Enviar código</Button>
              </div>
            </form>
          )}

          {/* ── 2) código ── */}
          {step === "codigo" && (
            <div className="text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary-dark mx-auto">
                <MailCheck className="h-7 w-7" strokeWidth={1.75} />
              </div>
              <h1 className="text-xl font-bold text-ink mt-4">Digite o código</h1>
              <p className="text-gray text-sm mt-1.5">
                Se existe uma conta com <b className="text-ink">{email}</b>, o código chegou lá.
              </p>
              <div className="mt-6">
                <CodeInput value={code} onChange={setCode} onComplete={(v) => checkCode(v)} disabled={loading} />
              </div>
              {devCode && (
                <p className="mt-4 text-xs text-warning bg-warning/10 rounded-lg px-3 py-2">
                  Modo de teste (e-mail não configurado) — seu código é <b>{devCode}</b>
                </p>
              )}
              {error && <p className="mt-4 text-sm text-danger bg-danger/5 rounded-lg px-4 py-3">{error}</p>}
              {resent && !error && <p className="mt-4 text-sm text-success">Código reenviado.</p>}
              <div className="mt-6 space-y-3">
                <Button size="lg" fullWidth loading={loading} onClick={() => checkCode()}>Confirmar código</Button>
                <div className="flex items-center justify-center gap-4 text-sm">
                  <button type="button" onClick={resend} disabled={loading} className="inline-flex items-center gap-1.5 text-primary-dark font-medium hover:underline disabled:opacity-50">
                    <RefreshCw className="h-3.5 w-3.5" /> Reenviar
                  </button>
                  <span className="text-gray-light">·</span>
                  <button type="button" onClick={() => { setStep("email"); setError(""); }} className="text-gray hover:text-ink">
                    Corrigir e-mail
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── 3) nova senha ── */}
          {step === "senha" && (
            <form onSubmit={save}>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary-dark">
                <KeyRound className="h-7 w-7" strokeWidth={1.75} />
              </div>
              <h1 className="text-xl font-bold text-ink mt-4">Crie uma nova senha</h1>
              <p className="text-gray text-sm mt-1.5 mb-5">E-mail confirmado. Agora defina a senha nova.</p>
              <div className="space-y-4">
                <div>
                  <Label>Nova senha</Label>
                  <PasswordField value={password} onChange={setPassword} showStrength autoComplete="new-password" placeholder="crie uma senha forte" />
                </div>
                <div>
                  <Label>Confirme a nova senha</Label>
                  <PasswordField value={confirm} onChange={setConfirm} autoComplete="new-password" placeholder="repita a senha" />
                  {confirm.length > 0 && confirm !== password && (
                    <p className="text-xs text-danger mt-1.5">As senhas não são iguais.</p>
                  )}
                </div>
              </div>
              {error && <p className="mt-4 text-sm text-danger bg-danger/5 rounded-lg px-4 py-3">{error}</p>}
              <div className="mt-5">
                <Button type="submit" size="lg" fullWidth loading={loading}>Salvar nova senha</Button>
              </div>
            </form>
          )}

          {/* ── 4) pronto ── */}
          {step === "pronto" && (
            <div className="text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success/10 text-success mx-auto">
                <CheckCircle2 className="h-7 w-7" strokeWidth={1.75} />
              </div>
              <h1 className="text-xl font-bold text-ink mt-4">Senha alterada!</h1>
              <p className="text-gray text-sm mt-1.5 mb-5">Já pode entrar com a nova senha.</p>
              <Button size="lg" fullWidth onClick={() => router.push("/login")}>Ir para o login</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
