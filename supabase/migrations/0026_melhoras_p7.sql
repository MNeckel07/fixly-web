-- ============================================================
--  FIXLY — 0026: melhoras "parte 7"
--
--  1) LOCALIZAÇÃO PRIVADA — o endereço exato do contratante sai de
--     `service_requests` (que o prestador enxerga antes de fechar) e passa a
--     viver em `service_request_locations`, liberada só depois do aceite.
--     O que fica no pedido é APROXIMADO: bairro/cidade e um ponto deslocado.
--  2) CONTRA-PROPOSTA DOS DOIS LADOS — o prestador pode responder à
--     contra-proposta do contratante com outro valor (ida e volta).
--  3) CHAT DE NEGOCIAÇÃO — uma das partes pede conversa, a outra aceita; o
--     mesmo chat segue durante o serviço inteiro (histórico único).
--  4) CONTATO OCULTO NO CHAT — telefone/e-mail digitados na conversa do
--     serviço são mascarados pelo banco (não dá para burlar pelo cliente).
--  5) PEDIDO DIRETO PELO PROFILER — vira negociação de verdade (proposta,
--     contra-proposta e aceite), em vez de nascer "aceito".
--  6) NOTIFICAÇÕES — registro do que já foi avisado por e-mail (anti-repetição).
--  7) Frase do cartão: 70 → 60 caracteres.
-- ============================================================

-- ════════════════════════════════════════════════════════════
--  1) LOCALIZAÇÃO PRIVADA
-- ════════════════════════════════════════════════════════════

/**
 * Deslocamento determinístico de uma coordenada.
 *
 * O mesmo pedido sempre cai no mesmo ponto falso (não adianta recarregar para
 * triangular), e o desvio máximo (~450 m) é MENOR que o raio do círculo que a
 * tela desenha (1 km) — então o endereço verdadeiro está sempre dentro da área
 * mostrada, sem nunca ser o centro dela.
 */
create or replace function public.fixly_blur_coord(
  v double precision, seed text, meters double precision default 450
) returns double precision
language sql immutable as $$
  select case
    when v is null then null
    else round(
      (v + ((abs((('x' || substr(md5(seed), 1, 8))::bit(32)::int)::bigint) % 2001) / 1000.0 - 1.0)
           * (meters / 111320.0))::numeric,
      5)::double precision
  end;
$$;

/**
 * "Rua Buenos Aires, Batel - Curitiba/PR, nº 286, compl. 31"
 *   → "Batel - Curitiba/PR"
 * Tira a rua (primeiro trecho), o número e o complemento. Sobra a região.
 */
create or replace function public.fixly_area_label(p text) returns text
language sql immutable as $$
  select nullif(
    btrim(regexp_replace(split_part(coalesce(p, ''), ', nº', 1), '^[^,]*,\s*', '')),
    ''
  );
$$;

create table if not exists public.service_request_locations (
  request_id uuid primary key references public.service_requests(id) on delete cascade,
  address    text,
  lat        double precision,
  lng        double precision,
  created_at timestamptz not null default now()
);

alter table public.service_request_locations enable row level security;

/**
 * Quem lê o endereço exato:
 *   - o contratante dono do pedido (sempre);
 *   - o profissional DESIGNADO, e só depois do aceite (o negócio fechou);
 *   - admin.
 * Prestador que ainda está propondo NÃO entra aqui.
 */
drop policy if exists srl_select on public.service_request_locations;
create policy srl_select on public.service_request_locations for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.service_requests r
    where r.id = request_id
      and (
        r.client_id = auth.uid()
        or (r.provider_id = auth.uid()
            and r.status in ('aceito', 'a_caminho', 'em_andamento', 'concluido'))
      )
  )
);

-- escrita é do trigger (security definer); o dono do pedido pode corrigir
drop policy if exists srl_write on public.service_request_locations;
create policy srl_write on public.service_request_locations for all to authenticated
using (
  public.is_admin()
  or exists (select 1 from public.service_requests r
             where r.id = request_id and r.client_id = auth.uid())
)
with check (
  public.is_admin()
  or exists (select 1 from public.service_requests r
             where r.id = request_id and r.client_id = auth.uid())
);

