import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { SupportCenter } from "@/components/support/SupportCenter";

export const dynamic = "force-dynamic";

export default async function SuportePrestador() {
  const supabase = await createClient();
  const { userId } = await getProfile();
  if (!userId) redirect("/login");
  const { data } = await supabase
    .from("tickets")
    .select("id, category, priority, subject, status, created_at, conversation_id")
    .eq("opener_id", userId)
    .order("created_at", { ascending: false });
  return <SupportCenter currentUserId={userId} tickets={(data as any) ?? []} />;
}
