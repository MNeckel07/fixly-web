-- ============================================================
--  0031 — KEEP-ALIVE DO SITE (sem custo, sem serviço novo)
--
--  PROBLEMA
--  --------
--  O plano gratuito do Render **desliga** o serviço após 15 minutos sem
--  nenhuma visita, e religar leva ~1 minuto (medido: 43,3 s). Quem chega
--  nesse minuto vê a tela de erro do navegador ("This page couldn't load"),
--  porque a conexão morre antes de existir qualquer resposta — não é erro do
--  Fixly, e nenhuma linha do nosso código roda antes disso.
--
--  POR QUE AQUI DENTRO DO BANCO
--  ----------------------------
--  A saída clássica é um monitor externo (UptimeRobot, cron-job.org). Mas o
--  Supabase já oferece as duas peças necessárias, então não é preciso abrir
--  conta em serviço nenhum: `pg_cron` agenda, `pg_net` faz a chamada HTTP.
--  Uma dependência a menos para lembrar, renovar e explicar para alguém.
--
--  A CONTA QUE DEFINE A JANELA
--  ---------------------------
--  O Render dá **750 horas de instância gratuita por mês para a conta
--  inteira** (não por serviço), e são DOIS serviços: `fixly-web` e
--  `fixly-admin`. Um mês tem ~730 h, então manter os dois acordados 24/7
--  pediria ~1460 h — o dobro do orçamento. Estourar não deixa o site lento:
--  o Render **suspende** os serviços até o dia 1º.
--
--    site acordado das 6h à meia-noite ...... ~547 h
--    painel, só enquanto o dono usa ......... ~65 h
--    total .................................. ~612 h de 750  (folga ~140 h)
--
--  Por isso a janela, e não 24 h. Entre meia-noite e 6h o site volta a
--  hibernar — é o preço de não pagar o plano Starter (US$ 7/mês), e a janela
--  é o lugar certo para mexer se o acesso real mostrar outro horário.
--
--  ⚠️  O HORÁRIO É UTC. O `cron.timezone` deste projeto é GMT e o Brasil é
--  UTC−3, então 6h–24h de Brasília se escreve `9-23` **mais** `0-2`:
--     UTC 09..23 -> BRT 06..20      UTC 00,01,02 -> BRT 21,22,23
--  Trocar a janela sem refazer essa conversão desloca tudo em 3 horas.
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- O Supabase cria o schema `cron` restrito ao superusuário; sem estes grants,
-- o `postgres` (que é quem aplica as migrações) não enxerga o agendamento.
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- Idempotente: reaplicar a migração não deixa dois agendamentos batendo no
-- mesmo endereço (o que dobraria o consumo de horas sem nenhum ganho).
select cron.unschedule('fixly-keepalive-site')
 where exists (select 1 from cron.job where jobname = 'fixly-keepalive-site');

-- ⚠️  `timeout_milliseconds` NÃO pode ficar no padrão (5000). Justamente na
-- chamada que mais importa — a primeira depois de o serviço dormir — a
-- resposta demora ~43 s, e o pg_net desistiria com
-- "Timeout of 5000 ms reached". O serviço até acorda (o handshake TCP/SSL
-- chega ao Render antes do abandono), mas nunca ficaria gravado um 200 em
-- `net._http_response` — e é essa tabela que a gente consulta para saber se o
-- keep-alive está de pé. Sem isso, o mecanismo funciona às cegas e o log só
-- acumula erro.
select cron.schedule(
  'fixly-keepalive-site',
  '*/10 0-2,9-23 * * *',
  $$ select net.http_get(
       'https://fixly.company/api/health',
       timeout_milliseconds := 60000
     ) $$
);
