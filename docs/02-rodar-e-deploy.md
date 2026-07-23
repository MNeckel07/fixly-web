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
MP_ACCESS_TOKEN=                                           # vazio = Mercado Pago mock
NEXT_PUBLIC_MP_PUBLIC_KEY=
RESEND_API_KEY=                                            # vazio = e-mail vira preview no log
```
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
- Também dá pra aplicar uma migração avulsa com um one-liner `pg`:
  ```bash
  node --env-file=.env.local -e "const fs=require('fs'),pg=require('pg');const c=new pg.Client({connectionString:process.env.SUPABASE_DB_URL,ssl:{rejectUnauthorized:false}});(async()=>{await c.connect();await c.query(fs.readFileSync('supabase/migrations/00XX.sql','utf8'));console.log('ok');await c.end();})()"
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
