import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { EmpreiteirosDirectory } from "@/components/empreiteiros/EmpreiteirosDirectory";

export const dynamic = "force-dynamic";

export default async function EmpreiteirosPage() {
  const supabase = await createClient();
  const { userId } = await getProfile();
  if (!userId) redirect("/login");

  const { data } = await supabase
    .from("empreiteiros")
    .select("id, company_name, handle, category_ids, specialties, description, city, phone, whatsapp, category:service_categories(name, slug)")
    .eq("subscription_active", true)
    .order("created_at", { ascending: false });

  const { data: allCats } = await supabase.from("service_categories").select("id, name");
  const catName = new Map<string, string>((allCats ?? []).map((c: any) => [c.id, c.name]));

  const empreiteiros = (data ?? []).map((e: any) => ({
    ...e,
    category: Array.isArray(e.category) ? e.category[0] : e.category,
    secondary: ((e.category_ids ?? []) as string[]).map((id) => catName.get(id)).filter(Boolean) as string[],
  }));

  /**
   * MINIATURAS DA GALERIA (Fixly 13.2) — *"colocar foto em miniatura na base
   * dos profiler e nos empreiteiros"*. Mesma ideia e mesmo cuidado do
   * diretório de Profilers: UMA consulta para a lista inteira, corte de 4 por
   * empresa feito na memória — nada de uma consulta por card.
   */
  const empIds = empreiteiros.map((e: any) => e.id);
  const miniaturas: Record<string, string[]> = {};
  if (empIds.length > 0) {
    const { data: fotos } = await supabase
      .from("empreiteiro_items")
      .select("empreiteiro_id, image_path, created_at")
      .in("empreiteiro_id", empIds)
      .order("created_at", { ascending: false })
      .limit(400);
    for (const f of (fotos ?? []) as { empreiteiro_id: string; image_path: string }[]) {
      const lista = (miniaturas[f.empreiteiro_id] ??= []);
      if (lista.length < 4) lista.push(f.image_path);
    }
  }

  const portfolioBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/portfolio/`;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-ink mb-1">Empreiteiros</h1>
      <p className="text-gray mb-5">Quer achar um empreiteiro para a sua obra? Busque e fale direto com a empresa.</p>
      <EmpreiteirosDirectory empreiteiros={empreiteiros} miniaturas={miniaturas} portfolioBase={portfolioBase} />
    </div>
  );
}
