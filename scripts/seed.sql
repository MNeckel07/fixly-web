-- ============================================================
--  FIXLY — Seed via SQL (cria auth.users + identities + profiles)
--  Roda direto no Postgres (útil quando não há secret key à mão).
-- ============================================================

-- 1) Cria as contas de autenticação (idempotente por e-mail)
do $$
declare
  rec record;
  uid uuid;
begin
  for rec in
    select * from (values
      ('matheus@dvn.com.br',        '1234',      'Matheus (Admin)'),
      ('admin@fixly.com.br',        'fixly1234', 'Equipe Fixly'),
      ('contratante@fixly.com.br',  'fixly1234', 'Marina Souza'),
      ('prestador@fixly.com.br',    'fixly1234', 'Carlos Oliveira'),
      ('ana.eletrica@fixly.com.br', 'fixly1234', 'Ana Paula Lima'),
      ('joao.encanador@fixly.com.br','fixly1234','João Mendes'),
      ('pendente@fixly.com.br',     'fixly1234', 'Roberto Alves')
    ) as t(email, pw, name)
  loop
    select id into uid from auth.users where email = rec.email;
    if uid is null then
      uid := gen_random_uuid();
      insert into auth.users (
        id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data,
        confirmation_token, recovery_token, email_change,
        email_change_token_new, email_change_token_current
      ) values (
        uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        rec.email, crypt(rec.pw, gen_salt('bf')),
        now(), now(), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', rec.name),
        '', '', '', '', ''
      );
      insert into auth.identities (
        provider_id, user_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
      ) values (
        uid::text, uid,
        jsonb_build_object('sub', uid::text, 'email', rec.email),
        'email', now(), now(), now()
      );
    end if;
  end loop;
end $$;

-- 2) Cria/atualiza os perfis (desliga o trigger de guarda durante o seed)
alter table public.profiles disable trigger trg_guard_profile;

insert into public.profiles (id, role, status, full_name, email, phone, cpf, city, lat, lng)
select u.id, 'admin', 'aprovado', 'Matheus (Admin)', u.email, null, null, 'São Paulo', -23.5505, -46.6333
from auth.users u where u.email = 'matheus@dvn.com.br'
on conflict (id) do update set role='admin', status='aprovado', full_name=excluded.full_name;

insert into public.profiles (id, role, status, full_name, email, city)
select u.id, 'admin', 'aprovado', 'Equipe Fixly', u.email, 'São Paulo'
from auth.users u where u.email = 'admin@fixly.com.br'
on conflict (id) do update set role='admin', status='aprovado';

insert into public.profiles (id, role, status, full_name, email, phone, cpf, city, lat, lng)
select u.id, 'contratante', 'aprovado', 'Marina Souza', u.email, '(11) 98888-0001', '111.111.111-11', 'São Paulo', -23.5505, -46.6333
from auth.users u where u.email = 'contratante@fixly.com.br'
on conflict (id) do update set role='contratante', status='aprovado', lat=-23.5505, lng=-46.6333;

insert into public.profiles (id, role, status, full_name, email, phone, cpf, city, category_id, base_price, service_radius_km, rating, jobs_done, bio, lat, lng)
select u.id, 'prestador', 'aprovado', 'Carlos Oliveira', u.email, '(11) 97777-0001', '222.222.222-22', 'São Paulo',
  (select id from public.service_categories where slug='eletricista'), 120, 15, 4.9, 128,
  'Eletricista com 8 anos de experiência em residências e comércios.', -23.5385, -46.6413
from auth.users u where u.email = 'prestador@fixly.com.br'
on conflict (id) do update set role='prestador', status='aprovado',
  category_id=(select id from public.service_categories where slug='eletricista'),
  base_price=120, rating=4.9, jobs_done=128, lat=-23.5385, lng=-46.6413;

insert into public.profiles (id, role, status, full_name, email, phone, cpf, city, category_id, base_price, service_radius_km, rating, jobs_done, bio, lat, lng)
select u.id, 'prestador', 'aprovado', 'Ana Paula Lima', u.email, '(11) 97777-0002', '333.333.333-33', 'São Paulo',
  (select id from public.service_categories where slug='eletricista'), 110, 12, 4.7, 86,
  'Especialista em instalações e quadros de energia.', -23.5655, -46.6233
from auth.users u where u.email = 'ana.eletrica@fixly.com.br'
on conflict (id) do update set role='prestador', status='aprovado',
  category_id=(select id from public.service_categories where slug='eletricista'),
  base_price=110, rating=4.7, jobs_done=86, lat=-23.5655, lng=-46.6233;

insert into public.profiles (id, role, status, full_name, email, phone, cpf, city, category_id, base_price, service_radius_km, rating, jobs_done, bio, lat, lng)
select u.id, 'prestador', 'aprovado', 'João Mendes', u.email, '(11) 97777-0003', '444.444.444-44', 'São Paulo',
  (select id from public.service_categories where slug='encanador'), 100, 20, 4.8, 152,
  'Encanador — vazamentos, desentupimentos e reparos.', -23.5305, -46.6183
from auth.users u where u.email = 'joao.encanador@fixly.com.br'
on conflict (id) do update set role='prestador', status='aprovado',
  category_id=(select id from public.service_categories where slug='encanador'),
  base_price=100, rating=4.8, jobs_done=152, lat=-23.5305, lng=-46.6183;

insert into public.profiles (id, role, status, full_name, email, phone, cpf, city, category_id, base_price, service_radius_km, bio, lat, lng)
select u.id, 'prestador', 'pendente', 'Roberto Alves', u.email, '(11) 97777-0009', '555.555.555-55', 'São Paulo',
  (select id from public.service_categories where slug='pintor'), 150, 10,
  'Pintor residencial buscando aprovação no Fixly.', -23.5605, -46.6533
from auth.users u where u.email = 'pendente@fixly.com.br'
on conflict (id) do update set role='prestador', status='pendente';

alter table public.profiles enable trigger trg_guard_profile;
