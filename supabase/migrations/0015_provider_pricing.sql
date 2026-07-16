-- ============================================================
--  FIXLY — Preço definido pelo prestador (sem preço da plataforma)
--  O contratante não vê mais faixa/estimativa. Cada prestador
--  envia sua proposta com o valor que quiser; o contratante
--  escolhe olhando perfil, avaliações e comentários.
-- ============================================================

-- Proposta do prestador SEM teto de 15% (preço livre).
create or replace function public.submit_proposal(
  p_request_id uuid, p_price numeric, p_eta int, p_message text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare r public.service_requests;
begin
  select * into r from public.service_requests where id = p_request_id;
  if r.id is null then raise exception 'Pedido não encontrado'; end if;
  if r.provider_id is not null then raise exception 'Este pedido já foi atribuído'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'prestador' and status = 'aprovado') then
    raise exception 'Apenas prestadores aprovados podem propor';
  end if;
  if p_price is null or p_price <= 0 then raise exception 'Informe um valor válido'; end if;

  insert into public.proposals (request_id, provider_id, price, eta_minutes, message, status)
  values (p_request_id, auth.uid(), round(p_price, 2), p_eta, p_message, 'enviada')
  on conflict (request_id, provider_id)
    do update set price = excluded.price, eta_minutes = excluded.eta_minutes,
                  message = excluded.message, status = 'enviada';

  update public.service_requests set status = 'proposta_enviada'
    where id = p_request_id and status = 'buscando';
  return p_request_id;
end;
$$;

-- Disparo automático: cada prestador propõe com o SEU preço-base
-- (ajustado por distância e urgência), não uma faixa da plataforma.
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

    -- preço do próprio prestador (base ± variação), urgência e distância
    price := coalesce(prov.base_price, 100)
             * (case when r.urgent then 1.3 else 1 end)
             + round(dist * 2)
             + round((random() * 30 - 10)::numeric);

    insert into public.proposals (request_id, provider_id, price, eta_minutes, status)
    values (p_request_id, prov.id, greatest(round(price::numeric, 2), 50),
            greatest(10, round(dist * 4 + random() * 20)::int), 'enviada')
    on conflict (request_id, provider_id) do nothing;
    cnt := cnt + 1;
  end loop;

  if cnt > 0 then
    update public.service_requests set status = 'proposta_enviada' where id = p_request_id;
  end if;
  return cnt;
end;
$$;
