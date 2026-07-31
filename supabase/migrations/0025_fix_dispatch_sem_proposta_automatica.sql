-- ============================================================
--  FIXLY — 0025: conserta o dispatch_request (regressão do 0023)
--
--  O QUE QUEBROU: o 0023 reescreveu `dispatch_request` partindo da versão do
--  **0004**, que INSERE proposta automática (preço = base do prestador ± ruído)
--  e já põe o pedido em 'proposta_enviada'. Só que o **0021** tinha removido
--  exatamente isso: no Express quem digita o preço é o prestador. Resultado:
--  pedido novo nascia com proposta de um profissional que não clicou em nada.
--
--  LIÇÃO: ao redefinir uma função que já foi alterada por outra migração,
--  partir da versão MAIS RECENTE (`grep -rn "function public.<nome>"` em
--  supabase/migrations e pegar a de maior número), nunca da primeira que
--  aparecer.
--
--  Esta versão = a do 0021 (só CONTA quem se qualifica, não cria proposta)
--  + o isolamento do Selo Fix que o 0023 trouxe.
-- ============================================================

create or replace function public.dispatch_request(p_request_id uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare
  r public.service_requests;
  prov record;
  dist numeric;
  cnt int := 0;
  client_badge boolean;
begin
  select * into r from public.service_requests where id = p_request_id;
  if r.id is null then raise exception 'Pedido não encontrado'; end if;
  if r.client_id <> auth.uid() then raise exception 'Sem permissão'; end if;

  select coalesce(fix_badge, false) into client_badge
    from public.profiles where id = r.client_id;

  for prov in
    select p.*
    from public.profiles p
    where p.role = 'prestador' and p.status = 'aprovado' and p.active
      -- SELO FIX (0023): prestador com selo só enxerga pedido de conta com
      -- selo. O contrário é permitido de propósito — conta de teste alcança
      -- prestador real, e aí a cobrança entra em vigor.
      and (client_badge or not coalesce(p.fix_badge, false))
      and (
        r.category_id is null
        or p.category_id = r.category_id
        or exists (select 1 from public.provider_categories pc
                   where pc.provider_id = p.id and pc.category_id = r.category_id)
      )
      -- não conta quem já está ocupado com um serviço em andamento
      and not exists (
        select 1 from public.service_requests s
        where s.provider_id = p.id and s.status in ('a_caminho','em_andamento')
      )
  loop
    dist := case
      when r.lat is not null and prov.lat is not null
        then round((111 * sqrt(power(r.lat - prov.lat, 2) + power(r.lng - prov.lng, 2)))::numeric, 1)
      else 0 end;
    if dist > coalesce(prov.service_radius_km, 10) then continue; end if;
    cnt := cnt + 1;
  end loop;

  -- NÃO cria proposta e NÃO mexe no status: o pedido fica em 'buscando' e só
  -- vira 'proposta_enviada' quando um prestador de verdade chamar
  -- `submit_proposal`. É o que faz o preço ser do profissional, não nosso.
  return cnt;
end;
$$;
