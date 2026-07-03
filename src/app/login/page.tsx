import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex flex-1 min-h-screen">
      {/* Painel de marca (esquerda) */}
      <aside className="hidden lg:flex w-[44%] flex-col justify-between bg-ink p-12 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-0 -left-16 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <Logo size={30} />
        <div className="relative">
          <h1 className="text-white text-4xl font-bold leading-tight">
            Serviços da sua casa,
            <br />
            resolvidos em minutos.
          </h1>
          <p className="text-white/60 mt-4 text-lg max-w-md">
            Uma plataforma, três experiências: quem contrata, quem executa e
            quem administra.
          </p>
          <div className="flex gap-3 mt-8">
            {["Eletricista", "Encanador", "Diarista", "Pintor"].map((c) => (
              <span
                key={c}
                className="text-white/80 text-sm bg-white/10 border border-white/10 rounded-full px-3 py-1.5"
              >
                {c}
              </span>
            ))}
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
            <LoginForm />
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
