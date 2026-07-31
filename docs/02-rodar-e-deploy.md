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
