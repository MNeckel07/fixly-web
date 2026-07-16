-- ============================================================
--  FIXLY — Profiler (perfil público + portfólio + follows)
-- ============================================================

-- handle público (usado em /p/<handle>)
alter table public.profiles
  add column if not exists handle    text,
  add column if not exists headline  text;

create unique index if not exists idx_profiles_handle
  on public.profiles (lower(handle)) where handle is not null;

-- ── Portfólio (fotos do trabalho) ───────────────────────────
create table if not exists public.portfolio_items (
  id          uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id) on delete cascade,
  image_path  text not null,
  caption     text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_portfolio_provider on public.portfolio_items(provider_id, created_at desc);

alter table public.portfolio_items enable row level security;
drop policy if exists pi_read on public.portfolio_items;
create policy pi_read on public.portfolio_items for select using (true);
drop policy if exists pi_write on public.portfolio_items;
create policy pi_write on public.portfolio_items for all
  using (provider_id = auth.uid() or public.is_admin())
  with check (provider_id = auth.uid() or public.is_admin());

-- ── Follows (rede social entre profissionais/clientes) ──────
create table if not exists public.follows (
  follower_id  uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id)
);
create index if not exists idx_follows_following on public.follows(following_id);

alter table public.follows enable row level security;
drop policy if exists fl_read on public.follows;
create policy fl_read on public.follows for select using (true);
drop policy if exists fl_insert on public.follows;
create policy fl_insert on public.follows for insert with check (follower_id = auth.uid());
drop policy if exists fl_delete on public.follows;
create policy fl_delete on public.follows for delete using (follower_id = auth.uid());

-- ── Storage: bucket público de portfólio ────────────────────
insert into storage.buckets (id, name, public)
values ('portfolio', 'portfolio', true)
on conflict (id) do nothing;

drop policy if exists portfolio_upload on storage.objects;
create policy portfolio_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'portfolio' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists portfolio_modify on storage.objects;
create policy portfolio_modify on storage.objects for update to authenticated
  using (bucket_id = 'portfolio' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists portfolio_delete on storage.objects;
create policy portfolio_delete on storage.objects for delete to authenticated
  using (bucket_id = 'portfolio' and (storage.foldername(name))[1] = auth.uid()::text);
