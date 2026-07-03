import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { Messenger } from "@/components/chat/Messenger";

export const dynamic = "force-dynamic";

export default async function MensagensContratante({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;
  const { userId } = await getProfile();
  if (!userId) redirect("/login");
  return <Messenger currentUserId={userId} initialConversationId={c} />;
}
