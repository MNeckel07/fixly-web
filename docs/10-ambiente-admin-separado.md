# 10 — Ambiente administrativo separado (fixly.fun)

> Construído em **11/08/2026**. O painel da equipe deixou de ser servido pelo
> site público: passa a viver em **fixly.fun**, num serviço próprio do Render,
> com o mesmo código. Este arquivo tem o que foi feito, o passo a passo para
> colocar o domínio no ar e o que testar depois.

---

## 1. A escolha, e o que ela entrega de fato

**Um repositório, dois serviços.** O mesmo código roda duas vezes; a variável
`APP_ROLE` decide qual papel cada servidor exerce:

| Serviço no Render | `APP_ROLE` | Domínio | Serve |
|---|---|---|---|
| `fixly-web` | `site` | fixly.company | o produto — `/admin` responde **404** |
| `fixly-admin` | `admin` | fixly.fun | o painel — `/app/*`, `/cadastro`, `/p/`, `/e/` e `/api/pagamentos` respondem **404** |

**O que a separação entrega de verdade:**
1. **Cookies não atravessam domínios.** A sessão de um administrador vive em
   `fixly.fun` e o navegador **não a envia** para `fixly.company`. Um XSS no site
   público deixa de alcançar sessão privilegiada — este é o ganho principal.
2. **O token do Mercado Pago não existe na máquina do painel.** O admin nunca
   chama a API do gateway (só lê colunas de `payments`), então `MP_ACCESS_TOKEN`
   simplesmente não é configurada lá.
3. **Endereço fora do radar:** o painel responde `noindex, nofollow` e o título
   da aba é "Painel · Fixly" — nada anuncia o produto.
4. **Falhas isoladas:** o painel continua de pé se o site cair, e vice-versa.
5. **Dá para trancar por IP** só o serviço do painel, sem afetar clientes.

**O que ela NÃO entrega — para não criar falsa sensação de segurança:**
- O código do admin **continua presente** no servidor público, apenas
  inacessível por rota. Quem tiver execução de código naquela máquina não é
  barrado por isso.
- **A fronteira que protege os dados continua sendo a RLS do Supabase** +
  `is_admin()`. Senha de admin vazada é igualmente grave nos dois domínios.
- Os dois serviços têm `SUPABASE_SECRET_KEY` (ambos rodam server actions).

---

## 2. Como funciona no código

| Peça | Arquivo | Papel |
|---|---|---|
| Decisão do papel + regra de rotas | `src/lib/appRole.ts` | `appRole()` lê `APP_ROLE`; `pathAllowed()` diz o que cada papel serve |
| Barreira | `src/proxy.ts` | responde **404** (não 403) quando a rota é do outro ambiente |
| Login | `LoginForm` + `login/page.tsx` | o painel só oferece "Equipe Fixly"; o site não oferece admin. Login na porta errada **encerra a sessão** e explica o endereço certo |
| Marca | `app/layout.tsx` | título próprio e `noindex` quando `APP_ROLE=admin` |
| Infra | `render.yaml` | os dois serviços, com as variáveis de cada um |

**Por que 404 e não 403:** um 403 confirmaria que a rota existe do outro lado.
Para quem varre o `fixly.company` atrás de `/admin`, o painel não existe.

**Padrão seguro:** se `APP_ROLE` faltar, o serviço assume `site`. Esquecer a
variável nunca deve transformar o site público em painel.

> 🔴 **Achado no caminho:** o `proxy.ts` estava na **raiz** do projeto, mas com o
> app em `src/app` o Next 16 exige `src/proxy.ts`. Na raiz ele era **ignorado em
> silêncio** — ou seja, o rate limiting (400 req/min por IP, 60/min nas telas de
> autenticação) e o refresh de sessão **nunca rodaram**. Corrigido junto: o
> arquivo foi movido e o build agora anuncia `ƒ Proxy (Middleware)`.

---

## 3. Passo a passo — colocar o fixly.fun no ar

Mesmo caminho que já foi feito com o `fixly.company`.

### 3.1 Criar o serviço no Render
1. **https://dashboard.render.com** → **New +** → **Web Service**.
2. Conecte o mesmo repositório: **`MNeckel07/fixly-web`**.
3. Preencha:
   - **Name:** `fixly-admin`
   - **Region:** Oregon (a mesma do site)
   - **Branch:** `main`
   - **Build Command:** `npm ci && npm run build`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
