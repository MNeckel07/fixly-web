"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CheckCheck,
  Paperclip,
  Send,
  MessageSquare,
  ArrowLeft,
  FileText,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABELS, type Role } from "@/lib/brand";

type Participant = { profile: { id: string; full_name: string; role: Role } };
type Conversation = {
  id: string;
  type: "aprovacao" | "servico";
  created_at: string;
  participants: Participant[];
};
type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  attachment_path: string | null;
  attachment_type: string | null;
  attachment_name: string | null;
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function Messenger({
  currentUserId,
  initialConversationId,
}: {
  currentUserId: string;
  initialConversationId?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string | null>(initialConversationId ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const other = useCallback(
    (c: Conversation) =>
      c.participants.find((p) => p.profile.id !== currentUserId)?.profile ??
      c.participants[0]?.profile,
    [currentUserId],
  );

  // carrega lista de conversas
  const loadConversations = useCallback(async () => {
    const { data: parts } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("profile_id", currentUserId);
    const ids = (parts ?? []).map((p: any) => p.conversation_id);
    if (ids.length === 0) return setConversations([]);
    const { data } = await supabase
      .from("conversations")
      .select("id, type, created_at, participants:conversation_participants(profile:profiles(id, full_name, role))")
      .in("id", ids)
      .order("created_at", { ascending: false });
    setConversations((data as any) ?? []);
  }, [supabase, currentUserId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // carrega mensagens da conversa selecionada + marca como lidas
  const loadMessages = useCallback(
    async (convId: string) => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true });
      setMessages((data as Message[]) ?? []);
      // marca incoming como lidas
      await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString(), delivered_at: new Date().toISOString() })
        .eq("conversation_id", convId)
        .neq("sender_id", currentUserId)
        .is("read_at", null);
    },
    [supabase, currentUserId],
  );

  useEffect(() => {
    if (selected) loadMessages(selected);
  }, [selected, loadMessages]);

  // realtime: novas mensagens e atualizações (recibos) da conversa aberta
  useEffect(() => {
    if (!selected) return;
    const channel = supabase
      .channel(`msg:${selected}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${selected}` },
        async (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (m.sender_id !== currentUserId) {
            await supabase
              .from("messages")
              .update({ delivered_at: new Date().toISOString(), read_at: new Date().toISOString() })
              .eq("id", m.id);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${selected}` },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [selected, supabase, currentUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    if (!selected || (!text.trim() && !fileRef.current?.files?.length)) return;
    setSending(true);
    const body = text.trim() || null;
    setText("");
    const { data, error } = await supabase
      .from("messages")
      .insert({ conversation_id: selected, sender_id: currentUserId, body })
      .select("*")
      .single();
    if (!error && data) setMessages((prev) => [...prev, data as Message]);
    setSending(false);
  }

  async function sendAttachment(file: File) {
    if (!selected) return;
    setSending(true);
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `${selected}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("chat").upload(path, file);
    if (!upErr) {
      const isImg = file.type.startsWith("image/");
      const { data } = await supabase
        .from("messages")
        .insert({
          conversation_id: selected,
          sender_id: currentUserId,
          attachment_path: path,
          attachment_type: isImg ? "image" : "file",
          attachment_name: file.name,
        })
        .select("*")
        .single();
      if (data) setMessages((prev) => [...prev, data as Message]);
    }
    setSending(false);
  }

  const sel = conversations.find((c) => c.id === selected);

  return (
    <div className="flex h-[calc(100vh-8rem)] md:h-[calc(100vh-6rem)] rounded-2xl border border-black/5 bg-white overflow-hidden">
      {/* Lista de conversas */}
      <div className={`${selected ? "hidden md:flex" : "flex"} w-full md:w-80 flex-col border-r border-black/5`}>
        <div className="px-4 h-14 flex items-center border-b border-black/5">
          <h2 className="font-semibold text-ink">Mensagens</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <p className="p-6 text-sm text-gray-light text-center">Nenhuma conversa ainda.</p>
          ) : (
            conversations.map((c) => {
              const o = other(c);
              return (
                <button
                  key={c.id}
                  onClick={() => setSelected(c.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/[0.02] transition ${
                    selected === c.id ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-canvas font-semibold text-ink shrink-0">
                    {o?.full_name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-ink truncate">{o?.full_name}</p>
                    <p className="text-xs text-gray-light">
                      {c.type === "aprovacao" ? "Análise de cadastro" : "Serviço"}
                      {o && ` · ${ROLE_LABELS[o.role]}`}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Thread */}
      <div className={`${selected ? "flex" : "hidden md:flex"} flex-1 flex-col min-w-0`}>
        {!sel ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-light">
            <MessageSquare className="h-10 w-10 mb-2" strokeWidth={1.5} />
            <p className="text-sm">Selecione uma conversa</p>
          </div>
        ) : (
          <>
            <div className="h-14 flex items-center gap-3 px-4 border-b border-black/5">
              <button className="md:hidden text-gray" onClick={() => setSelected(null)}>
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-canvas font-semibold text-ink text-sm">
                {other(sel)?.full_name.charAt(0)}
              </div>
              <div>
                <p className="font-medium text-ink leading-tight">{other(sel)?.full_name}</p>
                <p className="text-xs text-gray-light">
                  {sel.type === "aprovacao" ? "Análise de cadastro" : "Serviço"}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-canvas">
              {messages.map((m) => (
                <MessageBubble key={m.id} m={m} mine={m.sender_id === currentUserId} supabase={supabase} />
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="p-3 border-t border-black/5 flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) sendAttachment(f);
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="p-2 text-gray hover:text-ink rounded-lg hover:bg-black/[0.04]"
                title="Anexar"
              >
                <Paperclip className="h-5 w-5" strokeWidth={1.75} />
              </button>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Escreva uma mensagem..."
                className="flex-1 h-11 px-4 rounded-full border border-black/10 outline-none focus:border-primary text-[15px]"
              />
              <button
                onClick={send}
                disabled={sending}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-ink hover:bg-primary-dark disabled:opacity-50"
              >
                <Send className="h-5 w-5" strokeWidth={1.75} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MessageBubble({
  m,
  mine,
  supabase,
}: {
  m: Message;
  mine: boolean;
  supabase: ReturnType<typeof createClient>;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!m.attachment_path) return;
    supabase.storage
      .from("chat")
      .createSignedUrl(m.attachment_path, 3600)
      .then(({ data }) => setUrl(data?.signedUrl ?? null));
  }, [m.attachment_path, supabase]);

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[78%] rounded-2xl px-3 py-2 ${
          mine ? "bg-primary text-ink rounded-br-sm" : "bg-white border border-black/5 rounded-bl-sm"
        }`}
      >
        {m.attachment_type === "image" && url && (
          <a href={url} target="_blank" rel="noreferrer">
            <img src={url} alt={m.attachment_name ?? ""} className="rounded-lg max-h-56 mb-1" />
          </a>
        )}
        {m.attachment_type === "file" && (
          <a
            href={url ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-sm underline mb-1"
          >
            <FileText className="h-4 w-4" /> {m.attachment_name ?? "arquivo"}
          </a>
        )}
        {m.body && <p className="text-[15px] whitespace-pre-wrap break-words">{m.body}</p>}
        <div className={`flex items-center gap-1 justify-end mt-0.5 ${mine ? "text-ink/50" : "text-gray-light"}`}>
          <span className="text-[10px]">{fmtTime(m.created_at)}</span>
          {mine &&
            (m.read_at ? (
              <CheckCheck className="h-3.5 w-3.5 text-info" />
            ) : m.delivered_at ? (
              <CheckCheck className="h-3.5 w-3.5" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            ))}
        </div>
      </div>
    </div>
  );
}
