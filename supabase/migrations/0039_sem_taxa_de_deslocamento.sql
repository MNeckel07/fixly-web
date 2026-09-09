-- ============================================================
--  0039 — FIM DA TAXA DE DESLOCAMENTO (cobrança única)
--
--  Decisão do dono (Fixly 13, pág. 6). O PDF trazia a escolha:
--
--      "ou colocar os 15% no deslocamento também ou tirar o deslocamento"
--
--  e ele fechou pela segunda: **tirar**. No lugar dela, o profissional recebe
--  uma instrução, ANTES de digitar o preço, para embutir todos os custos —
--  deslocamento incluído — de modo que o valor que ele manda já seja o valor
--  em que ele tem lucro. O cliente passa a ver UM número só.
--
--  Por que isso resolve de verdade e não é só cosmético: a taxa separada
--  existia justamente por ficar FORA da comissão de 15% (0036). Ou seja, era
--  uma porta aberta — bastava anunciar R$ 1 de serviço e R$ 300 de
--  "deslocamento" para o serviço inteiro passar sem comissão. Com um valor só,
--  a comissão volta a incidir sobre tudo que foi combinado.
--
--  ⚠️ A COLUNA `travel_fee` FICA. Não é indecisão:
--    • serviços JÁ PAGOS têm o frete no extrato e na conta de cancelamento —
--      apagar a coluna reescreveria dinheiro que já mudou de mãos;
--    • a assinatura de `submit_proposal` continua com `p_travel_fee` para que
--      um navegador com a tela antiga em cache não quebre com "function does
--      not exist" no meio de uma proposta.
--  O que muda é que NADA MAIS ESCREVE valor nela: a função ignora o parâmetro.
-- ============================================================

-- ════════════════════════════════════════════════════════════
--  1) A PROPOSTA NASCE SEM FRETE
--
--  ⚠️ Redefinida a partir da versão da 0036 (a mais recente), não da original:
--  partir de uma cópia antiga apagaria em silêncio o limite de rodadas de
--  negociação e a trava de pedido direcionado que vivem aqui dentro.
-- ════════════════════════════════════════════════════════════
create or replace function public.submit_proposal(
  p_request_id uuid, p_price numeric, p_eta int, p_message text,
  p_advance_pct int default 0, p_travel_fee numeric default 0
) returns uuid
language plpgsql security definer set search_path = public as $$
declare r public.service_requests;
begin
  select * into r from public.service_requests where id = p_request_id;
  if r.id is null then raise exception 'Pedido não encontrado'; end if;
  if r.provider_id is not null then raise exception 'Este pedido já foi atribuído'; end if;
  if r.target_provider_id is not null and r.target_provider_id <> auth.uid() then
    raise exception 'Este pedido é de outro profissional';
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'prestador' and status = 'aprovado') then
    raise exception 'Apenas prestadores aprovados podem propor';
  end if;
  if p_price is null or p_price <= 0 then raise exception 'Informe um valor válido'; end if;

  -- `p_travel_fee` é aceito e DESCARTADO (ver cabeçalho). A trava tem que ser
  -- aqui, no banco: validar só na tela deixaria a porta aberta para quem
  -- chamasse a RPC direto.
  insert into public.proposals (request_id, provider_id, price, eta_minutes, message, status,
                                advance_pct, travel_fee)
  values (p_request_id, auth.uid(), round(p_price, 2), p_eta, p_message, 'enviada',
          least(greatest(coalesce(p_advance_pct, 0), 0), 50), 0)
  on conflict (request_id, provider_id)
    do update set price = excluded.price, eta_minutes = excluded.eta_minutes,
                  message = excluded.message, status = 'enviada',
                  advance_pct = excluded.advance_pct,
                  travel_fee = 0,
                  -- preço novo = negociação do zero (inclusive as rodadas
                  -- gastas: senão "alterar" viraria a saída para negociar
                  -- infinitamente por fora do limite da 0036)
                  counter_price = null, counter_status = null, counter_by = null,
                  counter_rounds = 0;

  update public.service_requests set status = 'proposta_enviada'
    where id = p_request_id and status = 'buscando';
  return p_request_id;
end;
$$;

-- ════════════════════════════════════════════════════════════
--  2) LIMPA O QUE AINDA NÃO VIROU DINHEIRO
--
--  Sem isto, uma proposta enviada ONTEM com R$ 30 de deslocamento continuaria
--  cobrando os R$ 30 no aceite de hoje — a tela nova nem mostraria de onde
--  veio, e o cliente pagaria um valor que ninguém explica.
--
--  O corte é o PAGAMENTO, não a data: pedido com linha em `payments` fica
--  intocado, porque ali o frete já entrou na conta que foi cobrada, no extrato
--  do cliente e na política de cancelamento.
-- ════════════════════════════════════════════════════════════
update public.proposals p
   set travel_fee = 0
 where p.travel_fee <> 0
   and not exists (select 1 from public.payments pay where pay.request_id = p.request_id);

-- `final_price` do pedido é `price + travel_fee` (ver `accept_proposal`), então
-- tirar o frete exige devolver o total ao valor do serviço — senão o cliente
-- pagaria o frete embutido num número que a tela chama de "valor do serviço".
update public.service_requests r
   set final_price = greatest(coalesce(r.final_price, 0) - r.travel_fee, 0),
       travel_fee  = 0
 where r.travel_fee <> 0
   and not exists (select 1 from public.payments pay where pay.request_id = r.id);
