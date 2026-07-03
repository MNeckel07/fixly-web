"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function LogoutButton({
  className = "",
  label = "Sair",
  showIcon = true,
}: {
  className?: string;
  label?: string;
  showIcon?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function confirm() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-2 text-sm text-gray hover:text-danger transition ${className}`}
      >
        {showIcon && <LogOut className="h-4 w-4" strokeWidth={1.75} />}
        {label}
      </button>
      <ConfirmDialog
        open={open}
        title="Sair da conta?"
        description="Você voltará para a tela de login. Qualquer ação não salva será perdida."
        confirmLabel="Sair"
        cancelLabel="Ficar"
        variant="danger"
        loading={loading}
        onConfirm={confirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
