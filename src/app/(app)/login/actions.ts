"use server";

import { headers } from "next/headers";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { appRole } from "@/lib/appRole";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import type { Role } from "@/lib/brand";

type LoginResult = {
  ok: boolean;
  error?: string;
  role?: Role;
  status?: string;
};

/** Resolve usuário→e-mail e autentica na mesma action; o e-mail nunca volta ao navegador. */
export async function loginWithIdentifier(input: {
  identifier: string;
  password: string;
  expectedRole: Role;
  remember: boolean;
}): Promise<LoginResult> {
  const requestHeaders = await headers();
  const ip = clientIp(requestHeaders);
  const rl = rateLimit(`login:${ip}`, 12, 15 * 60_000);
  if (!rl.ok) return { ok: false, error: "Muitas tentativas. Aguarde alguns minutos." };

  const identifier = input.identifier.trim();
  const serverRole = appRole(requestHeaders.get("host"));
  let email = identifier;

  if (!identifier || !input.password) return { ok: false, error: "Usuário/e-mail ou senha incorretos." };

  if (!identifier.includes("@")) {
    // Nome de usuário só existe no painel. No site público nem fazemos a busca
    // privilegiada, mesmo que alguém forje expectedRole no corpo da action.
    if (serverRole !== "admin") return { ok: false, error: "Usuário/e-mail ou senha incorretos." };
    const admin = createAdminClient();
    const { data } = await admin
      .from("profiles_private")
      .select("email")
      .ilike("username", identifier)
      .maybeSingle();
    if (!data?.email) return { ok: false, error: "Usuário/e-mail ou senha incorretos." };
    email = data.email;
  }

  const supabase = await createClient(input.remember);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: input.password });
  if (error || !data.user) return { ok: false, error: "Usuário/e-mail ou senha incorretos." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status, active")
    .eq("id", data.user.id)
    .single();

  const role = profile?.role as Role | undefined;
  const correctEnvironment = serverRole === "admin" ? role === "admin" : role !== "admin";
  if (!profile || !correctEnvironment || role !== input.expectedRole) {
    await supabase.auth.signOut();
    return { ok: false, error: "Usuário/e-mail ou senha incorretos." };
  }
  if (profile.active === false) {
    await supabase.auth.signOut();
    return { ok: false, error: "Esta conta está inativa. Fale com um administrador." };
  }

  return { ok: true, role, status: profile.status };
}
