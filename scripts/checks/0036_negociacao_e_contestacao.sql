-- ============================================================
--  Provas da 0036 — limite de negociação e contestação de avaliação.
--
--  Roda dentro da transação do dry-run (tudo volta atrás no fim). Cria um
--  pedido e uma proposta DE VERDADE e vai gastando as rodadas, alternando a
--  sessão entre contratante e prestador com `request.jwt.claims` — é assim que
--  `auth.uid()` responde o que a função enxerga em produção.
-- ============================================================

create temp table _r (ordem int, teste text, esperado text, obtido text, ok boolean) on commit drop;

do $$
declare
  v_cli   uuid;
  v_prov  uuid;
  v_cat   uuid;
  v_req   uuid;
  v_prop  uuid;
  v_log   jsonb := '[]'::jsonb;
  v_err   text;
  v_price numeric;
  v_final numeric;
  v_rounds int;
  v_flag  boolean;
  v_admin uuid;
begin
  select id into v_cli  from public.profiles where role='contratante' and status='aprovado' order by created_at limit 1;
  select id into v_prov from public.profiles where role='prestador'  and status='aprovado' order by created_at limit 1;
  select id into v_cat  from public.service_categories where hidden=false order by name limit 1;
  -- ⚠️ capturado AQUI, antes de assumir qualquer sessão: lido mais tarde (já
  -- como prestador) a RLS de `profiles` devolve vazio e o `sub` do JWT sai
  -- nulo — `auth.uid()` vira null e `is_admin()` responde falso.
  select id into v_admin from public.profiles where role='admin' and status='aprovado' order by created_at limit 1;

  ------------------------------------------------------------------
  -- PREPARO: pedido do cliente + proposta do prestador COM FRETE
  ------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_cli, 'role','authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  insert into public.service_requests (client_id, category_id, description, urgent, address, lat, lng, status)
  values (v_cli, v_cat, 'PROVA 0036 — negociação', false, 'Rua de teste, Centro, São Paulo, nº 1', -23.55, -46.63, 'buscando')
  returning id into v_req;

  perform set_config('request.jwt.claims', json_build_object('sub', v_prov, 'role','authenticated')::text, true);
  perform public.submit_proposal(v_req, 1000, null, null, 0, 150);
  select id, price, travel_fee into v_prop, v_price, v_final
    from public.proposals where request_id = v_req and provider_id = v_prov;

  v_log := v_log || jsonb_build_object('ordem',1,'teste','proposta guarda o frete separado do preço',
    'esperado','1000 / 150','obtido', v_price::text || ' / ' || v_final::text,
    'ok', v_price = 1000 and v_final = 150);

  ------------------------------------------------------------------
  -- 1) A PRIMEIRA contra-proposta é do CONTRATANTE
  ------------------------------------------------------------------
  begin
    perform public.counter_proposal(v_prop, 900);   -- ainda como PRESTADOR
    v_log := v_log || jsonb_build_object('ordem',2,'teste','prestador não abre a negociação',
      'esperado','recusado','obtido','deixou','ok',false);
  exception when others then
    v_log := v_log || jsonb_build_object('ordem',2,'teste','prestador não abre a negociação',
      'esperado','recusado','obtido',SQLERRM,'ok',true);
  end;

  ------------------------------------------------------------------
  -- 2) Quatro rodadas alternadas passam; a QUINTA não
  ------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_cli, 'role','authenticated')::text, true);
  perform public.counter_proposal(v_prop, 900);    -- rodada 1 (contratante)
  perform set_config('request.jwt.claims', json_build_object('sub', v_prov, 'role','authenticated')::text, true);
  perform public.counter_proposal(v_prop, 950);    -- rodada 2 (prestador)
  perform set_config('request.jwt.claims', json_build_object('sub', v_cli, 'role','authenticated')::text, true);
  perform public.counter_proposal(v_prop, 920);    -- rodada 3 (contratante)
  perform set_config('request.jwt.claims', json_build_object('sub', v_prov, 'role','authenticated')::text, true);
  perform public.counter_proposal(v_prop, 940);    -- rodada 4 (prestador) — VALOR FINAL

  select counter_rounds, counter_price, counter_by into v_rounds, v_price, v_cat
    from public.proposals where id = v_prop;
  v_log := v_log || jsonb_build_object('ordem',3,'teste','4 rodadas alternadas passam',
    'esperado','4 / 940 / prestador',
    'obtido', v_rounds::text || ' / ' || v_price::text || ' / ' || (case when v_cat = v_prov then 'prestador' else 'contratante' end),
    'ok', v_rounds = 4 and v_price = 940 and v_cat = v_prov);

  perform set_config('request.jwt.claims', json_build_object('sub', v_cli, 'role','authenticated')::text, true);
  begin
    perform public.counter_proposal(v_prop, 930);  -- 5ª: tem que bater na trave
    v_log := v_log || jsonb_build_object('ordem',4,'teste','5ª contra-proposta é barrada',
      'esperado','recusado','obtido','deixou','ok',false);
  exception when others then
    v_log := v_log || jsonb_build_object('ordem',4,'teste','5ª contra-proposta é barrada',
      'esperado','recusado','obtido',SQLERRM,'ok',true);
  end;

  ------------------------------------------------------------------
  -- 3) O ÚLTIMO valor é do prestador: o contratante aceita e fecha
  ------------------------------------------------------------------
  begin
    perform public.respond_counter(v_prop, true);
  exception when others then raise exception 'FALHOU em respond_counter: %', SQLERRM; end;
  begin
    perform public.accept_proposal(v_prop);
  exception when others then raise exception 'FALHOU em accept_proposal: %', SQLERRM; end;
  select final_price, travel_fee, accepted_at is not null into v_price, v_final, v_flag
    from public.service_requests where id = v_req;
  v_log := v_log || jsonb_build_object('ordem',5,'teste','aceite soma serviço + frete e carimba accepted_at',
    'esperado','1090 / 150 / carimbado',
    'obtido', v_price::text || ' / ' || v_final::text || ' / ' || (case when v_flag then 'carimbado' else 'vazio' end),
    'ok', v_price = 1090 and v_final = 150 and v_flag);

  ------------------------------------------------------------------
  -- 5) CONTESTAÇÃO — só o prestador, só abaixo de 3 estrelas, uma vez
  ------------------------------------------------------------------
  perform set_config('fixly.guard_bypass', 'on', true);
  update public.service_requests set status='concluido', rating=2, review='ruim' where id = v_req;
  perform set_config('fixly.guard_bypass', 'off', true);

  perform set_config('request.jwt.claims', json_build_object('sub', v_cli, 'role','authenticated')::text, true);
  begin
    perform public.dispute_review(v_req, 'texto suficientemente longo para passar do mínimo');
    v_log := v_log || jsonb_build_object('ordem',6,'teste','contratante NÃO contesta a própria nota',
      'esperado','recusado','obtido','deixou','ok',false);
  exception when others then
    v_log := v_log || jsonb_build_object('ordem',6,'teste','contratante NÃO contesta a própria nota',
      'esperado','recusado','obtido',SQLERRM,'ok',true);
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', v_prov, 'role','authenticated')::text, true);
  begin
    perform public.dispute_review(v_req, 'o cliente pediu servico fora do combinado e a nota veio por isso');
  exception when others then raise exception 'FALHOU em dispute_review(prestador): %', SQLERRM; end;
  select review_dispute_status into v_err from public.service_requests where id = v_req;
  v_log := v_log || jsonb_build_object('ordem',7,'teste','prestador contesta nota 2',
    'esperado','pendente','obtido', coalesce(v_err,'(nulo)'), 'ok', v_err = 'pendente');

  begin
    perform public.dispute_review(v_req, 'segunda tentativa com texto longo o bastante para passar');
    v_log := v_log || jsonb_build_object('ordem',8,'teste','contestar duas vezes é barrado',
      'esperado','recusado','obtido','deixou','ok',false);
  exception when others then
    v_log := v_log || jsonb_build_object('ordem',8,'teste','contestar duas vezes é barrado',
      'esperado','recusado','obtido',SQLERRM,'ok',true);
  end;

  -- nota 4 não é contestável
  perform set_config('fixly.guard_bypass', 'on', true);
  update public.service_requests
     set rating=4, review_dispute=null, review_disputed_at=null, review_dispute_status=null
   where id = v_req;
  perform set_config('fixly.guard_bypass', 'off', true);
  begin
    perform public.dispute_review(v_req, 'texto suficientemente longo para passar do minimo exigido');
    v_log := v_log || jsonb_build_object('ordem',9,'teste','nota 4 NÃO é contestável',
      'esperado','recusado','obtido','deixou','ok',false);
  exception when others then
    v_log := v_log || jsonb_build_object('ordem',9,'teste','nota 4 NÃO é contestável',
      'esperado','recusado','obtido',SQLERRM,'ok',true);
  end;

  ------------------------------------------------------------------
  -- 6) Acolher a contestação TIRA a nota da média
  ------------------------------------------------------------------
  perform set_config('fixly.guard_bypass', 'on', true);
  update public.service_requests set rating=1 where id = v_req;
  perform set_config('fixly.guard_bypass', 'off', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role','authenticated')::text, true);
  begin
    perform public.resolve_review_dispute(v_req, true, 'apurado');
  exception when others then raise exception 'FALHOU em resolve_review_dispute: %', SQLERRM; end;
  select review_hidden::text into v_err from public.service_requests where id = v_req;
  v_log := v_log || jsonb_build_object('ordem',10,'teste','acolher esconde a avaliação',
    'esperado','true','obtido', v_err, 'ok', v_err = 'true');

  -- devolve o papel antes de escrever na tabela temporária (que é do dono da
  -- conexão): como 'authenticated' o insert bate em "permission denied"
  perform set_config('role', 'none', true);
  insert into _r select (x->>'ordem')::int, x->>'teste', x->>'esperado', x->>'obtido', (x->>'ok')::boolean
    from jsonb_array_elements(v_log) x;
end $$;

select ordem, teste, esperado, obtido, case when ok then '✅' else '❌ FALHOU' end as veredito
  from _r order by ordem;
select count(*) filter (where ok) as passaram, count(*) filter (where not ok) as falharam,
       case when count(*) filter (where not ok) = 0
            then '✅ TODAS AS PROVAS PASSARAM' else '❌ REVISAR' end as resumo
  from _r;
