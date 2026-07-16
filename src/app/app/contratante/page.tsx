import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { Badge } from "@/components/ui/Badge";
import { CategoryIcon } from "@/components/ui/icons";
import { CategoryBrowser } from "@/components/contratante/CategoryBrowser";
import { UnreadBadge } from "@/components/chat/UnreadBadge";
import { brl } from "@/lib/pricing";
import type { ServiceCategory } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ContratanteHome() {
  const supabase = await createClient();
  const { userId, profile } = await getProfile();
  if (!profile) redirect("/login");

  const { data: cats } = await supabase
    .from("service_categories")
    .select("*")
    .order("name");
  const categories = (cats as ServiceCategory[]) ?? [];

  const { data: active } = await supabase
    .from("service_requests")
    .select("id, description, status, estimated_price, provider_id, category:service_categories(name, slug)")
    .eq("client_id", userId!)
    .not("status", "in", "(concluido,cancelado)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const activeCat = active
    ? Array.isArray(active.category)
      ? active.category[0]
      : active.category
    : null;

  let activeConvId: string | null = null;
  if (active?.provider_id) {
    const { data } = await supabase.rpc("start_service_chat", { p_request_id: active.id });
    activeConvId = (data as string) ?? null;
  }

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="rounded-3xl bg-ink text-white p-7 relative overflow-hidden">
        <div className="absolute -top-16 -right-10 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
        <p className="text-white/60">Olá, {profile?.full_name.split(" ")[0]}</p>
        <h1 className="text-2xl font-bold mt-1 max-w-sm relative">
          Qual serviço você precisa resolver hoje?
        </h1>
        <Link
          href="/app/contratante/solicitar"
          className="inline-flex items-center gap-2 mt-5 bg-primary text-ink font-semibold rounded-xl px-5 h-12 hover:bg-primary-dark transition relative"
        >
          <Plus className="h-5 w-5" /> Solicitar serviço
        </Link>
      </section>

      {/* Serviço ativo */}
      {active && (
        <Link
          href={`/app/contratante/servico/${active.id}`}
          className="relative flex items-center justify-between rounded-2xl border border-primary/40 bg-primary/5 p-5 hover:bg-primary/10 transition"
        >
          {activeConvId && (
            <span className="absolute -top-2 -right-2">
              <UnreadBadge conversationId={activeConvId} currentUserId={userId!} />
            </span>
          )}
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-ink">
              <CategoryIcon slug={activeCat?.slug} className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold text-ink">{activeCat?.name ?? "Serviço"} em andamento</p>
              <p className="text-sm text-gray">{active.description}</p>
            </div>
          </div>
          <div className="text-right">
            <Badge status={active.status} />
            {active.estimated_price && (
              <p className="text-sm text-ink font-semibold mt-1">{brl(active.estimated_price)}</p>
            )}
          </div>
        </Link>
      )}

      {/* Categorias */}
      <CategoryBrowser categories={categories} />
    </div>
  );
}
