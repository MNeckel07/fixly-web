import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignupForm } from "@/components/auth/SignupForm";
import type { ServiceCategory } from "@/lib/types";

export default async function CadastroRolePage({
  params,
}: {
  params: Promise<{ role: string }>;
}) {
  const { role } = await params;
  if (role !== "contratante" && role !== "prestador") notFound();

  let categories: ServiceCategory[] = [];
  if (role === "prestador") {
    const supabase = await createClient();
    const { data } = await supabase
      .from("service_categories")
      .select("*")
      .order("name");
    categories = (data as ServiceCategory[]) ?? [];
  }

  return <SignupForm role={role} categories={categories} />;
}
