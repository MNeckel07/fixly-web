"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Home, Wrench, ShieldCheck, Eye, EyeOff, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { ROLE_HOME, ROLE_LABELS, type Role } from "@/lib/brand";

const ROLES: { role: Role; icon: LucideIcon; hint: string }[] = [
  { role: "contratante", icon: Home, hint: "Preciso de um serviço" },
  { role: "prestador", icon: Wrench, hint: "Quero prestar serviços" },
  { role: "admin", icon: ShieldCheck, hint: "Equipe Fixly" },
];

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [role, setRole] = useState<Role>("contratante");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
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
    const supabase = createClient();

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !data.user) {
      setError("E-mail ou senha incorretos.");
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

      {/* Seleção de papel */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        {ROLES.map((r) => {
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
          <Label>E-mail</Label>
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
            autoComplete="email"
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

        <Button type="submit" size="lg" fullWidth loading={loading}>
          Entrar como {ROLE_LABELS[role]}
        </Button>
      </form>
    </div>
  );
}
