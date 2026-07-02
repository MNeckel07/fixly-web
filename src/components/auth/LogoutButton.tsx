"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton({
  className = "",
  children = "Sair",
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  async function handle() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }
  return (
    <button
      onClick={handle}
      className={`text-sm text-gray hover:text-danger transition ${className}`}
    >
      {children}
    </button>
  );
}
