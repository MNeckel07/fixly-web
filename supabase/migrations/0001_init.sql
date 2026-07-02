-- ============================================================
--  FIXLY — Schema inicial (perfis, cadastro, serviços, escrow)
--  Rodar uma vez no SQL Editor do Supabase (ou via psql/CLI).
-- ============================================================

create extension if not exists pgcrypto;

-- ── Tipos (enums) ───────────────────────────────────────────
do $$ begin create type public.user_role       as enum ('contratante','prestador','admin');                                                     exception when duplicate_object then null; end $$;
do $$ begin create type public.profile_status   as enum ('pendente','aprovado','reprovado');                                                    exception when duplicate_object then null; end $$;
do $$ begin create type public.request_status   as enum ('buscando','proposta_enviada','aceito','a_caminho','em_andamento','concluido','cancelado'); exception when duplicate_object then null; end $$;
do $$ begin create type public.proposal_status  as enum ('enviada','aceita','recusada','expirada');                                              exception when duplicate_object then null; end $$;
do $$ begin create type public.payment_status   as enum ('retido','liberado','reembolsado');                                                    exception when duplicate_object then null; end $$;
do $$ begin create type public.document_status  as enum ('pendente','aprovado','reprovado');                                                    exception when duplicate_object then null; end $$;

-- ── Categorias de serviço ───────────────────────────────────
create table if not exists public.service_categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  icon        text not null,           -- emoji/ícone
  color       text not null default '#FFC107',
  base_price  numeric(10,2) not null default 80,
  created_at  timestamptz not null default now()
);

-- ── Perfis (1:1 com auth.users) ─────────────────────────────
create table if not exists public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  role             public.user_role     not null,
  status           public.profile_status not null default 'pendente',
  full_name        text not null,
  email            text not null,
  phone            text,
  cpf              text,
  city             text,
  -- específicos do prestador
  category_id      uuid references public.service_categories(id),
  bio              text,
  service_radius_km int  default 10,
  base_price       numeric(10,2),
  lat              double precision,
  lng              double precision,
  rating           numeric(2,1) default 5.0,
  jobs_done        int default 0,
  avatar_url       text,
  -- moderação
  reviewed_at      timestamptz,
  reviewed_by      uuid references auth.users(id),
  reject_reason    text,
  created_at       timestamptz not null default now()
);

-- ── Documentos enviados no cadastro ─────────────────────────
create table if not exists public.documents (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  kind         text not null,          -- rg, cpf, cnh, comprovante_endereco, certificado, selfie
  file_path    text not null,          -- caminho no bucket privado 'documentos'
  status       public.document_status not null default 'pendente',
  created_at   timestamptz not null default now()
);

-- ── Pedidos de serviço ──────────────────────────────────────
create table if not exists public.service_requests (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.profiles(id) on delete cascade,
  category_id     uuid references public.service_categories(id),
  provider_id     uuid references public.profiles(id),
  description     text not null,
  urgent          boolean not null default false,
  address         text,
  lat             double precision,
  lng             double precision,
  estimated_price numeric(10,2),
  final_price     numeric(10,2),
  status          public.request_status not null default 'buscando',
  rating          int,
  created_at      timestamptz not null default now()
);

-- ── Propostas (disparo p/ vários prestadores) ───────────────
create table if not exists public.proposals (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references public.service_requests(id) on delete cascade,
  provider_id  uuid not null references public.profiles(id) on delete cascade,
  price        numeric(10,2) not null,
  eta_minutes  int,
  message      text,
  status       public.proposal_status not null default 'enviada',
  created_at   timestamptz not null default now(),
  unique (request_id, provider_id)
);

-- ── Pagamentos (escrow) ─────────────────────────────────────
create table if not exists public.payments (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references public.service_requests(id) on delete cascade,
  amount       numeric(10,2) not null,
  fee          numeric(10,2) not null default 0,   -- comissão da plataforma
  method       text,                               -- pix, cartao
  status       public.payment_status not null default 'retido',
  created_at   timestamptz not null default now(),
  released_at  timestamptz
);

-- ── Índices ─────────────────────────────────────────────────
create index if not exists idx_requests_status   on public.service_requests(status);
create index if not exists idx_requests_client    on public.service_requests(client_id);
create index if not exists idx_requests_provider  on public.service_requests(provider_id);
create index if not exists idx_proposals_provider on public.proposals(provider_id);
create index if not exists idx_documents_profile  on public.documents(profile_id);

-- ============================================================
--  Função auxiliar: is_admin() — evita recursão de RLS
-- ============================================================
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'aprovado'
  );
$$;

