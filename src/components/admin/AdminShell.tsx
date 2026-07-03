"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderCheck,
  Users,
  TrendingUp,
  Wrench,
  FileText,
  MessageSquare,
  LifeBuoy,
  PanelLeftClose,
  PanelLeft,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { LogoutButton } from "@/components/auth/LogoutButton";

const ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin", label: "Visão geral", icon: LayoutDashboard },
  { href: "/admin/cadastros", label: "Aprovações", icon: FolderCheck },
  { href: "/admin/usuarios", label: "Cadastros", icon: Users },
  { href: "/admin/vendas", label: "Vendas", icon: TrendingUp },
  { href: "/admin/servicos", label: "Serviços", icon: Wrench },
  { href: "/admin/suporte", label: "Suporte", icon: LifeBuoy },
  { href: "/admin/mensagens", label: "Atendimento", icon: MessageSquare },
  { href: "/admin/documentos", label: "Documentos", icon: FileText },
];

export function AdminShell({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem("fixly_admin_collapsed") === "1");
  }, []);
  function toggle() {
    setCollapsed((v) => {
      localStorage.setItem("fixly_admin_collapsed", v ? "0" : "1");
      return !v;
    });
  }

  return (
    <div className="flex min-h-screen flex-1 bg-canvas">
      <aside
        className={`hidden md:flex ${
          collapsed ? "w-16" : "w-52"
        } flex-col bg-ink text-white sticky top-0 h-screen transition-[width] duration-200`}
      >
        <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} px-3 h-16`}>
          {!collapsed && <Logo size={22} />}
          <button
            onClick={toggle}
            className="text-white/50 hover:text-white p-1.5 rounded-lg hover:bg-white/10"
            title={collapsed ? "Expandir" : "Recolher"}
          >
            {collapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>
        </div>

        <nav className="flex-1 px-2 space-y-0.5 mt-2">
          {ITEMS.map((it) => {
            const active = it.href === "/admin" ? path === "/admin" : path.startsWith(it.href);
            const Icon = it.icon;
            return (
              <Link
                key={it.href}
                href={it.href}
                title={it.label}
                className={`flex items-center ${collapsed ? "justify-center" : ""} gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  active ? "bg-primary text-ink" : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                {!collapsed && it.label}
              </Link>
            );
          })}
        </nav>

        <div className={`border-t border-white/10 p-3 ${collapsed ? "flex justify-center" : ""}`}>
          {!collapsed && (
            <>
              <p className="text-sm font-medium truncate">{name}</p>
              <p className="text-white/40 text-xs mb-2">Administrador</p>
            </>
          )}
          <LogoutButton
            className="!text-white/60 hover:!text-white"
            label={collapsed ? "" : "Sair"}
          />
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
