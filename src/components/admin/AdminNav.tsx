"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", label: "Visão geral", icon: "📊" },
  { href: "/admin/cadastros", label: "Aprovações", icon: "🗂️" },
  { href: "/admin/usuarios", label: "Usuários", icon: "👥" },
  { href: "/admin/servicos", label: "Serviços", icon: "🧰" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="mt-6 space-y-1">
      {ITEMS.map((it) => {
        const active =
          it.href === "/admin" ? path === "/admin" : path.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              active
                ? "bg-primary text-ink"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            <span>{it.icon}</span>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