-- ============================================================
--  Trigger: impede que o usuário mude o próprio role/status.
--  Só o admin (ou a service key, que ignora RLS) pode moderar.
-- ============================================================
create or replace function public.guard_profile_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.role <> old.role or new.status <> old.status) and not public.is_admin() then
    raise exception 'Alteração de role/status não permitida';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_profile on public.profiles;
create trigger trg_guard_profile
  before update on public.profiles
  for each row execute function public.guard_profile_changes();

-- ============================================================
--  Row Level Security
-- ============================================================
alter table public.profiles          enable row level security;
alter table public.documents         enable row level security;
alter table public.service_categories enable row level security;
alter table public.service_requests  enable row level security;
alter table public.proposals         enable row level security;
alter table public.payments          enable row level security;

-- Categorias: leitura pública (catálogo), escrita só admin
drop policy if exists cat_read on public.service_categories;
create policy cat_read on public.service_categories for select using (true);
drop policy if exists cat_write on public.service_categories;
create policy cat_write on public.service_categories for all using (public.is_admin()) with check (public.is_admin());

-- Profiles
drop policy if exists prof_select on public.profiles;
create policy prof_select on public.profiles for select using (
  id = auth.uid()
  or public.is_admin()
  or (role = 'prestador' and status = 'aprovado')
);
drop policy if exists prof_insert on public.profiles;
create policy prof_insert on public.profiles for insert with check (id = auth.uid());
drop policy if exists prof_update on public.profiles;
create policy prof_update on public.profiles for update using (id = auth.uid() or public.is_admin());

-- Documents
drop policy if exists doc_select on public.documents;
create policy doc_select on public.documents for select using (profile_id = auth.uid() or public.is_admin());
drop policy if exists doc_insert on public.documents;
create policy doc_insert on public.documents for insert with check (profile_id = auth.uid());
drop policy if exists doc_modify on public.documents;
create policy doc_modify on public.documents for update using (profile_id = auth.uid() or public.is_admin());

-- Service requests
drop policy if exists req_select on public.service_requests;
create policy req_select on public.service_requests for select using (
  client_id = auth.uid()
  or provider_id = auth.uid()
  or public.is_admin()
  or (status in ('buscando','proposta_enviada') and exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'prestador' and p.status = 'aprovado'))
);
drop policy if exists req_insert on public.service_requests;
create policy req_insert on public.service_requests for insert with check (client_id = auth.uid());
drop policy if exists req_update on public.service_requests;
create policy req_update on public.service_requests for update using (
  client_id = auth.uid() or provider_id = auth.uid() or public.is_admin()
);

-- Proposals
drop policy if exists prop_select on public.proposals;
create policy prop_select on public.proposals for select using (
  provider_id = auth.uid()
  or public.is_admin()
  or exists (select 1 from public.service_requests r where r.id = request_id and r.client_id = auth.uid())
);
drop policy if exists prop_insert on public.proposals;
create policy prop_insert on public.proposals for insert with check (provider_id = auth.uid());
drop policy if exists prop_update on public.proposals;
create policy prop_update on public.proposals for update using (
  provider_id = auth.uid()
  or public.is_admin()
  or exists (select 1 from public.service_requests r where r.id = request_id and r.client_id = auth.uid())
);

-- Payments
drop policy if exists pay_select on public.payments;
create policy pay_select on public.payments for select using (
  public.is_admin()
  or exists (select 1 from public.service_requests r
             where r.id = request_id and (r.client_id = auth.uid() or r.provider_id = auth.uid()))
);
drop policy if exists pay_write on public.payments;
create policy pay_write on public.payments for all using (
  public.is_admin()
  or exists (select 1 from public.service_requests r where r.id = request_id and r.client_id = auth.uid())
) with check (
  public.is_admin()
  or exists (select 1 from public.service_requests r where r.id = request_id and r.client_id = auth.uid())
);

-- ============================================================
--  Storage: bucket privado de documentos
-- ============================================================
insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;

drop policy if exists doc_upload on storage.objects;
create policy doc_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists doc_read on storage.objects;
create policy doc_read on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ============================================================
--  Seed: catálogo de categorias
-- ============================================================
insert into public.service_categories (slug, name, icon, color, base_price) values
  ('eletricista',  'Eletricista',        '⚡', '#F59E0B', 120),
  ('encanador',    'Encanador',          '🔧', '#3B82F6', 110),
  ('diarista',     'Diarista',           '🧹', '#10B981', 90),
  ('pintor',       'Pintor',             '🎨', '#8B5CF6', 150),
  ('montador',     'Montador de Móveis', '🪑', '#EF4444', 80),
  ('ar_condicionado','Ar-condicionado',  '❄️', '#06B6D4', 180),
  ('jardinagem',   'Jardinagem',         '🌿', '#22C55E', 100),
  ('chaveiro',     'Chaveiro',           '🔑', '#6366F1', 90)
on conflict (slug) do nothing;
