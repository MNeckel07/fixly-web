-- ============================================================
--  0037 — RODADA *FIXLY 12*
--
--  Duas coisas independentes, juntas porque as duas são de catálogo/texto e
--  nenhuma toca em dinheiro:
--    1) fechar o furo da máscara de contato;
--    2) criar a categoria "Frete e carreto".
-- ============================================================

-- ════════════════════════════════════════════════════════════
--  1) MÁSCARA DE CONTATO — o número escrito com espaço passava
-- ════════════════════════════════════════════════════════════
/**
 * A máscara da 0026 tinha três regras: e-mail, telefone formatado e
 * `\d{8,}` (oito dígitos SEGUIDOS). No teste do Fixly 12 o dono escreveu
 *
 *     9 9 5 4 0 0 1 9 5
 *
 * e passou inteiro: não existem oito dígitos seguidos ali, existe um dígito,
 * um espaço, um dígito. As três regras erraram junto.
 *
 * A regra nova conta DÍGITOS, não caracteres: oito ou mais dígitos com
 * qualquer separador no meio (espaço, ponto, hífen, underline). Pega
 * "9 9 5 4 0 0 1 9 5", "9.9.5.4.0.0.1.9.5" e — de quebra — um furo ANTIGO que
 * ninguém tinha visto: **celular sem DDD**, "99540-0195", que escapava das três
 * regras velhas (a do telefone exige o DDD, e não há oito dígitos seguidos).
 *
 * Ela termina em `\d` de propósito. Com `(\d[\s._-]*){8,}` o último separador
 * era engolido junto e "zap 9 9 5 ... 5 liga" virava "zap [contato oculto]liga",
 * grudado. Terminar em dígito devolve o espaço à frase.
 *
 * ⚠️ ELA TEM QUE SER A ÚLTIMA. As anteriores já substituíram os casos
 * formatados por "[contato oculto]"; se esta rodasse antes, comeria pedaços
 * de telefone e sobraria lixo no meio da frase.
 *
 * ⚠️ E ELA NÃO PODE COMER O PREÇO. `{8,}` (oito dígitos, não seis) é o que
 * segura "R$ 1.250,00" — sete dígitos com pontuação. Um valor combinado no
 * chat não pode virar "[contato oculto]", senão a máscara quebra a
 * negociação que ela deveria proteger.
 *
 * O que ainda passa: número escrito por extenso ("nove nove cinco..."). Fechar
 * isso exigiria interpretar texto, e o custo de um falso positivo (apagar uma
 * frase legítima) é maior que o do furo. O caminho preguiçoso — que é o que
 * quase todo mundo usa — está fechado.
 */
create or replace function public.mask_contact_info(p text) returns text
language sql immutable as $$
  select case when p is null then null else
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(p,
            '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[contato oculto]', 'g'),
          '(\+?\d{1,3}[\s.-]?)?\(?\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}', '[contato oculto]', 'g'),
        '\d{8,}', '[contato oculto]', 'g'),
      -- 8+ dígitos com qualquer separador no meio: "9 9 5 4 0 0 1 9 5",
      -- "9.9.5.4.0.0.1.9.5" e o celular sem DDD "99540-0195"
      '(\d[\s._-]*){7,}\d', '[contato oculto]', 'g')
  end;
$$;

-- ════════════════════════════════════════════════════════════
--  2) CATEGORIA "FRETE E CARRETO"
-- ════════════════════════════════════════════════════════════
/**
 * Pedido do dono no Fixly 12: *"colocar frete ali, como um serviço, tipo, ah
 * preciso levar este armário para outra casa, preciso levar esta cama para
 * outro lugar"*.
 *
 * ⚠️ ISTO OCUPA A PALAVRA "FRETE". Até a 0036, "frete" era o nome da TAXA DE
 * DESLOCAMENTO da proposta (`proposals.travel_fee`). Com a categoria nova, a
 * mesma palavra passaria a significar duas coisas na mesma tela — por isso, no
 * mesmo commit, o rótulo da taxa vira só "Deslocamento" no formulário da
 * proposta. Se um dia alguém reverter só um dos dois lados, a ambiguidade
 * volta.
 *
 * `featured = false` de propósito: a grade em destaque é dos serviços de casa,
 * e frete não é reparo. Ele aparece em "Ver todos" e na busca (o léxico do
 * `serviceSearch` manda "mudança", "carreto" e "transporte" para cá).
 */
insert into public.service_categories (slug, name, icon, color, base_price, featured, hidden)
values ('frete', 'Frete e carreto', 'truck', '#0EA5E9', 120, false, false)
on conflict (slug) do update
  set name = excluded.name,
      icon = excluded.icon,
      color = excluded.color;
