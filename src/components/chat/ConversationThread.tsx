"use client";

import { useEffect, useRef, useState } from "react";
import { Check, CheckCheck, Paperclip, Send, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type Message = {
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

export function ConversationThread({
  conversationId,
  currentUserId,
  height = 420,
}: {
  conversationId: string;
  currentUserId: string;
  height?: number;
}) {
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (!active) return;
      setMessages((data as Message[]) ?? []);
      await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString(), delivered_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .neq("sender_id", currentUserId)
        .is("read_at", null);
    })();
    return () => { active = false; };
  }, [conversationId, currentUserId, supabase]);

  useEffect(() => {
    const channel = supabase
      .channel(`thread:${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        async (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (m.sender_id !== currentUserId) {
            await supabase.from("messages")
              .update({ delivered_at: new Date().toISOString(), read_at: new Date().toISOString() })
              .eq("id", m.id);
          }
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, currentUserId, supabase]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send() {
    if (!text.trim()) return;
    setSending(true);
    const body = text.trim();
    setText("");
    const { data } = await supabase
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: currentUserId, body })
      .select("*").single();
    if (data) setMessages((prev) => (prev.some((x) => x.id === (data as Message).id) ? prev : [...prev, data as Message]));
    setSending(false);
  }

  async function sendAttachment(file: File) {
    setSending(true);
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `${conversationId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("chat").upload(path, file);
    if (!error) {
      const { data } = await supabase.from("messages").insert({
        conversation_id: conversationId, sender_id: currentUserId,
        attachment_path: path, attachment_type: file.type.startsWith("image/") ? "image" : "file",
        attachment_name: file.name,
      }).select("*").single();
      if (data) setMessages((prev) => [...prev, data as Message]);
    }
    setSending(false);
  }

  return (
    <div className="flex flex-col rounded-2xl border border-black/5 bg-white overflow-hidden" style={{ height }}>
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-canvas">
        {messages.length === 0 && (
          <p className="text-center text-sm text-gray-light py-8">Nenhuma mensagem ainda. Diga olá.</p>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} m={m} mine={m.sender_id === currentUserId} supabase={supabase} />
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="p-3 border-t border-black/5 flex items-center gap-2">
        <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) sendAttachment(f); e.target.value = ""; }} />
        <button onClick={() => fileRef.current?.click()} className="p-2 text-gray hover:text-ink rounded-lg hover:bg-black/[0.04]" title="Anexar">
          <Paperclip className="h-5 w-5" strokeWidth={1.75} />
        </button>
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Escreva uma mensagem..." className="flex-1 h-11 px-4 rounded-full border border-black/10 outline-none focus:border-primary text-[15px]" />
        <button onClick={send} disabled={sending} className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-ink hover:bg-primary-dark disabled:opacity-50">
          <Send className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}

function Bubble({ m, mine, supabase }: { m: Message; mine: boolean; supabase: ReturnType<typeof createClient> }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!m.attachment_path) return;
    supabase.storage.from("chat").createSignedUrl(m.attachment_path, 3600).then(({ data }) => setUrl(data?.signedUrl ?? null));
  }, [m.attachment_path, supabase]);

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[78%] rounded-2xl px-3 py-2 ${mine ? "bg-primary text-ink rounded-br-sm" : "bg-white border border-black/5 rounded-bl-sm"}`}>
        {m.attachment_type === "image" && url && (
          <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={m.attachment_name ?? ""} className="rounded-lg max-h-56 mb-1" /></a>
        )}
        {m.attachment_type === "file" && (
          <a href={url ?? "#"} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm underline mb-1">
            <FileText className="h-4 w-4" /> {m.attachment_name ?? "arquivo"}
          </a>
        )}
        {m.body && <p className="text-[15px] whitespace-pre-wrap break-words">{m.body}</p>}
        <div className={`flex items-center gap-1 justify-end mt-0.5 ${mine ? "text-ink/50" : "text-gray-light"}`}>
          <span className="text-[10px]">{fmtTime(m.created_at)}</span>
          {mine && (m.read_at ? <CheckCheck className="h-3.5 w-3.5 text-info" /> : m.delivered_at ? <CheckCheck className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />)}
        </div>
      </div>
    </div>
  );
}
