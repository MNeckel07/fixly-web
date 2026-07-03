-- ============================================================
--  FIXLY — Migração v3
--  Fix do chat (participantes leem perfil um do outro),
--  tickets de suporte, múltiplas categorias do prestador,
--  dispatch com filtro por raio + multi-categoria.
-- ============================================================

-- ── Participantes de uma conversa podem se ver ──────────────
create or replace function public.shares_conversation(p_other uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1
    from public.conversation_participants a
    join public.conversation_participants b on a.conversation_id = b.conversation_id
    where a.profile_id = auth.uid() and b.profile_id = p_other
  );
$$;
grant execute on function public.shares_conversation(uuid) to authenticated;

drop policy if exists prof_select on public.profiles;
create policy prof_select on public.profiles for select using (
  id = auth.uid()
  or public.is_admin()
  or (role = 'prestador' and status = 'aprovado')
  or public.shares_conversation(id)
);

-- ── Conversa do tipo 'ticket' ───────────────────────────────
alter table public.conversations drop constraint if exists conversations_type_check;
alter table public.conversations
  add constraint conversations_type_check check (type in ('aprovacao','servico','ticket'));

-- ── Múltiplas categorias do prestador ───────────────────────
create table if not exists public.provider_categories (
  provider_id uuid references public.profiles(id) on delete cascade,
  category_id uuid references public.service_categories(id) on delete cascade,
  primary key (provider_id, category_id)
);
alter table public.provider_categories enable row level security;
drop policy if exists pc_select on public.provider_categories;
create policy pc_select on public.provider_categories for select using (true);
drop policy if exists pc_write on public.provider_categories;
create policy pc_write on public.provider_categories for all
  using (provider_id = auth.uid() or public.is_admin())
  with check (provider_id = auth.uid() or public.is_admin());

-- ── Tickets de suporte ──────────────────────────────────────
create table if not exists public.tickets (
  id              uuid primary key default gen_random_uuid(),
  opener_id       uuid not null references public.profiles(id) on delete cascade,
  category        text not null,
  priority        text not null default 'normal',
  subject         text not null,
  description     text not null,
  attachment_path text,
  status          text not null default 'aberto', -- aberto | em_andamento | resolvido
  conversation_id uuid references public.conversations(id),
  created_at      timestamptz not null default now()
);
alter table public.tickets enable row level security;
drop policy if exists tk_select on public.tickets;
create policy tk_select on public.tickets for select using (opener_id = auth.uid() or public.is_admin());
drop policy if exists tk_insert on public.tickets;
create policy tk_insert on public.tickets for insert with check (opener_id = auth.uid());
drop policy if exists tk_update on public.tickets;
create policy tk_update on public.tickets for update using (opener_id = auth.uid() or public.is_admin());

-- Cria um ticket + a conversa vinculada (opener como participante).
create or replace function public.create_ticket(
  p_category text, p_priority text, p_subject text, p_description text, p_attachment text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare conv uuid; tid uuid;
begin
  insert into public.conversations (type) values ('ticket') returning id into conv;
  insert into public.conversation_participants (conversation_id, profile_id) values (conv, auth.uid());
  insert into public.tickets (opener_id, category, priority, subject, description, attachment_path, conversation_id)
    values (auth.uid(), p_category, p_priority, p_subject, p_description, p_attachment, conv)
    returning id into tid;
  -- mensagem inicial no chat
  insert into public.messages (conversation_id, sender_id, body)
    values (conv, auth.uid(), '[' || p_category || '] ' || p_subject || E'\n' || p_description);
  return tid;
end;
$$;
grant execute on function public.create_ticket(text, text, text, text, text) to authenticated;

-- Admin entra na conversa do ticket (vira participante) e retorna a conversa.
create or replace function public.admin_open_ticket(p_ticket_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare conv uuid;
begin
  if not public.is_admin() then raise exception 'Apenas admin'; end if;
  select conversation_id into conv from public.tickets where id = p_ticket_id;
  if conv is null then raise exception 'Ticket sem conversa'; end if;
  insert into public.conversation_participants (conversation_id, profile_id)
    values (conv, auth.uid()) on conflict do nothing;
  update public.tickets set status = 'em_andamento' where id = p_ticket_id and status = 'aberto';
  return conv;
end;
$$;
grant execute on function public.admin_open_ticket(uuid) to authenticated;

-- ============================================================
--  dispatch_request v2: filtra por RAIO e por multi-categoria
-- ============================================================
create or replace function public.dispatch_request(p_request_id uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare
  r public.service_requests;
  prov record;
  dist numeric;
  price numeric;
  cnt int := 0;
begin
  select * into r from public.service_requests where id = p_request_id;
  if r.id is null then raise exception 'Pedido não encontrado'; end if;
  if r.client_id <> auth.uid() then raise exception 'Sem permissão'; end if;

  for prov in
    select p.*
    from public.profiles p
    where p.role = 'prestador' and p.status = 'aprovado' and p.active
      and (
        r.category_id is null
        or p.category_id = r.category_id
        or exists (select 1 from public.provider_categories pc
                   where pc.provider_id = p.id and pc.category_id = r.category_id)
      )
    order by
      case when p.lat is not null and r.lat is not null
        then power(r.lat - p.lat, 2) + power(r.lng - p.lng, 2) else 999 end
    limit 8
  loop
    dist := case
      when r.lat is not null and prov.lat is not null
        then round((111 * sqrt(power(r.lat - prov.lat, 2) + power(r.lng - prov.lng, 2)))::numeric, 1)
      else 0 end;

    -- respeita o raio de atendimento do prestador
    if dist > coalesce(prov.service_radius_km, 10) then
      continue;
    end if;

    price := coalesce(prov.base_price, 100) * (case when r.urgent then 1.4 else 1 end)
             + round(dist * 3.5) + round((random() * 20 - 10)::numeric);

    insert into public.proposals (request_id, provider_id, price, eta_minutes, status)
    values (p_request_id, prov.id, greatest(round(price::numeric, 2), 50),
            greatest(10, round(dist * 4 + random() * 15)::int), 'enviada')
    on conflict (request_id, provider_id) do nothing;
    cnt := cnt + 1;
  end loop;

  if cnt > 0 then
    update public.service_requests set status = 'proposta_enviada' where id = p_request_id;
  end if;
  return cnt;
end;
$$;
