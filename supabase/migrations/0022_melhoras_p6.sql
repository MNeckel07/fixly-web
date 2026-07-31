-- ============================================================
--  FIXLY — Melhoras (parte 6)
--
--  1) Verificação de e-mail por CÓDIGO (cadastro + recuperação de senha)
--  2) Conclusão do prestador ≠ dinheiro liberado
--     (o dinheiro só entra nos Ganhos quando o CONTRATANTE aprova)
--  3) Cartão do Profiler configurável (qual serviço aparece + frase curta)
--  4) Carteira do prestador: saldo a liberar, previsão de crédito e SAQUE
--  5) accept_proposal(): aceitar proposta no servidor
--     (bloqueia aceitar com contra-proposta pendente e usa o preço certo)
--  6) Empreiteiro: todo anúncio ganha um handle → profiler público garantido
--  7) Split de pagamento: conta do prestador no gateway (server-only)
-- ============================================================

-- ── 1) Códigos de verificação por e-mail ───────────────────
-- Guardamos só o HASH do código (sha256). RLS ligado e NENHUMA policy:
-- apenas a service_role (server actions) enxerga a tabela.
create table if not exists public.email_codes (
  id          uuid primary key default gen_random_uuid(),
  email       text        not null,
  purpose     text        not null,           -- 'cadastro' | 'recuperacao'
  code_hash   text        not null,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  attempts    int         not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists idx_email_codes_lookup
  on public.email_codes (lower(email), purpose, created_at desc);
alter table public.email_codes enable row level security;
-- (sem policies de propósito — ninguém autenticado lê/escreve)

-- Limpeza de códigos vencidos (chamada pelas server actions)
create or replace function public.purge_expired_email_codes()
returns void language sql security definer set search_path = public as $$
  delete from public.email_codes
   where expires_at < now() - interval '1 day';
$$;
revoke all on function public.purge_expired_email_codes() from public, anon, authenticated;

-- ── 2) Conclusão do prestador (aguardando aprovação) ───────
-- O prestador marca que terminou; o status SÓ vira 'concluido' quando o
-- contratante aprova (é isso que libera o pagamento e conta o serviço).
alter table public.service_requests
  add column if not exists provider_done_at timestamptz;

-- Guard: além do que já valia, agora
--   • só o CONTRATANTE (ou admin/service-role) pode concluir o serviço;
--   • só o PRESTADOR designado marca provider_done_at (e não desmarca).
create or replace function public.guard_request_changes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_setting('fixly.guard_bypass', true) = 'on' then
    return new;
  end if;

  -- contexto confiável (service_role / server actions com a chave secret)
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  -- avaliação (nota + comentário) é exclusiva do contratante dono do pedido
  if (new.rating is distinct from old.rating or new.review is distinct from old.review)
     and auth.uid() <> old.client_id then
    raise exception 'Somente o contratante pode avaliar o serviço';
  end if;

  -- estados finais são terminais
  if old.status in ('concluido', 'cancelado') and new.status is distinct from old.status then
    raise exception 'Serviço finalizado não pode mudar de status';
  end if;

  -- CONCLUIR é ato do contratante: é o que libera o pagamento ao prestador.
  -- O prestador sinaliza o término em provider_done_at.
  if new.status = 'concluido' and old.status is distinct from 'concluido'
     and auth.uid() <> old.client_id then
    raise exception 'Somente o contratante aprova a conclusão do serviço';
  end if;

  -- provider_done_at: só o prestador designado marca, e não volta atrás
  if new.provider_done_at is distinct from old.provider_done_at then
    if old.provider_done_at is not null then
      raise exception 'A conclusão já foi sinalizada';
    end if;
    if auth.uid() <> coalesce(old.provider_id, new.provider_id) then
      raise exception 'Somente o profissional do serviço pode sinalizar a conclusão';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_request on public.service_requests;
create trigger trg_guard_request
  before update on public.service_requests
  for each row execute function public.guard_request_changes();

-- ── 3) Cartão do Profiler configurável ─────────────────────
-- Qual dos serviços cadastrados aparece no cartão + a frase (curta) do cartão.
alter table public.profiles
  add column if not exists card_category_id uuid references public.service_categories(id);
alter table public.profiles
  add column if not exists card_headline text;
alter table public.profiles drop constraint if exists profiles_card_headline_len;
alter table public.profiles
  add constraint profiles_card_headline_len check (card_headline is null or char_length(card_headline) <= 70);

-- ── 4) Carteira e saques ───────────────────────────────────
-- Previsão de crédito: quando o valor liberado fica de fato disponível
-- (D+1 no Pix, D+2 no cartão — espelha o prazo do gateway).
alter table public.payments add column if not exists available_at         timestamptz;
alter table public.payments add column if not exists advance_released_at  timestamptz;
-- Split real: para onde foi cada parte
alter table public.payments add column if not exists split_mode           text;  -- 'escrow' | 'split'
alter table public.payments add column if not exists provider_gateway_id  text;

create table if not exists public.withdrawals (
  id           uuid primary key default gen_random_uuid(),
  provider_id  uuid           not null references public.profiles(id) on delete cascade,
  amount       numeric(10,2)  not null check (amount > 0),
  pix_key      text,
  status       text           not null default 'solicitado',  -- solicitado | pago | recusado
  note         text,
  requested_at timestamptz    not null default now(),
  paid_at      timestamptz
);
create index if not exists idx_withdrawals_provider
  on public.withdrawals (provider_id, requested_at desc);

alter table public.withdrawals enable row level security;
drop policy if exists wd_read on public.withdrawals;
create policy wd_read on public.withdrawals for select to authenticated
  using (provider_id = auth.uid() or public.is_admin());
