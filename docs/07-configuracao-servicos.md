# 07 — Configuração dos serviços externos (passo a passo)

Duas coisas dependem de você, Matheus. **O código já está pronto e no ar** — o que
falta é ligar as chaves. Sugestão de ordem: **e-mail primeiro** (destrava o
cadastro), pagamento depois (dá mais trabalho e envolve dinheiro real).

---

# 1) E-MAIL — Brevo (destrava o cadastro)

**Por que é urgente:** o cadastro envia um código de 6 dígitos para confirmar o
e-mail. Sem provedor configurado, o código não sai e **ninguém cria conta nova**
(a tela mostra erro na hora — não deixa o usuário esperando).

## Qual provedor: Brevo (a mesma do sistema-producao)
O código aceita **Brevo** ou **Resend** (`lib/email.ts` escolhe pela variável que
estiver preenchida). A recomendação é **Brevo**, por três motivos:

| | Brevo | Resend |
|---|---|---|
| Conta | **já existe** (DVN usa no sistema-producao) | criar nova |
| Grátis por dia | **300/dia** (9.000/mês) | 100/dia (3.000/mês) |
| Funciona no Render free | ✅ API HTTPS | ✅ API HTTPS |

O teto **diário** é o que importa: código de verificação chega em rajada
(cadastro + recuperação de senha no mesmo dia).

> ⚠️ **Nunca use SMTP no Render.** O Render **bloqueia as portas 25/465/587 nos
> serviços gratuitos** — a conexão só estoura o tempo. Os dois caminhos aqui
> usam API HTTPS na porta 443. Essa armadilha já custou debugging no
> sistema-producao (está documentada em `backend/app/mailer.py` lá).

## 1.1 Pegar a chave da Brevo
1. Entre em **https://app.brevo.com** com a conta da DVN (a mesma do
   sistema-producao).
2. Canto superior direito → **SMTP & API** → aba **API Keys**.
3. **Generate a new API key**, nome `fixly-producao`. Copie (começa com
   `xkeysib-`).

> Dá para reaproveitar a chave que já está no Render do sistema-producao, mas
> **prefira uma chave nova**: se um dia precisar revogar a do Fixly, o sistema
> da DVN não para.

## 1.2 Verificar o remetente do Fixly
Remetente definido: **`nao-responda@fixly.company`** (caixa da Hostinger, já
ativa). O e-mail **não pode** sair como `projetos@dvn.com.br` — o cliente do
Fixly receberia um código vindo da DVN, o que parece golpe e vai para o spam.

### Caminho A — rápido, SEM DNS (faz hoje)
Brevo → **Settings** → **Senders, Domains & Dedicated IPs** → aba **Senders** →
**Add a sender**:
- Name: `Fixly` · Email: `nao-responda@fixly.company`

A Brevo manda um e-mail de confirmação **para essa caixa**. Abra o webmail da
Hostinger, clique no link e o remetente fica verificado. Já dá para enviar.

### Caminho B — DKIM/SPF do domínio (fazer depois, melhora a entrega)
Brevo → mesma tela → aba **Domains** → **Add a domain** → `fixly.company`.
Ela mostra os registros; copie no DNS da **Hostinger** (Domínios →
`fixly.company` → Gerenciar registros DNS).

**⚠️ A armadilha do SPF — leia antes de colar nada.**
Só pode existir **UM** registro SPF por domínio. O `fixly.company` **já tem** um,
da Hostinger:
```
v=spf1 include:_spf.mail.hostinger.com ~all
```
Se você criar um TXT SPF separado para a Brevo, **os dois param de valer** e o
e-mail passa a cair no spam. O certo é **EDITAR** o registro existente e juntar
os includes:
```
v=spf1 include:_spf.mail.hostinger.com include:spf.brevo.com ~all
```
O DKIM, sim, é um registro **novo** (não conflita) — cole exatamente o nome e o
valor que a tela da Brevo mostrar.

Estado atual do DNS (conferido em 2026-07-30), para você saber o que **não** mexer:

| Tipo | Nome | Valor | Para quê |
|---|---|---|---|
| A | `@` | `216.24.57.1` | **site no Render — NÃO MEXER** |
| MX | `@` | `mx1.hostinger.com` (5), `mx2.hostinger.com` (10) | recebe e-mail — não mexer |
| TXT | `@` | `v=spf1 include:_spf.mail.hostinger.com ~all` | SPF — **editar**, não duplicar |
| TXT | `_dmarc` | `v=DMARC1; p=none` | já existe, nada a fazer |

