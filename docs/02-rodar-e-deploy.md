# 02 — Rodar local e Deploy

## Rodar local
```bash
cd /Users/matheusneckel/Projetos/Fixly/sistema-web
npm install          # se necessário
npm run dev          # http://localhost:3000
```
> ⚠️ O `cwd` do bash às vezes **volta** para `/Users/matheusneckel/Projetos`.
> Sempre comece os comandos com `cd .../sistema-web`.
> Comandos que acessam a internet (banco, curl externo) precisam rodar com o
> sandbox desligado (`dangerouslyDisableSandbox: true`).

## Variáveis de ambiente (`sistema-web/.env.local` — gitignored, tem segredos)
```
NEXT_PUBLIC_SUPABASE_URL=https://rndtmsjzwqahnwiddzcf.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   # pública (browser)
SUPABASE_SECRET_KEY=sb_secret_...                          # server-only (server actions)
SUPABASE_DB_URL=postgresql://postgres.rndtmsjzwqahnwiddzcf:<senha%40cod>@aws-1-ca-central-1.pooler.supabase.com:5432/postgres
NEXT_PUBLIC_APP_URL=http://localhost:3000                  # em prod: https://fixly.company

# ── E-mail — OBRIGATÓRIO para cadastro e recuperação de senha ──
# Brevo (recomendada: conta já existe na DVN, 300/dia) OU Resend (100/dia).
BREVO_API_KEY=                     # xkeysib-... (tem precedência sobre a Resend)
RESEND_API_KEY=                    # alternativa
EMAIL_FROM=Fixly <nao-responda@fixly.company>   # precisa ser remetente VERIFICADO
EMAIL_DEV_CODES=                   # "1" mostra o código NA TELA (só para testar sem Resend)
AUTH_TOKEN_SECRET=                 # opcional; sem ela usa SUPABASE_SECRET_KEY

# ── Mercado Pago ──
MP_ACCESS_TOKEN=                   # vazio = gateway em modo simulado (mock)
NEXT_PUBLIC_MP_PUBLIC_KEY=         # Checkout Transparente (cartão, no browser)
MP_WEBHOOK_SECRET=                 # assinatura secreta do webhook (sem ela o webhook RECUSA)
MP_CLIENT_ID=                      # só para o split (OAuth do prestador)
MP_CLIENT_SECRET=
```
⚠️ **Sem `BREVO_API_KEY`/`RESEND_API_KEY` o cadastro NÃO conclui em produção** —
o envio falha com erro na tela (de propósito: melhor erro que espera eterna).
⚠️ **Nunca SMTP no Render:** portas 25/465/587 são bloqueadas no plano free — só
API HTTPS (é por isso que `lib/email.ts` usa a API da Brevo, não SMTP).
Para testar antes de configurar o provedor, use `EMAIL_DEV_CODES=1` (mostra o
código na tela) e **remova depois**. Passo a passo completo: arquivo **07**.
As **mesmas** chaves (menos DB_URL) precisam existir no **Render** (Environment).
Se `SUPABASE_SECRET_KEY` faltar no Render, as **server actions quebram** em produção
(criar conta, criar admin, forçar etapa, cancelar com reembolso, etc.).

## Supabase
- Projeto: **`rndtmsjzwqahnwiddzcf`** (nome "Fix-ly", org "DVN Ferro e aço",
  região **ca-central-1**). É separado do projeto sistema-producao.
- **Conexão ao Postgres:** a conexão direta `db.<ref>.supabase.co` **NÃO resolve**
  neste ambiente (IPv6). Use o **pooler**: host `aws-1-ca-central-1.pooler.supabase.com`,
  usuário `postgres.rndtmsjzwqahnwiddzcf`, porta 5432. (Prefixo é `aws-1`, não `aws-0`.)
  Senha do banco tem `@` → codificar como `%40` na URL.
