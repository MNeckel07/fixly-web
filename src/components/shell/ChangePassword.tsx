"use client";

import { useState } from "react";
import { KeyRound, Check, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Field";
import { PasswordField } from "@/components/auth/PasswordField";
import { CodeInput } from "@/components/auth/CodeInput";
import { requestPasswordChangeCode, changePassword } from "@/app/(app)/app/senha.actions";

/** Trocar senha estando logado — com confirmação por código no e-mail. */
export function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"inicio" | "codigo" | "pronto">("inicio");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [devCode, setDevCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function sendCode() {
    if (!current) return setError("Informe sua senha atual.");
    if (!next) return setError("Informe a nova senha.");
    if (next !== confirm) return setError("A senha e a confirmação não são iguais.");
    setError("");
    setBusy(true);
    const res = await requestPasswordChangeCode();
    setBusy(false);
    if (!res.ok) return setError(res.error ?? "Não foi possível enviar o código.");
    setEmail(res.email ?? "");
    setDevCode(res.devCode ?? "");
    setStep("codigo");
  }

  async function save(value?: string) {
    const c = (value ?? code).replace(/\D/g, "");
    if (c.length !== 6) return setError("Digite os 6 dígitos do código.");
    setError("");
    setBusy(true);
    const res = await changePassword(current, c, next, confirm);
    setBusy(false);
    if (!res.ok) return setError(res.error ?? "Não foi possível trocar a senha.");
    setStep("pronto");
    setCurrent(""); setNext(""); setConfirm(""); setCode("");
  }

  if (!open) {
    return (
      <div className="max-w-lg mx-auto mt-4">
        <button
          onClick={() => { setOpen(true); setStep("inicio"); setError(""); }}
          className="w-full flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-6 py-4 text-left hover:bg-black/[0.02] transition"
        >
          <KeyRound className="h-5 w-5 text-primary-dark shrink-0" />
          <span>
            <span className="block font-semibold text-ink">Trocar minha senha</span>
            <span className="block text-xs text-gray-light">Confirmação por código no seu e-mail</span>
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto mt-4 bg-white rounded-2xl border border-black/5 p-6">
      {step === "pronto" ? (
        <div className="text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success/10 text-success mx-auto">
            <Check className="h-6 w-6" />
          </div>
          <h2 className="font-semibold text-ink mt-3">Senha alterada!</h2>
          <p className="text-sm text-gray mt-1">Use a nova senha no próximo login.</p>
          <Button variant="outline" className="mt-4" onClick={() => setOpen(false)}>Fechar</Button>
        </div>
      ) : step === "codigo" ? (
        <div className="text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary-dark mx-auto">
            <MailCheck className="h-6 w-6" />
          </div>
          <h2 className="font-semibold text-ink mt-3">Confirme pelo e-mail</h2>
          <p className="text-sm text-gray mt-1">
            Enviamos um código para <b className="text-ink">{email}</b>.
          </p>
          <div className="mt-5">
            <CodeInput value={code} onChange={setCode} onComplete={(v) => save(v)} disabled={busy} />
          </div>
          {devCode && (
            <p className="mt-4 text-xs text-warning bg-warning/10 rounded-lg px-3 py-2">
              Não conseguimos enviar o e-mail agora — use este código: <b>{devCode}</b>
            </p>
          )}
          {error && <p className="mt-4 text-sm text-danger">{error}</p>}
          <div className="flex gap-2 mt-5">
            <Button variant="outline" fullWidth onClick={() => { setStep("inicio"); setError(""); }}>Voltar</Button>
            <Button fullWidth loading={busy} onClick={() => save()}>Salvar nova senha</Button>
          </div>
        </div>
      ) : (
        <>
          <h2 className="font-semibold text-ink">Trocar senha</h2>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Senha atual</Label>
              <PasswordField value={current} onChange={setCurrent} autoComplete="current-password" />
            </div>
            <div>
              <Label>Nova senha</Label>
              <PasswordField value={next} onChange={setNext} showStrength autoComplete="new-password" placeholder="crie uma senha forte" />
            </div>
            <div>
              <Label>Confirme a nova senha</Label>
              <PasswordField value={confirm} onChange={setConfirm} autoComplete="new-password" placeholder="repita a senha" />
              {confirm.length > 0 && confirm !== next && (
                <p className="text-xs text-danger mt-1.5">As senhas não são iguais.</p>
              )}
            </div>
          </div>
          {error && <p className="mt-4 text-sm text-danger">{error}</p>}
          <div className="flex gap-2 mt-5">
            <Button variant="outline" fullWidth onClick={() => setOpen(false)}>Cancelar</Button>
            <Button fullWidth loading={busy} onClick={sendCode}>Enviar código</Button>
          </div>
        </>
      )}
    </div>
  );
}
