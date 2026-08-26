-- ============================================================
--  FIXLY — 0036: frete, negociação com fim, contestação de
--                avaliação e a política de cancelamento
--
--  Quatro pedidos da rodada de testes (Fixly 11):
--    1) "Adicionar frete nas opções de serviço"
--    2) "as propostas tão infinitas... tem que ter duas voltas de valor"
--    3) "colocar a opção de contestar uma avaliação quando menor que 3 estrelas"
--    4) a política de cancelamento escrita pelo dono (itens 3 a 8), que fala em
--       retenção de 30%/50%, taxa de deslocamento e no-show.
--
--  ⚠️ Esta migração APERTA regras (limite de rodadas, novas exceções). Aplicar
--  JUNTO com o deploy do código, não antes: enquanto o código antigo estiver no
--  ar ele não sabe do limite e o usuário levaria erro sem explicação.
-- ============================================================

-- ════════════════════════════════════════════════════════════
--  1) FRETE / TAXA DE DESLOCAMENTO
--
--  Fica SEPARADO do preço do serviço de propósito, e não por capricho de
--  modelagem: a política de cancelamento (item 3.3 e 5.1) manda reter "o valor
--  da taxa de deslocamento" em duas situações. Se o frete estivesse somado
--  dentro de `price`, não haveria como saber quanto era — e a regra viraria
--  chute na hora que ela vale dinheiro.
-- ════════════════════════════════════════════════════════════

-- ⚠️ as colunas vêm ANTES de qualquer função desta migração: `accept_proposal`
-- grava `accepted_at`, e criar a função antes da coluna existir deixaria uma
-- bomba-relógio para o primeiro aceite depois do deploy.
alter table public.service_requests
  add column if not exists accepted_at   timestamptz,   -- 3.2: aceite do profissional
  add column if not exists departed_at   timestamptz,   -- 3.3: saiu para o local
  add column if not exists started_at    timestamptz,   -- 3.4: execução iniciada
  add column if not exists cancelled_at  timestamptz,
  add column if not exists cancelled_by  uuid references public.profiles(id),
  add column if not exists cancel_stage  text;          -- etapa apurada no cancelamento

alter table public.proposals
  add column if not exists travel_fee numeric not null default 0;

alter table public.service_requests
  add column if not exists travel_fee numeric not null default 0;

alter table public.proposals
  drop constraint if exists proposals_travel_fee_nao_negativo;
alter table public.proposals
  add constraint proposals_travel_fee_nao_negativo check (travel_fee >= 0);

-- ════════════════════════════════════════════════════════════
--  2) NEGOCIAÇÃO COM FIM — duas voltas de valor
--
--  Regra do dono: "fiz a proposta, volta uma contra, faço outra, e no máx volta
--  mais uma pro contratante aceitar; a última é o prestador que dá".
--
--  Traduzindo em rodadas de CONTRA-PROPOSTA (a proposta original não conta):
--    rodada 1 → contratante     rodada 2 → prestador
--    rodada 3 → contratante     rodada 4 → prestador  (valor final)
--  Depois da 4ª não há mais valor novo: o contratante aceita ou recusa.
--
--  A paridade (ímpar = contratante, par = prestador) é o que sustenta a regra,
--  por isso a 1ª rodada é obrigatoriamente do contratante. Não é restrição
--  nova na prática: o prestador que quer baixar o próprio preço usa "alterar"
--  (`submit_proposal`), que zera a negociação inteira.
-- ════════════════════════════════════════════════════════════

alter table public.proposals
  add column if not exists counter_rounds int not null default 0;

-- propostas antigas que já estavam em negociação: contam como 1 rodada feita
update public.proposals
   set counter_rounds = 1
 where counter_price is not null and counter_rounds = 0;

/** Quantas idas e voltas de VALOR a negociação aceita, no total. */
create or replace function public.fixly_max_counter_rounds() returns int
language sql immutable as $$ select 4 $$;