- **Auth:** "Confirm email" está **ligado** — por isso o cadastro cria a conta
  já confirmada via server action (`createAccount`, chave de servidor). Login por
  e-mail/senha (e por **usuário** para admins).

### Aplicar schema / seed (scripts prontos)
```bash
npm run db:apply     # roda TODAS as migrações (idempotente) via SUPABASE_DB_URL
npm run seed         # cria usuários de teste (precisa SUPABASE_SECRET_KEY)
```
- `scripts/apply-schema.mjs` — lista de migrações no topo; adicione a nova lá.
- `scripts/seed.sql` — seed via SQL (auth.users + identities + profiles + private).
- ⚠️ **`db:apply` está QUEBRADO** para re-execução (falha no 0004). Para migração
  **nova**, use o script dedicado — aplica **só um arquivo**, em transação própria
  (falha no meio = rollback, banco não fica pela metade):
  ```bash
  node --env-file=.env.local scripts/apply-migration.mjs 0022_melhoras_p6.sql
  ```

## Deploy (Render + domínio)
- **GitHub:** `https://github.com/MNeckel07/fixly-web` (privado). Push com a
  credencial do `MNeckel07` já no **osxkeychain** (não precisa de token/gh):
  `git push origin main`. O `gh` NÃO está instalado; criei o repo via API usando
  o token do keychain (`git credential fill`).
- **Render:** serviço `fixly-web` (`srv-d96gosdckfvc73fh2cbg`), URL
  `https://fixly-web-ctg2.onrender.com`. **Auto-deploy da branch `main`** — cada
  push publica. `render.yaml` e `.node-version` na raiz.
- **Domínio:** `fixly.company` (Hostinger). DNS: **A `@` → 216.24.57.1**,
  **CNAME `www` → fixly-web-ctg2.onrender.com**. HTTPS automático pelo Render.
- **Migrações:** aplicadas no Supabase compartilhado (mesmo banco que a produção
  usa), então basta aplicar via `db:apply` e a produção já enxerga.

## Fluxo típico de uma mudança
1. `cd sistema-web`; editar código; se mexeu no schema, criar migração em
   `supabase/migrations/00XX_...sql` e aplicar (`db:apply` ou one-liner).
2. `npx tsc --noEmit` e `npm run build` (validar).
3. `git add -A && git commit -m "..."` (co-author: Claude) e `git push origin main`.
4. Render publica sozinho em ~1–2 min.


## A tela roxa do Render ("SERVICE WAKING UP")

Não é do Fixly: é a página que a **infraestrutura do Render** serve enquanto
acorda um serviço do plano gratuito, que hiberna depois de 15 minutos sem
acesso. Ela aparece **antes** do nosso código existir no ar, então nenhuma
mudança de front resolve.

Duas saídas:

1. **Plano Starter (US$ 7/mês no `fixly-web`)** — o serviço não hiberna e a
   tela nunca mais aparece. É a solução definitiva.
2. **Monitor externo batendo em `/api/health`** (escolha do dono, 18/08/2026):
   UptimeRobot ou cron-job.org, a cada 5 minutos, em
   `https://fixly.company/api/health`. Custo zero.
   ⚠️ O plano gratuito do Render dá **750 horas de instância por mês na conta
   inteira**. Um serviço acordado 24/7 consome ~730 h e não sobra praticamente
   nada para o `fixly-admin`. Por isso, configure o monitor com **janela de
   horário** (ex.: 6h–24h) — dá ~540 h e deixa folga para o painel.

O `loading.tsx` com a marca (`BrandLoading`) cobre a outra espera, a de
navegação dentro do app: em vez de tela branca, o símbolo do Fixly pulsando.

## "This page couldn't load" (a tela preta do navegador)

**Não é a mesma coisa que a tela roxa, e não é erro do Fixly.** A tela roxa é o
Render dizendo "estou acordando"; esta aqui é o **navegador desistindo** antes
de existir qualquer resposta. A diferença importa no diagnóstico: um erro do
nosso código viria como 500 com a página de erro do Next; aqui não chega a
existir status HTTP nenhum.

