"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Contador de mensagens não lidas de TODAS as conversas de um tipo.
 *
 * Existe para o menu: sem ele, a pessoa só descobre que recebeu mensagem
 * abrindo o serviço certo — foi exatamente a reclamação ("colocar notificação
 * de mensagem nas conversas", "para o cara saber em qual é a notificação").
 *
 * A RLS já limita `messages` às conversas de que a pessoa participa, então a
 * conta sai certa sem nenhum filtro de usuário além do remetente.
 */
export function UnreadNavBadge({
  currentUserId,
  tipo,
  className = "",
}: {
  currentUserId: string;
  /** `servico` = chat com a outra ponta; `ticket` = suporte. */
  tipo: "servico" | "ticket";
  className?: string;
}) {
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const [count, setCount] = useState(0);

  useEffect(() => {
    let ativo = true;
    async function refresh() {
      const { count: c } = await supabase
        .from("messages")
        .select("id, conversation:conversations!inner(type)", { count: "exact", head: true })
        .eq("conversation.type", tipo)
        .neq("sender_id", currentUserId)
        .is("read_at", null);
      if (ativo) setCount(c ?? 0);
    }
    refresh();

    const canal = supabase
      .channel(`unread-nav:${tipo}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, refresh)
      .subscribe();
    return () => {
      ativo = false;
      supabase.removeChannel(canal);
    };
  }, [currentUserId, tipo, supabase]);

  if (count === 0) return null;
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[10px] font-bold ${className}`}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}