/**
 * O split acontece ANTES de a linha existir (BEFORE INSERT) de propósito: se a
 * linha chegasse a ser gravada com o endereço exato, o Realtime entregaria esse
 * payload aos prestadores que assinam `service_requests` — a RLS é por linha, e
 * a linha é visível para eles. Guardamos o valor exato num ajuste de sessão
 * (escopo de transação) e o AFTER INSERT o grava na tabela privada.
 */
create or replace function public.fixly_stash_exact_location()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- a chave leva o id do pedido: num INSERT de várias linhas, os AFTER triggers
  -- rodam todos no fim do comando, e uma chave única guardaria só a última.
  perform set_config(
    'fixly.loc_' || replace(new.id::text, '-', ''),
    json_build_object('address', new.address, 'lat', new.lat, 'lng', new.lng)::text,
    true);

  new.address := coalesce(public.fixly_area_label(new.address), new.address);
  new.lat     := public.fixly_blur_coord(new.lat, new.id::text || 'lat');
  new.lng     := public.fixly_blur_coord(new.lng, new.id::text || 'lng');
  return new;
end;
$$;

create or replace function public.fixly_save_exact_location()
returns trigger language plpgsql security definer set search_path = public as $$
declare exact_loc json; key text;
begin
  key := 'fixly.loc_' || replace(new.id::text, '-', '');
  begin
    exact_loc := nullif(current_setting(key, true), '')::json;
  exception when others then
    exact_loc := null;
  end;
  if exact_loc is null then return null; end if;

  insert into public.service_request_locations (request_id, address, lat, lng)
  values (
    new.id,
    nullif(exact_loc ->> 'address', ''),
    (exact_loc ->> 'lat')::double precision,
    (exact_loc ->> 'lng')::double precision
  )
  on conflict (request_id) do update
    set address = excluded.address, lat = excluded.lat, lng = excluded.lng;

  perform set_config(key, '', true);
  return null;
end;
$$;

drop trigger if exists trg_stash_exact_location on public.service_requests;
create trigger trg_stash_exact_location
  before insert on public.service_requests
  for each row execute function public.fixly_stash_exact_location();

drop trigger if exists trg_save_exact_location on public.service_requests;
create trigger trg_save_exact_location
  after insert on public.service_requests
  for each row execute function public.fixly_save_exact_location();

-- ── Migração dos pedidos que já existem ──────────────────────
-- Primeiro guarda o endereço exato, depois embaralha o que fica exposto.
insert into public.service_request_locations (request_id, address, lat, lng)
select id, address, lat, lng from public.service_requests
on conflict (request_id) do nothing;

do $$
begin
  perform set_config('fixly.guard_bypass', 'on', true);
  update public.service_requests r
     set address = coalesce(public.fixly_area_label(r.address), r.address),
         lat     = public.fixly_blur_coord(r.lat, r.id::text || 'lat'),
         lng     = public.fixly_blur_coord(r.lng, r.id::text || 'lng')
   where exists (select 1 from public.service_request_locations l where l.request_id = r.id);
  perform set_config('fixly.guard_bypass', 'off', true);
end $$;

-- ════════════════════════════════════════════════════════════
--  2) CONTRA-PROPOSTA DOS DOIS LADOS
-- ════════════════════════════════════════════════════════════

-- quem fez a última oferta pendente (contratante ou prestador)
alter table public.proposals
  add column if not exists counter_by uuid references public.profiles(id);

-- rodadas anteriores viraram histórico de quem estava esperando: até aqui só o
-- contratante contrapropunha, então quem fez foi ele.
update public.proposals p
   set counter_by = r.client_id
  from public.service_requests r
 where r.id = p.request_id
   and p.counter_price is not null
   and p.counter_by is null;

/**
 * Nova oferta na negociação. Serve para os DOIS lados: o contratante pede um
 * valor menor, o prestador responde com outro, e assim por diante — enquanto o
 * pedido não tiver profissional designado.
 */
