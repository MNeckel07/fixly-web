create temp table _r(teste text, obtido text, ok boolean) on commit drop;
do $$
declare v_prov uuid; v_log jsonb := '[]'::jsonb; v_id uuid;
begin
  select id into v_prov from public.profiles
   where role='prestador' and status='aprovado' order by created_at limit 1;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_prov::text,'role','authenticated')::text, true);
  perform set_config('role','authenticated', true);
  begin
    select public.request_withdrawal(999999) into v_id;
    v_log := v_log || jsonb_build_object('t','request_withdrawal chega a validar saldo','g','sacou 999999?! (revisar)','ok',false);
  exception when others then
    -- "Saldo insuficiente" = o caminho funcionou (chegou a ler provider_balance).
    -- "permission denied for function provider_balance" = a 0034 quebrou o saque.
    v_log := v_log || jsonb_build_object('t','request_withdrawal chega a validar saldo','g',SQLERRM,
      'ok', SQLERRM not ilike '%permission denied%');
  end;
  perform set_config('role','none', true);
  insert into _r select e->>'t', e->>'g', (e->>'ok')::boolean from jsonb_array_elements(v_log) e;
end $$;
select teste, obtido, case when ok then '✅ caminho do saque intacto' else '❌ SAQUE QUEBRADO' end as veredito from _r;
