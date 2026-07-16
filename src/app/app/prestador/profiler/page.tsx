import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { ProfilerEditor } from "@/components/prestador/ProfilerEditor";

export const dynamic = "force-dynamic";

export default async function MeuProfilerPage() {
  const supabase = await createClient();
  const { profile } = await getProfile();
  if (!profile) redirect("/login");

  const { data: items } = await supabase
    .from("portfolio_items")
    .select("id, image_path, caption")
    .eq("provider_id", profile.id)
    .order("created_at", { ascending: false });

  const publicUrlBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/portfolio/`;

  return (
    <div>
      <div className="max-w-2xl mx-auto mb-4">
        <h1 className="text-2xl font-bold text-ink">Meu Profiler</h1>
        <p className="text-gray">Seu portfólio público — divulgue e leve clientes até você.</p>
      </div>
      <ProfilerEditor
        providerId={profile.id}
        initial={{
          handle: (profile as any).handle ?? "",
          headline: (profile as any).headline ?? "",
          bio: profile.bio ?? "",
        }}
        items={(items as any) ?? []}
        publicUrlBase={publicUrlBase}
      />
    </div>
  );
}