create or replace function public.counter_proposal(p_proposal_id uuid, p_price numeric)
returns uuid language plpgsql security definer set search_path = public as $$
declare pr public.proposals; r public.service_requests;
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

  update public.proposals
     set counter_price  = round(p_price, 2),
         counter_status = 'pendente',
         counter_by     = auth.uid()
   where id = pr.id;
  return pr.id;
end;
$$;

/**
 * Responde à oferta pendente. Só quem NÃO fez a oferta responde.
 * Aceitar grava o valor negociado como preço da proposta.
 */
create or replace function public.respond_counter(p_proposal_id uuid, p_accept boolean)
returns numeric language plpgsql security definer set search_path = public as $$
declare pr public.proposals; r public.service_requests;
begin
  select * into pr from public.proposals where id = p_proposal_id;
  if pr.id is null then raise exception 'Proposta não encontrada'; end if;
  if pr.counter_status is distinct from 'pendente' then raise exception 'Não há proposta pendente'; end if;

  select * into r from public.service_requests where id = pr.request_id;
  if r.provider_id is not null then raise exception 'Este pedido já tem profissional'; end if;
  if auth.uid() not in (r.client_id, pr.provider_id) then raise exception 'Sem permissão'; end if;
  if pr.counter_by = auth.uid() then raise exception 'Quem fez a oferta não pode respondê-la'; end if;

  if p_accept then
    update public.proposals
       set price = pr.counter_price, counter_status = 'aceita'
     where id = pr.id;
    return pr.counter_price;
  end if;

  update public.proposals set counter_status = 'recusada' where id = pr.id;
  return pr.price;
end;
$$;

/**
 * 🔴 Buraco fechado junto: a policy antiga deixava o CONTRATANTE dar UPDATE em
 * qualquer coluna da proposta — inclusive `price`. Dava para reescrever o preço
 * para R$ 1 e aceitar. Agora a negociação inteira passa por
 * `counter_proposal` / `respond_counter` (security definer, com as regras
 * acima); update direto fica só para admin.
 */
drop policy if exists prop_update on public.proposals;
create policy prop_update on public.proposals for update
  using (public.is_admin()) with check (public.is_admin());

-- ════════════════════════════════════════════════════════════
--  3) CHAT DE NEGOCIAÇÃO (pedido → aceite → serviço, um só histórico)
-- ════════════════════════════════════════════════════════════

alter table public.conversations
  add column if not exists provider_id  uuid references public.profiles(id);
alter table public.conversations
  add column if not exists chat_status  text not null default 'ativa';
alter table public.conversations
  add column if not exists requested_by uuid references public.profiles(id);

alter table public.conversations drop constraint if exists conversations_chat_status_check;
alter table public.conversations
  add constraint conversations_chat_status_check
  check (chat_status in ('pendente', 'ativa', 'recusada', 'encerrada'));

-- conversas de serviço que já existem passam a apontar para o profissional
update public.conversations c
   set provider_id = r.provider_id
  from public.service_requests r
 where c.request_id = r.id and c.type = 'servico'
   and c.provider_id is null and r.provider_id is not null;

/**
 * Antes do índice único, JUNTAR as conversas duplicadas.
 *
 * O banco tinha pedidos com DUAS conversas de serviço: o `start_service_chat`
 * era chamado ao abrir a tela dos dois lados, e duas chamadas simultâneas
 * passavam as duas pelo `select ... limit 1` antes de qualquer insert. Cada
 * ponta ficou com um pedaço da conversa. Aqui as mensagens (e os participantes)
 * migram para a conversa mais antiga e as sobras somem — perder mensagem de
 * cliente não é opção.
 */
do $$
declare d record;
begin
  for d in
    select c.id, first_value(c.id) over (
             partition by c.request_id, c.provider_id order by c.created_at, c.id
           ) as keep_id
      from public.conversations c
     where c.type = 'servico' and c.provider_id is not null
  loop
    if d.id <> d.keep_id then
      insert into public.conversation_participants (conversation_id, profile_id)
      select d.keep_id, cp.profile_id from public.conversation_participants cp
       where cp.conversation_id = d.id
      on conflict do nothing;
      update public.messages set conversation_id = d.keep_id where conversation_id = d.id;
      delete from public.conversations where id = d.id;
    end if;
  end loop;