create or replace function public.counter_proposal(p_proposal_id uuid, p_price numeric)
returns uuid language plpgsql security definer set search_path = public as $$
declare pr public.proposals; r public.service_requests; v_max int; v_prox int;
begin
  select * into pr from public.proposals where id = p_proposal_id;
  if pr.id is null then raise exception 'Proposta não encontrada'; end if;

  select * into r from public.service_requests where id = pr.request_id;
  if r.provider_id is not null then raise exception 'Este pedido já tem profissional'; end if;
  if pr.status = 'recusada' then raise exception 'Esta proposta foi recusada'; end if;
  if auth.uid() not in (r.client_id, pr.provider_id) then raise exception 'Sem permissão'; end if;
  if p_price is null or p_price <= 0 then raise exception 'Informe um valor válido'; end if;

  -- não dá para contrapropor duas vezes seguidas: é a vez do outro responder
  if pr.counter_status = 'pendente' and pr.counter_by = auth.uid() then
    raise exception 'Aguarde a resposta da outra parte';
  end if;

  v_max  := public.fixly_max_counter_rounds();
  v_prox := coalesce(pr.counter_rounds, 0) + 1;

  if v_prox > v_max then
    raise exception 'A negociação chegou ao limite de % valores. O último valor é do profissional — aceite ou recuse.', v_max;
  end if;

  -- ímpar é do contratante, par é do prestador: é isso que garante que o
  -- ÚLTIMO valor (a rodada par final) seja sempre o do profissional
  if v_prox % 2 = 1 and auth.uid() <> r.client_id then
    raise exception 'A próxima contra-proposta é do contratante';
  end if;
  if v_prox % 2 = 0 and auth.uid() <> pr.provider_id then
    raise exception 'A próxima contra-proposta é do profissional';
  end if;

  update public.proposals
     set counter_price  = round(p_price, 2),
         counter_status = 'pendente',
         counter_by     = auth.uid(),
         counter_rounds = v_prox
   where id = pr.id;
  return pr.id;
end;
$$;

-- ════════════════════════════════════════════════════════════
--  3) PROPOSTA COM FRETE + reset da negociação ao alterar o preço
-- ════════════════════════════════════════════════════════════

create or replace function public.submit_proposal(
  p_request_id uuid, p_price numeric, p_eta int, p_message text,
  p_advance_pct int default 0, p_travel_fee numeric default 0
) returns uuid
language plpgsql security definer set search_path = public as $$
declare r public.service_requests;
begin
  select * into r from public.service_requests where id = p_request_id;
  if r.id is null then raise exception 'Pedido não encontrado'; end if;
  if r.provider_id is not null then raise exception 'Este pedido já foi atribuído'; end if;
  if r.target_provider_id is not null and r.target_provider_id <> auth.uid() then
    raise exception 'Este pedido é de outro profissional';
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'prestador' and status = 'aprovado') then
    raise exception 'Apenas prestadores aprovados podem propor';
  end if;
  if p_price is null or p_price <= 0 then raise exception 'Informe um valor válido'; end if;
  if coalesce(p_travel_fee, 0) < 0 then raise exception 'O frete não pode ser negativo'; end if;

  insert into public.proposals (request_id, provider_id, price, eta_minutes, message, status,
                                advance_pct, travel_fee)
  values (p_request_id, auth.uid(), round(p_price, 2), p_eta, p_message, 'enviada',
          least(greatest(coalesce(p_advance_pct, 0), 0), 50), round(coalesce(p_travel_fee, 0), 2))
  on conflict (request_id, provider_id)
    do update set price = excluded.price, eta_minutes = excluded.eta_minutes,
                  message = excluded.message, status = 'enviada',
                  advance_pct = excluded.advance_pct,
                  travel_fee = excluded.travel_fee,
                  -- preço novo = negociação do zero (inclusive as rodadas
                  -- gastas: senão "alterar" viraria a saída para negociar
                  -- infinitamente por fora do limite da 0036)
                  counter_price = null, counter_status = null, counter_by = null,
                  counter_rounds = 0;

  update public.service_requests set status = 'proposta_enviada'
    where id = p_request_id and status = 'buscando';
  return p_request_id;
end;
$$;

