import Link from "next/link";
import { redirect } from "next/navigation";
import { Star, ClipboardList, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { Badge } from "@/components/ui/Badge";
import { CategoryIcon } from "@/components/ui/icons";
import { brl } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export default async function HistoricoPage() {
  const supabase = await createClient();
  const { userId } = await getProfile();
  if (!userId) redirect("/login");

  const { data } = await supabase
    .from("service_requests")
    .select("id, description, status, estimated_price, final_price, rating, created_at, category:service_categories(name, slug)")
    .eq("client_id", userId!)
    .order("created_at", { ascending: false });

  const reqs = (data ?? []) as any[];

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-ink mb-1">Histórico</h1>
      <p className="text-gray mb-6">Seus pedidos de serviço</p>

      {reqs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-black/5 p-10 text-center">
          <ClipboardList className="h-9 w-9 text-gray-light mx-auto mb-2" strokeWidth={1.5} />
          <p className="text-ink font-medium">Nenhum serviço ainda</p>
          <Link href="/app/contratante/solicitar" className="inline-flex items-center gap-1 text-primary-dark font-semibold text-sm mt-2">
            Solicitar meu primeiro serviço <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {reqs.map((r) => {
            const cat = Array.isArray(r.category) ? r.category[0] : r.category;
            return (
              <div key={r.id} className="bg-white rounded-2xl border border-black/5 p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-canvas text-ink">
                    <CategoryIcon slug={cat?.slug} className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-semibold text-ink">{cat?.name ?? "Serviço"}</p>
                    <p className="text-sm text-gray-light truncate max-w-[200px]">{r.description}</p>
                    <p className="flex items-center gap-1 text-xs text-gray-light mt-0.5">
                      {new Date(r.created_at).toLocaleDateString("pt-BR")}
                      {r.rating ? (
                        <span className="inline-flex items-center gap-0.5">
                          · <Star className="h-3 w-3 fill-primary text-primary" /> {r.rating}
                        </span>
                      ) : null}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge status={r.status} />
                  <p className="text-sm font-semibold text-ink mt-1">
                    {brl(r.final_price ?? r.estimated_price ?? 0)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
