-- ============================================================
--  FIXLY — 0030: editar o pedido depois de criado
--
--  O contratante pode corrigir o que pediu enquanto NINGUÉM aceitou. Mexer no
--  endereço é o caso delicado: desde a 0026 o endereço exato mora em
--  `service_request_locations` e o pedido guarda só a versão embaralhada. Uma
--  atualização feita direto pela tela gravaria o endereço exato no lugar
--  errado — e ele vazaria para todos os prestadores que enxergam pedidos
--  abertos.
--
--  Por isso a edição de local passa por esta RPC, que refaz o mesmo split do
--  INSERT usando as MESMAS funções (`fixly_area_label`, `fixly_blur_coord`).
-- ============================================================

create or replace function public.update_request_location(
  p_request_id uuid,
  p_address    text,
  p_lat        double precision,
  p_lng        double precision
) returns void
language plpgsql security definer set search_path = public as $$
declare r public.service_requests;
begin
  select * into r from public.service_requests where id = p_request_id;
  if r.id is null then raise exception 'Pedido não encontrado'; end if;
  if r.client_id <> auth.uid() and not public.is_admin() then
    raise exception 'Sem permissão';
  end if;
  -- depois que alguém aceitou, o combinado está feito: mudar o endereço aqui
  -- seria mudar o serviço por baixo do profissional que já topou.
  if r.provider_id is not null then
    raise exception 'O pedido já foi aceito — fale pelo chat para ajustar o endereço';
  end if;

  insert into public.service_request_locations (request_id, address, lat, lng)
  values (p_request_id, p_address, p_lat, p_lng)
  on conflict (request_id) do update
    set address = excluded.address, lat = excluded.lat, lng = excluded.lng;

  perform set_config('fixly.guard_bypass', 'on', true);
  update public.service_requests
     set address = coalesce(public.fixly_area_label(p_address), p_address),
         lat     = public.fixly_blur_coord(p_lat, p_request_id::text || 'lat'),
         lng     = public.fixly_blur_coord(p_lng, p_request_id::text || 'lng')
   where id = p_request_id;
  perform set_config('fixly.guard_bypass', 'off', true);
end;
$$;

grant execute on function public.update_request_location(uuid, text, double precision, double precision) to authenticated;
