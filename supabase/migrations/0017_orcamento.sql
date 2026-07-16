-- ============================================================
--  FIXLY — Modo Orçamento (visita técnica)
--  O contratante escolhe um profissional, combina a visita pelo
--  chat, e o profissional envia o valor depois. Distinguimos do
--  Express por 'mode'. Sem novo valor de enum.
-- ============================================================

alter table public.service_requests
  add column if not exists mode     text not null default 'express',  -- express | orcamento
  add column if not exists visit_at timestamptz;
