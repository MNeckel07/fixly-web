import { Suspense } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { appRole, adminUrl, siteUrl } from "@/lib/appRole";
import { Logo } from "@/components/ui/Logo";
import { LoginForm } from "@/components/auth/LoginForm";
import { AdminLoginForm } from "@/components/auth/AdminLoginForm";
import { ServiceTypewriter } from "@/components/auth/ServiceTypewriter";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/brand";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; next?: string }>;
}) {
  const { erro } = await searchParams;

  const ambiente = appRole((await headers()).get("host"));
  const outroEndereco = ambiente === "admin" ? siteUrl() : adminUrl();

  // "Ficar conectado": quem já tem sessão válida entra direto, sem passar pelo
  // formulário. Não vale quando vem com `?erro=` (papel errado / conta inativa),
  // senão o aviso nunca aparece.
  //
  // ⚠️ Só redireciona se o papel da conta pertencer a ESTE ambiente: no painel,
  // mandar um contratante para /app/contratante cairia no 404 do proxy.
  if (!erro) {
    const { profile } = await getProfile();
    const pertence = profile && (ambiente === "admin" ? profile.role === "admin" : profile.role !== "admin");
    if (profile && pertence && profile.active !== false && profile.status === "aprovado") {
      redirect(ROLE_HOME[profile.role]);
    }
  }

  /**
   * PAINEL — tela própria, sem nada de vitrine.
   * Sai antes de consultar o catálogo de categorias: o painel não precisa
   * dessa query, e cada dado a menos nesta tela é um dado a menos exposto a
   * quem topou com o endereço por acaso.
   */
  if (ambiente === "admin") {
    return (
      <main className="flex flex-1 min-h-screen items-center justify-center bg-canvas p-6">
        <div className="w-full max-w-sm">
          <Suspense fallback={<div className="h-80" />}>
            <AdminLoginForm siteUrl={outroEndereco} />
          </Suspense>
        </div>
      </main>
    );
  }

  // todas as categorias cadastradas (leitura pública via RLS cat_read)
  const supabase = await createClient();
  const { data: cats } = await supabase
    .from("service_categories")
    .select("name")
    .eq("hidden", false)
    .order("featured", { ascending: false })
    .order("name");
  const services = (cats ?? []).map((c) => c.name);

  return (
    <div className="flex flex-1 min-h-screen">
      {/* Painel de marca (esquerda) */}
      <aside className="hidden lg:flex w-[44%] flex-col justify-between bg-ink p-12 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-0 -left-16 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <Logo size={34} />
        <div className="relative max-w-xl">
          <h1 className="text-white text-4xl font-bold leading-tight">
            Serviços da sua casa,
            <br />
            resolvidos em minutos.
          </h1>
          <p className="text-white/60 mt-4 text-lg">
            Uma plataforma, três experiências: quem contrata, quem executa e
            quem administra.
          </p>
          <div className="mt-8">
            <ServiceTypewriter services={services} />
          </div>
        </div>
        <p className="text-white/30 text-sm relative">
          Fixly © {new Date().getFullYear()} — Ambiente de demonstração
        </p>
      </aside>

      {/* Formulário (direita) */}
      <main className="flex-1 flex items-center justify-center p-6 bg-canvas">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <Logo size={28} variant="dark" />
          </div>
          <Suspense fallback={<div className="h-96" />}>
            <LoginForm ambiente={ambiente} outroEndereco={outroEndereco} />
          </Suspense>
          <p className="text-center text-sm text-gray mt-8">
            Não tem conta?{" "}
            <Link href="/cadastro" className="text-primary-dark font-semibold">
              Cadastre-se
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
