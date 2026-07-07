-- ============================================================
--  FIXLY — Visibilidade de pedidos abertos para prestadores
--  Antes: prestador só via status 'buscando' (pedidos viravam
--  'proposta_enviada' no disparo e sumiam). Agora vê QUALQUER
--  pedido ainda SEM prestador designado (provider_id is null),
--  independente de quando foi criado. O filtro de raio/categoria
--  é aplicado na aplicação.
-- ============================================================

drop policy if exists req_select on public.service_requests;
create policy req_select on public.service_requests for select using (
  client_id = auth.uid()
  or provider_id = auth.uid()
  or public.is_admin()
  or (
    provider_id is null
    and status not in ('concluido', 'cancelado')
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'prestador' and p.status = 'aprovado'
    )
  )
);
