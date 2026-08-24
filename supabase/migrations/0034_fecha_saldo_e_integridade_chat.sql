-- ============================================================
--  0034 — AUTORIZAÇÃO DO SALDO + INTEGRIDADE DO CHAT
-- ============================================================

-- `provider_balance(uuid)` é SECURITY DEFINER. O UUID opcional não pode ser
-- tratado como autorização: uma sessão comum só consulta o próprio saldo;
-- administradores podem consultar outro prestador para operar a plataforma.
create or replace function public.provider_balance(p_provider uuid default null)
returns table (
  liberado numeric, a_liberar numeric, em_servico numeric,
  adiantado numeric, sacado numeric, disponivel numeric
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_provider uuid;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;

  v_provider := coalesce(p_provider, auth.uid());
  if v_provider <> auth.uid() and not public.is_admin() then
    raise exception 'Sem permissão';
  end if;

  return query
  with pays as (
    select p.*, r.provider_id
      from public.payments p
      join public.service_requests r on r.id = p.request_id
     where r.provider_id = v_provider
  ),
  agg as (
    select
      coalesce(sum(case when status = 'liberado'
                         and coalesce(available_at, released_at, created_at) <= now()
                        then provider_net else 0 end), 0) as liberado,
      coalesce(sum(case when status = 'liberado'
                         and coalesce(available_at, released_at, created_at) > now()
                        then provider_net else 0 end), 0) as a_liberar,
      coalesce(sum(case when status = 'retido' then provider_net else 0 end), 0) as em_servico,
      coalesce(sum(case when advance_released_at is not null then advance_amount else 0 end), 0) as adiantado
      from pays
  ),
  wd as (
    select coalesce(sum(amount), 0) as sacado
      from public.withdrawals
     where provider_id = v_provider and status <> 'recusado'
  )
  select agg.liberado, agg.a_liberar, agg.em_servico, agg.adiantado, wd.sacado,
         greatest(agg.liberado - wd.sacado, 0) as disponivel
    from agg, wd;
end;
$$;

revoke all on function public.provider_balance(uuid) from public, anon;
grant execute on function public.provider_balance(uuid) to authenticated, service_role;

-- A policy de UPDATE existe para recibos de entrega/leitura. Sem um guard ela
-- também permitia adulterar corpo, autor e anexo de qualquer mensagem da
-- conversa. Esses campos passam a ser imutáveis depois do INSERT.
create or replace function public.guard_message_receipts_only()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id              is distinct from old.id
     or new.conversation_id is distinct from old.conversation_id
     or new.sender_id    is distinct from old.sender_id
     or new.body         is distinct from old.body
     or new.attachment_path is distinct from old.attachment_path
     or new.attachment_type is distinct from old.attachment_type
     or new.attachment_name is distinct from old.attachment_name
     or new.created_at   is distinct from old.created_at
  then
    raise exception 'Conteúdo e autoria da mensagem são imutáveis';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_message_receipts_only on public.messages;
create trigger trg_message_receipts_only
  before update on public.messages
  for each row execute function public.guard_message_receipts_only();

drop policy if exists msg_update on public.messages;
create policy msg_update on public.messages
  for update
  to authenticated
  using (public.is_conversation_participant(conversation_id))
  with check (public.is_conversation_participant(conversation_id));
