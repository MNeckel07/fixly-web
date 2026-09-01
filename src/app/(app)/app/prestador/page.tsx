import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { haversineKm, providerNet } from "@/lib/pricing";
import { signRequestPhotoMap } from "@/lib/uploads";
import { PedidosBoard } from "@/components/prestador/PedidosBoard";
import { AutoRefresh } from "@/components/ui/AutoRefresh";

export const dynamic = "force-dynamic";

export default async function PrestadorHome() {
  const supabase = await createClient();
  const { profile } = await getProfile();
  if (!profile) redirect("/login");

  // categorias que o prestador atende (multi) + a principal
  const { data: pcs } = await supabase
    .from("provider_categories")
    .select("category_id")
    .eq("provider_id", profile.id);
  const myCategoryIds = new Set<string>(
    [...(pcs ?? []).map((p: any) => p.category_id), profile.category_id].filter(Boolean) as string[],
  );

  // ⚠️ `address`, `lat` e `lng` de `service_requests` são APROXIMADOS (0026):
  // região e ponto deslocado. O endereço exato vive em
  // `service_request_locations` e a RLS só libera depois do aceite.
  const { data: open } = await supabase
    .from("service_requests")
    .select(
      "id, client_id, description, urgent, address, estimated_price, estimated_min, estimated_max, status, lat, lng, photos, category_id, target_provider_id, created_at, category:service_categories(name, slug), client:profiles!service_requests_client_id_fkey(full_name, city, fix_badge)",
    )
    .in("status", ["buscando", "proposta_enviada"])
    .order("created_at", { ascending: false })
    .limit(50);

  /**
   * 🔴 O SELO DEIXAVA O PROFISSIONAL CEGO — bug encontrado em 25/08/2026.
   *
   * O filtro abaixo repete a regra do `dispatch_request` (0023): quem TEM o
   * Selo Fixly é conta de vitrine e não deve receber pedido de cliente real.
   * Ele lia `fix_badge` do cliente pelo `join` da consulta acima — e a RLS de
   * `profiles` **não deixa um prestador ler o perfil de um contratante**
   * (`prof_select`: só a si mesmo, admin, ou prestador aprovado). O join
   * voltava NULO, e `profile.fix_badge && !cliente?.fix_badge` virava
   * `true && !undefined` = **true para todo pedido**.
   *
   * Resultado: todo profissional COM selo via "0 pedidos na sua região",
   * sempre — inclusive os pedidos mandados DIRETO para ele. Foi a queixa do
   * testador ("o perfil do Robson… não aparece os serviços que solicito para
   * ele"): o Robson tem selo.
   *
   * Por que a chave de servidor: a regra é de PAREAMENTO de contas e precisa de
   * um dado que a sessão do prestador legitimamente não pode ler. Só o
   * `fix_badge` é lido aqui, nada mais — e nada disso vai para o navegador.
   */
  const clientIds = [...new Set((open ?? []).map((r: any) => r.client_id).filter(Boolean))] as string[];
  const badgeDoCliente = new Map<string, boolean>();
  if (clientIds.length > 0) {
    const { data: badges } = await createAdminClient()
      .from("profiles")
      .select("id, fix_badge")
      .in("id", clientIds);
    for (const b of (badges ?? []) as { id: string; fix_badge: boolean | null }[]) {
      badgeDoCliente.set(b.id, !!b.fix_badge);
    }
  }

  const { data: myProps } = await supabase
    .from("proposals")
    .select("id, request_id, price, eta_minutes, advance_pct, travel_fee, counter_price, counter_status, counter_by, counter_rounds")
    .eq("provider_id", profile.id);

  const propMap: Record<string, {
    id: string; price: number; eta: number | null; advance_pct: number; travel_fee: number;
    counter_price: number | null; counter_status: string | null; counter_by: string | null;
    counter_rounds: number;
  }> = {};
  (myProps ?? []).forEach((p: any) => {
    propMap[p.request_id] = {
      id: p.id,
      price: p.price,
      eta: p.eta_minutes,
      advance_pct: p.advance_pct ?? 0,
      travel_fee: Number(p.travel_fee ?? 0),
      counter_price: p.counter_price,
      counter_status: p.counter_status,
      counter_by: p.counter_by,
      counter_rounds: Number(p.counter_rounds ?? 0),
    };
  });

  // Prestador ocupado = tem serviço em execução AINDA não sinalizado como pronto.
  // Depois de concluir, ele volta a receber pedidos mesmo que a aprovação do
  // contratante (que libera o pagamento) ainda não tenha saído.
  const { count: activeCount } = await supabase
    .from("service_requests")
    .select("*", { count: "exact", head: true })
    .eq("provider_id", profile.id)
    .in("status", ["a_caminho", "em_andamento"])
    .is("provider_done_at", null);
  const busy = (activeCount ?? 0) > 0;

  /**
   * O QUE AINDA É "PEDIDO" PARA O PROFISSIONAL (regra do dono, Fixly 12).
   *
   * *"Quando o pedido for aprovado, pago e etc., apenas faltar a ida do
   * prestador pra ir ao local e executar, deixe apenas em Trabalho; quando o
   * mesmo estiver pendente, em negociação, proposta e etc., deixe em Pedidos."*
   *
   * Repare que o corte NÃO é o aceite, é o PAGAMENTO. `aceito` quer dizer "o
   * cliente escolheu você e ainda não pagou" — ninguém vai a lugar nenhum
   * ainda, então isso é pendência e fica aqui. Assim que o dinheiro entra o
   * status vira `a_caminho`, e daí em diante o serviço é da aba Trabalho e
   * some daqui.
   *
   * Efeito colateral bem-vindo: o contador "X em aberto" volta a significar
   * uma coisa só — quantos serviços esperam algo DELE —, em vez de somar
   * trabalho em andamento com pendência.
   */
  const { data: mine } = await supabase
    .from("service_requests")
    .select("id, description, status, address, mode, final_price, created_at, category:service_categories(name, slug), client:profiles!service_requests_client_id_fkey(full_name, city), location:service_request_locations(address)")
    .eq("provider_id", profile.id)
    .eq("status", "aceito")
    .order("created_at", { ascending: false });
  const myJobs = (mine ?? []).map((j: any) => ({
    id: j.id,
    description: j.description,
    status: j.status,
    // serviço já fechado: aqui o endereço completo pode (e deve) aparecer
    address: (Array.isArray(j.location) ? j.location[0] : j.location)?.address ?? j.address,
    mode: j.mode,
    final_price: j.final_price,
    category: Array.isArray(j.category) ? j.category[0] : j.category,
    client: Array.isArray(j.client) ? j.client[0] : j.client,
  }));

  /**
   * Ganho do mês = o que foi LIBERADO neste mês, não o que foi pedido neste mês.
   *
   * Antes a conta filtrava por `created_at` do pedido: um serviço criado em
   * julho e aprovado em agosto não aparecia em nenhum dos dois meses, e o
   * painel mostrava "3 serviços · R$ 0,00" — que foi a reclamação. Quem manda
   * é a data em que o dinheiro virou dele (`payments.released_at`).
   */
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const { data: paidThisMonth } = await supabase
    .from("payments")
    .select("provider_net, released_at, request:service_requests!inner(provider_id)")
    .eq("request.provider_id", profile.id)
    .gte("released_at", monthStart.toISOString());
  const monthNet = (paidThisMonth ?? []).reduce(
    (sum: number, p: any) => sum + Number(p.provider_net ?? 0),
    0,
  );
  const monthLabel = monthStart.toLocaleDateString("pt-BR", { month: "long" });

  const radius = profile.service_radius_km ?? 10;
  const requests = (open ?? [])
    .filter((r: any) => {
      /**
       * PEDIDO DIRETO PASSA NA FRENTE DE TODOS OS FILTROS (Fixly 12).
       *
       * Os três filtros abaixo servem para MONTAR uma vitrine: de tudo que
       * está aberto por aí, mostrar o que faz sentido para este profissional.
       * Pedido direto não é vitrine — é o cliente apontando o dedo para ELE,
       * pelo Profiler ou pelo perfil público. Nesse caso Selo, categoria e
       * raio não têm o que opinar: o banco já decidiu o destinatário em
       * `dispatch_request` (0026), e a RLS já autorizou a leitura da linha.
       *
       * Sem esta linha, o pedido direto era descartado AQUI, depois de o banco
       * o ter entregue corretamente — e o profissional (o Robson do teste, que
       * tem Selo e 27 serviços) via "0 pedidos" para sempre. Era o mesmo
       * defeito por trás de dois relatos diferentes do Fixly 12: "solicitei
       * pelo Profiler e não chega" e "quem tem mais de um serviço está bugado".
       */
      if (r.target_provider_id === profile.id) return true;

      // SELO FIX (mesma regra do `dispatch_request`, 0023): prestador COM selo
      // não enxerga pedido de cliente real — evitaria o cliente receber proposta
      // de conta de vitrine. O contrário é permitido: conta com selo alcança
      // prestador real, e aí a cobrança entra em vigor.
      if (profile.fix_badge && !badgeDoCliente.get(r.client_id)) return false;
      // só categorias que ele atende
      if (myCategoryIds.size > 0 && r.category_id && !myCategoryIds.has(r.category_id)) return false;
      // respeita o raio de atendimento (quando há coordenadas)
      if (profile.lat && profile.lng && r.lat && r.lng) {
        const d = haversineKm({ lat: profile.lat, lng: profile.lng }, { lat: r.lat, lng: r.lng });
        if (d > radius) return false;
      }
      return true;
    })
    .map((r: any) => {
      const cliente = Array.isArray(r.client) ? r.client[0] : r.client;
      return {
        id: r.id,
        description: r.description,
        urgent: r.urgent,
        // região aproximada (o endereço exato só depois do aceite)
        area: r.address || cliente?.city || null,
        estimated_price: r.estimated_price,
        estimated_min: r.estimated_min,
        estimated_max: r.estimated_max,
        lat: r.lat,
        lng: r.lng,
        distanceKm:
          profile.lat && profile.lng && r.lat && r.lng
            ? haversineKm({ lat: profile.lat, lng: profile.lng }, { lat: r.lat, lng: r.lng })
            : null,
        direct: r.target_provider_id === profile.id,
        photos: (r.photos as string[] | null) ?? [],
        category: Array.isArray(r.category) ? r.category[0] : r.category,
        client: cliente,
        myProposal: propMap[r.id] ?? null,
      };
    });

  // assina as fotos (bucket privado) só para quem tem direito de ver
  const signedMap = await signRequestPhotoMap(supabase, requests.flatMap((r) => r.photos));
  for (const r of requests) r.photos = r.photos.map((p: string) => signedMap[p]).filter(Boolean);

  return (
    <>
      {/* pedidos novos e contra-propostas aparecem sem precisar dar F5 */}
      <AutoRefresh seconds={15} />
      <PedidosBoard
      requests={requests}
      myJobs={myJobs as any}
      providerId={profile!.id}
      providerName={profile!.full_name}
      rating={profile!.rating ?? 0}
      jobsDone={profile!.jobs_done ?? 0}
      monthNet={monthNet}
      monthLabel={monthLabel}
      defaultAdvancePct={profile!.advance_pct ?? 0}
      busy={busy}
      />
    </>
  );
}
