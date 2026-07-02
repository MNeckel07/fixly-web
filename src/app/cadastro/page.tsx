import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

const OPTIONS = [
  {
    role: "contratante",
    icon: "🏠",
    title: "Sou Contratante",
    desc: "Quero encontrar profissionais para resolver serviços na minha casa ou empresa.",
    bullets: ["Preço estimado na hora", "Pagamento protegido", "Avaliações reais"],
  },
  {
    role: "prestador",
    icon: "🔧",
    title: "Sou Prestador",
    desc: "Quero receber pedidos de serviço na minha região e aumentar minha renda.",
    bullets: ["Receba propostas próximas", "Você define seus preços", "Receba com segurança"],
  },
];

export default function CadastroPage() {
  return (
    <div className="flex flex-1 min-h-screen flex-col items-center bg-canvas px-6 py-12">
      <div className="w-full max-w-4xl">
        <div className="flex justify-center mb-2">
          <Logo size={28} variant="dark" />
        </div>
        <h1 className="text-center text-3xl font-bold text-ink mt-6">
          Como você quer usar o Fixly?
        </h1>
        <p className="text-center text-gray mt-2">
          Escolha seu perfil para começar o cadastro.
        </p>

        <div className="grid md:grid-cols-2 gap-5 mt-10">
          {OPTIONS.map((o) => (
            <Link
              key={o.role}
              href={`/cadastro/${o.role}`}
              className="group rounded-2xl border border-black/10 bg-white p-7 hover:border-primary hover:shadow-[0_12px_40px_-12px_rgba(31,35,41,0.22)] transition-all"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-3xl">
                {o.icon}
              </div>
              <h2 className="text-xl font-bold text-ink mt-5">{o.title}</h2>
              <p className="text-gray mt-2 text-[15px] leading-relaxed">
                {o.desc}
              </p>
              <ul className="mt-4 space-y-1.5">
                {o.bullets.map((b) => (
                  <li key={b} className="flex items-center gap-2 text-sm text-ink">
                    <span className="text-success">✓</span>
                    {b}
                  </li>
                ))}
              </ul>
              <span className="mt-6 inline-flex items-center gap-1 font-semibold text-primary-dark group-hover:gap-2 transition-all">
                Começar cadastro →
              </span>
            </Link>
          ))}
        </div>

        <p className="text-center text-sm text-gray mt-10">
          Já tem conta?{" "}
          <Link href="/login" className="text-primary-dark font-semibold">
            Entrar
          </Link>
        </p>
        <p className="text-center text-xs text-gray-light mt-3">
          Contas de administrador são criadas internamente pela equipe Fixly.
        </p>
      </div>
    </div>
  );
}
