-- ============================================================
--  Provas da 0035 — rodam DENTRO da transação do dry-run.
--
--  Cada teste vive numa subtransação (begin/exception) para que uma exceção
--  esperada não aborte as conferências seguintes.
--
--  Os resultados são acumulados num `jsonb` em memória, e não numa tabela:
--  o bloco troca de papel (`set role authenticated`) para simular a sessão do
--  usuário, e nesse papel não há permissão para escrever em tabela temporária.
-- ============================================================

create temp table _res (
  ordem int, teste text, esperado text, obtido text, ok boolean
) on commit drop;

do $$
declare
  v_prest uuid;
  v_novo  uuid := gen_random_uuid();
  v_staff uuid := gen_random_uuid();
  v_log   jsonb := '[]'::jsonb;
begin
  ------------------------------------------------------------------
  -- PREPARO (tudo desfeito no rollback do dry-run)
  ------------------------------------------------------------------
  select id into v_prest
    from public.profiles
   where role = 'prestador'
   order by created_at
   limit 1;

  if v_prest is null then
    insert into _res values (0, 'PREPARO', 'existir prestador', 'nenhum prestador no banco', false);
    return;
  end if;

  -- duas contas de auth novas: uma para o cadastro público, outra para o staff
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change,
    email_change_token_new, email_change_token_current
  )
  select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'dryrun-' || u.id || '@fixly.test', '',
         now(), now(), now(),
         '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
         '', '', '', '', ''
    from (values (v_novo), (v_staff)) as u(id);

  ------------------------------------------------------------------
  -- SESSÃO DE USUÁRIO COMUM (prestador existente)
  ------------------------------------------------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_prest::text, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  -- T1 — forjar o Selo Fixly (o furo que a 0033 abriu).
  -- INVERTE o valor de propósito: regravar o mesmo valor não seria alteração
  -- nenhuma, e o teste passaria por engano.
  begin
    update public.profiles set seal_active = not coalesce(seal_active, false) where id = v_prest;
    v_log := v_log || jsonb_build_object('o',1,'t','usuário liga o próprio seal_active','e','BLOQUEADO','g','PASSOU','ok',false);
  exception when others then
    v_log := v_log || jsonb_build_object('o',1,'t','usuário liga o próprio seal_active','e','BLOQUEADO','g','bloqueado: '||SQLERRM,'ok',true);
  end;

  -- T2 — auto-conceder o Selo Fix (que libera serviço sem cobrança)
  begin
    update public.profiles set fix_badge = not coalesce(fix_badge, false) where id = v_prest;
    v_log := v_log || jsonb_build_object('o',2,'t','usuário liga o próprio fix_badge','e','BLOQUEADO','g','PASSOU','ok',false);
  exception when others then
    v_log := v_log || jsonb_build_object('o',2,'t','usuário liga o próprio fix_badge','e','BLOQUEADO','g','bloqueado: '||SQLERRM,'ok',true);
  end;

  -- T3 — desfazer uma revogação do admin
  begin
    update public.profiles
       set seal_revoked_at = case when seal_revoked_at is null then now() else null end
     where id = v_prest;
    v_log := v_log || jsonb_build_object('o',3,'t','usuário mexe em seal_revoked_at','e','BLOQUEADO','g','PASSOU','ok',false);
  exception when others then
    v_log := v_log || jsonb_build_object('o',3,'t','usuário mexe em seal_revoked_at','e','BLOQUEADO','g','bloqueado: '||SQLERRM,'ok',true);
  end;

  -- T4 — escalada para admin por UPDATE (tem de seguir fechada)
  begin
    update public.profiles set role = 'admin', status = 'aprovado' where id = v_prest;
    v_log := v_log || jsonb_build_object('o',4,'t','usuário vira admin por UPDATE','e','BLOQUEADO','g','PASSOU','ok',false);
  exception when others then
    v_log := v_log || jsonb_build_object('o',4,'t','usuário vira admin por UPDATE','e','BLOQUEADO','g','bloqueado: '||SQLERRM,'ok',true);
  end;

  -- T5 — CONTROLE: o fluxo legítimo não pode ter quebrado
  begin
    update public.profiles set bio = '[dry-run] edicao legitima' where id = v_prest;
    v_log := v_log || jsonb_build_object('o',5,'t','usuário edita a própria bio','e','PERMITIDO','g','passou','ok',true);
  exception when others then
    v_log := v_log || jsonb_build_object('o',5,'t','usuário edita a própria bio','e','PERMITIDO','g','QUEBROU: '||SQLERRM,'ok',false);
  end;

  ------------------------------------------------------------------
  -- SESSÃO DE CADASTRO NOVO (conta recém-criada, ainda sem perfil)
  ------------------------------------------------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_novo::text, 'role', 'authenticated')::text, true);

  -- T6 — nascer admin (o achado original)
  begin
    insert into public.profiles (id, role, status, full_name)
    values (v_novo, 'admin', 'aprovado', 'Dry Run');
    v_log := v_log || jsonb_build_object('o',6,'t','cadastro nasce admin/aprovado','e','BLOQUEADO','g','PASSOU','ok',false);
  exception when others then
    v_log := v_log || jsonb_build_object('o',6,'t','cadastro nasce admin/aprovado','e','BLOQUEADO','g','bloqueado: '||SQLERRM,'ok',true);
  end;

  -- T7 — nascer com Selo Fix (fechado só na 0035)
  begin
    insert into public.profiles (id, role, status, full_name, fix_badge)
    values (v_novo, 'contratante', 'pendente', 'Dry Run', true);
    v_log := v_log || jsonb_build_object('o',7,'t','cadastro nasce com fix_badge','e','BLOQUEADO','g','PASSOU','ok',false);
  exception when others then
    v_log := v_log || jsonb_build_object('o',7,'t','cadastro nasce com fix_badge','e','BLOQUEADO','g','bloqueado: '||SQLERRM,'ok',true);
  end;

  -- T8 — nascer com o selo ligado (fechado só na 0035)
  begin
    insert into public.profiles (id, role, status, full_name, seal_active)
    values (v_novo, 'prestador', 'pendente', 'Dry Run', true);
    v_log := v_log || jsonb_build_object('o',8,'t','cadastro nasce com seal_active','e','BLOQUEADO','g','PASSOU','ok',false);
  exception when others then
    v_log := v_log || jsonb_build_object('o',8,'t','cadastro nasce com seal_active','e','BLOQUEADO','g','bloqueado: '||SQLERRM,'ok',true);
  end;

  -- T9 — CONTROLE: o cadastro público de verdade (o que o SignupForm manda)
  begin
    insert into public.profiles (id, role, status, full_name, city, state)
    values (v_novo, 'prestador', 'pendente', 'Dry Run', 'São Paulo', 'SP');
    v_log := v_log || jsonb_build_object('o',9,'t','cadastro público normal','e','PERMITIDO','g','passou','ok',true);
  exception when others then
    v_log := v_log || jsonb_build_object('o',9,'t','cadastro público normal','e','PERMITIDO','g','QUEBROU: '||SQLERRM,'ok',false);
  end;

  ------------------------------------------------------------------
  -- CHAVE DE SERVIÇO (createStaffUser) — o ponto que a 0033 arriscava
  ------------------------------------------------------------------
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', '', true);

  -- T10 — CONTROLE: criar administrador pela server action protegida
  begin
    insert into public.profiles (id, role, status, full_name, funcao, permissions)
    values (v_staff, 'admin', 'aprovado', 'Staff Dry Run', 'suporte', array['suporte']);
    v_log := v_log || jsonb_build_object('o',10,'t','createStaffUser cria admin (service_role)','e','PERMITIDO','g','passou','ok',true);
  exception when others then
    v_log := v_log || jsonb_build_object('o',10,'t','createStaffUser cria admin (service_role)','e','PERMITIDO','g','QUEBROU: '||SQLERRM,'ok',false);
  end;

  -- T11 — CONTROLE: o mesmo upsert caindo em ON CONFLICT DO UPDATE
  begin
    insert into public.profiles (id, role, status, full_name)
    values (v_staff, 'admin', 'aprovado', 'Staff Dry Run 2')
    on conflict (id) do update set full_name = excluded.full_name;
    v_log := v_log || jsonb_build_object('o',11,'t','upsert do staff cai em UPDATE (service_role)','e','PERMITIDO','g','passou','ok',true);
  exception when others then
    v_log := v_log || jsonb_build_object('o',11,'t','upsert do staff cai em UPDATE (service_role)','e','PERMITIDO','g','QUEBROU: '||SQLERRM,'ok',false);
  end;

  ------------------------------------------------------------------
  -- de volta ao papel original para poder gravar o resultado
  ------------------------------------------------------------------
  perform set_config('role', 'none', true);

  insert into _res (ordem, teste, esperado, obtido, ok)
  select (e->>'o')::int, e->>'t', e->>'e', e->>'g', (e->>'ok')::boolean
    from jsonb_array_elements(v_log) e;
end $$;

-- ── Resultado ──
select ordem, teste, esperado, obtido,
       case when ok then '✅' else '❌ FALHOU' end as veredito
  from _res
 order by ordem;

select count(*) filter (where ok)     as passaram,
       count(*) filter (where not ok) as falharam,
       case when count(*) filter (where not ok) = 0
            then '✅ TODAS AS PROVAS PASSARAM'
            else '❌ REVISAR — ha prova falhando' end as resumo
  from _res;