end $$;

create unique index if not exists uniq_conv_servico_provider
  on public.conversations (request_id, provider_id)
  where type = 'servico' and provider_id is not null;

/**
 * Uma das partes PEDE conversa; a outra aceita. Enquanto está 'pendente'
 * ninguém escreve (a policy de `messages` exige 'ativa').
 */
create or replace function public.request_service_chat(p_request_id uuid, p_provider uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare conv uuid; r public.service_requests; prov uuid;
begin
  select * into r from public.service_requests where id = p_request_id;
  if r.id is null then raise exception 'Pedido não encontrado'; end if;

  prov := coalesce(r.provider_id, p_provider);
  if prov is null then raise exception 'Informe o profissional'; end if;

  if auth.uid() = r.client_id then
    -- o contratante só chama quem realmente está na negociação
    if r.provider_id is null and not exists (
      select 1 from public.proposals p where p.request_id = r.id and p.provider_id = prov
    ) then raise exception 'Este profissional não está na negociação'; end if;
  elsif auth.uid() = prov then
    if r.provider_id is null and not exists (
      select 1 from public.proposals p where p.request_id = r.id and p.provider_id = auth.uid()
    ) then raise exception 'Envie uma proposta antes de pedir conversa'; end if;
  else
    raise exception 'Sem permissão';
  end if;

  select id into conv from public.conversations
   where type = 'servico' and request_id = p_request_id and provider_id = prov limit 1;

  if conv is null then
    insert into public.conversations (type, request_id, provider_id, chat_status, requested_by)
    values ('servico', p_request_id, prov,
            case when r.provider_id is not null then 'ativa' else 'pendente' end,
            auth.uid())
    returning id into conv;
    insert into public.conversation_participants (conversation_id, profile_id)
    values (conv, r.client_id), (conv, prov) on conflict do nothing;
  end if;
  return conv;
end;
$$;

/** Aceitar (ou recusar) o convite de conversa. Só o lado que NÃO pediu. */
create or replace function public.respond_chat_request(p_conversation_id uuid, p_accept boolean)
returns text language plpgsql security definer set search_path = public as $$
declare c public.conversations;
begin
  select * into c from public.conversations where id = p_conversation_id;
  if c.id is null then raise exception 'Conversa não encontrada'; end if;
  if not public.is_conversation_participant(c.id) then raise exception 'Sem permissão'; end if;
  if c.chat_status <> 'pendente' then return c.chat_status; end if;
  if c.requested_by = auth.uid() then raise exception 'Quem pediu a conversa não pode aceitá-la'; end if;

  update public.conversations
     set chat_status = case when p_accept then 'ativa' else 'recusada' end
   where id = c.id;
  return case when p_accept then 'ativa' else 'recusada' end;
end;
$$;

/**
 * Chat do serviço já fechado. Reaproveita a conversa da negociação (o histórico
 * continua o mesmo) e a deixa ativa. Substitui a versão do 0003, que não
 * conhecia `provider_id` nem `chat_status`.
 */
create or replace function public.start_service_chat(p_request_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare conv uuid; r public.service_requests;
begin
  select * into r from public.service_requests where id = p_request_id;
  if r.id is null then raise exception 'Pedido não encontrado'; end if;
  if not (auth.uid() = r.client_id or auth.uid() = r.provider_id or public.is_admin()) then
    raise exception 'Sem permissão';
  end if;
  if r.provider_id is null then raise exception 'Serviço ainda sem prestador'; end if;

  select id into conv from public.conversations
   where type = 'servico' and request_id = p_request_id
     and (provider_id = r.provider_id or provider_id is null)
   order by (provider_id = r.provider_id) desc limit 1;

  if conv is null then
    insert into public.conversations (type, request_id, provider_id, chat_status)
    values ('servico', p_request_id, r.provider_id, 'ativa') returning id into conv;
    insert into public.conversation_participants (conversation_id, profile_id)
    values (conv, r.client_id), (conv, r.provider_id) on conflict do nothing;
  else
    update public.conversations
       set provider_id = r.provider_id, chat_status = 'ativa'
     where id = conv and chat_status <> 'ativa';
    insert into public.conversation_participants (conversation_id, profile_id)
    values (conv, r.client_id), (conv, r.provider_id) on conflict do nothing;
  end if;
  return conv;
end;
$$;

-- conversa 'pendente'/'recusada' não recebe mensagem
drop policy if exists msg_insert on public.messages;
create policy msg_insert on public.messages for insert with check (
  sender_id = auth.uid()
  and public.is_conversation_participant(conversation_id)
  and exists (
    select 1 from public.conversations c
    where c.id = conversation_id and coalesce(c.chat_status, 'ativa') = 'ativa'
  )
);

-- ════════════════════════════════════════════════════════════
--  4) CONTATO OCULTO NAS MENSAGENS DO SERVIÇO
-- ════════════════════════════════════════════════════════════

/**
 * Regra comercial e de segurança: dentro do Fixly, contratante e prestador só
 * se falam pelo chat. Telefone e e-mail digitados na conversa do serviço são
 * substituídos pelo BANCO — o cliente pode ser um navegador adulterado, então
 * validar só na tela não vale de nada.
 * Conversa com admin (aprovação/ticket/equipe) não é filtrada.
 */
create or replace function public.mask_contact_info(p text) returns text
language sql immutable as $$
  select case when p is null then null else
    regexp_replace(
      regexp_replace(
        regexp_replace(p,
          '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[contato oculto]', 'g'),
        '(\+?\d{1,3}[\s.-]?)?\(?\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}', '[contato oculto]', 'g'),
      '\d{8,}', '[contato oculto]', 'g')
  end;
$$;

create or replace function public.fixly_mask_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.conversations c
             where c.id = new.conversation_id and c.type = 'servico') then
    new.body := public.mask_contact_info(new.body);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_mask_message on public.messages;