/**
 * A assinatura antiga (5 argumentos) SAI de cena.
 *
 * Tentador seria deixá-la como atalho para a nova — mas duas funções com o
 * mesmo nome, uma de 5 e outra de 6 argumentos com default, deixam a chamada
 * AMBÍGUA e o Postgres recusa ("function is not unique"). E manter as duas nem
 * é preciso: o PostgREST chama por NOME de parâmetro, então o app que ainda
 * não subiu, mandando os 5 de sempre, cai na nova com `p_travel_fee = 0`.
 */
drop function if exists public.submit_proposal(uuid, numeric, int, text, int);

/**
 * Aceite da proposta. Base: 0026 + o frete.
 * `final_price` passa a ser SERVIÇO + FRETE (é o que o cliente paga), e o
 * frete fica guardado à parte no pedido para a conta do cancelamento.
 */
create or replace function public.accept_proposal(p_proposal_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare pr public.proposals; r public.service_requests; conv uuid;
begin
  select * into pr from public.proposals where id = p_proposal_id;
  if pr.id is null then raise exception 'Proposta não encontrada'; end if;

  select * into r from public.service_requests where id = pr.request_id;
  if r.id is null then raise exception 'Pedido não encontrado'; end if;
  if r.client_id <> auth.uid() then raise exception 'Sem permissão'; end if;
  if r.provider_id is not null then raise exception 'Este pedido já tem profissional'; end if;
  if pr.status = 'recusada' then raise exception 'Esta proposta foi recusada'; end if;
  if pr.counter_status = 'pendente' then
    raise exception 'Responda a negociação em aberto antes de fechar.';
  end if;

  perform set_config('fixly.guard_bypass', 'on', true);
  update public.proposals set status = 'aceita' where id = pr.id;
  update public.proposals set status = 'recusada'
    where request_id = pr.request_id and id <> pr.id and status = 'enviada';
  update public.service_requests
     set provider_id  = pr.provider_id,
         final_price  = pr.price + coalesce(pr.travel_fee, 0),
         travel_fee   = coalesce(pr.travel_fee, 0),
         status       = 'aceito',
         accepted_at  = now(),
         advance_pct  = least(greatest(coalesce(pr.advance_pct, 0), 0), 50)
   where id = r.id;

  select id into conv from public.conversations
   where type = 'servico' and request_id = r.id and provider_id = pr.provider_id limit 1;
  if conv is null then
    insert into public.conversations (type, request_id, provider_id, chat_status)
    values ('servico', r.id, pr.provider_id, 'ativa') returning id into conv;
    insert into public.conversation_participants (conversation_id, profile_id)
    values (conv, r.client_id), (conv, pr.provider_id) on conflict do nothing;
  else
    update public.conversations set chat_status = 'ativa' where id = conv;
  end if;
  update public.conversations set chat_status = 'encerrada'
   where type = 'servico' and request_id = r.id and id <> conv and chat_status <> 'encerrada';

  perform set_config('fixly.guard_bypass', 'off', true);
  return r.id;
end;
$$;

-- ════════════════════════════════════════════════════════════
--  4) CONTESTAR UMA AVALIAÇÃO ABAIXO DE 3 ESTRELAS
--
--  Uma nota baixa injusta pesa duas vezes no Fixly: derruba a média E tira o
--  Selo. Sem canal de contestação, a única saída do profissional é pedir para o
--  cliente mudar a nota — que é exatamente a "manipulação de avaliações" que a
--  denúncia proíbe.
--
--  O corte em 3 estrelas é do dono. Acima disso não é reclamação, é opinião.
-- ════════════════════════════════════════════════════════════

alter table public.service_requests
  add column if not exists review_dispute        text,
  add column if not exists review_disputed_at    timestamptz,
  add column if not exists review_dispute_status text,      -- pendente | acolhida | negada
  add column if not exists review_dispute_note   text,      -- resposta do suporte
  add column if not exists review_hidden         boolean not null default false;

alter table public.service_requests
  drop constraint if exists review_dispute_status_valido;
alter table public.service_requests
  add constraint review_dispute_status_valido
  check (review_dispute_status is null or review_dispute_status in ('pendente','acolhida','negada'));

