import { Briefcase, Banknote } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { CategoryIcon } from "@/components/ui/icons";
import { brl, providerNet, platformFee } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export default async function GanhosPage() {
  const supabase = await createClient();
  const { profile } = await getProfile();

  const { data } = await supabase
    .from("service_requests")
    .select("id, final_price, estimated_price, created_at, category:service_categories(name, slug)")
    .eq("provider_id", profile!.id)
    .eq("status", "concluido")
    .order("created_at", { ascending: false });

  const jobs = (data ?? []) as any[];
  const gross = jobs.reduce((s, j) => s + (j.final_price ?? j.estimated_price ?? 0), 0);
  const net = jobs.reduce((s, j) => s + providerNet(j.final_price ?? j.estimated_price ?? 0), 0);

  // barras por dia da semana
  const week = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const byDay = new Array(7).fill(0);
  jobs.forEach((j) => {
    const d = new Date(j.created_at).getDay();
    byDay[d] += providerNet(j.final_price ?? j.estimated_price ?? 0);
  });
  const max = Math.max(...byDay, 1);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="rounded-3xl bg-gradient-to-br from-primary to-primary-dark p-6 text-ink">
        <p className="text-ink/70 text-sm">Ganho líquido total</p>
        <p className="text-4xl font-bold mt-1">{brl(net)}</p>
        <div className="flex gap-6 mt-4 text-sm">
          <span className="inline-flex items-center gap-1.5"><Briefcase className="h-4 w-4" /> {jobs.length} serviços</span>
          <span className="inline-flex items-center gap-1.5"><Banknote className="h-4 w-4" /> bruto {brl(gross)}</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-black/5 p-6">
        <h2 className="font-semibold text-ink mb-4">Ganhos na semana</h2>
        <div className="flex items-end justify-between gap-2 h-40">
          {byDay.map((v, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full flex items-end justify-center h-32">
                <div
                  className="w-full max-w-8 rounded-t-lg bg-primary/80 transition-all"
                  style={{ height: `${(v / max) * 100}%`, minHeight: v > 0 ? 6 : 2 }}
                  title={brl(v)}
                />
              </div>
              <span className="text-[11px] text-gray-light">{week[i]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-black/5 overflow-hidden">
        <div className="px-6 py-4 border-b border-black/5">
          <h2 className="font-semibold text-ink">Serviços concluídos</h2>
        </div>
        {jobs.length === 0 ? (
          <p className="px-6 py-10 text-center text-gray">
            Você ainda não concluiu serviços. Aceite um pedido para começar a ganhar!
          </p>
        ) : (
          <ul className="divide-y divide-black/5">
            {jobs.map((j) => {
              const cat = Array.isArray(j.category) ? j.category[0] : j.category;
              const val = j.final_price ?? j.estimated_price ?? 0;
              return (
                <li key={j.id} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-canvas text-ink">
                      <CategoryIcon slug={cat?.slug} className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-medium text-ink">{cat?.name ?? "Serviço"}</p>
                      <p className="text-xs text-gray-light">
                        {new Date(j.created_at).toLocaleDateString("pt-BR")} · taxa {brl(platformFee(val))}
                      </p>
                    </div>
                  </div>
                  <p className="font-semibold text-success">+{brl(providerNet(val))}</p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
