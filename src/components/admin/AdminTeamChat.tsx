"use client";

import { useState } from "react";
import { ArrowLeft, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ConversationThread } from "@/components/chat/ConversationThread";

type Admin = { id: string; full_name: string };

export function AdminTeamChat({ admins, currentUserId }: { admins: Admin[]; currentUserId: string }) {
  const [sel, setSel] = useState<Admin | null>(null);
  const [conv, setConv] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function open(a: Admin) {
    setSel(a);
    setConv(null);
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.rpc("start_admin_chat", { p_other: a.id });
    setConv((data as string) ?? null);
    setLoading(false);
  }

  if (admins.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-black/5 p-12 text-center">
        <Users className="h-10 w-10 text-gray-light mx-auto mb-2" strokeWidth={1.5} />
        <p className="text-ink font-medium">Nenhum outro admin cadastrado</p>
        <p className="text-sm text-gray-light mt-1">Adicione membros em Usuários para conversar aqui.</p>
      </div>
    );
  }

  if (sel) {
    return (
      <div className="max-w-2xl space-y-3">
        <button onClick={() => setSel(null)} className="inline-flex items-center gap-1 text-sm text-gray hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Voltar à equipe
        </button>
        <div className="bg-white rounded-2xl border border-black/5 p-4">
          <p className="font-semibold text-ink">{sel.full_name}</p>
          <p className="text-xs text-gray-light">Conversa interna da equipe</p>
        </div>
        {loading ? (
          <p className="text-sm text-gray-light text-center py-6">Abrindo conversa...</p>
        ) : conv ? (
          <ConversationThread conversationId={conv} currentUserId={currentUserId} height={440} />
        ) : null}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-black/5 overflow-hidden max-w-2xl">
      <ul className="divide-y divide-black/5">
        {admins.map((a) => (
          <li key={a.id}>
            <button onClick={() => open(a)} className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-black/[0.015]">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-canvas font-semibold text-ink">
                {a.full_name.charAt(0)}
              </div>
              <div>
                <p className="font-medium text-ink">{a.full_name}</p>
                <p className="text-xs text-gray-light">Administrador</p>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
