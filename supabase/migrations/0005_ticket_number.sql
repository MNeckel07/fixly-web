-- ============================================================
--  FIXLY — Numeração sequencial global dos tickets
--  Cada ticket recebe um número = último número + 1 (sequência).
-- ============================================================

create sequence if not exists public.ticket_number_seq;

alter table public.tickets add column if not exists number bigint;

-- backfill dos tickets existentes na ordem de criação
with ordered as (
  select id, row_number() over (order by created_at) as rn
  from public.tickets
  where number is null
)
update public.tickets t set number = o.rn
from ordered o where t.id = o.id;

-- a sequência continua a partir do maior número já atribuído
select setval('public.ticket_number_seq', coalesce((select max(number) from public.tickets), 0) + 1, false);

alter table public.tickets alter column number set default nextval('public.ticket_number_seq');
alter table public.tickets alter column number set not null;
