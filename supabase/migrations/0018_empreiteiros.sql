-- ============================================================
--  FIXLY — Empreiteiros (B2B): anúncio por mensalidade, sem comissão
--  Quem quer se anunciar cria a empresa e paga mensalidade para
--  aparecer. Quem busca mão de obra encontra e contata direto.
-- ============================================================

create table if not exists public.empreiteiros (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid unique references public.profiles(id) on delete cascade,
  company_name        text not null,
  category_id         uuid references public.service_categories(id),
  specialties         text,
  description         text,
  city                text,
  phone               text,
  whatsapp            text,
  subscription_active boolean not null default false,
  subscription_until  date,
  created_at          timestamptz not null default now()
);
create index if not exists idx_empreiteiros_active on public.empreiteiros(subscription_active);

alter table public.empreiteiros enable row level security;

drop policy if exists emp_read on public.empreiteiros;
create policy emp_read on public.empreiteiros for select
  using (subscription_active or owner_id = auth.uid() or public.is_admin());

drop policy if exists emp_insert on public.empreiteiros;
create policy emp_insert on public.empreiteiros for insert with check (owner_id = auth.uid());

drop policy if exists emp_update on public.empreiteiros;
create policy emp_update on public.empreiteiros for update
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists emp_delete on public.empreiteiros;
create policy emp_delete on public.empreiteiros for delete
  using (owner_id = auth.uid() or public.is_admin());
