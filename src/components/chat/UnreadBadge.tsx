"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Mostra um contador de mensagens não lidas de uma conversa, em tempo real.
 * `dot`: só uma bolinha (sem número).
 */
export function UnreadBadge({
  conversationId,
  currentUserId,
  dot = false,
  className = "",
}: {
  conversationId: string;
  currentUserId: string;
  dot?: boolean;
  className?: string;
}) {
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    async function refresh() {
      const { count: c } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", conversationId)
        .neq("sender_id", currentUserId)
        .is("read_at", null);
      if (active) setCount(c ?? 0);
    }
    refresh();
    const channel = supabase
      .channel(`unread:${conversationId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, refresh)
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId, supabase]);

  if (count === 0) return null;

  if (dot) {
    return <span className={`inline-block h-2.5 w-2.5 rounded-full bg-danger ${className}`} />;
  }
  return (
    <span className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-danger text-white text-[11px] font-bold ${className}`}>
      {count > 9 ? "9+" : count}
    </span>
  );
}
