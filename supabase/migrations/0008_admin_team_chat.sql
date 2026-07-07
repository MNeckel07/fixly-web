-- ============================================================
--  FIXLY — Chat interno entre usuários admin ("Equipe")
-- ============================================================

alter table public.conversations drop constraint if exists conversations_type_check;
alter table public.conversations
  add constraint conversations_type_check check (type in ('aprovacao','servico','ticket','equipe'));

-- Cria (ou retorna) a conversa 1:1 entre dois admins.
create or replace function public.start_admin_chat(p_other uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare conv uuid; me uuid;
begin
  me := auth.uid();
  if not public.is_admin() then raise exception 'Apenas admin'; end if;
  if not exists (select 1 from public.profiles where id = p_other and role = 'admin') then
    raise exception 'Destinatário não é admin';
  end if;
  if p_other = me then raise exception 'Conversa consigo mesmo'; end if;

  select c.id into conv
  from public.conversations c
  join public.conversation_participants a on a.conversation_id = c.id and a.profile_id = me
  join public.conversation_participants b on b.conversation_id = c.id and b.profile_id = p_other
  where c.type = 'equipe'
  limit 1;

  if conv is null then
    insert into public.conversations (type) values ('equipe') returning id into conv;
    insert into public.conversation_participants (conversation_id, profile_id)
    values (conv, me), (conv, p_other) on conflict do nothing;
  end if;
  return conv;
end;
$$;
grant execute on function public.start_admin_chat(uuid) to authenticated;
