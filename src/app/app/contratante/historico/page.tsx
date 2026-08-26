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

  /**
   * VALOR DA LISTA — por que a consulta acima não basta.
   *
   * Enquanto ninguém foi escolhido, o pedido não tem preço: quem tem preço é a
   * PROPOSTA. A tela lia só `final_price ?? estimated_price ?? 0` e escrevia
   * "R$ 0,00" em tudo — "os valores todos zeraram, e se entrar ali tá certo,
   * mas não tá puxando o valor". Aqui buscamos as propostas vivas dos pedidos
   * em aberto para mostrar a partir de quanto está e quantas chegaram.
   *
   * Uma consulta só para a lista inteira (`in`), não uma por linha.
   */
  const abertos = reqs.filter((r) => !["concluido", "cancelado"].includes(r.status)).map((r) => r.id);
  const porPedido = new Map<string, { menor: number; qtd: number }>();
  if (abertos.length > 0) {
    const { data: props } = await supabase
      .from("proposals")
      .select("request_id, price, counter_price, counter_status, status")
      .in("request_id", abertos)
      .neq("status", "recusada");
    for (const p of (props ?? []) as any[]) {
      // o valor que vale é o negociado, quando a contra-proposta foi aceita
      const valor = Number(p.counter_status === "aceita" ? p.price : p.price) || 0;
      const atual = porPedido.get(p.request_id);
      porPedido.set(p.request_id, {
        menor: atual ? Math.min(atual.menor, valor) : valor,
        qtd: (atual?.qtd ?? 0) + 1,
      });
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-ink mb-1">Meus Serviços</h1>
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
            const props = porPedido.get(r.id);
            const fechado = r.final_price ?? r.estimated_price ?? null;
            return (
              <Link key={r.id} href={`/app/contratante/servico/${r.id}`} className="bg-white rounded-2xl border border-black/5 p-5 flex items-center justify-between hover:border-primary/40 transition">
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
                  <Badge status={r.status} count={props?.qtd} />
                  {fechado != null ? (
                    <p className="text-sm font-semibold text-ink mt-1">{brl(fechado)}</p>
                  ) : props ? (
                    <p className="text-sm font-semibold text-ink mt-1">
                      <span className="font-normal text-gray-light text-xs">
                        {props.qtd > 1 ? "a partir de " : ""}
                      </span>
                      {brl(props.menor)}
                    </p>
                  ) : (
                    /* sem preço não é R$ 0,00: é preço que ainda não existe */
                    <p className="text-xs text-gray-light mt-1.5">
                      {["concluido", "cancelado"].includes(r.status) ? "sem valor" : "aguardando propostas"}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
