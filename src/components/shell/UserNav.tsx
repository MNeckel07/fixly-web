"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Plus, Clock, User, Inbox, Wrench, Wallet, LifeBuoy, Images, type LucideIcon } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { LogoutButton } from "@/components/auth/LogoutButton";

const ICONS: Record<string, LucideIcon> = {
  home: Home,
  plus: Plus,
  clock: Clock,
  user: User,
  inbox: Inbox,
  wrench: Wrench,
  wallet: Wallet,
  support: LifeBuoy,
  profiler: Images,
};

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS };

export function UserNav({ items, name }: { items: NavItem[]; name: string }) {
  const path = usePathname();
  const isActive = (href: string) =>
    href === items[0].href ? path === href : path.startsWith(href);

  return (
    <>
      {/* Top bar (desktop) */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-black/5">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 h-16">
          <Link href={items[0].href} aria-label="Início" className="transition hover:opacity-80">
            <Logo size={24} variant="dark" />
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {items.map((it) => {
              const Icon = ICONS[it.icon];
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive(it.href)
                      ? "bg-primary/15 text-primary-dark"
                      : "text-gray hover:bg-black/[0.04]"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
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
          const Icon = ICONS[it.icon];
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${
                isActive(it.href) ? "text-primary-dark" : "text-gray-light"
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={1.75} />
              {it.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
