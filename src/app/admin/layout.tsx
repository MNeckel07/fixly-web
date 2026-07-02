import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { Logo } from "@/components/ui/Logo";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { AdminNav } from "@/components/admin/AdminNav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("admin");

  return (
    <div className="flex min-h-screen flex-1 bg-canvas">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-ink text-white p-5 sticky top-0 h-screen">
        <div className="px-2 py-3">
          <Logo size={24} />
          <p className="text-white/40 text-xs mt-1">Painel interno</p>
        </div>
        <AdminNav />
        <div className="mt-auto border-t border-white/10 pt-4">
          <p className="text-sm font-medium truncate">{profile.full_name}</p>
          <p className="text-white/40 text-xs mb-3">Administrador</p>
          <LogoutButton className="!text-white/60 hover:!text-white" />
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="md:hidden flex items-center justify-between bg-ink text-white px-4 py-3">
          <Logo size={20} />
          <LogoutButton className="!text-white/70" />
        </div>
        {children}
      </main>
    </div>
  );
}
