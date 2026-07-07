-- ============================================================
--  FIXLY — Usuários admin: função, permissões e login por usuário
-- ============================================================

alter table public.profiles
  add column if not exists funcao      text,
  add column if not exists permissions text[];

alter table public.profiles_private
  add column if not exists username text;

create unique index if not exists idx_profiles_private_username
  on public.profiles_private (lower(username)) where username is not null;
