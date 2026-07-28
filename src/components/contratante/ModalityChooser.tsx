"use client";

import { useRouter } from "next/navigation";
import { Zap, ClipboardList, HardHat, type LucideIcon } from "lucide-react";

const MODES: { href: string; icon: LucideIcon; title: string; desc: string; tone: string }[] = [
  { href: "/app/contratante/solicitar?modo=express", icon: Zap, title: "Express", desc: "Preciso agora — os profissionais disponíveis enviam o preço", tone: "bg-primary/10 text-primary-dark" },
  { href: "/app/contratante/solicitar?modo=orcamento", icon: ClipboardList, title: "Orçamento", desc: "Serviço com visita técnica — escolha o profissional e combine", tone: "bg-info/10 text-info" },
  { href: "/app/contratante/solicitar?modo=orcamento&reforma=1", icon: HardHat, title: "Reforma", desc: "Obra em casa — visita técnica e orçamento", tone: "bg-warning/10 text-warning" },
];

export function ModalityChooser() {
  const router = useRouter();
  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-white rounded-2xl border border-black/5 p-6 animate-fade-up">
        <h2 className="text-lg font-bold text-ink">Como você quer resolver?</h2>
        <p className="text-gray text-sm mt-0.5 mb-5">Escolha a modalidade do pedido</p>
        <div className="grid sm:grid-cols-3 gap-3">
          {MODES.map((m) => (
            <button
              key={m.title}
              onClick={() => router.push(m.href)}
              className="rounded-2xl border border-black/10 bg-white p-5 text-left hover:border-primary hover:shadow-[0_8px_28px_-12px_rgba(31,35,41,0.25)] hover:-translate-y-0.5 transition-all"
            >
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${m.tone}`}>
                <m.icon className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <p className="font-semibold text-ink mt-3">{m.title}</p>
              <p className="text-xs text-gray-light mt-0.5 leading-snug">{m.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