/** Nota mínima que ainda dá direito a contestar. */
create or replace function public.fixly_max_nota_contestavel() returns int
language sql immutable as $$ select 2 $$;   -- "menor que 3 estrelas"

create or replace function public.dispute_review(p_request_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.service_requests;
begin
  select * into r from public.service_requests where id = p_request_id;
  if r.id is null then raise exception 'Serviço não encontrado'; end if;
  if r.provider_id is distinct from auth.uid() then
    raise exception 'Somente o profissional avaliado pode contestar';
  end if;
  if r.rating is null then raise exception 'Este serviço ainda não foi avaliado'; end if;
  if r.rating > public.fixly_max_nota_contestavel() then
    raise exception 'Só é possível contestar avaliações abaixo de 3 estrelas';
  end if;
  if r.review_disputed_at is not null then
    raise exception 'Esta avaliação já foi contestada';
  end if;
  if length(coalesce(trim(p_reason), '')) < 20 then
    raise exception 'Explique o que aconteceu com pelo menos 20 caracteres — é o que permite apurar';
  end if;

  perform set_config('fixly.guard_bypass', 'on', true);
  update public.service_requests
     set review_dispute        = trim(p_reason),
         review_disputed_at    = now(),
         review_dispute_status = 'pendente'
   where id = p_request_id;
  perform set_config('fixly.guard_bypass', 'off', true);
end;
$$;

/**
 * Suporte decide. Acolher ESCONDE a avaliação (do perfil público e da média);
 * negar mantém tudo como estava. Em nenhum dos casos a nota é reescrita: o
 * histórico continua auditável.
 */
create or replace function public.resolve_review_dispute(
  p_request_id uuid, p_acolhida boolean, p_note text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Sem permissão'; end if;

  perform set_config('fixly.guard_bypass', 'on', true);
  update public.service_requests
     set review_dispute_status = case when p_acolhida then 'acolhida' else 'negada' end,
         review_dispute_note   = p_note,
         review_hidden         = coalesce(p_acolhida, false)
   where id = p_request_id;
  perform set_config('fixly.guard_bypass', 'off', true);

  perform public.recalc_provider_rating(
    (select provider_id from public.service_requests where id = p_request_id));
end;
$$;

/**
 * Média e contagem do profissional, ignorando avaliação escondida por
 * contestação acolhida. Existe como função própria porque agora há DOIS
 * momentos que mexem na média: avaliar e acolher uma contestação.
 */
create or replace function public.recalc_provider_rating(p_provider uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_media numeric;
begin
  if p_provider is null then return; end if;
  select round(avg(rating)::numeric, 1) into v_media
    from public.service_requests
   where provider_id = p_provider and rating is not null and not coalesce(review_hidden, false);

  perform set_config('fixly.guard_bypass', 'on', true);
  update public.profiles set rating = coalesce(v_media, 0) where id = p_provider;
  perform set_config('fixly.guard_bypass', 'off', true);
end;
$$;

/**
 * O perfil público deixa de mostrar avaliação acolhida.
 *
 * ⚠️ A ORDEM das colunas devolvidas é a mesma da 0016 de propósito: o Postgres
 * recusa `create or replace` que mude o tipo de retorno, e trocar a ordem
 * obrigaria a dropar a função (e todo grant junto).
 */
create or replace function public.get_provider_reviews(p_provider uuid, p_limit int default 10)
returns table (rating int, review text, created_at timestamptz, category text)
language sql security definer set search_path = public stable as $$
  select r.rating, r.review, r.created_at, c.name
  from public.service_requests r
  left join public.service_categories c on c.id = r.category_id
  where r.provider_id = p_provider
    and r.review is not null
    and r.rating is not null
    and not coalesce(r.review_hidden, false)
  order by r.created_at desc
  limit greatest(1, least(p_limit, 50));
$$;

/**
 * Média do prestador — redefinida a partir da versão VIVA (0019), somando só a
 * novidade: avaliação escondida por contestação acolhida sai da conta.
 * `jobs_done` continua igual.
 */
create or replace function public.on_request_completed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.provider_id is null then return new; end if;

  perform set_config('fixly.guard_bypass', 'on', true);

  if new.status = 'concluido' and old.status is distinct from 'concluido' then
    update public.profiles set jobs_done = coalesce(jobs_done, 0) + 1 where id = new.provider_id;
  end if;

  if new.rating is not null and new.rating is distinct from old.rating then
    update public.profiles p
      set rating = coalesce((
        select round(avg(rating)::numeric, 1)
        from public.service_requests
        where provider_id = new.provider_id
          and rating is not null
          and not coalesce(review_hidden, false)
      ), 0)
      where p.id = new.provider_id;
  end if;

  perform set_config('fixly.guard_bypass', 'off', true);
  return new;
end;
$$;

-- ════════════════════════════════════════════════════════════
--  5) POLÍTICA DE CANCELAMENTO — o que o banco precisa guardar
--
--  A conta em si mora no código (`src/lib/cancellation.ts`), junto do estorno
--  no gateway. Aqui ficam os CARIMBOS de tempo que dizem em que etapa o
--  cancelamento aconteceu — sem eles, "antes ou depois do deslocamento?" seria
--  palavra contra palavra.
-- ════════════════════════════════════════════════════════════

-- retenção/estorno parcial ficam registrados no pagamento: `status` sozinho
-- ('reembolsado') mentiria quando só parte do dinheiro voltou.
alter table public.payments
  add column if not exists refunded_amount numeric not null default 0,
  add column if not exists retained_amount numeric not null default 0,
  add column if not exists cancel_stage    text;

-- pedidos já em andamento ganham o carimbo aproximado que existe hoje, para a
-- política não tratar histórico como "cancelado antes do aceite"
update public.service_requests
   set accepted_at = coalesce(accepted_at, created_at)
 where provider_id is not null and accepted_at is null;

/**
 * Carimbo de etapa. Quem move o serviço para `a_caminho`/`em_andamento` é o
 * profissional, pela tela dele — este gatilho só registra QUANDO, para que a
 * política de cancelamento tenha um fato e não uma inferência.
 */
create or replace function public.stamp_request_stage()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.provider_id is not null and old.provider_id is null and new.accepted_at is null then
    new.accepted_at := now();
  end if;
  if new.status = 'a_caminho' and old.status is distinct from 'a_caminho' and new.departed_at is null then
    new.departed_at := now();
  end if;
  if new.status = 'em_andamento' and old.status is distinct from 'em_andamento' and new.started_at is null then
    new.started_at := now();
  end if;
  if new.status = 'cancelado' and old.status is distinct from 'cancelado' and new.cancelled_at is null then
    new.cancelled_at := now();
  end if;
  return new;
end;
$$;

-- ⚠️ nome com "z" no começo? NÃO: gatilho BEFORE roda em ORDEM ALFABÉTICA e
-- este precisa rodar DEPOIS do guard (`trg_guard_request`), que valida a
-- transição. "trg_z_..." garante isso sem depender de sorte.
drop trigger if exists trg_z_stamp_request_stage on public.service_requests;
create trigger trg_z_stamp_request_stage
  before update on public.service_requests
  for each row execute function public.stamp_request_stage();

-- ════════════════════════════════════════════════════════════
--  6) PERMISSÕES
-- ════════════════════════════════════════════════════════════

grant execute on function public.submit_proposal(uuid, numeric, int, text, int, numeric) to authenticated;
grant execute on function public.counter_proposal(uuid, numeric)   to authenticated;
grant execute on function public.accept_proposal(uuid)             to authenticated;
grant execute on function public.dispute_review(uuid, text)        to authenticated;
grant execute on function public.get_provider_reviews(uuid, int)   to anon, authenticated;
grant execute on function public.fixly_max_counter_rounds()        to anon, authenticated;
grant execute on function public.fixly_max_nota_contestavel()      to anon, authenticated;

revoke all on function public.resolve_review_dispute(uuid, boolean, text) from public, anon;
grant execute on function public.resolve_review_dispute(uuid, boolean, text) to authenticated, service_role;
revoke all on function public.recalc_provider_rating(uuid) from public, anon;
grant execute on function public.recalc_provider_rating(uuid) to service_role;