## 1.3 Colocar no Render
**Render** → serviço **`fixly-web`** → **Environment** → *Add Environment Variable*:

| Key | Value |
|---|---|
| `BREVO_API_KEY` | `xkeysib-...` |
| `EMAIL_FROM` | `Fixly <nao-responda@fixly.company>` |

Salve — o Render reinicia sozinho (~2 min).

> 🔴 O endereço em `EMAIL_FROM` **tem que ser exatamente o verificado no passo
> 1.2**. Se não bater, a Brevo devolve 401/400 e a tela mostra o motivo exato
> (o erro real dela aparece na mensagem, justamente para não ficar no escuro).

> 🔴 Se `EMAIL_DEV_CODES=1` estiver no Render, **remova agora**. Com provedor
> configurado ela não é mais necessária, e ligada é um vazamento: o código
> aparece na tela de quem digitou o e-mail — inclusive de outra pessoa.

## 1.4 Conferir se está tudo certo (script pronto)
```bash
cd sistema-web
node --env-file=.env.local scripts/check-email.mjs                  # diagnóstico
node --env-file=.env.local scripts/check-email.mjs voce@email.com   # + envio de teste
```
Ele responde as três perguntas que sempre aparecem quando "o código não chega":
a chave é válida? o remetente está ativo? o último envio saiu ou deu bounce?
Nunca imprime a chave.

> **O que realmente libera o envio é o REMETENTE ativo**, não o domínio
> autenticado. Em 30/07/2026 o `fixly.company` estava com `autenticado: false`
> (DNS ainda propagando) e o e-mail saiu normalmente, porque
> `nao-responda@fixly.company` já constava como remetente ativo. A autenticação
> do domínio melhora a entrega — não é pré-requisito.

## 1.5 Testar pela tela
1. `https://fixly.company/cadastro` em **aba privada**.
2. Cadastre com um e-mail **seu, de verdade** — o código chega em segundos.
3. Se cair no spam, marque "não é spam" (ajuda a reputação).
4. Teste também `https://fixly.company/recuperar-senha`.

## 1.6 Se preferir Resend em vez de Brevo
O código aceita as duas. Limite grátis menor: **3.000/mês, 100/dia**.
1. **https://resend.com** → *Sign up* (dá para entrar com o GitHub).
2. **Domains** → **Add Domain** → `fixly.company` → copie os registros DNS que
   ele mostrar (DKIM/SPF) e cole no DNS da **Hostinger**. A Resend **exige**
   domínio verificado para enviar.
3. **API Keys** → *Create API Key* (permissão *Sending access*) → copie `re_...`.
4. No Render: `RESEND_API_KEY` em vez de `BREVO_API_KEY` (o `EMAIL_FROM` é igual).

> Se as duas variáveis estiverem preenchidas, o código usa a **Brevo**.

## 1.7 Testar ANTES de configurar qualquer provedor
Adicione `EMAIL_DEV_CODES` = `1`. O código passa a aparecer **na tela**,
em amarelo, escrito "Modo de teste".
> 🔴 **Remova essa variável depois.** Com ela ligada, qualquer pessoa consegue
> confirmar o e-mail de outra pessoa.

---

# 2) PAGAMENTO — Mercado Pago

## 2.1 Por que Mercado Pago (a pesquisa que você pediu)

> 📊 **O estudo completo de taxas está em [`08-estudo-meios-de-pagamento.md`](08-estudo-meios-de-pagamento.md)**
> (levantado em 30/07/2026, com 8 gateways, simulação no nosso ticket e o efeito
> na comissão). O quadro abaixo é o resumo qualitativo; os **números** estão lá.
> A conclusão continua a mesma — ficar no MP —, mas com duas mudanças de preço
> que zeram o nosso custo (repassar a tarifa do cartão e parcelar com juros).

Comparei as opções brasileiras que fazem **split** (dividir o pagamento entre a
plataforma e o profissional) e não cobram mensalidade:

| Gateway | Abrir conta | Split | Como o profissional recebe | Observação |
|---|---|---|---|---|
| **Mercado Pago** | grátis | `application_fee` (Checkout API/Bricks) | precisa de **conta MP** + autorizar por OAuth | **melhor conversão no Brasil**, Pix barato, já é o que o site tem modelado |
| **Asaas** | grátis, sem mensalidade | split por % ou valor fixo | dá para criar **subconta** para o profissional pela API | ótimo para marketplace; troca mais burocrática (KYC de cada subconta) |
| **Pagar.me** | grátis | split (recebedores) | precisa cadastrar recebedor | forte em e-commerce, menos gente conhece |
| **Stripe Connect** | grátis | Connect | onboarding do profissional | Pix chegou depois; taxa de cartão maior no BR |

