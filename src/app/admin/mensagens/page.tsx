import { getProfile } from "@/lib/auth";
import { Messenger } from "@/components/chat/Messenger";
import { PageHeader } from "@/components/admin/StatCard";

export const dynamic = "force-dynamic";

export default async function MensagensAdmin({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;
  const { userId } = await getProfile();
  return (
    <div className="p-6 md:p-8 max-w-6xl">
      <PageHeader title="Mensagens" subtitle="Converse com candidatos durante a análise de cadastro." />
      <Messenger currentUserId={userId!} initialConversationId={c} />
    </div>
  );
}
