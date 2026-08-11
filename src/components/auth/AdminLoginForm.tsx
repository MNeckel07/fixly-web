"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { writeRemember } from "@/lib/session";
import { resolveLoginEmail } from "@/app/login/actions";

/**
 * Login do PAINEL (fixly.fun) — tela própria, propositalmente seca.
 *
 * Nada de vitrine aqui: sem o painel de marca da esquerda, sem o efeito de
 * digitação, sem "Cadastre-se", sem escolher perfil. Quem chega nesta tela já
 * sabe o que veio fazer, e cada elemento a mais seria: (a) ruído para a equipe,
 * (b) informação de graça para quem topou com o endereço por acaso.
 *
 * O papel é fixo em `admin` — a conta que não for da equipe é recusada e tem a
 * sessão encerrada na hora.
 */
export function AdminLoginForm({ siteUrl }: { siteUrl: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // grava a preferência ANTES de criar o cliente: é ela que define se os
    // cookies da sessão vão com validade longa ou só até fechar o navegador
    writeRemember(remember);
    const supabase = createClient();

    const loginEmail = email.includes("@") ? email : await resolveLoginEmail(email);
    if (!loginEmail) {
      setError("Usuário ou senha incorretos.");
      setLoading(false);
      return;
    }

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    });
    if (signInError || !data.user) {
      setError("Usuário/e-mail ou senha incorretos.");
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, status, active")
      .eq("id", data.user.id)
      .single();

    // Conta que não é da equipe não fica com sessão aberta neste domínio —
    // é o que dá sentido a separar os ambientes.
    if (!profile || profile.role !== "admin") {
      await supabase.auth.signOut();
      setError(`Esta área é restrita à equipe Fixly. Clientes e profissionais entram em ${siteUrl.replace(/^https?:\/\//, "")}.`);
      setLoading(false);
      return;
    }
    if (profile.active === false || profile.status !== "aprovado") {
      await supabase.auth.signOut();
      setError("Esta conta está inativa. Fale com um administrador.");
      setLoading(false);
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm">
      <div className="flex items-center gap-2.5 mb-6">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-ink">
          <ShieldCheck className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <div>
          <h1 className="text-lg font-bold text-ink leading-tight">Painel Fixly</h1>
          <p className="text-xs text-gray-light">Acesso restrito à equipe</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label>E-mail ou usuário</Label>
          <Input
            type="text"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="usuário ou voce@email.com"
            autoComplete="username"
          />
        </div>

        <div>
          <Label>Senha</Label>
          <div className="relative">
            <Input
              type={showPass ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-light hover:text-ink"
            >
              {showPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-danger bg-danger/5 rounded-lg px-3 py-2">{error}</p>
        )}

        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 accent-[#FFC107] cursor-pointer"
          />
          <span className="text-sm text-ink">Ficar conectado</span>
        </label>

        <Button type="submit" size="lg" fullWidth loading={loading}>
          Entrar
        </Button>

        <p className="text-center">
          <Link href="/recuperar-senha" className="text-sm font-semibold text-primary-dark hover:underline">
            Esqueci minha senha
          </Link>
        </p>
      </form>
    </div>
  );
}
