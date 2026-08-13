-- ============================================================
--  FIXLY — 0027: cartões salvos (Checkout Transparente do MP)
--
--  O Fixly NUNCA guarda número, CVV ou validade de cartão. Quem guarda é o
--  Mercado Pago, no "customer" dele; aqui fica só o ID desse customer, para
--  saber a quem pedir a lista de cartões.
--
--  `mp_customer_env` existe porque customer de TESTE não vale em PRODUÇÃO: ao
--  virar as credenciais, o id antigo passa a apontar para o nada. Guardando o
--  ambiente, o servidor percebe a troca e cria o customer certo em vez de
--  quebrar o pagamento do cliente.
-- ============================================================

alter table public.profiles_private
  add column if not exists mp_customer_id  text,
  add column if not exists mp_customer_env text;  -- 'test' | 'prod'

comment on column public.profiles_private.mp_customer_id is
  'ID do customer no Mercado Pago (cartões salvos). Nunca guardamos dados do cartão.';
comment on column public.profiles_private.mp_customer_env is
  'Ambiente em que o customer foi criado: test | prod. Se mudar, o id é descartado.';
