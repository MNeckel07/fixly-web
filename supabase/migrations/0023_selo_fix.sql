-- ============================================================
--  FIXLY — 0023: Selo Fix (fluxo sem cobrança)
--
--  Uma marca que o admin liga em contas específicas. Conta com selo roda o
--  fluxo inteiro do site SEM gateway de pagamento no meio — serve para validar
--  front e back em produção, demonstrar o produto e treinar equipe.
--
--  Duas regras que valem a pena entender antes de mexer aqui:
--
--   1. PULAR O PAGAMENTO EXIGE SELO NOS DOIS LADOS. Basta o prestador que
--      aceitou ser conta real para a cobrança entrar em vigor. Isso é checado
--      na server action `skipPayment`, não aqui.
--
--   2. ISOLAMENTO ASSIMÉTRICO no disparo (`dispatch_request`):
--        - prestador COM selo não recebe pedido de contratante SEM selo
--          (protege o cliente real de receber proposta de conta de vitrine);
--        - contratante COM selo CONTINUA alcançando prestador real — é assim
--          que uma conta real pega um serviço e o pagamento entra em vigor.
--
--  Por que uma coluna nova e não o `is_test` que já existe: `is_test` libera o
--  link mágico de impersonação em Admin → Testes. Dar isso a usuário real seria
--  abrir porta de invasão de conta. O selo só dispensa o pagamento.
--
--  Migração ADITIVA (colunas com default false): pode ser aplicada antes do
--  push sem quebrar o código que está no ar.
-- ============================================================

-- ── 1) Colunas ──────────────────────────────────────────────
alter table public.profiles
  add column if not exists fix_badge boolean not null default false;

-- marca o serviço que correu sem cobrança; é o que sustenta a tarja na tela
-- e mantém esses serviços fora de qualquer relatório de faturamento
alter table public.service_requests
  add column if not exists no_charge boolean not null default false;

comment on column public.profiles.fix_badge is
  'Selo Fix: conta pode rodar o fluxo sem gateway de pagamento. Só admin altera.';
comment on column public.service_requests.no_charge is
  'Serviço concluído sem cobrança (Selo Fix nos dois lados). Não gera linha em payments.';

create index if not exists idx_profiles_fix_badge on public.profiles(fix_badge) where fix_badge;

-- ── 2) Guard: só admin liga o selo ──────────────────────────
-- Mesma proteção que já existe para role/status. Sem isto, o próprio usuário
-- poderia se auto-marcar e concluir serviços sem pagar.
create or replace function public.guard_profile_changes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_setting('fixly.guard_bypass', true) = 'on' then
    return new;
  end if;
  if not public.is_admin() then
    if new.role <> old.role
       or new.status <> old.status
       or coalesce(new.active, true) <> coalesce(old.active, true)
       or coalesce(new.fix_badge, false) <> coalesce(old.fix_badge, false)
       or coalesce(new.rating, -1) is distinct from coalesce(old.rating, -1)
       or coalesce(new.jobs_done, -1) is distinct from coalesce(old.jobs_done, -1)
       or new.reviewed_at   is distinct from old.reviewed_at
       or new.reviewed_by   is distinct from old.reviewed_by
       or new.reject_reason is distinct from old.reject_reason
    then
      raise exception 'Alteração de campos protegidos não permitida';
    end if;
  end if;
  return new;
end;
$$;

-- ── 3) Disparo com isolamento assimétrico ───────────────────
-- Igual à versão do 0004, com UMA cláusula a mais no where (ver comentário).
create or replace function public.dispatch_request(p_request_id uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare
  r public.service_requests;
  prov record;
  dist numeric;
  price numeric;
  cnt int := 0;
  client_badge boolean;
begin
  select * into r from public.service_requests where id = p_request_id;
  if r.id is null then raise exception 'Pedido não encontrado'; end if;
  if r.client_id <> auth.uid() then raise exception 'Sem permissão'; end if;

  select coalesce(fix_badge, false) into client_badge
    from public.profiles where id = r.client_id;

  for prov in
    select p.*
    from public.profiles p
    where p.role = 'prestador' and p.status = 'aprovado' and p.active
      -- ISOLAMENTO: prestador com selo só enxerga pedido de conta com selo.
      -- O contrário é permitido de propósito (conta de teste alcança prestador
      -- real, e aí a cobrança entra em vigor).
      and (client_badge or not coalesce(p.fix_badge, false))
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

-- ── 4) Selo nas contas existentes ───────────────────────────
-- Definido pelo dono em 30/07/2026: todas as contas de hoje são de teste,
-- MENOS o Arthur — se ele aceitar um serviço, a cobrança entra em vigor.
-- O recorte por data deixa a migração inofensiva se for reaplicada: conta
-- criada depois daqui nasce sem selo e continua sem.
-- O guard acima recusa quem não é admin, e uma conexão direta ao banco não tem
-- `auth.uid()` — daí o bypass, que é o mecanismo que o próprio schema já usa
-- (ver `on_request_completed` no 0006). É local à transação da migração.
select set_config('fixly.guard_bypass', 'on', true);

update public.profiles p
   set fix_badge = true
 where p.created_at < '2026-07-31'::timestamptz
   and not exists (
     select 1 from public.profiles_private pp
      where pp.id = p.id
        and lower(pp.email) = lower('Arthuroliveira@fixly.com.br')
   );
