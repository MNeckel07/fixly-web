# Deploy do Fixly — Render + domínio fixly.company

Fluxo: **GitHub** (código) → **Render** (hospeda o Next.js) → **Hostinger**
(aponta o domínio) → **Supabase** (ajusta URLs de auth).

## 1. Subir o código no GitHub
1. Crie um repositório **privado** em https://github.com/new (ex.: `fixly-web`).
   Não marque "Add README".
2. No terminal, dentro de `sistema-web`:
   ```bash
   git remote add origin https://github.com/SEU_USUARIO/fixly-web.git
   git branch -M main
   git push -u origin main
   ```
   (Vai pedir login do GitHub — use um Personal Access Token como senha.)

## 2. Criar o serviço no Render
1. Acesse https://dashboard.render.com → **New** → **Web Service**.
2. Conecte sua conta GitHub e selecione o repositório `fixly-web`.
   - O Render lê o `render.yaml` automaticamente. Se pedir manual:
   - **Build Command:** `npm ci && npm run build`
   - **Start Command:** `npm start`
   - **Runtime:** Node · **Plan:** Free (ou Starter para não hibernar)
3. Em **Environment**, adicione as variáveis (as mesmas do `.env.local`):
   | Variável | Valor |
   |---|---|
   | `NODE_VERSION` | `20.18.0` |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://rndtmsjzwqahnwiddzcf.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` |
   | `SUPABASE_SECRET_KEY` | `sb_secret_...` |
   | `NEXT_PUBLIC_APP_URL` | `https://fixly.company` |
   | `RESEND_API_KEY` | (opcional) `re_...` |
   | `MP_ACCESS_TOKEN` | (opcional) `APP_USR-...` |
   | `NEXT_PUBLIC_MP_PUBLIC_KEY` | (opcional) `APP_USR-...` |
4. **Create Web Service**. O primeiro build leva ~3–5 min. Ao final, o app fica
   em `https://fixly-web.onrender.com`.

## 3. Apontar o domínio fixly.company
1. No Render → serviço → **Settings → Custom Domains → Add** → digite
   `fixly.company` e também `www.fixly.company`.
2. O Render mostra os alvos de DNS. Normalmente:
   - **Apex** `fixly.company` → registro **A** para o IP do Render (ex.:
     `216.24.57.1`) — ou ANAME/ALIAS se o provedor suportar.
   - **www** `www.fixly.company` → **CNAME** para `fixly-web.onrender.com`.
3. No **Hostinger** (hPanel) → **Domínios → fixly.company → DNS / Nameservers**:
   - Adicione o registro **A** do apex com o IP informado pelo Render.
   - Adicione o **CNAME** de `www` apontando para `fixly-web.onrender.com`.
   - Remova registros de "parking" conflitantes (os `dns-parking.com`).
4. Volte ao Render e clique **Verify**. A propagação leva de minutos a algumas
   horas. O Render emite o **certificado HTTPS** automaticamente.

## 4. Ajustar o Supabase para o domínio
Supabase → **Authentication → URL Configuration**:
- **Site URL:** `https://fixly.company`
- **Redirect URLs:** adicione `https://fixly.company/**`

## 5. Checklist final de produção
- [ ] Reativar **Confirm email** (Authentication → Providers → Email) ou exigir
      verificação, antes de abrir cadastro público.
- [ ] Ativar **Leaked password protection** e tamanho mínimo de senha.
- [ ] Se for usar Mercado Pago real: cadastrar o **webhook** apontando para
      `https://fixly.company/api/mp/webhook` (a implementar) e validar assinatura.
- [ ] Plano **Starter** no Render se o cold start do Free incomodar.
- [ ] Conferir o `SECURITY.md` (recomendações residuais).

> Observação: o schema e os usuários de teste **já estão no Supabase**. Para um
> ambiente limpo de produção, rode `npm run db:apply` e (opcional) `npm run seed`
> apontando para o projeto Supabase de produção.
