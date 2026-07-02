import { requireRole } from "@/lib/auth";
import { UserNav, type NavItem } from "@/components/shell/UserNav";

const ITEMS: NavItem[] = [
  { href: "/app/prestador", label: "Pedidos", icon: "📥" },
  { href: "/app/prestador/trabalho", label: "Trabalho", icon: "🔧" },
  { href: "/app/prestador/ganhos", label: "Ganhos", icon: "💰" },
  { href: "/app/prestador/perfil", label: "Perfil", icon: "👤" },
];

export default async function PrestadorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("prestador");
  return (
    <div className="flex flex-col min-h-screen flex-1 bg-canvas">
      <UserNav items={ITEMS} name={profile.full_name} />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 pb-24 md:pb-6">
        {children}
      </main>
    </div>
  );
}