**Recomendação: ficar no Mercado Pago.** Motivos:
1. É o que o cliente final reconhece e confia (conversão no Pix e no cartão);
2. o código do Fixly já está escrito para ele;
3. **o profissional não precisa ter conta em nada** para começar — ver o modelo abaixo.

## 2.2 Como o dinheiro se move (o modelo que implementei)

Existem dois modos, e o sistema escolhe **automaticamente** por pagamento:

### Modo ESCROW (o padrão — funciona para todo mundo)
```
Contratante paga R$ 1.000  →  cai na conta MERCADO PAGO DO FIXLY
                              │
                              ├─ tarifa do Mercado Pago   (~R$ 9,90 no Pix)
                              ├─ comissão Fixly 15%       (R$ 150,00)
                              └─ resto RETIDO: R$ 840,10
                                 │
                     contratante APROVA o serviço
                                 │
                              fica disponível para o prestador
                              (Pix D+1 / cartão D+2)
                                 │
                     prestador clica "Sacar dinheiro"
                                 │
                     entra em Admin → Saques → você paga o PIX dele
```
É o modo que faz o marketplace funcionar **hoje**: o profissional só precisa de
uma **chave PIX** (que já pedimos no cadastro). O dinheiro fica com o Fixly até a
aprovação — é isso que garante o "pagamento protegido" ao contratante.

