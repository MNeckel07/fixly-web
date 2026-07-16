"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, ExternalLink, Plus, Home, Wrench, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { CategoryIcon } from "@/components/ui/icons";
import { impersonationLink, createTestRequest, forceStep } from "@/app/admin/testes/actions";
import { brl } from "@/lib/pricing";

type Account = { id: string; full_name: string; role: string };
type Service = {
  id: string;
  description: string;
  status: string;
  estimated_min: number | null;
  estimated_max: number | null;
  final_price: number | null;
  rating: number | null;
  category: { name: string; slug: string } | null;
  provider: { full_name: string } | null;
};

const STEPS: { key: any; label: string; when: string[] }[] = [
  { key: "propostas", label: "Gerar propostas", when: ["buscando"] },
  { key: "aceitar", label: "Aceitar (escolher)", when: ["proposta_enviada"] },
  { key: "pagar", label: "Marcar pago", when: ["aceito"] },
  { key: "andamento", label: "Em andamento", when: ["a_caminho"] },
  { key: "concluir", label: "Concluir", when: ["em_andamento", "a_caminho"] },
  { key: "avaliar", label: "Avaliar", when: ["concluido"] },
];

export function TestPanel({ accounts, services }: { accounts: Account[]; services: Service[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  async function enterAs(a: Account) {
    setBusy("imp-" + a.id);
    setMsg("");
    const res = await impersonationLink(a.id);
    setBusy(null);
    if (!res.ok || !res.url) return setMsg(res.error ?? "Falha ao gerar link.");
    window.open(res.url, "_blank");
  }

  async function newRequest() {
    setBusy("new");
    setMsg("");
    const res = await createTestRequest();
    setBusy(null);
    if (!res.ok) return setMsg(res.error ?? "Falha ao criar pedido.");
    router.refresh();
  }

  async function step(id: string, s: string) {
    setBusy(id + s);
    setMsg("");
    const res = await forceStep(id, s as any);
    setBusy(null);
    if (!res.ok) return setMsg(res.error ?? "Falha na etapa.");
    router.refresh();
  }

  const contratante = accounts.find((a) => a.role === "contratante");
  const prestador = accounts.find((a) => a.role === "prestador");

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 rounded-xl bg-warning/10 text-warning px-4 py-3 text-sm font-medium">
        <FlaskConical className="h-4 w-4" /> MODO TESTE — ações aqui afetam apenas contas marcadas como teste.
      </div>

      {/* Acesso rápido */}
      <div className="bg-white rounded-2xl border border-black/5 p-5">
        <h2 className="font-semibold text-ink mb-1">Entrar como conta de teste</h2>
        <p className="text-sm text-gray-light mb-4">
          Abre a app já logado numa nova aba. Dica: abra o prestador numa <b>janela anônima</b> para ter os dois lados ao mesmo tempo.
        </p>
        <div className="flex flex-wrap gap-2">
          {contratante && (
            <Button variant="outline" loading={busy === "imp-" + contratante.id} onClick={() => enterAs(contratante)}>
              <Home className="h-4 w-4" /> Entrar como Contratante <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          )}
          {prestador && (
            <Button variant="outline" loading={busy === "imp-" + prestador.id} onClick={() => enterAs(prestador)}>
              <Wrench className="h-4 w-4" /> Entrar como Prestador <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Serviços de teste + forçar etapa */}
      <div className="bg-white rounded-2xl border border-black/5 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5">
          <h2 className="font-semibold text-ink">Serviços de teste</h2>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => router.refresh()}><RefreshCw className="h-4 w-4" /> Atualizar</Button>
            <Button size="sm" loading={busy === "new"} onClick={newRequest}><Plus className="h-4 w-4" /> Criar pedido de teste</Button>
          </div>
        </div>

        {msg && <p className="px-5 pt-3 text-sm text-danger">{msg}</p>}

        {services.length === 0 ? (
          <p className="px-5 py-10 text-center text-gray">
            Nenhum serviço de teste. Crie um pedido acima e depois force as etapas — ou solicite pela conta de teste.
          </p>
        ) : (
          <ul className="divide-y divide-black/5">
            {services.map((s) => (
              <li key={s.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-canvas text-ink">
                      <CategoryIcon slug={s.category?.slug} className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-ink">{s.category?.name ?? "Serviço"}</p>
                      <p className="text-xs text-gray-light">
                        {s.provider?.full_name ? `Prestador: ${s.provider.full_name} · ` : ""}
                        faixa {brl(s.estimated_min ?? 0)}–{brl(s.estimated_max ?? 0)}
                        {s.rating ? ` · ${s.rating}★` : ""}
                      </p>
                    </div>
                  </div>
                  <Badge status={s.status} />
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                  {STEPS.map((st) => {
                    const enabled = st.when.includes(s.status);
                    return (
                      <button
                        key={st.key}
                        disabled={!enabled || busy === s.id + st.key}
                        onClick={() => step(s.id, st.key)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition ${
                          enabled
                            ? "border-ink bg-ink text-white hover:bg-ink-soft"
                            : "border-black/10 text-gray-light cursor-not-allowed"
                        }`}
                      >
                        {busy === s.id + st.key ? "..." : st.label}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => step(s.id, "apagar")}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium border border-danger/30 text-danger hover:bg-danger/5"
                  >
                    Apagar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
