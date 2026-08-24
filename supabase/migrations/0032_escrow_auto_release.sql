-- ============================================================
--  0032 — LIBERAÇÃO AUTOMÁTICA DO ESCROW
--
--  O BURACO QUE ISTO FECHA
--  -----------------------
--  Só o contratante conclui o serviço (guard da 0022), e concluir é o que
--  libera o dinheiro. Quando ele simplesmente some — e some —, o profissional
--  trabalhou, marcou `provider_done_at` e **nunca recebe**: o pagamento fica
--  `retido` para sempre. Era a pendência mais séria do fluxo de pagamento.
--
--  Agora: 7 dias após `provider_done_at`, o serviço é concluído e o valor
--  liberado. No 5º dia sai um aviso por e-mail ao contratante — a liberação
--  nunca pode ser surpresa, e quem tem problema com o serviço ainda tem 2 dias
--  para reclamar ou denunciar. Os prazos vivem em `lib/pricing.ts`
--  (`AUTO_RELEASE_DAYS` / `AUTO_RELEASE_WARN_DAYS`); mudar lá muda tudo.
--
--  POR QUE CHAMAR O APP EM VEZ DE FAZER TUDO EM SQL
--  ------------------------------------------------
--  A liberação de verdade acontece no gateway (`releaseEscrow` → Mercado Pago).
--  Refazer isso em PL/pgSQL criaria um SEGUNDO lugar que mexe em dinheiro,
--  fadado a divergir do primeiro. Aqui o cron só puxa o gatilho: o caminho do
--  dinheiro continua sendo um só, o mesmo do botão "aprovar".
--
--  O SEGREDO NÃO ESTÁ NESTE ARQUIVO
--  --------------------------------
--  A rota exige `Authorization: Bearer <CRON_SECRET>`. O valor fica no **Vault
--  do Supabase** (`fixly_cron_secret`) e é lido na hora da chamada — escrever
--  o segredo aqui seria versioná-lo no Git, e escrevê-lo direto no
--  `cron.job.command` o deixaria à vista de qualquer consulta.
--
--  Para funcionar, o MESMO valor precisa existir dos dois lados:
--    1. no Vault:  select vault.create_secret('<valor>', 'fixly_cron_secret');
--    2. no Render: `fixly-web` → Environment → CRON_SECRET
--  Enquanto faltar de um dos lados a rota responde 401/503 e **nada é
--  liberado** — falha fechada, de propósito.
--
--  ⚠️ HORÁRIO EM UTC, como todo cron deste banco (`cron.timezone` = GMT):
--  `0 12 * * *` é 09:00 de Brasília. Foi escolhido DENTRO da janela do
--  keep-alive (0031, 6h–24h BRT) — fora dela o site estaria hibernando e a
--  chamada acordaria o serviço à toa, gastando hora gratuita de madrugada.
-- ============================================================

-- As extensões vêm da 0031 (keep-alive) e NÃO são recriadas aqui. Repetir
-- `create extension if not exists` num banco onde elas já existem falhou de
-- forma intermitente com "dependent privileges exist" — o DDL colide com a
-- gestão de extensões do próprio Supabase. Como já é dependência da 0031,
-- basta não repetir.

select cron.unschedule('fixly-escrow-auto-release')
 where exists (select 1 from cron.job where jobname = 'fixly-escrow-auto-release');

select cron.schedule(
  'fixly-escrow-auto-release',
  '0 12 * * *',
  $$
  select net.http_post(
    url     := 'https://fixly.company/api/cron/escrow',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization',
                 'Bearer ' || coalesce(
                   (select decrypted_secret from vault.decrypted_secrets
                     where name = 'fixly_cron_secret'), '')
               ),
    -- generoso de propósito: a rota percorre serviços, fala com o gateway e
    -- dispara e-mails. O padrão de 5 s abandonaria o trabalho no meio.
    timeout_milliseconds := 120000
  )
  $$
);