-- inserção só pela RPC (security definer) e update só por admin
drop policy if exists wd_admin on public.withdrawals;
create policy wd_admin on public.withdrawals for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

/**
 * Saldo do prestador, calculado NO SERVIDOR (nunca no cliente):
 *   liberado    → pagamentos aprovados cujo prazo de crédito já passou
 *   a_liberar   → aprovados ainda dentro do prazo (D+1/D+2)
 *   em_servico  → retido em serviços não aprovados ainda (inclui adiantamento)
 *   sacado      → saques solicitados/pagos (não recusados)
 *   disponivel  → liberado - sacado  (é o que pode ser sacado)
 */
create or replace function public.provider_balance(p_provider uuid default null)
returns table (
  liberado numeric, a_liberar numeric, em_servico numeric,
  adiantado numeric, sacado numeric, disponivel numeric
)
language sql security definer set search_path = public stable as $$
  with me as (select coalesce(p_provider, auth.uid()) as id),
  pays as (
    select p.*, r.provider_id
      from public.payments p
      join public.service_requests r on r.id = p.request_id
     where r.provider_id = (select id from me)
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
     where provider_id = (select id from me) and status <> 'recusado'
  )
  select agg.liberado, agg.a_liberar, agg.em_servico, agg.adiantado, wd.sacado,
         greatest(agg.liberado - wd.sacado, 0) as disponivel
    from agg, wd;
$$;

/** Solicita saque. Valida o saldo no servidor; usa o PIX do cadastro. */
create or replace function public.request_withdrawal(p_amount numeric)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_avail numeric; v_pix text; v_id uuid;
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  if not exists (select 1 from public.profiles
                  where id = auth.uid() and role = 'prestador' and status = 'aprovado') then
    raise exception 'Apenas prestadores aprovados podem sacar';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Informe um valor válido'; end if;

  select disponivel into v_avail from public.provider_balance(auth.uid());
  if p_amount > v_avail then
    raise exception 'Saldo disponível insuficiente (disponível: %)', coalesce(v_avail, 0);
  end if;

  select pix_key into v_pix from public.profiles_private where id = auth.uid();

  insert into public.withdrawals (provider_id, amount, pix_key)
  values (auth.uid(), round(p_amount, 2), v_pix)
  returning id into v_id;
  return v_id;
end;
$$;

-- ── 5) Aceitar proposta no servidor ────────────────────────
-- Antes o cliente escrevia provider_id/final_price direto (podia aceitar com
-- contra-proposta pendente e mandar o valor antigo). Agora é RPC.
create or replace function public.accept_proposal(p_proposal_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare pr public.proposals; r public.service_requests;
begin
  select * into pr from public.proposals where id = p_proposal_id;
  if pr.id is null then raise exception 'Proposta não encontrada'; end if;

  select * into r from public.service_requests where id = pr.request_id;
  if r.id is null then raise exception 'Pedido não encontrado'; end if;
  if r.client_id <> auth.uid() then raise exception 'Sem permissão'; end if;
  if r.provider_id is not null then raise exception 'Este pedido já tem profissional'; end if;
  if pr.status = 'recusada' then raise exception 'Esta proposta foi recusada'; end if;
  if pr.counter_status = 'pendente' then
    raise exception 'Aguarde o profissional responder sua contra-proposta antes de fechar.';
  end if;

  perform set_config('fixly.guard_bypass', 'on', true);
  update public.proposals set status = 'aceita' where id = pr.id;
  update public.proposals set status = 'recusada'
    where request_id = pr.request_id and id <> pr.id and status = 'enviada';
  update public.service_requests
     set provider_id  = pr.provider_id,
         final_price  = pr.price,          -- preço da proposta (pós-negociação)
         status       = 'aceito',
         advance_pct  = least(greatest(coalesce(pr.advance_pct, 0), 0), 50)
   where id = r.id;
  perform set_config('fixly.guard_bypass', 'off', true);
  return r.id;
end;
$$;

-- ── 6) Empreiteiro: handle para todos (profiler garantido) ──
-- Gera um handle a partir do nome da empresa para quem ficou sem, para o
-- anúncio ter a página pública /e/<handle> igual à do profissional.
do $$
declare e record; base text; cand text; n int;
begin
  for e in select id, company_name from public.empreiteiros
            where handle is null or btrim(handle) = '' loop
    base := regexp_replace(
              lower(translate(e.company_name,
                'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
                'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')),
              '[^a-z0-9]+', '.', 'g');
    base := btrim(base, '.');
    if base = '' then base := 'empresa'; end if;
    cand := base; n := 1;
    while exists (select 1 from public.empreiteiros where lower(handle) = cand) loop
      n := n + 1;
      cand := base || n::text;
    end loop;
    update public.empreiteiros set handle = cand where id = e.id;
  end loop;
end $$;

-- ── 7) Conta do prestador no gateway (split) — server-only ──
-- Tokens de OAuth do gateway. RLS ligado e SEM policies: só a service_role.
create table if not exists public.provider_gateway_accounts (
  provider_id     uuid primary key references public.profiles(id) on delete cascade,
  gateway         text not null default 'mercadopago',
  gateway_user_id text,
  access_token    text,
  refresh_token   text,
  expires_at      timestamptz,
  connected_at    timestamptz not null default now()
);
alter table public.provider_gateway_accounts enable row level security;
-- (sem policies de propósito)

-- Só o dono do perfil vê se está conectado (sem expor token nenhum)
create or replace function public.gateway_connected(p_provider uuid default null)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.provider_gateway_accounts
     where provider_id = coalesce(p_provider, auth.uid())
       and access_token is not null
  );
$$;
