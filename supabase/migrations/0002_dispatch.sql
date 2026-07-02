-- ============================================================
--  FIXLY — Disparo de pedido para vários prestadores
--  Função SECURITY DEFINER: cria propostas dos prestadores
--  próximos com preço/ETA simulados. Chamada pelo contratante
--  dono do pedido (via supabase.rpc('dispatch_request', ...)).
-- ============================================================

create or replace function public.dispatch_request(p_request_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r     public.service_requests;
  prov  record;
  dist  numeric;
  price numeric;
  cnt   int := 0;
begin
  select * into r from public.service_requests where id = p_request_id;
  if r.id is null then
    raise exception 'Pedido não encontrado';
  end if;
  if r.client_id <> auth.uid() then
    raise exception 'Sem permissão para disparar este pedido';
  end if;

  for prov in
    select p.*
    from public.profiles p
    where p.role = 'prestador'
      and p.status = 'aprovado'
      and (r.category_id is null or p.category_id = r.category_id)
    order by
      case when p.lat is not null and r.lat is not null
        then power(r.lat - p.lat, 2) + power(r.lng - p.lng, 2)
        else 999 end
    limit 5
  loop
    dist := case
      when r.lat is not null and prov.lat is not null
        then round((111 * sqrt(power(r.lat - prov.lat, 2) + power(r.lng - prov.lng, 2)))::numeric, 1)
      else round((2 + random() * 6)::numeric, 1)
    end;

    price := coalesce(prov.base_price, 100) * (case when r.urgent then 1.4 else 1 end)
             + round(dist * 3.5) + round((random() * 20 - 10)::numeric);

    insert into public.proposals (request_id, provider_id, price, eta_minutes, status)
    values (
      p_request_id,
      prov.id,
      greatest(round(price::numeric, 2), 50),
      greatest(10, round(dist * 4 + random() * 15)::int),
      'enviada'
    )
    on conflict (request_id, provider_id) do nothing;

    cnt := cnt + 1;
  end loop;

  if cnt > 0 then
    update public.service_requests
      set status = 'proposta_enviada'
      where id = p_request_id;
  end if;

  return cnt;
end;
$$;

grant execute on function public.dispatch_request(uuid) to authenticated;

-- ============================================================
--  Prestador aceita um pedido aberto (claim estilo Uber).
--  SECURITY DEFINER: permite o prestador se auto-atribuir com
--  segurança (o RLS sozinho não deixaria, pois ele ainda não é
--  o provider_id do pedido).
-- ============================================================
create or replace function public.accept_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r  public.service_requests;
  me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.role <> 'prestador' or me.status <> 'aprovado' then
    raise exception 'Apenas prestadores aprovados podem aceitar pedidos';
  end if;

  select * into r from public.service_requests where id = p_request_id for update;
  if r.id is null then
    raise exception 'Pedido não encontrado';
  end if;
  if r.provider_id is not null and r.provider_id <> auth.uid() then
    raise exception 'Este pedido já foi aceito por outro prestador';
  end if;

  update public.service_requests
    set provider_id = auth.uid(), status = 'aceito'
    where id = p_request_id;

  update public.proposals set status = 'aceita'
    where request_id = p_request_id and provider_id = auth.uid();
  update public.proposals set status = 'recusada'
    where request_id = p_request_id and provider_id <> auth.uid();
end;
$$;

grant execute on function public.accept_request(uuid) to authenticated;
