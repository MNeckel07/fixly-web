"use client";

import { useState } from "react";
import { ArrowLeft, LifeBuoy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ConversationThread } from "@/components/chat/ConversationThread";
import { ROLE_LABELS, type Role } from "@/lib/brand";

type Ticket = {
  id: string;
  category: string;
  priority: string;
  subject: string;
  description: string;
  status: string;
  created_at: string;
  conversation_id: string | null;
  opener: { full_name: string; role: Role } | null;
};

const STATUS: Record<string, string> = { aberto: "Aberto", em_andamento: "Em andamento", resolvido: "Resolvido" };
const STATUS_TONE: Record<string, string> = {
  aberto: "bg-warning/10 text-warning",
  em_andamento: "bg-info/10 text-info",
  resolvido: "bg-success/10 text-success",
};

export function AdminTickets({ tickets, currentUserId }: { tickets: Ticket[]; currentUserId: string }) {
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [conv, setConv] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  async function open(t: Ticket) {
    setSelected(t);
    setOpening(true);
    const supabase = createClient();
    const { data } = await supabase.rpc("admin_open_ticket", { p_ticket_id: t.id });
    setConv((data as string) ?? t.conversation_id);
    setOpening(false);
  }

  async function setStatus(status: string) {
    if (!selected) return;
    const supabase = createClient();
    await supabase.from("tickets").update({ status }).eq("id", selected.id);
    setSelected({ ...selected, status });
  }

  if (selected) {
    return (
      <div className="space-y-3">
        <button onClick={() => { setSelected(null); setConv(null); }} className="inline-flex items-center gap-1 text-sm text-gray hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Voltar aos chamados
        </button>
        <div className="bg-white rounded-2xl border border-black/5 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-ink">{selected.subject}</p>
              <p className="text-sm text-gray-light">
                {selected.category} · {selected.opener?.full_name} ({selected.opener && ROLE_LABELS[selected.opener.role]})
              </p>
            </div>
            <select value={selected.status} onChange={(e) => setStatus(e.target.value)} className="text-sm border border-black/10 rounded-lg px-2 py-1.5">
              <option value="aberto">Aberto</option>
              <option value="em_andamento">Em andamento</option>
              <option value="resolvido">Resolvido</option>
            </select>
          </div>
          <p className="text-sm text-gray bg-canvas rounded-xl px-4 py-3 mt-3">{selected.description}</p>
        </div>
        {opening ? (
          <p className="text-sm text-gray-light text-center py-6">Abrindo conversa...</p>
        ) : conv ? (
          <ConversationThread conversationId={conv} currentUserId={currentUserId} height={420} />
        ) : null}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-black/5 overflow-hidden">
      {tickets.length === 0 ? (
        <div className="p-12 text-center">
          <LifeBuoy className="h-10 w-10 text-gray-light mx-auto mb-2" strokeWidth={1.5} />
          <p className="text-ink font-medium">Nenhum chamado no momento</p>
        </div>
      ) : (
        <ul className="divide-y divide-black/5">
          {tickets.map((t) => (
            <li key={t.id}>
              <button onClick={() => open(t)} className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-black/[0.015]">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-ink truncate">{t.subject}</p>
                    {t.priority === "alta" && <span className="text-[10px] font-bold text-danger">ALTA</span>}
                  </div>
                  <p className="text-xs text-gray-light">
                    {t.category} · {t.opener?.full_name ?? "—"} · {new Date(t.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_TONE[t.status] ?? "bg-black/[0.05] text-gray"}`}>
                  {STATUS[t.status] ?? t.status}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
