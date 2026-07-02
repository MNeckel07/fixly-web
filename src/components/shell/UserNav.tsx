"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { LogoutButton } from "@/components/auth/LogoutButton";

export type NavItem = { href: string; label: string; icon: string };

export function UserNav({
  items,
  name,
}: {
  items: NavItem[];
  name: string;
}) {
  const path = usePathname();
  return (
    <>
      {/* Top bar (desktop) */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-black/5">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 h-16">
          <Logo size={24} variant="dark" />
          <nav className="hidden md:flex items-center gap-1">
            {items.map((it) => {
              const active =
                it.href === items[0].href
                  ? path === it.href
                  : path.startsWith(it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-primary/15 text-primary-dark"
                      : "text-gray hover:bg-black/[0.04]"
                  }`}
                >
                  <span>{it.icon}</span>
                  {it.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm text-gray">Olá, {name.split(" ")[0]}</span>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Bottom tab bar (mobile) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-white border-t border-black/5 flex">
        {items.map((it) => {
          const active =
            it.href === items[0].href ? path === it.href : path.startsWith(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${
                active ? "text-primary-dark" : "text-gray-light"
              }`}
            >
              <span className="text-lg">{it.icon}</span>
              {it.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
