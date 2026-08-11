"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Home, Wrench, ShieldCheck, Eye, EyeOff, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { ROLE_HOME, ROLE_LABELS, type Role } from "@/lib/brand";
import { writeRemember } from "@/lib/session";
import { resolveLoginEmail } from "@/app/login/actions";

const ROLES: { role: Role; icon: LucideIcon; hint: string }[] = [
  { role: "contratante", icon: Home, hint: "Preciso de um serviço" },
  { role: "prestador", icon: Wrench, hint: "Quero prestar serviços" },
  { role: "admin", icon: ShieldCheck, hint: "Equipe Fixly" },
];

export function LoginForm({
  ambiente = "site",
  outroEndereco = "",
}: {
  /** Papel deste servidor: o site público ou o painel da equipe. */
  ambiente?: "site" | "admin";
  /** Endereço do outro ambiente, para orientar quem errou a porta. */
  outroEndereco?: string;
} = {}) {
  const router = useRouter();
  const params = useSearchParams();

  // No painel só existe o perfil da equipe; no site público, só os dois do
  // produto. Separar os ambientes começa por não oferecer a porta errada.
  const perfis = ROLES.filter((r) => (ambiente === "admin" ? r.role === "admin" : r.role !== "admin"));
  const [role, setRole] = useState<Role>(ambiente === "admin" ? "admin" : "contratante");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(
    params.get("erro") === "papel"
      ? "Essa conta não pertence ao perfil selecionado."
      : "",
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    // grava a preferência ANTES de criar o cliente: é ela que define se os
    // cookies da sessão vão com validade longa ou só até fechar o navegador
    writeRemember(remember);
    const supabase = createClient();

    // admin pode entrar por usuário ou e-mail; demais, por e-mail
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
      .select("role, status")
      .eq("id", data.user.id)
      .single();

    if (!profile) {
      setError("Perfil não encontrado. Complete seu cadastro.");
      setLoading(false);
      return;
    }
    /**
     * Porta errada: conta de admin não entra pelo site público, e conta de
     * cliente/profissional não entra pelo painel. A sessão é encerrada na hora
     * — deixá-la de pé no domínio errado esvaziaria o motivo de separar os
     * ambientes. (A barreira de verdade é o proxy, que responde 404; isto aqui
     * é para a pessoa entender o que fazer.)
     */
    const pertence = ambiente === "admin" ? profile.role === "admin" : profile.role !== "admin";
    if (!pertence) {
      await supabase.auth.signOut();
      setError(
        ambiente === "admin"
          ? `Esta é a área da equipe Fixly. Contas de ${ROLE_LABELS[profile.role as Role]} entram em ${outroEndereco || "fixly.company"}.`
          : `Contas da equipe Fixly entram pelo painel administrativo${outroEndereco ? ` em ${outroEndereco}` : ""}, não por aqui.`,
      );
      setLoading(false);
      return;
    }

    if (profile.role !== role) {
      await supabase.auth.signOut();
      setError(
        `Esta conta é de ${ROLE_LABELS[profile.role as Role]}. Selecione o perfil correto.`,
      );
      setLoading(false);
      return;
    }
    if (profile.status !== "aprovado") {
      router.push("/aguardando");
      return;
    }
    router.push(ROLE_HOME[role]);
    router.refresh();
  }

  return (
    <div className="animate-fade-up">
      <h2 className="text-2xl font-bold text-ink">Entrar</h2>
      <p className="text-gray mt-1 mb-6">Escolha seu perfil e acesse a conta.</p>

      {/* Seleção de papel — no painel sobra só "Equipe Fixly" */}
      <div className={`grid gap-2 mb-6 ${perfis.length === 1 ? "grid-cols-1" : perfis.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
        {perfis.map((r) => {
          const active = role === r.role;
          const Icon = r.icon;
          return (
            <button
              key={r.role}
              type="button"
              onClick={() => setRole(r.role)}
              className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 transition ${
                active
                  ? "border-primary bg-primary/10 ring-2 ring-primary/25"
                  : "border-black/10 bg-white hover:bg-black/[0.02]"
              }`}
            >
              <Icon className={`h-6 w-6 ${active ? "text-primary-dark" : "text-gray"}`} strokeWidth={1.75} />
              <span className="text-[13px] font-semibold text-ink">
                {ROLE_LABELS[r.role]}
              </span>
              <span className="text-[11px] text-gray-light leading-tight text-center">
                {r.hint}
              </span>
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label>{role === "admin" ? "E-mail ou usuário" : "E-mail"}</Label>
          <Input
            type="text"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={role === "admin" ? "usuário ou voce@email.com" : "voce@email.com"}
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
          <p className="text-sm text-danger bg-danger/5 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Ficar conectado: mantém a sessão depois de fechar o navegador */}
        <label className="flex items-start gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#FFC107] cursor-pointer"
          />
          <span className="text-sm text-ink">
            Ficar conectado
            <span className="block text-xs text-gray-light">
              Você entra direto na próxima vez, sem digitar e-mail e senha.
            </span>
          </span>
        </label>

        <Button type="submit" size="lg" fullWidth loading={loading}>
          Entrar como {ROLE_LABELS[role]}
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