4. **Create Web Service**. O primeiro deploy vai subir — ainda sem domínio.

### 3.2 Variáveis do painel
Em **fixly-admin → Environment**, adicione:

| Key | Value |
|---|---|
| `APP_ROLE` | **`admin`** ← é a variável que define tudo |
| `NEXT_PUBLIC_SUPABASE_URL` | a mesma do site |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | a mesma do site |
| `SUPABASE_SECRET_KEY` | a mesma do site |
| `NEXT_PUBLIC_APP_URL` | `https://fixly.fun` |
| `NEXT_PUBLIC_SITE_URL` | `https://fixly.company` |
| `BREVO_API_KEY` | a mesma do site |
| `EMAIL_FROM` | `Fixly <nao-responda@fixly.company>` |

🔴 **NÃO** coloque `MP_ACCESS_TOKEN`, `NEXT_PUBLIC_MP_PUBLIC_KEY` nem
`MP_WEBHOOK_SECRET` aqui. O painel não cobra ninguém — manter a credencial fora
dessa máquina é metade do ganho da separação.

### 3.3 Domínio no Render
1. **fixly-admin → Settings → Custom Domains → Add Custom Domain**.
2. Adicione **`fixly.fun`** e também **`www.fixly.fun`**.
3. O Render mostra o que apontar. Anote os dois valores — o **IP do apex** e o
   **hostname do serviço** (algo como `fixly-admin-xxxx.onrender.com`).

### 3.4 DNS na Hostinger
**Domínios → `fixly.fun` → Gerenciar → Registros DNS:**

| Tipo | Nome | Valor | Observação |
|---|---|---|---|
| A | `@` | o IP que o Render mostrar | hoje o do site é `216.24.57.1`; **use o que a tela do Render exibir**, não copie daqui |
| CNAME | `www` | `fixly-admin-xxxx.onrender.com` | o hostname do **serviço novo**, não o do site |

⚠️ **Apague antes qualquer A/CNAME de estacionamento** que a Hostinger tenha
criado para o `fixly.fun`, senão os registros brigam e o domínio fica oscilando.

⚠️ **Não mexa no DNS do `fixly.company`.** São zonas diferentes; o site continua
como está.

### 3.5 Esperar e validar
A propagação leva de minutos a algumas horas. O Render emite o certificado HTTPS
sozinho quando o DNS aponta certo (o status vira **Verified**).

Quando estiver no ar, me chame que eu rodo a checagem — ou rode você:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://fixly.fun/login          # 200
curl -s -o /dev/null -w "%{http_code}\n" https://fixly.fun/app/contratante # 404
curl -s -o /dev/null -w "%{http_code}\n" https://fixly.company/admin       # 404
```

Os três precisam bater. O terceiro é o que prova que o painel saiu do ar público.

### 3.6 Avisar a equipe
O endereço do painel passa a ser **https://fixly.fun**. Quem tentar entrar com
conta de admin pelo `fixly.company` recebe a mensagem apontando para lá — e a
sessão é encerrada na hora.

---

## 4. Depois que estiver no ar (recomendado)

- **Trancar por IP.** Com o painel isolado, dá para restringir o acesso à faixa
  de IP da empresa sem afetar cliente nenhum. No Render é via
  **Settings → Access Control**, ou pondo um Cloudflare Access na frente.
- **Segundo fator** para as contas de admin.
- Se um dia o painel precisar de um subdomínio (`painel.fixly.fun`), é só somar
  o host em `ADMIN_HOSTS` no `appRole.ts` — a regex já aceita subdomínio.

---

## 5. Testado em 11/08/2026 (não é suposição)

Subi as duas configurações localmente e conferi rota por rota:

| Rota | `APP_ROLE=site` | `APP_ROLE=admin` |
|---|---|---|
| `/login` | 200 | 200 |
| `/admin` | **404** | 307 → login |
| `/admin/usuarios` | **404** | (protegido por permissão) |
| `/admin/vendas` | **404** | (protegido por permissão) |
| `/app/contratante` | 307 → login | **404** |
| `/cadastro` | 200 | **404** |
| `/p/<handle>` | 200 | **404** |
| `/api/pagamentos/webhook` | 200 | **404** |
| `/` | 307 → login | 307 → `/admin` |

E na tela de login: o painel oferece **só** "Equipe Fixly", título `Painel ·
Fixly` e `robots: noindex, nofollow`; o site oferece só contratante e prestador,
com o título de sempre.
