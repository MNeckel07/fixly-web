-- ============================================================
--  FIXLY — 0024: cancelamento pelo prestador + pedidos em tempo real
--
--  1) `cancel_reason`: por que o serviço foi desfeito. Guardado no pedido para
--     o admin conseguir enxergar padrão (prestador que desiste sempre, cliente
--     que cancela depois de pago).
--
--  2) `service_requests` entra na publicação do Realtime. Sem isto, o quadro do
--     prestador só descobre um pedido novo no `AutoRefresh` (15 s) — o dono
--     pediu que apareça na hora. Com a tabela publicada, o navegador do
--     prestador recebe o INSERT e atualiza sozinho.
--     O Realtime respeita a RLS: o prestador só recebe evento de pedido que ele
--     já teria direito de ler (`provider_id is null`, política do 0007).
-- ============================================================

alter table public.service_requests
  add column if not exists cancel_reason text;

comment on column public.service_requests.cancel_reason is
  'Motivo do cancelamento/desistência (texto livre, preenchido por quem desfez).';

-- ── Realtime ────────────────────────────────────────────────
-- `add table` estoura se a tabela já estiver na publicação; o bloco engole
-- só esse erro para a migração continuar idempotente.
do $$
begin
  alter publication supabase_realtime add table public.service_requests;
exception
  when duplicate_object then null;
  when others then
    -- em ambiente sem a publicação (Postgres puro), seguir sem Realtime
    raise notice 'Realtime não configurado neste banco: %', sqlerrm;
end $$;
