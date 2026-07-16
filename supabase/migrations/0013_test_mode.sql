-- ============================================================
--  FIXLY — Modo de Teste: flag is_test nas contas
-- ============================================================

alter table public.profiles
  add column if not exists is_test boolean not null default false;

-- marca as contas de teste conhecidas (contratante e prestador)
update public.profiles p
set is_test = true
from public.profiles_private pp
where pp.id = p.id
  and pp.email in ('contratante@fixly.com.br', 'prestador@fixly.com.br',
                   'ana.eletrica@fixly.com.br', 'joao.encanador@fixly.com.br');
