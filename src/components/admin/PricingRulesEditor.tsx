"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CategoryIcon } from "@/components/ui/icons";
import { brl, estimateRange } from "@/lib/pricing";

type Rule = {
  category_id: string;
  slug: string;
  name: string;
  base_min: number;
  base_max: number;
  per_km: number;
  urgent_multiplier: number;
};

export function PricingRulesEditor({ rules }: { rules: Rule[] }) {
  const [rows, setRows] = useState<Rule[]>(rules);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  function upd(id: string, field: keyof Rule, value: string) {
    setRows((prev) => prev.map((r) => (r.category_id === id ? { ...r, [field]: Number(value) } : r)));
  }

  async function save(r: Rule) {
    setSavingId(r.category_id);
    const supabase = createClient();
    await supabase.from("pricing_rules").upsert(
      {
        category_id: r.category_id,
        base_min: r.base_min,
        base_max: r.base_max,
        per_km: r.per_km,
        urgent_multiplier: r.urgent_multiplier,
      },
      { onConflict: "category_id" },
    );
    setSavingId(null);
    setSavedId(r.category_id);
    setTimeout(() => setSavedId((v) => (v === r.category_id ? null : v)), 2000);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray">
        O pré-orçamento mostrado ao contratante é <b>faixa mínima–máxima</b> por categoria, somada à
        distância (por km) e à urgência. O prestador pode propor até <b>15% acima do máximo</b>.
      </p>
      <div className="bg-white rounded-2xl border border-black/5 overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-canvas text-gray-light">
            <tr className="text-left">
              <th className="px-4 py-3 font-medium">Categoria</th>
              <th className="px-4 py-3 font-medium">Mín (R$)</th>
              <th className="px-4 py-3 font-medium">Máx (R$)</th>
              <th className="px-4 py-3 font-medium">Por km (R$)</th>
              <th className="px-4 py-3 font-medium">Mult. urgência</th>
              <th className="px-4 py-3 font-medium">Ex. 5km</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {rows.map((r) => {
              const ex = estimateRange(r, false, 5);
              return (
                <tr key={r.category_id}>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2 font-medium text-ink">
                      <CategoryIcon slug={r.slug} className="h-4 w-4" /> {r.name}
                    </span>
                  </td>
                  <td className="px-4 py-3"><NumInput value={r.base_min} onChange={(v) => upd(r.category_id, "base_min", v)} /></td>
                  <td className="px-4 py-3"><NumInput value={r.base_max} onChange={(v) => upd(r.category_id, "base_max", v)} /></td>
                  <td className="px-4 py-3"><NumInput value={r.per_km} onChange={(v) => upd(r.category_id, "per_km", v)} step="0.5" /></td>
                  <td className="px-4 py-3"><NumInput value={r.urgent_multiplier} onChange={(v) => upd(r.category_id, "urgent_multiplier", v)} step="0.1" /></td>
                  <td className="px-4 py-3 text-gray-light whitespace-nowrap">{brl(ex.min)}–{brl(ex.max)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => save(r)}
                      className="inline-flex items-center gap-1 rounded-lg bg-ink text-white px-3 py-1.5 text-xs font-medium hover:bg-ink-soft disabled:opacity-50"
                      disabled={savingId === r.category_id}
                    >
                      {savedId === r.category_id ? <><Check className="h-3.5 w-3.5" /> Salvo</> : savingId === r.category_id ? "..." : "Salvar"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NumInput({ value, onChange, step = "1" }: { value: number; onChange: (v: string) => void; step?: string }) {
  return (
    <input
      type="number"
      step={step}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-24 rounded-lg border border-black/10 px-2 py-1.5 outline-none focus:border-primary"
    />
  );
}