create trigger trg_mask_message
  before insert or update of body on public.messages
  for each row execute function public.fixly_mask_message();

-- ════════════════════════════════════════════════════════════
--  5) PEDIDO DIRETO PELO PROFILER = NEGOCIAÇÃO
-- ════════════════════════════════════════════════════════════

alter table public.service_requests
  add column if not exists target_provider_id uuid references public.profiles(id);

-- Pedido direcionado só aparece para o profissional escolhido.
drop policy if exists req_select on public.service_requests;
create policy req_select on public.service_requests for select using (
  client_id = auth.uid()
  or provider_id = auth.uid()
  or public.is_admin()
  or (
    provider_id is null
    and status not in ('concluido', 'cancelado')
    and (target_provider_id is null or target_provider_id = auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'prestador' and p.status = 'aprovado'
    )
  )
);

/**
 * Proposta do prestador. Mudanças desta migração:
 *   - respeita `target_provider_id` (pedido direto é só de quem foi chamado);
 *   - mexer no preço zera a negociação em aberto (senão o contratante veria uma
 *     contra-proposta referente a um valor que não existe mais).
 * Base: versão do 0021.
 */
create or replace function public.submit_proposal(
  p_request_id uuid, p_price numeric, p_eta int, p_message text, p_advance_pct int default 0
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

  insert into public.proposals (request_id, provider_id, price, eta_minutes, message, status, advance_pct)
  values (p_request_id, auth.uid(), round(p_price, 2), p_eta, p_message, 'enviada',
          least(greatest(coalesce(p_advance_pct, 0), 0), 50))
  on conflict (request_id, provider_id)
    do update set price = excluded.price, eta_minutes = excluded.eta_minutes,
                  message = excluded.message, status = 'enviada',
                  advance_pct = excluded.advance_pct,
                  counter_price = null, counter_status = null, counter_by = null;

  update public.service_requests set status = 'proposta_enviada'
    where id = p_request_id and status = 'buscando';
  return p_request_id;
end;
$$;

/**
 * Dispatch. Base: versão do 0025 (só CONTA quem se qualifica) + pedido
 * direcionado: quando há `target_provider_id`, o alcance é ele e mais ninguém.
 */
create or replace function public.dispatch_request(p_request_id uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare
  r public.service_requests;
  prov record;
  dist numeric;
  cnt int := 0;
  client_badge boolean;
begin
  select * into r from public.service_requests where id = p_request_id;
  if r.id is null then raise exception 'Pedido não encontrado'; end if;
  if r.client_id <> auth.uid() then raise exception 'Sem permissão'; end if;

  if r.target_provider_id is not null then
    return (select count(*)::int from public.profiles p
             where p.id = r.target_provider_id and p.role = 'prestador' and p.status = 'aprovado');
  end if;

  select coalesce(fix_badge, false) into client_badge
    from public.profiles where id = r.client_id;

  for prov in
    select p.*
    from public.profiles p
    where p.role = 'prestador' and p.status = 'aprovado' and p.active
      and (client_badge or not coalesce(p.fix_badge, false))
      and (
        r.category_id is null
        or p.category_id = r.category_id
        or exists (select 1 from public.provider_categories pc
                   where pc.provider_id = p.id and pc.category_id = r.category_id)
      )
      and not exists (
        select 1 from public.service_requests s
        where s.provider_id = p.id and s.status in ('a_caminho','em_andamento')
      )
  loop
    dist := case
      when r.lat is not null and prov.lat is not null
        then round((111 * sqrt(power(r.lat - prov.lat, 2) + power(r.lng - prov.lng, 2)))::numeric, 1)
      else 0 end;
    if dist > coalesce(prov.service_radius_km, 10) then continue; end if;
    cnt := cnt + 1;
  end loop;

  return cnt;
end;
$$;

/**
 * Aceite da proposta. Base: versão do 0022 + duas coisas desta leva:
 *   - o chat da negociação (se existir) fica ATIVO e vira o chat do serviço;
 *     as conversas dos outros candidatos são encerradas;
 *   - a contra-proposta pendente continua barrando o aceite (agora dos dois
 *     lados: quem tem que responder responde primeiro).
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
         final_price  = pr.price,
         status       = 'aceito',
         advance_pct  = least(greatest(coalesce(pr.advance_pct, 0), 0), 50)
   where id = r.id;

  -- chat: o do profissional escolhido fica ativo, os demais são encerrados
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
--  6) REGISTRO DE NOTIFICAÇÕES (evita e-mail repetido)
-- ════════════════════════════════════════════════════════════

create table if not exists public.notification_log (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind       text not null,          -- proposta | contra_proposta | mensagem | aprovacao
  ref_id     uuid,                   -- proposta, conversa ou pedido
  created_at timestamptz not null default now()
);
create index if not exists idx_notification_log_lookup
  on public.notification_log (profile_id, kind, ref_id, created_at desc);

-- server-only, igual a `email_codes`: RLS ligada e ZERO policies de propósito.
alter table public.notification_log enable row level security;

-- ════════════════════════════════════════════════════════════
--  7) Frase do cartão: 70 → 60 caracteres
-- ════════════════════════════════════════════════════════════

alter table public.profiles drop constraint if exists profiles_card_headline_len;
update public.profiles set card_headline = left(card_headline, 60)
 where card_headline is not null and char_length(card_headline) > 60;
alter table public.profiles
  add constraint profiles_card_headline_len
  check (card_headline is null or char_length(card_headline) <= 60);

-- ════════════════════════════════════════════════════════════
--  Permissões
-- ════════════════════════════════════════════════════════════
grant execute on function public.counter_proposal(uuid, numeric)   to authenticated;
grant execute on function public.respond_counter(uuid, boolean)    to authenticated;
grant execute on function public.request_service_chat(uuid, uuid)  to authenticated;
grant execute on function public.respond_chat_request(uuid, boolean) to authenticated;
grant execute on function public.start_service_chat(uuid)          to authenticated;
grant execute on function public.submit_proposal(uuid, numeric, int, text, int) to authenticated;
grant execute on function public.dispatch_request(uuid)            to authenticated;
grant execute on function public.accept_proposal(uuid)             to authenticated;
grant execute on function public.fixly_area_label(text)            to authenticated;
grant execute on function public.mask_contact_info(text)           to authenticated;
