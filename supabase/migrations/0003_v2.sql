-- ============================================================
--  FIXLY — Migração v2
--  Chat, tipos de documento configuráveis, termos, dados
--  completos de perfil, breakdown de pagamento, inativação.
--  (Sem ALTER TYPE de enums — usamos colunas novas.)
-- ============================================================

-- ── Perfis: dados completos + moderação ─────────────────────
alter table public.profiles
  add column if not exists birth_date        date,
  add column if not exists rg                text,
  add column if not exists gender            text,
  add column if not exists address           text,
  add column if not exists address_number    text,
  add column if not exists complement        text,
  add column if not exists neighborhood      text,
  add column if not exists state             text,
  add column if not exists zip_code          text,
  add column if not exists bank_name         text,
  add column if not exists bank_agency       text,
  add column if not exists bank_account      text,
  add column if not exists bank_account_type text,
  add column if not exists pix_key           text,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version     text,
  add column if not exists active            boolean not null default true,
  add column if not exists deleted_at        timestamptz;

-- ── Tipos de documento (gerenciados pelo admin) ─────────────
create table if not exists public.document_types (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,
  label      text not null,
  applies_to text not null default 'prestador' check (applies_to in ('prestador','contratante','ambos')),
  required   boolean not null default true,
  active     boolean not null default true,
  sort       int not null default 0,
  created_at timestamptz not null default now()
);

insert into public.document_types (slug, label, applies_to, required, sort) values
  ('rg_cnh',                'RG ou CNH (frente e verso)',        'ambos',       true,  1),
  ('cpf_doc',              'CPF',                                'ambos',       false, 2),
  ('comprovante_residencia','Comprovante de residência',         'ambos',       true,  3),
  ('foto_3x4',             'Foto 3x4',                           'prestador',   true,  4),
  ('selfie_documento',     'Selfie segurando o documento',       'prestador',   true,  5),
  ('carteira_trabalho',    'Carteira de Trabalho (CTPS)',        'prestador',   false, 6),
  ('comprovante_qualificacao','Certificado / qualificação técnica','prestador', false, 7),
  ('antecedentes',         'Certidão de antecedentes criminais', 'prestador',   false, 8),
  ('comprovante_bancario', 'Comprovante de conta bancária',      'prestador',   true,  9),
  ('termos_aceite',        'Termo de aceite assinado',           'ambos',       false, 99)
on conflict (slug) do nothing;

-- ── Chat: conversas, participantes, mensagens ───────────────
create table if not exists public.conversations (
  id         uuid primary key default gen_random_uuid(),
  type       text not null check (type in ('aprovacao','servico')),
  request_id uuid references public.service_requests(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  primary key (conversation_id, profile_id)
);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  body            text,
  attachment_path text,
  attachment_type text,   -- image | file
  attachment_name text,
  created_at      timestamptz not null default now(),
  delivered_at    timestamptz,
  read_at         timestamptz
);

create index if not exists idx_msg_conversation on public.messages(conversation_id, created_at);
create index if not exists idx_parts_profile     on public.conversation_participants(profile_id);

-- ── Pagamentos: breakdown (gateway, tarifas, líquido) ───────
alter table public.payments
  add column if not exists gateway        text,
  add column if not exists gateway_id     text,
  add column if not exists gateway_status text,
  add column if not exists gateway_fee    numeric(10,2) not null default 0,
  add column if not exists provider_net   numeric(10,2),
  add column if not exists paid_at        timestamptz;

-- ============================================================
--  Funções auxiliares
-- ============================================================
create or replace function public.is_conversation_participant(p_conv uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conv and profile_id = auth.uid()
  ) or public.is_admin();
$$;

-- Cria (ou retorna) a conversa de aprovação entre admin e o candidato.
create or replace function public.start_approval_chat(p_applicant uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare conv uuid; admin_id uuid;
begin
  admin_id := auth.uid();
  if not (public.is_admin() or admin_id = p_applicant) then
    raise exception 'Sem permissão';
  end if;

  select c.id into conv
  from public.conversations c
  join public.conversation_participants cp on cp.conversation_id = c.id and cp.profile_id = p_applicant
  where c.type = 'aprovacao'
  limit 1;

  if conv is null then
    insert into public.conversations (type) values ('aprovacao') returning id into conv;
    insert into public.conversation_participants (conversation_id, profile_id) values (conv, p_applicant);
    if public.is_admin() then
      insert into public.conversation_participants (conversation_id, profile_id)
      values (conv, admin_id) on conflict do nothing;
    end if;
  else
    -- garante o admin atual como participante
    if public.is_admin() then
      insert into public.conversation_participants (conversation_id, profile_id)
      values (conv, admin_id) on conflict do nothing;
    end if;
  end if;
  return conv;
end;
$$;

-- Cria (ou retorna) a conversa de serviço entre contratante e prestador.
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
  where type = 'servico' and request_id = p_request_id limit 1;

  if conv is null then
    insert into public.conversations (type, request_id) values ('servico', p_request_id) returning id into conv;
    insert into public.conversation_participants (conversation_id, profile_id)
    values (conv, r.client_id), (conv, r.provider_id) on conflict do nothing;
  end if;
  return conv;
end;
$$;

grant execute on function public.is_conversation_participant(uuid) to authenticated;
grant execute on function public.start_approval_chat(uuid) to authenticated;
grant execute on function public.start_service_chat(uuid) to authenticated;

-- ============================================================
--  RLS
-- ============================================================
alter table public.document_types          enable row level security;
alter table public.conversations           enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages                enable row level security;

drop policy if exists dt_read on public.document_types;
create policy dt_read on public.document_types for select using (true);
drop policy if exists dt_write on public.document_types;
create policy dt_write on public.document_types for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists conv_select on public.conversations;
create policy conv_select on public.conversations for select using (public.is_conversation_participant(id));

drop policy if exists cp_select on public.conversation_participants;
create policy cp_select on public.conversation_participants for select using (
  profile_id = auth.uid() or public.is_conversation_participant(conversation_id)
);

drop policy if exists msg_select on public.messages;
create policy msg_select on public.messages for select using (public.is_conversation_participant(conversation_id));
drop policy if exists msg_insert on public.messages;
create policy msg_insert on public.messages for insert with check (
  sender_id = auth.uid() and public.is_conversation_participant(conversation_id)
);
drop policy if exists msg_update on public.messages;
create policy msg_update on public.messages for update using (public.is_conversation_participant(conversation_id));

-- ── Storage: bucket privado de anexos do chat ───────────────
insert into storage.buckets (id, name, public)
values ('chat', 'chat', false) on conflict (id) do nothing;

drop policy if exists chat_upload on storage.objects;
create policy chat_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'chat' and public.is_conversation_participant(((storage.foldername(name))[1])::uuid));
drop policy if exists chat_read on storage.objects;
create policy chat_read on storage.objects for select to authenticated
  using (bucket_id = 'chat' and public.is_conversation_participant(((storage.foldername(name))[1])::uuid));

-- ── Realtime para o chat ────────────────────────────────────
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; end $$;
