-- ============================================================
--  FIXLY — Blindagem de integridade em service_requests
--  O RLS já garante QUEM pode escrever na linha (dono/prestador/admin),
--  mas não O QUE cada um pode mudar. Sem isto, um prestador designado
--  poderia (via API, não pela UI):
--    - escrever a própria nota/avaliação (rating/review) → inflar reputação;
--    - alternar o status para 'concluido' repetidas vezes → farmar jobs_done.
--  Este trigger fecha os dois buracos, sem quebrar os fluxos legítimos.
-- ============================================================

create or replace function public.guard_request_changes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- triggers confiáveis podem sinalizar bypass
  if current_setting('fixly.guard_bypass', true) = 'on' then
    return new;
  end if;

  -- contexto confiável (service_role / server actions com a chave secret):
  -- não há usuário autenticado. O RLS já bloqueia o anônimo antes daqui.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  -- avaliação (nota + comentário) é exclusiva do contratante dono do pedido
  if (new.rating is distinct from old.rating or new.review is distinct from old.review)
     and auth.uid() <> old.client_id then
    raise exception 'Somente o contratante pode avaliar o serviço';
  end if;

  -- estados finais são terminais: ninguém (além de admin) reabre um pedido
  -- concluído/cancelado (impede farmar contagem de serviços)
  if old.status in ('concluido', 'cancelado') and new.status is distinct from old.status then
    raise exception 'Serviço finalizado não pode mudar de status';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_request on public.service_requests;
create trigger trg_guard_request
  before update on public.service_requests
  for each row execute function public.guard_request_changes();
