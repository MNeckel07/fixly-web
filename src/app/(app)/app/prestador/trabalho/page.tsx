import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { signRequestPhotos, signRequestPhotoMap } from "@/lib/uploads";
import { haversineKm } from "@/lib/pricing";
import { RequestCard } from "@/components/prestador/RequestCard";
import { TrabalhoView } from "@/components/prestador/TrabalhoView";
import { JobSwitcher } from "@/components/prestador/JobSwitcher";
import { AutoRefresh } from "@/components/ui/AutoRefresh";

export const dynamic = "force-dynamic";

const ACTIVE = ["aceito", "a_caminho", "em_andamento"];

export default async function TrabalhoPage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string }>;
}) {
  const { job: jobParam } = await searchParams;
  const supabase = await createClient();
  const { profile } = await getProfile();
  if (!profile) redirect("/login");

  // TODOS os serviços em aberto (Express aceito, orçamento e reforma), para o
  // prestador ver no que está trabalhando agora e alternar entre eles.
  const { data: rows } = await supabase
    .from("service_requests")
    .select(
      "id, description, status, address, lat, lng, estimated_price, final_price, mode, urgent, photos, provider_done_at, no_charge, created_at, category:service_categories(name, slug), client:profiles!service_requests_client_id_fkey(id, full_name, city), location:service_request_locations(address, lat, lng)",
    )
    .eq("provider_id", profile!.id)
    .in("status", ACTIVE)
    .order("created_at", { ascending: false });

  // Serviço aceito = endereço liberado (a RLS de `service_request_locations` é
  // que decide; aqui só preferimos o exato quando ele vem).
  const jobs = (rows ?? []).map((j: any) => {
    const loc = Array.isArray(j.location) ? j.location[0] : j.location;
    return {
      ...j,
      address: loc?.address ?? j.address,
      lat: loc?.lat ?? j.lat,
      lng: loc?.lng ?? j.lng,
      category: Array.isArray(j.category) ? j.category[0] : j.category,
      client: Array.isArray(j.client) ? j.client[0] : j.client,
    };
  });

  // "trabalhando agora" = a caminho / em andamento e ainda não sinalizado pronto
  const current =
    jobs.find((j: any) => j.id === jobParam) ??
    jobs.find((j: any) => ["a_caminho", "em_andamento"].includes(j.status) && !j.provider_done_at) ??
    jobs[0] ??
    null;

  const jobPhotos = current ? await signRequestPhotos(supabase, (current.photos as string[]) ?? []) : [];
  const normalized = current ? { ...current, photos: jobPhotos } : null;

  /**
   * PROPOSTAS ENVIADAS TAMBÉM SÃO TRABALHO (Fixly 13, pág. 3).
   *
   * *"Deixar os pedidos que foram enviadas propostas, que já foram aceitos e os
   * que já foram pagos e iniciados na aba trabalho."*
   *
   * A partir daqui, **Pedidos é a caixa de entrada** (só o que ainda não
   * respondi) e **Trabalho é tudo em que já me envolvi** — da proposta em
   * negociação ao serviço em execução. A negociação vem junto: é o mesmo
   * `RequestCard` da outra aba, sem nenhuma mudança de comportamento.
   *
   * ⚠️ E AQUI NÃO SE REPETEM OS FILTROS DE VITRINE.
   * A tela de Pedidos descarta pedido fora do raio, fora das categorias dele e
   * de cliente sem selo. Aqueles filtros respondem "o que EU OFEREÇO a este
   * profissional" — não têm o que opinar sobre uma proposta que ele já mandou.
   * Se ele propôs, é dele, e some da tela dele seria perder a negociação no
   * meio. Por isso a consulta aqui parte das PROPOSTAS, não do raio.
   */
  const { data: minhasPropostas } = await supabase
    .from("proposals")
    .select("id, request_id, price, eta_minutes, advance_pct, travel_fee, counter_price, counter_status, counter_by, counter_rounds")
    .eq("provider_id", profile!.id)
    .eq("status", "enviada");

  const idsComProposta = (minhasPropostas ?? []).map((p: any) => p.request_id as string);
  let emNegociacao: any[] = [];
  if (idsComProposta.length > 0) {
    const { data: abertos } = await supabase
      .from("service_requests")
      .select(
        "id, description, urgent, address, estimated_price, estimated_min, estimated_max, lat, lng, photos, target_provider_id, created_at, category:service_categories(name, slug), client:profiles!service_requests_client_id_fkey(full_name, city)",
      )
      .in("id", idsComProposta)
      .in("status", ["buscando", "proposta_enviada"])
      .order("created_at", { ascending: false });

    const propostaDoPedido = new Map<string, any>(
      (minhasPropostas ?? []).map((p: any) => [p.request_id as string, p]),
    );

    emNegociacao = (abertos ?? []).map((r: any) => {
      const cliente = Array.isArray(r.client) ? r.client[0] : r.client;
      const p = propostaDoPedido.get(r.id);
      return {
        id: r.id,
        description: r.description,
        urgent: r.urgent,
        area: r.address || cliente?.city || null,
        estimated_price: r.estimated_price,
        estimated_min: r.estimated_min,
        estimated_max: r.estimated_max,
        lat: r.lat,
        lng: r.lng,
        distanceKm:
          profile!.lat && profile!.lng && r.lat && r.lng
            ? haversineKm({ lat: profile!.lat, lng: profile!.lng }, { lat: r.lat, lng: r.lng })
            : null,
        direct: r.target_provider_id === profile!.id,
        photos: (r.photos as string[] | null) ?? [],
        category: Array.isArray(r.category) ? r.category[0] : r.category,
        client: cliente,
        myProposal: {
          id: p.id,
          price: p.price,
          eta: p.eta_minutes,
          advance_pct: p.advance_pct ?? 0,
          travel_fee: Number(p.travel_fee ?? 0),
          counter_price: p.counter_price,
          counter_status: p.counter_status,
          counter_by: p.counter_by,
          counter_rounds: Number(p.counter_rounds ?? 0),
        },
      };
    });

    // fotos do bucket privado, assinadas como na outra aba
    const mapa = await signRequestPhotoMap(supabase, emNegociacao.flatMap((r) => r.photos));
    for (const r of emNegociacao) r.photos = r.photos.map((f: string) => mapa[f]).filter(Boolean);
  }

  return (
    <div className="space-y-4">
      {/* pagamento do cliente / aprovação chegam sozinhos */}
      <AutoRefresh seconds={15} />
      {jobs.length > 1 && (
        <JobSwitcher
          jobs={jobs.map((j: any) => ({
            id: j.id,
            status: j.status,
            mode: j.mode,
            urgent: !!j.urgent,
            providerDone: !!j.provider_done_at,
            categoryName: j.category?.name ?? "Serviço",
            categorySlug: j.category?.slug ?? null,
            clientName: j.client?.full_name ?? "Cliente",
            price: j.final_price ?? j.estimated_price ?? null,
            quoted: j.final_price != null,
          }))}
          currentId={current?.id ?? null}
        />
      )}

      <TrabalhoView
        job={normalized as any}
        currentUserId={profile!.id}
        providerLoc={
          profile!.lat && profile!.lng
            ? { lat: profile!.lat, lng: profile!.lng }
            : null
        }
        defaultAdvancePct={profile!.advance_pct ?? 0}
      />

      {/* Propostas enviadas — a negociação acontece aqui, no mesmo card da
          aba Pedidos. Vem DEPOIS do serviço em execução de propósito: o
          trabalho de agora manda na tela; proposta é espera. */}
      {emNegociacao.length > 0 && (
        <div className="max-w-lg mx-auto space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-ink">Propostas enviadas</h2>
            <span className="text-sm text-gray-light">
              {emNegociacao.length} aguardando o cliente
            </span>
          </div>
          {emNegociacao.map((r) => (
            <RequestCard key={r.id} r={r} defaultAdvancePct={profile!.advance_pct ?? 0} currentUserId={profile!.id} />
          ))}
        </div>
      )}
    </div>
  );
}
