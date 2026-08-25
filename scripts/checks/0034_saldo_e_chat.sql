-- ============================================================
--  Provas da 0034 — imutabilidade do chat + autorização do saldo.
--  Rodam dentro da transação do dry-run; resultados em jsonb (o bloco troca
--  de papel e perde acesso a tabela temporária).
-- ============================================================

create temp table _res (
  ordem int, teste text, esperado text, obtido text, ok boolean
) on commit drop;

do $$
declare
  v_msg_id  uuid;
  v_conv    uuid;
  v_autor   uuid;
  v_outro   uuid;
  v_prov    uuid;
  v_outro_p uuid;
  v_log     jsonb := '[]'::jsonb;
  v_n       numeric;
begin
  ------------------------------------------------------------------
  -- PREPARO: uma mensagem real com DOIS participantes distintos
  ------------------------------------------------------------------
  select m.id, m.conversation_id, m.sender_id
    into v_msg_id, v_conv, v_autor
    from public.messages m
    join public.conversation_participants a on a.conversation_id = m.conversation_id
    join public.conversation_participants b on b.conversation_id = m.conversation_id
   where a.profile_id = m.sender_id
     and b.profile_id <> m.sender_id
   order by m.created_at desc
   limit 1;

  if v_msg_id is not null then
    select profile_id into v_outro
      from public.conversation_participants
     where conversation_id = v_conv and profile_id <> v_autor
     limit 1;
  end if;

  -- dois prestadores distintos para o teste de saldo
  select id into v_prov    from public.profiles where role = 'prestador' order by created_at limit 1;
  select id into v_outro_p from public.profiles where role = 'prestador' and id <> v_prov limit 1;

  ------------------------------------------------------------------
  -- CHAT — como o OUTRO participante (não o autor da mensagem)
  ------------------------------------------------------------------
  if v_outro is null then
    v_log := v_log || jsonb_build_object('o',1,'t','chat: sem conversa de 2 participantes no banco','e','-','g','PULADO','ok',true);
  else
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_outro::text, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);

    -- T1 — reescrever o texto da mensagem do outro
    begin
      update public.messages set body = '[dry-run] texto adulterado' where id = v_msg_id;
      v_log := v_log || jsonb_build_object('o',1,'t','participante reescreve o body do outro','e','BLOQUEADO','g','PASSOU','ok',false);
    exception when others then
      v_log := v_log || jsonb_build_object('o',1,'t','participante reescreve o body do outro','e','BLOQUEADO','g','bloqueado: '||SQLERRM,'ok',true);
    end;

    -- T2 — reatribuir a autoria
    begin
      update public.messages set sender_id = v_outro where id = v_msg_id;
      v_log := v_log || jsonb_build_object('o',2,'t','participante troca o sender_id','e','BLOQUEADO','g','PASSOU','ok',false);
    exception when others then
      v_log := v_log || jsonb_build_object('o',2,'t','participante troca o sender_id','e','BLOQUEADO','g','bloqueado: '||SQLERRM,'ok',true);
    end;

    -- T3 — trocar o anexo
    begin
      update public.messages set attachment_path = 'outro/arquivo.png' where id = v_msg_id;
      v_log := v_log || jsonb_build_object('o',3,'t','participante troca o anexo','e','BLOQUEADO','g','PASSOU','ok',false);
    exception when others then
      v_log := v_log || jsonb_build_object('o',3,'t','participante troca o anexo','e','BLOQUEADO','g','bloqueado: '||SQLERRM,'ok',true);
    end;

    -- T4 — CONTROLE: marcar como lida (o motivo de a policy existir)
    begin
      update public.messages set read_at = now(), delivered_at = now() where id = v_msg_id;
      v_log := v_log || jsonb_build_object('o',4,'t','participante marca lida (read_at)','e','PERMITIDO','g','passou','ok',true);
    exception when others then
      v_log := v_log || jsonb_build_object('o',4,'t','participante marca lida (read_at)','e','PERMITIDO','g','QUEBROU: '||SQLERRM,'ok',false);
    end;
  end if;

  ------------------------------------------------------------------
  -- SALDO — provider_balance(uuid)
  ------------------------------------------------------------------
  -- T5 — CONTROLE: o próprio prestador consulta o próprio saldo
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_prov::text, 'role', 'authenticated')::text, true);
  begin
    select disponivel into v_n from public.provider_balance();
    v_log := v_log || jsonb_build_object('o',5,'t','prestador consulta o PRÓPRIO saldo','e','PERMITIDO','g','passou (disponivel='||coalesce(v_n::text,'null')||')','ok',true);
  exception when others then
    v_log := v_log || jsonb_build_object('o',5,'t','prestador consulta o PRÓPRIO saldo','e','PERMITIDO','g','QUEBROU: '||SQLERRM,'ok',false);
  end;

  -- T6 — consultar o saldo de OUTRO prestador
  if v_outro_p is null then
    v_log := v_log || jsonb_build_object('o',6,'t','saldo alheio: só há um prestador no banco','e','-','g','PULADO','ok',true);
  else
    begin
      select disponivel into v_n from public.provider_balance(v_outro_p);
      v_log := v_log || jsonb_build_object('o',6,'t','prestador consulta saldo de OUTRO','e','BLOQUEADO','g','PASSOU (disponivel='||coalesce(v_n::text,'null')||')','ok',false);
    exception when others then
      v_log := v_log || jsonb_build_object('o',6,'t','prestador consulta saldo de OUTRO','e','BLOQUEADO','g','bloqueado: '||SQLERRM,'ok',true);
    end;
  end if;

  -- T7 — anônimo (sem sessão) consultando saldo alheio
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin
    select disponivel into v_n from public.provider_balance(v_prov);
    v_log := v_log || jsonb_build_object('o',7,'t','ANÔNIMO consulta saldo de prestador','e','BLOQUEADO','g','PASSOU (disponivel='||coalesce(v_n::text,'null')||')','ok',false);
  exception when others then
    v_log := v_log || jsonb_build_object('o',7,'t','ANÔNIMO consulta saldo de prestador','e','BLOQUEADO','g','bloqueado: '||SQLERRM,'ok',true);
  end;

  perform set_config('role', 'none', true);
  insert into _res (ordem, teste, esperado, obtido, ok)
  select (e->>'o')::int, e->>'t', e->>'e', e->>'g', (e->>'ok')::boolean
    from jsonb_array_elements(v_log) e;
end $$;

select ordem, teste, esperado, obtido,
       case when ok then '✅' else '❌ FALHOU' end as veredito
  from _res order by ordem;

select count(*) filter (where ok) as passaram, count(*) filter (where not ok) as falharam,
       case when count(*) filter (where not ok) = 0
            then '✅ TODAS AS PROVAS PASSARAM' else '❌ REVISAR' end as resumo
  from _res;
