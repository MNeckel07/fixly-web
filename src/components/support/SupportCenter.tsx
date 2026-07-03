"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, LifeBuoy, ArrowLeft, Paperclip } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea, Select } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { ConversationThread } from "@/components/chat/ConversationThread";

export type Ticket = {
  id: string;
  category: string;
  priority: string;
  subject: string;
  status: string;
  created_at: string;
  conversation_id: string | null;
};

const CATEGORIES = ["Dúvida", "Problema técnico", "Pagamento", "Conta e cadastro", "Serviço", "Outro"];
const TICKET_STATUS: Record<string, string> = { aberto: "Aberto", em_andamento: "Em andamento", resolvido: "Resolvido" };

export function SupportCenter({ currentUserId, tickets }: { currentUserId: string; tickets: Ticket[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({ category: CATEGORIES[0], priority: "normal", subject: "", description: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const supabase = createClient();
    const { data: tid, error } = await supabase.rpc("create_ticket", {
      p_category: form.category,
      p_priority: form.priority,
      p_subject: form.subject,
      p_description: form.description,
      p_attachment: null,
    });
    if (error || !tid) {
      setBusy(false);
      return;
    }
    // anexo (opcional): sobe no bucket do chat e vira mensagem
    if (file) {
      const { data: tk } = await supabase.from("tickets").select("conversation_id").eq("id", tid).single();
      const conv = tk?.conversation_id;
      if (conv) {
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `${conv}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("chat").upload(path, file);
        if (!upErr) {
          await supabase.from("messages").insert({
            conversation_id: conv,
            sender_id: currentUserId,
            attachment_path: path,
            attachment_type: file.type.startsWith("image/") ? "image" : "file",
            attachment_name: file.name,
          });
        }
      }
    }
    setBusy(false);
    setCreating(false);
    setForm({ category: CATEGORIES[0], priority: "normal", subject: "", description: "" });
    setFile(null);
    router.refresh();
  }

  // Ticket aberto (chat)
  if (selected?.conversation_id) {
    return (
      <div className="max-w-2xl mx-auto space-y-3">
        <button onClick={() => setSelected(null)} className="inline-flex items-center gap-1 text-sm text-gray hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Voltar aos tickets
        </button>
        <div className="bg-white rounded-2xl border border-black/5 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-ink">{selected.subject}</p>
              <p className="text-xs text-gray-light">{selected.category}</p>
            </div>
            <span className="text-xs font-semibold text-gray bg-black/[0.05] px-2.5 py-1 rounded-full">
              {TICKET_STATUS[selected.status] ?? selected.status}
            </span>
          </div>
        </div>
        <ConversationThread conversationId={selected.conversation_id} currentUserId={currentUserId} height={440} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Suporte</h1>
          <p className="text-gray">Abra um chamado e converse com nossa equipe.</p>
        </div>
        {!creating && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Novo ticket
          </Button>
        )}
      </div>

      {creating && (
        <form onSubmit={submit} className="bg-white rounded-2xl border border-black/5 p-6 space-y-4 mb-6">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Categoria</Label>
              <Select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}>
                <option value="baixa">Baixa</option>
                <option value="normal">Normal</option>
                <option value="alta">Alta</option>
              </Select>
            </div>
          </div>
          <div>
            <Label>Assunto</Label>
            <Input required value={form.subject} onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))} placeholder="Resumo do que você precisa" />
          </div>
          <div>
            <Label>Descreva o que aconteceu</Label>
            <Textarea required rows={4} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Conte os detalhes para agilizarmos o atendimento" />
          </div>
          <div>
            <Label>Anexo (opcional)</Label>
            <label className="flex items-center gap-2 text-sm text-gray cursor-pointer">
              <span className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 hover:bg-black/[0.03]">
                <Paperclip className="h-4 w-4" /> {file ? file.name : "Escolher arquivo"}
              </span>
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <div className="flex gap-2">
            <Button type="submit" loading={busy}>Abrir ticket</Button>
            <Button type="button" variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-black/5 overflow-hidden">
        {tickets.length === 0 ? (
          <div className="p-10 text-center">
            <LifeBuoy className="h-9 w-9 text-gray-light mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-ink font-medium">Nenhum ticket aberto</p>
            <p className="text-sm text-gray-light mt-1">Precisa de ajuda? Abra um novo ticket.</p>
          </div>
        ) : (
          <ul className="divide-y divide-black/5">
            {tickets.map((t) => (
              <li key={t.id}>
                <button onClick={() => setSelected(t)} className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-black/[0.015]">
                  <div>
                    <p className="font-medium text-ink">{t.subject}</p>
                    <p className="text-xs text-gray-light">{t.category} · {new Date(t.created_at).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <span className="text-xs font-semibold text-gray bg-black/[0.05] px-2.5 py-1 rounded-full">
                    {TICKET_STATUS[t.status] ?? t.status}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
