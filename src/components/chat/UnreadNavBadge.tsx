"use client";

import { useEffect, useId, useRef, useState } from "react";
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
 *
 * ⚠️ O NOME DO CANAL PRECISA SER ÚNICO POR INSTÂNCIA — e isto derrubou a área
 * logada inteira em produção (24/08/2026). O `UserNav` monta este componente
 * DUAS vezes para o mesmo `tipo`: uma no menu do desktop e outra na barra de
 * baixo do celular. Com um nome fixo (`unread-nav:servico`), o
 * `supabase.channel()` devolvia **o mesmo canal** para as duas, a segunda
 * chamava `.on("postgres_changes", …)` num canal já inscrito e o Supabase
 * lançava "cannot add postgres_changes callbacks after subscribe()". O erro
 * subia sem tratamento e a página inteira morria — o navegador mostrava
 * "This page couldn't load", que parece queda de servidor e não é.
 * `useId()` dá um sufixo estável e diferente para cada instância.
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
  const instancia = useId();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let ativo = true;
    async function refresh() {
      try {
        const { count: c } = await supabase
          .from("messages")
          .select("id, conversation:conversations!inner(type)", { count: "exact", head: true })
          .eq("conversation.type", tipo)
          .neq("sender_id", currentUserId)
          .is("read_at", null);
        if (ativo) setCount(c ?? 0);
      } catch {
        /* contador é enfeite: se a consulta falhar, fica como está */
      }
    }
    refresh();

    /**
     * Todo o bloco vai de try/catch por princípio: este componente vive no
     * menu de TODAS as telas logadas, então qualquer exceção aqui tira o app
     * do ar. Um contador que não atualiza é um detalhe; um app que não abre,
     * não.
     */
    let canal: ReturnType<typeof supabase.channel> | null = null;
    try {
      canal = supabase
        .channel(`unread-nav:${tipo}:${instancia}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, refresh)
        .subscribe();
    } catch (e) {
      console.error("[UnreadNavBadge] realtime indisponível:", e);
    }

    return () => {
      ativo = false;
      try {
        if (canal) supabase.removeChannel(canal);
      } catch {
        /* nada a fazer na desmontagem */
      }
    };
  }, [currentUserId, tipo, supabase, instancia]);

  if (count === 0) return null;
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[10px] font-bold ${className}`}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}
