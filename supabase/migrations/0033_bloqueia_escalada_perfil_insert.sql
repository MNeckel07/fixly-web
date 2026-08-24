-- ============================================================
--  0033 — BLOQUEIA ESCALADA DE PRIVILÉGIO NO CADASTRO
--
--  O navegador cria a linha de `profiles` depois de criar a conta no Auth.
--  A policy anterior conferia somente `id = auth.uid()`, enquanto o guard de
--  campos protegidos rodava apenas em UPDATE. Uma sessão autenticada podia,
--  portanto, inserir o próprio perfil com role='admin' e status='aprovado'.
--
--  A correção é intencionalmente redundante:
--    1. a RLS recusa role/status privilegiados no caminho público;
--    2. o trigger valida os valores absolutos no INSERT e também protege os
--       campos de reputação/moderação, não apenas diferenças no UPDATE.
--
--  Operações com service_role continuam funcionando (createStaffUser usa a
--  chave de serviço). A exceção é segura porque service_role não é entregue
--  ao navegador e já ignora RLS por definição.
-- ============================================================

drop policy if exists prof_insert on public.profiles;
create policy prof_insert on public.profiles
  for insert
  with check (
    id = auth.uid()
    and role <> 'admin'
    and status = 'pendente'
  );

create or replace function public.guard_profile_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Triggers internos confiáveis usam este bypass ao recalcular reputação.
  if current_setting('fixly.guard_bypass', true) = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- A chave de serviço precisa criar administradores pela action protegida
    -- createStaffUser. Toda sessão de usuário, inclusive admin, passa pelas
    -- regras abaixo; criação administrativa comum usa service_role.
    if coalesce(auth.role(), '') <> 'service_role' then
      if new.id is distinct from auth.uid()
         or new.role = 'admin'
         or new.status <> 'pendente'
         or coalesce(new.active, true) <> true
         or coalesce(new.rating, 0) <> 0
         or coalesce(new.jobs_done, 0) <> 0
         or new.reviewed_at is not null
         or new.reviewed_by is not null
         or new.reject_reason is not null
      then
        raise exception 'Valores protegidos não permitidos no cadastro';
      end if;
    end if;

    return new;
  end if;

  if not public.is_admin() then
    if new.role <> old.role
       or new.status <> old.status
       or coalesce(new.active, true) <> coalesce(old.active, true)
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

drop trigger if exists trg_guard_profile on public.profiles;
create trigger trg_guard_profile
  before insert or update on public.profiles
  for each row execute function public.guard_profile_changes();
