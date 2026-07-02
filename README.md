# Fixly — Sistema Web

Plataforma web do Fixly com **três frentes numa mesma aplicação**: Contratante,
Prestador e Administrador. Uma única tela de login permite escolher o perfil.

## Stack
- **Next.js 16** (App Router, Server Actions) + TypeScript
- **Tailwind CSS v4**
- **Supabase** — Postgres, Auth, Storage (documentos privados), RLS
- **Leaflet + OpenStreetMap** — mapa e rota (sem chave/custo)
- **Resend** — e-mail de aprovação de cadastro
- Deploy alvo: **Render**

## Arquitetura de segurança
- **RLS** em todas as tabelas: cada usuário só acessa os próprios dados.
- Documentos em **bucket privado** (`documentos`) — acesso só por URL assinada.
- Ações administrativas rodam no servidor com verificação `is_admin()`.
- O `service_role`/secret key **nunca** vai ao navegador (só a publishable).
- Recomendação de produção: separar o painel `/admin` em um deploy/subdomínio
  próprio (`admin.fixly.com.br`), com MFA e allowlist de IP.

## Setup (passo a passo)

### 1. Aplicar o schema no Supabase
No painel do Supabase → **SQL Editor**, rode em ordem:
1. `supabase/migrations/0001_init.sql`
2. `supabase/migrations/0002_dispatch.sql`

### 2. Desativar confirmação de e-mail (protótipo)
Supabase → **Authentication → Sign In / Providers → Email** →
desligue **"Confirm email"**. Assim o gate de acesso passa a ser a **aprovação
do admin** (status do perfil), e não um link de e-mail.

### 3. Variáveis de ambiente (`.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=...             # já preenchido
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=... # já preenchido
SUPABASE_SECRET_KEY=sb_secret_...        # necessária para o seed
RESEND_API_KEY=re_...                    # opcional (sem ela, e-mail vira preview no console)
```

### 4. Criar usuários de teste (3 frentes)
```bash
npm run seed
```
Cria contas aprovadas de Admin, Contratante e Prestadores + 1 prestador
**pendente** para testar a aprovação.

### 5. Rodar
```bash
npm run dev       # http://localhost:3000
```

## Contas de teste (após o seed)
| Perfil | E-mail | Senha |
|---|---|---|
| Administrador | `matheus@dvn.com.br` | `1234` |
| Contratante | `contratante@fixly.com.br` | `fixly1234` |
| Prestador | `prestador@fixly.com.br` | `fixly1234` |

## Fluxos implementados
- **Cadastro** (contratante e prestador) com **upload de documentos** → análise.
- **Admin**: fila de aprovação, visualização de documentos, aprovar/reprovar
  com **e-mail** automático.
- **Contratante**: precificação rápida → disparo para vários prestadores →
  escolha de proposta → **pagamento protegido (escrow)** → acompanhamento no
  **mapa com rota** → avaliação.
- **Prestador**: ficar online, aceitar pedidos, **rota até o cliente**,
  concluir serviço, **ganhos**.

## Gateway de pagamento
`src/lib/gateway.ts` é uma **abstração mock**. Para produção, trocar o corpo das
funções pela integração real (recomendado **Iugu** ou **Pagar.me** — suportam
split/marketplace e retenção no Brasil) sem alterar o resto do app.
