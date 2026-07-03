import { Home, Plus, Clock, MessageSquare, User } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { UserNav, type NavItem } from "@/components/shell/UserNav";

const ITEMS: NavItem[] = [
  { href: "/app/contratante", label: "Início", icon: Home },
  { href: "/app/contratante/solicitar", label: "Solicitar", icon: Plus },
  { href: "/app/contratante/historico", label: "Histórico", icon: Clock },
  { href: "/app/contratante/mensagens", label: "Mensagens", icon: MessageSquare },
  { href: "/app/contratante/perfil", label: "Perfil", icon: User },
];

export default async function ContratanteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("contratante");
  return (
    <div className="flex flex-col min-h-screen flex-1 bg-canvas">
      <UserNav items={ITEMS} name={profile.full_name} />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 pb-24 md:pb-6">
        {children}
      </main>
    </div>
  );
}