Medido em 21/08/2026, contra a produção:

| teste | resultado |
|---|---|
| 100 requisições com o site aquecido (`/login` e um `.png`) | **0 falhas** nas duas |
| 60 requisições a cada 2 s | 1 morreu (`code 000`) depois de 27,6 s |
| primeira batida depois de ocioso (20/08) | **43,8 s**; a seguinte, 0,31 s |
| Supabase Auth (10 medições) | ~250 ms, saudável |
| memória da instância | **RSS 118 MB de 512** |
| DNS e certificado | A → 216.24.57.1, cert válido até 05/10/2026 |
| 40 amostras em 10 min, medindo `uptime_s` | **0 requisições mortas**; 2 reinícios, ambos causados pelos meus próprios deploys |

Dois achados fecham o caso: **a instância não reinicia sozinha** (os únicos
reinícios observados foram os dos deploys) e **reinício de deploy não derruba
requisição** — o Render troca sem downtime. O que derruba é o serviço partindo
do zero depois da hibernação.

A leitura: **acordado, o serviço é confiável; o problema é acordar.** RSS de
118 MB descarta queda por falta de memória, e o Supabase saudável descarta o
banco. Sobra a hibernação do plano gratuito — que é justamente o que o dono vê
e o monitor não, porque quem testa fica batendo no site e o mantém de pé.

**O que dá para fazer por código (feito):**
- `/api/health` agora devolve `uptime_s` e `mem_mb`. Serve para responder de
  fora, sem acesso ao log do Render, se a instância **caiu e subiu** (uptime
  volta a zero) ou se **nunca morreu** (uptime crescendo) — some o chute.
- `healthCheckPath` passou de `/login` para `/api/health` nos dois serviços. É
  o health check que decide quando o Render manda tráfego para a instância
  nova; uma página inteira demora mais a responder no boot, e cada segundo a
  mais é um segundo derrubando requisição de verdade.
  ⚠️ `render.yaml` só vale em serviço gerenciado por **Blueprint**. Nos dois
  serviços criados à mão, trocar também em **Settings → Health Check Path**.

### ⚠️ O PAINEL hiberna sempre (24/08/2026)

Medido: `fixly.fun/login` levou **43,3 s** na primeira batida e 0,47 s na
seguinte, com `uptime_s` = 36 — ou seja, ele **subiu por causa da minha
requisição**. O site pelo menos recebe visita de vez em quando; o painel só o
dono acessa, então ele está **sempre** frio. Se a reclamação de "não carrega"
vier de quem usa o painel, é aqui, não no site.

A conta do Render tem **750 h de instância gratuita por mês, na conta inteira**.
Dois serviços de pé 24/7 precisariam de ~1460 h — não cabe. Por isso a única
combinação que deixa os DOIS rápidos é: `fixly-web` no **Starter** (pago, não
consome hora gratuita) e o `fixly-admin` no free com monitor 24/7 (~730 h,
cabe nas 750 h). Custo total: US$ 7/mês.

**O que NÃO se resolve por código:** a hibernação em si. O plano free do Render
desliga o serviço após 15 minutos parado, e o pedido seguinte espera o
container subir. Duas saídas, nesta ordem de eficácia:

1. **Starter (US$ 7/mês) no `fixly-web`** — não hiberna. Acaba com a tela roxa
   E com esta tela preta, e libera as 750 h/mês do plano free inteiras para o
   `fixly-admin`.
2. **Monitor externo** batendo em `https://fixly.company/api/health` a cada 5
   min (UptimeRobot, grátis). ⚠️ As 750 h/mês são **da conta inteira**: manter
   um serviço de pé 24/7 consome ~730 h e não sobra nada para o painel — por
   isso o monitor precisa de **janela de horário** (ex.: 6h–24h ≈ 540 h). Fora
   da janela, o primeiro acesso continua lento.
