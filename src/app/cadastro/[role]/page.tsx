import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignupForm } from "@/components/auth/SignupForm";
import type { ServiceCategory } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CadastroRolePage({
  params,
}: {
  params: Promise<{ role: string }>;
}) {
  const { role } = await params;
  if (role !== "contratante" && role !== "prestador") notFound();

  const supabase = await createClient();

  const [{ data: catData }, { data: docData }] = await Promise.all([
    role === "prestador"
      ? supabase.from("service_categories").select("*").order("name")
      : Promise.resolve({ data: [] as ServiceCategory[] }),
    supabase
      .from("document_types")
      .select("slug, label, applies_to, required")
      .eq("active", true)
      .neq("slug", "termos_aceite")
      .order("sort"),
  ]);

  const docTypes = (docData ?? []).filter(
    (d: any) => d.applies_to === role || d.applies_to === "ambos",
  );

  return (
    <SignupForm
      role={role}
      categories={(catData as ServiceCategory[]) ?? []}
      docTypes={docTypes as any}
    />
  );
}
