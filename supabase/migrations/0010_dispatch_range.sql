-- ============================================================
--  FIXLY — Disparo automático dentro da faixa de pré-orçamento
--  Mantém o disparo (para o contratante ver opções na hora), mas
--  com preços dentro de [estimated_min, estimated_max].
-- ============================================================
create or replace function public.dispatch_request(p_request_id uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare
  r public.service_requests;
  prov record;
  dist numeric;
  price numeric;
  cnt int := 0;
begin
  select * into r from public.service_requests where id = p_request_id;
  if r.id is null then raise exception 'Pedido não encontrado'; end if;
  if r.client_id <> auth.uid() then raise exception 'Sem permissão'; end if;

  for prov in
    select p.*
    from public.profiles p
    where p.role = 'prestador' and p.status = 'aprovado' and p.active
      and (
        r.category_id is null
        or p.category_id = r.category_id
        or exists (select 1 from public.provider_categories pc
                   where pc.provider_id = p.id and pc.category_id = r.category_id)
      )
    order by
      case when p.lat is not null and r.lat is not null
        then power(r.lat - p.lat, 2) + power(r.lng - p.lng, 2) else 999 end
    limit 8
  loop
    dist := case
      when r.lat is not null and prov.lat is not null
        then round((111 * sqrt(power(r.lat - prov.lat, 2) + power(r.lng - prov.lng, 2)))::numeric, 1)
      else 0 end;

    if dist > coalesce(prov.service_radius_km, 10) then
      continue;
    end if;

    -- preço dentro da faixa de pré-orçamento (com leve variação)
    price := coalesce(r.estimated_min, 80)
             + (coalesce(r.estimated_max, 150) - coalesce(r.estimated_min, 80)) * random();
    price := least(greatest(price, coalesce(r.estimated_min, 50)), coalesce(r.estimated_max, price));

    insert into public.proposals (request_id, provider_id, price, eta_minutes, status)
    values (p_request_id, prov.id, round(price::numeric, 2),
            greatest(10, round(dist * 4 + random() * 15)::int), 'enviada')
    on conflict (request_id, provider_id) do nothing;
    cnt := cnt + 1;
  end loop;

  if cnt > 0 then
    update public.service_requests set status = 'proposta_enviada' where id = p_request_id;
  end if;
  return cnt;
end;
$$;
