import { redirect } from "next/navigation";
import { Briefcase, Banknote } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { CategoryIcon } from "@/components/ui/icons";
import { GanhoItem } from "@/components/prestador/GanhoItem";
import { Carteira, type Pending, type Withdrawal } from "@/components/prestador/Carteira";
import { getBalance } from "./actions";
import { brl, providerNet } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const GATEWAY_MSG: Record<string, { text: string; tone: string }> = {
  conectado: { text: "Conta do gateway conectada com sucesso.", tone: "text-success bg-success/5" },
  recusado: { text: "Você recusou a autorização no gateway.", tone: "text-gray bg-black/[0.03]" },
  falha: { text: "Não foi possível conectar a conta. Tente novamente.", tone: "text-danger bg-danger/5" },
  "state-invalido": { text: "Link de conexão expirado. Tente de novo.", tone: "text-danger bg-danger/5" },
  "sem-codigo": { text: "O gateway não devolveu a autorização.", tone: "text-danger bg-danger/5" },
  "nao-configurado": { text: "O recebimento direto ainda não está configurado.", tone: "text-warning bg-warning/10" },
  "sem-permissao": { text: "Apenas prestadores aprovados podem conectar a conta.", tone: "text-danger bg-danger/5" },
};

export default async function GanhosPage({
  searchParams,
}: {
  searchParams: Promise<{ gateway?: string }>;
}) {
  const { gateway } = await searchParams;
  const supabase = await createClient();
  const { profile } = await getProfile();
  if (!profile) redirect("/login");

  const [{ data }, balance, { data: wds }, { data: connected }] = await Promise.all([
    supabase
      .from("service_requests")
      .select(
        "id, final_price, estimated_price, created_at, category:service_categories(name, slug), payment:payments(amount, fee, gateway_fee, provider_net, method, status, available_at, released_at, advance_amount, advance_released_at)",
      )
      .eq("provider_id", profile!.id)
      .eq("status", "concluido")
      .order("created_at", { ascending: false }),
    getBalance(),
    supabase
      .from("withdrawals")
      .select("id, amount, status, requested_at, paid_at, pix_key")
      .eq("provider_id", profile!.id)
      .order("requested_at", { ascending: false })
      .limit(10),
    supabase.rpc("gateway_connected"),
  ]);

  const jobs = (data ?? []).map((j: any) => {
    const cat = Array.isArray(j.category) ? j.category[0] : j.category;
    const pay = Array.isArray(j.payment) ? j.payment[0] : j.payment;
    const val = j.final_price ?? j.estimated_price ?? 0;
    const net = pay?.provider_net ?? providerNet(val);
    return { id: j.id, created_at: j.created_at, catName: cat?.name ?? "Serviço", catSlug: cat?.slug, val, pay, net };
  });

  // "A caminho da sua conta": aprovado, mas o prazo de crédito ainda não venceu
  const pending: Pending[] = jobs
    .filter((j) => j.pay?.status === "liberado" && j.pay?.available_at && new Date(j.pay.available_at) > new Date())
    .map((j) => ({
      id: j.id,
      categoryName: j.catName,
      net: Number(j.net),
      availableAt: j.pay!.available_at as string,
      isAdvance: false,
    }));

  // Adiantamentos liberados de serviços AINDA em andamento (não aparecem na
  // lista de concluídos — era a reclamação "liberei adiantamento e não apareceu")
  const { data: adv } = await supabase
    .from("service_requests")
    .select("id, category:service_categories(name), payment:payments(advance_amount, advance_released_at)")
    .eq("provider_id", profile!.id)
    .in("status", ["a_caminho", "em_andamento"]);
  for (const a of adv ?? []) {
    const pay: any = Array.isArray((a as any).payment) ? (a as any).payment[0] : (a as any).payment;
    if (!pay?.advance_released_at) continue;
    const cat: any = Array.isArray((a as any).category) ? (a as any).category[0] : (a as any).category;
    pending.push({
      id: `adv-${(a as any).id}`,
      categoryName: cat?.name ?? "Serviço",
      net: Number(pay.advance_amount ?? 0),
      availableAt: pay.advance_released_at as string,
      isAdvance: true,
    });
  }

  const grossNet = jobs.reduce((s, j) => s + Number(j.net), 0);
  const gross = jobs.reduce((s, j) => s + Number(j.val), 0);

  const week = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const byDay = new Array(7).fill(0);
  jobs.forEach((j) => (byDay[new Date(j.created_at).getDay()] += Number(j.net)));
  const max = Math.max(...byDay, 1);

  const msg = gateway ? GATEWAY_MSG[gateway] : null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {msg && <p className={`text-sm rounded-xl px-4 py-3 ${msg.tone}`}>{msg.text}</p>}

      <Carteira
        balance={balance}
        pending={pending}
        withdrawals={(wds as Withdrawal[]) ?? []}
        pixKey={(profile as any).pix_key ?? null}
        gatewayConnected={!!connected}
        gatewayAvailable={!!process.env.MP_CLIENT_ID}
      />

      {/* Total histórico */}
      <div className="bg-white rounded-2xl border border-black/5 p-6">
        <p className="text-gray text-sm">Ganho líquido total (histórico)</p>
        <p className="text-2xl font-bold text-ink mt-1">{brl(grossNet)}</p>
        <div className="flex gap-6 mt-3 text-sm text-gray">
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
          <p className="text-xs text-gray-light mt-0.5">Toque em um serviço para ver o detalhamento dos descontos.</p>
        </div>
        {jobs.length === 0 ? (
          <p className="px-6 py-10 text-center text-gray">
            Você ainda não concluiu serviços. O valor entra aqui quando o contratante aprova a conclusão.
          </p>
        ) : (
          <ul className="divide-y divide-black/5">
            {jobs.map((j) => (
              <GanhoItem key={j.id} job={j}>
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-canvas text-ink">
                  <CategoryIcon slug={j.catSlug} className="h-5 w-5" />
                </span>
              </GanhoItem>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
