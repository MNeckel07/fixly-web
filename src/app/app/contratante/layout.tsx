import { requireRole } from "@/lib/auth";
import { UserNav, type NavItem } from "@/components/shell/UserNav";

const ITEMS: NavItem[] = [
  { href: "/app/contratante", label: "Início", icon: "home" },
  { href: "/app/contratante/solicitar", label: "Solicitar", icon: "plus" },
  { href: "/app/contratante/historico", label: "Meus Serviços", icon: "clock" },
  { href: "/app/contratante/suporte", label: "Suporte", icon: "support" },
  { href: "/app/contratante/perfil", label: "Perfil", icon: "user" },
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