### Modo SPLIT (opcional, quando o profissional quiser)
Se o profissional conectar a conta Mercado Pago dele (botão **"Conectar Mercado
Pago"** na aba Ganhos), o próprio MP divide na hora: a **comissão do Fixly** cai
para nós via `application_fee` e o resto vai direto para ele. Aí **não tem saque**.
Precisa de `MP_CLIENT_ID`/`MP_CLIENT_SECRET` (passo 2.6) — pode deixar para depois.

> **Ordem dos descontos** (regra do MP): primeiro a tarifa do Mercado Pago,
> depois a nossa comissão sobre o que sobrou. A tela do contratante já mostra as
> duas linhas separadas, além da taxa de adiantamento quando existe.

## 2.3 Criar a aplicação no Mercado Pago
1. Entre em **https://www.mercadopago.com.br/developers** com a conta MP **da
   empresa** (a que vai receber o dinheiro — não use conta pessoal se for faturar
   pelo CNPJ).
2. **Suas integrações** → **Criar aplicação**.
   - Nome: `Fixly`
   - Produto: **Checkout Transparente** (é o que usamos: Pix + cartão na nossa tela)
   - Modelo de negócio: **Marketplace** (é o que libera o split depois)
3. Criada a aplicação, você vê duas abas de credenciais: **Teste** e **Produção**.

## 2.4 Primeiro em TESTE (recomendado — não mexe com dinheiro real)
Em **Credenciais de teste**, copie:
- **Public Key** → começa com `TEST-`
- **Access Token** → começa com `TEST-`

No Render → `fixly-web` → **Environment**:

| Key | Value |
|---|---|
| `MP_ACCESS_TOKEN` | `TEST-...` |
| `NEXT_PUBLIC_MP_PUBLIC_KEY` | `TEST-...` |

Depois, em **Contas de teste** no painel do MP, crie **duas** contas de teste
(uma "comprador", uma "vendedor"). Use os **cartões de teste** do MP para pagar:
- aprovado: `5031 4332 1540 6351`, CVV `123`, validade `11/30`, nome `APRO`
- recusado: mesmo cartão, nome `OTHE`

## 2.5 Webhook (é o que confirma o Pix)
Sem isso, o Pix fica "aguardando" para sempre.

1. No painel da aplicação → **Webhooks / Notificações**.
2. **URL de produção:** `https://fixly.company/api/pagamentos/webhook`
3. Eventos: marque **Pagamentos** (`payment`).
4. O MP mostra uma **"assinatura secreta"**. Copie.
5. No Render, adicione:

| Key | Value |
|---|---|
| `MP_WEBHOOK_SECRET` | a assinatura secreta do webhook |

> 🔴 **Sem `MP_WEBHOOK_SECRET` a rota RECUSA todas as notificações** (401). É de
> propósito: um webhook sem validação de assinatura deixaria qualquer pessoa na
> internet marcar um serviço como pago. Não tem como "pular" essa parte.
>
> A tela do Pix também consulta o MP a cada 5 s como rede de segurança, então um
> webhook atrasado não trava o cliente — mas o webhook é o caminho oficial.

## 2.6 Split via OAuth (opcional, deixe para depois)
Só se você quiser oferecer "receber direto na sua conta MP":
1. No painel da aplicação → **OAuth**.
2. **Redirect URI:** `https://fixly.company/api/pagamentos/oauth/callback`
3. Copie **Client ID** e **Client Secret** → no Render:
   `MP_CLIENT_ID` e `MP_CLIENT_SECRET`.
4. O botão "Conectar Mercado Pago" aparece sozinho na aba **Ganhos** do prestador.

> O token do vendedor vale **~6 meses** e precisa ser renovado. A função de
> renovar (`oauthRefresh`) está pronta, falta agendar — está anotado no arquivo 06.

## 2.7 Virar para PRODUÇÃO (dinheiro real)
Quando os testes passarem:
1. No MP, aba **Credenciais de produção** (pode pedir dados da empresa/homologação).
2. Troque no Render: `MP_ACCESS_TOKEN` e `NEXT_PUBLIC_MP_PUBLIC_KEY` para as de
   produção (`APP_USR-...`).
3. Refaça o webhook com a assinatura secreta **de produção**.
4. **Teste com R$ 1,00 de verdade**, no seu próprio cartão/Pix, e confira:
   - o pedido virou "a caminho" depois do pagamento;
   - `Admin → Vendas` mostra o valor e a comissão;
   - aprovando o serviço, o valor aparece na **Carteira** do prestador com a data
     de crédito;
   - o saque cai em `Admin → Saques`.

## 2.8 Conferir as taxas antes de abrir
Os números que estão no código são **provisórios** (`src/lib/pricing.ts`):

| Constante | Valor atual | O que é |
|---|---|---|
| `PLATFORM_FEE_RATE` | 15% | comissão do Fixly |
| `GATEWAY_FEE_RATES.pix` | 0,99% | tarifa do MP no Pix — ✅ confere com a tabela oficial |
| `GATEWAY_FEE_RATES.cartao` | 3,79% | 🔴 **errado**: o MP cobra **4,98%** (na hora) ou 3,99% (em 30 dias) |
| `ADVANCE_FEE_RATE` | 8% | taxa sobre a parte adiantada |
| `SETTLEMENT_DAYS` | Pix 1 dia, cartão 2 | prazo de crédito ("cai dia X") |

**Confira contra o contrato que o Mercado Pago te der** e me diga os números
certos — são 5 linhas para ajustar. Se a tarifa real for maior que a daqui, a
gente está pagando a diferença do próprio bolso em cada serviço.

---

# 3) Checklist final de variáveis no Render

| Key | Obrigatória? | Sem ela… |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | nada funciona |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ | nada funciona |
| `SUPABASE_SECRET_KEY` | ✅ | server actions quebram (cadastro, admin, pagamento) |
| `NEXT_PUBLIC_APP_URL` | ✅ | links de e-mail e QR do cartão saem errados |
| `BREVO_API_KEY` *(ou `RESEND_API_KEY`)* | ✅ | **cadastro e recuperação de senha não funcionam** |
| `EMAIL_FROM` | ✅ | precisa ser o remetente VERIFICADO no provedor |
| `MP_ACCESS_TOKEN` | para cobrar | pagamento fica simulado (mock) |
| `NEXT_PUBLIC_MP_PUBLIC_KEY` | para cartão | só Pix aparece |
| `MP_WEBHOOK_SECRET` | para Pix | Pix nunca confirma |
| `MP_CLIENT_ID` / `MP_CLIENT_SECRET` | opcional | sem "receber direto" (split) |
| `AUTH_TOKEN_SECRET` | opcional | usa a `SUPABASE_SECRET_KEY` para assinar |
| `EMAIL_DEV_CODES` | 🔴 **não** | *só* para testar sem provedor — remover depois |
| `STRIPE_SECRET_KEY` | para carteiras | Apple Pay / Google Pay não aparecem |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | para carteiras | idem (tem que ser a **publicável**) |

> **Apple Pay e Google Pay rodam no STRIPE, não no Mercado Pago** — o MP não
> oferece essas carteiras no Brasil. Passo a passo de como criar a conta,
> validar o domínio e ligar os métodos: `docs/06`, seção "PARA O GOOGLE PAY
> APARECER". As duas variáveis vão **só no `fixly-web`**; o painel não recebe
> credencial de pagamento.
