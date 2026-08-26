# 06 — Próximos passos e instruções para a próxima sessão

# 📍 PONTO DE PARADA — 26/08/2026 (rodada *Fixly 11* + landing · NO AR)

`main` = **`3accd79`**, árvore limpa, tudo publicado e **conferido em
produção pelo comportamento** (não só por HTTP 200). Migrações **0001–0036**
aplicadas.

## O que entrou nesta sessão

Três commits:

| commit | o quê |
|---|---|
| `c4c3957` | rodada *Fixly 11* — os 12 itens do PDF |
| `96a1924` | a landing virou a raiz de `fixly.company` |
| `3accd79` | o frete não paga comissão |

Detalhe de cada um no `docs/05` (v14, v15 e v15.1). As armadilhas que
custaram diagnóstico estão no `docs/03`.

**Os dois achados que mais importam**, porque mudam o que já se acreditava:

1. **`#441` não era do cancelamento nem da edição.** Um `export const` num
   arquivo `"use server"` derruba TODAS as server actions da página. Ver a
   armadilha no `docs/03` e a varredura preventiva que está lá.
2. **"2 prestadores não veem meus pedidos NÃO é bug" (anotação da v13) estava
   errado.** A regra do Selo existe, mas a implementação estava furada: o
   filtro lia `fix_badge` do cliente por um `join` que a RLS zera, e **todo
   prestador com Selo via 0 pedidos**. Corrigido.

## ✅ Conferido em produção (26/08)

- `/` = landing, `/login` e `/cadastro/*` 200, `/admin` **404** no site público
- `fixly.fun`: `/app/*` e `/cadastro` 404, `robots.txt` = `Disallow: /`
- Prestador: serviço R$ 1.000 + frete R$ 200 → líquido **R$ 1.050,00**
  (com o código antigo daria R$ 1.020,00 — é o número que prova o deploy)
- Contratante: "Propostas recebidas (2)", filtros de Selo/serviços,
  "R$ 400,00 + R$ 60,00 de frete", "bloco 1 de 2 · 3 valor(es) restante(s)",
  "a partir de R$ 380,00" e "aguardando propostas" no lugar de R$ 0,00

## 🔵 DECISÕES DO DONO REGISTRADAS

- **O frete NÃO paga comissão** (26/08). Os 15% incidem só sobre o serviço;
  o frete vai inteiro ao profissional, inclusive na retenção do cancelamento.
- **A janela de 5 min do Express fica como está** (carência): dentro dos 5
  minutos o cancelamento é gratuito mesmo com profissional já designado.
  ⚠️ Segue **em aberto para revisão futura** — a alternativa é "sem carência"
  (aceitou, valem os 30%), e é uma linha em `etapaDoCancelamento`.

## 🟡 O QUE FICOU PENDENTE DESTA RODADA

- **Item 3.4 da política (execução já iniciada) não tem fluxo de apuração.**
  Hoje o serviço é interrompido, o dinheiro fica **retido** (item 8) e a tela
  avisa que o suporte vai apurar — mas **não existe tela no painel** para o
  suporte decidir quanto vai para cada lado. Enquanto isso, esses casos ficam
  parados. É o próximo passo natural da política.
- **O no-show do cliente (item 5.1) depende do profissional marcar "a caminho".**
  Sem o carimbo `departed_at` a taxa de deslocamento não é devida — e o
  profissional pode simplesmente não marcar. Vale observar em uso real.
- **`travel_fee` não entra no adiantamento.** O frete é pago junto com o resto,
  na aprovação. Se o dono quiser que o deslocamento seja adiantado (faz sentido:
  o custo é do início), é uma mudança em `paymentBreakdown`.
- **O prestador não vê o nome do cliente** ("Cliente" genérico) porque a RLS de
  `profiles` não o expõe. Não foi pedido, mas a tela claramente pretendia
  mostrar. Decisão de privacidade — perguntar antes de mudar.

## ⚠️ ANTES DE MEXER NO CÓDIGO, SAIBA

- `src/app` tem **dois route groups com root layouts separados**: `(site)` (a
  landing) e `(app)` (o produto). Não junte os CSS — o motivo está no `docs/03`.
- Imports de server action carregam o group: `@/app/(app)/…`.
- `scripts/strip-admin.mjs` apaga **por caminho** e agora **falha fechado**. Se
  alguma pasta mudar de lugar, o build para — de propósito.
- As provas ficam em `scripts/checks/` (23 casos sem banco + 10 no banco com
  rollback). Rodar antes de mexer em preço, política ou negociação.

---

# 📍 PONTO DE PARADA — 18/08/2026 (parte 10 · v13 · NO AR)

`main` = v13 + o acerto do CSP do Stripe. Migrações **0001–0030 aplicadas**
(conferido no banco: existe a função `update_request_location` e as policies
`avatars_read`/`portfolio_read`). Deploy confirmado no ar: `/api/health` do
fixly.company responde `{"ok":true,"service":"site"}`.

**Tudo o que o PDF *Fixly 10* pedia está entregue.** O último item que faltava
era a segunda metade do pedido da página 5 — "colocar um símbolo de notificação
ali, **e das respostas por email**": o símbolo (`UnreadNavBadge`) já tinha
sido feito; agora a **resposta do suporte avisa o autor do chamado por e-mail**.

## 🔴 O QUE ESTAVA QUEBRADO NA v13 E FOI CORRIGIDO AGORA

**O botão de Apple Pay/Google Pay não podia funcionar** — e falharia calado.
O `next.config.ts` tem CSP, e o `js.stripe.com` não estava liberado em lugar
nenhum. O navegador barraria o SDK, o `carregarSdk()` devolveria `false` e o
componente esconde o botão de propósito ("botão de carteira que não funciona é
pior do que não ter"). Resultado: depois de configurar as chaves, o dono veria
exatamente a mesma tela de antes e concluiria que a credencial estava errada.

Liberado no CSP: `script-src`/`img-src` (`js.stripe.com`, `*.stripe.com`),
`connect-src` (`api.stripe.com`, `r.stripe.com`) e `frame-src`
(`js.stripe.com`, `hooks.stripe.com` — o 3-D Secure). E o
**`Permissions-Policy`** passou a **delegar** `payment` ao iframe do Stripe
(`payment=(self "https://js.stripe.com")`): a Payment Request API roda dentro
dele, e `payment=(self)` sozinho a bloqueia. Conferido no header servido pelo
build de produção.

## 🔑 PARA O GOOGLE PAY APARECER (só falta credencial)

O código está pronto e **desligado** enquanto `STRIPE_SECRET_KEY` não existir.

1. Criar conta em https://dashboard.stripe.com (CNPJ; o Stripe Brasil aceita
   MEI). Ativar a conta ("Ativar pagamentos").
2. **Desenvolvedores → Chaves de API**: copiar a **Publicável** (`pk_live_…`) e
   a **Secreta** (`sk_live_…`). Para testar antes, use o par `pk_test_`/
   `sk_test_` — o botão aparece igual e nada é cobrado.
3. **Configurações → Métodos de pagamento**: ligar **Apple Pay** e **Google
   Pay**.
4. **Apple Pay → validar domínio** `fixly.company` (o Stripe faz o certificado;
   **não** precisa da conta de US$ 99 da Apple).
5. **Render → `fixly-web` → Environment**, duas variáveis novas:
   `STRIPE_SECRET_KEY` e `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
   ⚠️ A `NEXT_PUBLIC_…` precisa ser a **publicável** — a secreta dentro de uma
   `NEXT_PUBLIC_*` vaza no bundle do navegador.
   ⚠️ O `fixly-admin` **não** recebe nenhuma das duas (mesma regra do MP).
6. Testar **no celular** (o botão só aparece em aparelho com carteira
   configurada; no desktop sem carteira o `canMakePayment()` devolve nulo e
   nada é mostrado — isso é o comportamento certo, não um bug).

Pix e cartão digitado continuam no Mercado Pago. O dinheiro anda igual: cai na
conta do Fixly (escrow), fica retido até o contratante aprovar, e o saque do
profissional sai por Pix na fila do Admin.

## O que testar na tela desta leva (parte 10)

1. **Chave PIX**: perfil do prestador → "Configurar" → escolher o tipo →
   digitar → o campo formata sozinho e recusa o que não bate com o tipo.
2. **Editar pedido**: criar um pedido, clicar no lápis, trocar descrição e
   endereço. Do lado do prestador, o endereço tem que continuar mostrando só a
   região até o aceite.
3. **EXPRESS**: pedido com "É urgente?" ligado → tarja EXPRESS nas duas pontas,
   com os dois avisos ("só proponha se puder ir agora" / "ele sai agora").
4. **Foto de perfil** pelo celular (era o erro de RLS do upsert).
5. **Suporte**: abrir um chamado, responder pelo painel e conferir que chega o
   **e-mail** "O suporte respondeu seu chamado #N" com link para o
   fixly.company (não para o fixly.fun).
6. **Ganhos**: a caixa diz "Ganhos em <mês>" e conta pelo `released_at`.


# 📍 Ponto de parada anterior — 12/08/2026 (parte 7 · v12)

`main` = `cc44163`, migração **0026 aplicada** e deploy **confirmado no ar**
(marcadores da parte 7 encontrados nos chunks servidos por fixly.company).
Migrações aplicadas: **0001–0026**.

**Verificado depois de publicar:**
- 54 pedidos, 54 com linha em `service_request_locations`; o `address` público
  virou região ("Batel - Curitiba/PR");
- `prop_update` é admin-only; as 6 funções novas existem;
- bundle servido contém "arraste o pino at…" e "Pino ajustado para o n…".

> ⚠️ Ao conferir marcador em bundle: o minificador escapa acento
> (`\u00e9`), então **grep só com trecho ASCII** — "arraste o pino at" acha,
> "arraste o pino até" não.

## 🔑 O QUE DEPENDE DE CREDENCIAL (nada disso é código)

### 1. Validar o Mercado Pago em produção
As credenciais foram trocadas no Render pelo dono (13/08). **Não dá para
conferir de fora**: a public key só entra no bundle da tela de pagamento, que
fica atrás do login. Para validar de verdade, colocar as três de PRODUÇÃO no
`.env.local` e rodar:
```bash
node --env-file=.env.local scripts/check-mp.mjs --url https://fixly.company
```
Tem que dizer **ambiente PRODUÇÃO** e aceitar a assinatura do webhook. Depois,
um serviço real de R$ 1,00 pago pelo app do banco.

### 2. Cartão na carteira do celular (código pronto, credencial faltando)
`/api/carteira/apple` e `/api/carteira/google` respondem **503** enquanto não
existirem as variáveis. Os botões só aparecem no cartão QR quando o servidor
tem credencial — nada de botão que dá erro.

**Google (grátis, ~1 dia de aprovação):**
1. [Google Pay & Wallet Console](https://pay.google.com/business/console) →
   criar conta de emissor → anotar o **Issuer ID**.
2. Google Cloud → API "Google Wallet" ativada → criar **service account** →
   baixar a chave JSON.
3. No console do Wallet, autorizar o e-mail da service account.
4. Render (`fixly-web`): `GOOGLE_WALLET_ISSUER_ID`, `GOOGLE_WALLET_SA_EMAIL`,
   `GOOGLE_WALLET_SA_KEY` (a `private_key` do JSON, com os `\n`).

**Apple (US$ 99/ano):**
1. Apple Developer Program → Certificates, IDs & Profiles → **Pass Type ID**
   (ex.: `pass.company.fixly.cartao`).
2. Gerar o certificado, exportar como **.p12** com senha.
3. Baixar o **Apple WWDR** (intermediário) em PEM.
4. Render: `APPLE_PASS_TYPE_ID`, `APPLE_TEAM_ID`,
   `APPLE_PASS_P12` (base64 do .p12), `APPLE_PASS_P12_PASSWORD`, `APPLE_WWDR_PEM`.

### 3. Dados do Encarregado (DPO) nos Termos
`src/lib/terms.ts` → constante `DPO`. Hoje está com
`privacidade@fixly.company` e um nome genérico. **A LGPD (art. 41) pede pessoa
identificável e canal que responda** — trocar pelo nome e e-mail reais.

## 🔴 PENDÊNCIA REGISTRADA — Apple Pay e Google Pay (próxima atualização)

**Não é configuração: o Mercado Pago não oferece esses meios no Brasil.** O
Payment Brick deles aceita cartão, cartão de débito virtual Caixa, Pix, boleto,
pagamento em lotérica, Carteira Mercado Pago e parcelamento sem cartão —
`google_pay` e `apple_pay` não existem na lista. Conferido na documentação
oficial do Payment Brick em 13/08/2026.

Para entregar as duas carteiras é preciso um **segundo gateway** (Stripe, Adyen,
Braintree ou Pagar.me são os que suportam no Brasil), convivendo com o MP:
- Apple Pay exige domínio validado na Apple (o Stripe automatiza) e conta com
  CNPJ;
- o escrow, o estorno e o webhook passam a ter dois caminhos — é o trabalho
  real dessa história, não o botão.

**Decisão do dono (13/08/2026):** fica para a próxima atualização; agora entram
o Pix real e os cartões salvos.

## 💳 Como virar o Mercado Pago para PRODUÇÃO (é o que conserta o QR)

O código está certo — `scripts/check-mp.mjs` confirma token válido, Pix e cartão
ativos. O QR é recusado pelo banco porque a credencial é `TEST-`.

1. **Mercado Pago → Seus negócios → Configurações → Gestão e administração →
   Credenciais → Credenciais de produção**, na aplicação **Sistema-Fixly**.
   (Se pedir, complete o cadastro do negócio: ramo, site `https://fixly.company`.)
2. Copie **Public Key** (`APP_USR-…`) e **Access Token** (`APP_USR-…`).
3. Ainda na aplicação, aba **Webhooks → Modo produção**: URL
   `https://fixly.company/api/pagamentos/webhook`, evento **Pagamentos**, e
   copie a **assinatura secreta** (ela é DIFERENTE da de teste).
4. **Render → serviço `fixly-web` → Environment**, troque as três:
   `MP_ACCESS_TOKEN`, `NEXT_PUBLIC_MP_PUBLIC_KEY`, `MP_WEBHOOK_SECRET`.
   Salvar já dispara um deploy. ⚠️ O serviço `fixly-admin` **não** recebe
   credencial de pagamento — é de propósito.
5. Conferir: `node --env-file=.env.local scripts/check-mp.mjs --url https://fixly.company`
   (com as mesmas credenciais no `.env.local`) tem que dizer **ambiente
   PRODUÇÃO** e aceitar a assinatura do webhook.
6. Fazer **um serviço real de R$ 1,00** ponta a ponta: Pix pago pelo app do
   banco → o serviço tem que sair de "aguardando pagamento" sozinho (webhook).

⚠️ **Antes do passo 1, decidir a conta.** A que está ligada hoje é PESSOAL, no
CPF do Matheus (`NECKELMATHEUS20220502082512`). Em produção todo o dinheiro —
inclusive a parte do prestador — entra nela. Trocar depois obriga a refazer
aplicação, credenciais e webhook.

## O que testar na tela (nesta ordem)
1. **Pedido novo** (contratante): CEP → digitar o número → o pino tem que pular
   para a casa; arrastar o pino e enviar.
2. **Prestador**: o pedido aparece com **bairro + círculo de ~1 km**, sem rua e
   sem número. Mandar proposta.
3. **Contratante**: contra-proposta → **prestador responde com outro valor** →
   contratante aceita → só então o endereço completo aparece para o prestador.
4. **Chat**: pedir conversa de um lado, aceitar do outro, escrever um telefone
   (tem que virar `[contato oculto]`).
4b. **Cartão salvo**: pagar com cartão marcando "salvar"; na contratação
   seguinte o cartão aparece na lista e só pede o CVV. Remover pelo ícone de
   lixeira. (Em teste, use os cartões de teste do MP — APRO aprova.)
5. **Profiler**: "Solicitar serviço" em `/p/<handle>` → o pedido vai só para ele
   e agora dá para negociar.
6. **E-mails**: aprovar um cadastro no painel (chega com o e-mail de acesso), e
   conferir os avisos de proposta/contra-proposta/mensagem.

## Pendências que continuam abertas (não são desta leva)
Liberação automática do escrow, validação da chave PIX, conta MP no CNPJ,
limpeza dos 14 pagamentos simulados, virar o MP para produção e trancar o painel
por IP — detalhe no bloco do v11 logo abaixo. Da parte 7 ficou de fora, por
combinação: **empreiteiros** (404 do perfil público, assinatura sem pagamento,
planos mensal/anual, foto da empresa) e o **telefone/WhatsApp que o anúncio de
empreiteiro publica** (é um anúncio pago — o dono decide se sai).

---

# 📍 Ponto de parada anterior — 12/08/2026 (v11)

**Tudo o que estava pendente foi publicado.** `main` = `51427b9`, árvore limpa,
nada esperando push. Os dois ambientes estão no ar e verificados por `curl`.

| Ambiente | Domínio | Serviço Render | `APP_ROLE` | Estado |
|---|---|---|---|---|
| Produto | https://fixly.company | `fixly-web` | `site` | ✅ no ar · `/admin` → 404 |
| Painel | https://fixly.fun | `fixly-admin` | `admin` | ✅ no ar · `/app/*`, `/cadastro`, `/p/`, `/e/`, `/api/pagamentos` → 404 |

**Mercado Pago: ambiente de TESTE nos dois.** Credenciais `TEST-` no Render do
site. Nenhum dinheiro real se move ainda.

**Migrações aplicadas no banco: 0001–0025.**

---

## O QUE FAZER NA PRÓXIMA SESSÃO (em ordem)

### 1. 🔴 Confirmar que o `strip-admin` rodou no build do site
É a única coisa desta leva que **não dá para verificar de fora**. No Render →
`fixly-web` → **Logs** do último deploy, procure a linha:
```
[strip-admin] removido: src/app/admin
```
Se ela **não** estiver lá, o Build Command não foi salvo — corrija para
`node scripts/strip-admin.mjs && npm ci && npm run build` e faça Manual Deploy.
Sem isso o `fixly.company` continua compilando as 17 server actions do painel
(protegidas por `assertAdmin()`, mas presentes).

### 2. Testar o pagamento na tela (credencial de TESTE)
Nunca foi feito ponta a ponta pelo dono:
- **Selo Fix:** `contratante@fixly.com.br`/`fixly1234` → pedir → aceitar →
  "Seguir sem pagamento" → concluir → aprovar. Conferir que **Admin → Vendas**
  ignora o serviço e a carteira do prestador não muda.
- **Cartão de teste:** titular `APRO` aprova, `OTHE` recusa. Conferir os **dois
  preços** (Pix e cartão com acréscimo) e que o prestador recebe igual nos dois.
- **Webhook:** no painel do MP, "simular notificação" → 200.

> ⚠️ **Pix em modo teste não é pagável pelo app do banco** — credencial `TEST-`
> só aceita conta de teste do MP.

### 3. Limpar os pagamentos simulados (precisa do ok do dono — apaga histórico)
Existem **14 pagamentos de mock somando R$ 17.103** no banco. Quando o dinheiro
virar real eles poluem `Admin → Vendas` e a carteira dos prestadores.

### 4. Virar o Mercado Pago para produção
Passo a passo na seção 5 do `docs/09`. Trocar as 3 variáveis no Render do site
para `APP_USR-` + a assinatura secreta da aba **Modo de produção**, e fazer um
serviço real de R$ 1,00.

### 5. 🔴 Liberação automática do escrow (dinheiro pode ficar preso para sempre)
**Não existe** aprovação automática. Se o contratante não clicar em "aprovar",
o valor fica `retido` indefinidamente — o prestador trabalhou e não recebe.
Sugerido: liberar sozinho **7 dias** depois de o prestador marcar
`provider_done_at`, com aviso por e-mail no 5º dia. É uma coluna de prazo + um
job diário. É a pendência mais séria do fluxo de pagamento.

### 6. Validar a chave PIX do prestador
O saque usa **só** `profiles_private.pix_key` — banco, agência e conta são
coletados no cadastro e **nunca usados**. Hoje nada valida a chave: nem formato,
nem se o titular é a pessoa do cadastro. Há lixo salvo em produção
(`bank_name` = "321231", "xz\x"), o que mostra que o formulário aceita qualquer
coisa. Correção barata: validar o formato e aceitar por padrão só a chave que
seja o **CPF do próprio cadastro**.

### 7. A conta do Mercado Pago é PESSOAL (CPF), não da Fixly
A conta que recebe é `NECKELMATHEUS20220502082512` /
`matheusneckel@hotmail.com`, tipo **normal**, documento **CPF**, com nome
fantasia "Caminhos da Virtude" de outro negócio. Em produção, todo o valor —
inclusive a parte do prestador — entraria no CPF do dono. **Resolver antes de
virar o dinheiro real**: conta empresa no CNPJ da Fixly, e refazer aplicação,
credenciais e webhook a partir dela.

### 8. Trancar o painel por IP (recomendado, agora é barato)
`fixly-admin` → Settings → Access Control → só a faixa da empresa. Nenhum
cliente é afetado, porque eles não passam por esse serviço.

---

## O QUE FOI FEITO NESTA LEVA (30/07 a 12/08)

### Pagamento (v9)
- **Estudo de 8 gateways** (`docs/08`): o ticket do Fixly (R$ 68–252) é o que
  decide — tarifa fixa mata ticket baixo, e o MP ganha no Pix até ~R$ 160.
- `GATEWAY_FEE_RATES.cartao` **3,79% → 4,98%** (a tarifa real do MP).
- **Tarifa do cartão virou acréscimo ao contratante**
  (`chargedTotal = valor/(1-taxa)`, **não** `valor*(1+taxa)`). O prestador passa
  a receber o mesmo nos dois meios e o custo da Fixly no cartão vai a zero.
- `scripts/check-mp.mjs` — diagnóstico do MP sem imprimir credencial. Detecta a
  troca Public Key × Access Token, que devolve um `403` do MP sem explicação.

### Selo Fix (migração 0023)
Conta com selo roda o fluxo inteiro sem gateway. Pular o pagamento **exige selo
nos dois lados**; se o prestador que aceitou for conta real, a cobrança entra em
vigor. Isolamento assimétrico no `dispatch_request`. **Não grava em `payments`**
— é isso que mantém carteira e faturamento limpos. Selo em 8 das 9 contas: **só
o Arthur ficou sem**; conta nova nasce sem.

### Prestador (0024/0025)
- **Cancelar trabalho aceito** (`cancelJobAsProvider`): sem pagamento volta para
  a fila; **com** pagamento estorna o contratante antes de mexer no banco.
- **Pedidos em tempo real** (`service_requests` na publicação do Realtime).
- `0025` consertou uma **regressão minha**: a `0023` reescreveu
  `dispatch_request` a partir da `0004` e voltou a criar proposta automática.

### Separação de ambientes (v10/v11)
`APP_ROLE` decide o papel; `src/proxy.ts` responde **404** (não 403) para a rota
do outro lado; login cruzado encerra a sessão; painel com tela própria (fundo
escuro, cartão de vidro — arquitetura copiada do login do **Estradão**);
`strip-admin.mjs` tira o painel do build público. Detalhes em `docs/10`.

---

## Histórico — ponto de parada de 30/07/2026 (já resolvido)

**Base:** último commit `86e0a6c` ("docs: handoff da sessao v7"). Tudo o que veio
depois está **só no working tree**: **30 arquivos novos + 49 modificados + 1
apagado**.

Arquivos novos, por assunto:
| Assunto | Arquivos |
|---|---|
| Verificação por e-mail | `lib/otp.ts`, `lib/verifiedEmail.ts`, `components/auth/CodeInput.tsx`, `components/auth/ResetPasswordFlow.tsx`, `app/recuperar-senha/`, `app/app/senha.actions.ts`, `components/shell/ChangePassword.tsx` |
| Busca inteligente | `lib/serviceSearch.ts`, `app/app/contratante/search.actions.ts` |
| Pagamento | `components/contratante/CardForm.tsx`, `PixPanel.tsx`, `app/api/pagamentos/*`, `lib/signedState.ts`, `app/admin/saques/`, `components/admin/SaquesTable.tsx`, `components/prestador/Carteira.tsx`, `app/app/prestador/ganhos/actions.ts` |
| Prestador / UI | `components/prestador/JobSwitcher.tsx`, `components/ui/AutoRefresh.tsx`, `components/map/ServiceAreaMap.tsx` |
| Login / marca | `lib/session.ts`, `src/app/icon.png`, `apple-icon.png`, `favicon.ico` (M), `public/fixly-icon.png` |
| Banco | `supabase/migrations/0022_melhoras_p6.sql` (**já aplicada no banco**) |
| Scripts | `scripts/apply-migration.mjs`, `scripts/check-email.mjs`, `scripts/check-mp.mjs` |
| Docs | `docs/07-configuracao-servicos.md`, `docs/08-estudo-meios-de-pagamento.md` |

Apagado: `components/contratante/OrcamentoFlow.tsx` (Orçamento foi fundido com
Reformas no `SolicitarFlow`).

### O que foi VERIFICADO nesta sessão (não é suposição)
- **Migração 0022 aplicada e conferida** no banco real (tabelas, colunas, RPCs, RLS).
- **Guards testados via SQL** simulando usuário autenticado: prestador não conclui
  nem se auto-avalia; contratante conclui; `accept_proposal` recusa com
  contra-proposta pendente e usa o preço certo.
- **Busca:** 31/31 casos do documento do dono passando.
- **E-mail:** enviado de verdade e **entregue** (`delivered` no log da Brevo).
- **Login:** "Ficar conectado" testado no Chrome — marcado = cookie até 2027;
  desmarcado = cookie de sessão; logout limpa e volta a pedir senha.
- **Mapa da área:** círculo ao vivo, slider abaixo, tela cheia 1100×824, sem erro JS.
- `tsc --noEmit` e `npm run build` limpos.

### O que NÃO foi feito
- **Commit e push** (o dono não autorizou).
- Mercado Pago em produção — segue **mock** (faltam as credenciais).
- DMARC do `fixly.company`: o DNS está certo, mas a Brevo ainda mostrava aviso por
  **cache dela** (TTL 1h). Não é bloqueio; não reeditar o registro.
- Domínio `fixly.company` na Brevo ainda `autenticado: false` (DNS propagando).
  **Não impede o envio** — o remetente já está ativo.

### Estado da máquina local
- `.env.local` está com a **`BREVO_API_KEY` real** preenchida (gitignored).
- `EMAIL_DEV_CODES=1` continua no `.env.local`, porém **inerte**: com provedor
  configurado, `showDevCode()` retorna false. 🔴 Conferir que essa variável **não**
  existe no Render.
- O `npm run dev` ficou rodando na porta 3000.

---

## v9 (2026-07-30): Selo Fix + pagamento com taxa real

- **Migração 0023 aplicada e conferida** no banco real: `profiles.fix_badge`,
  `service_requests.no_charge`, guard do selo e `dispatch_request` com isolamento
  assimétrico. **8 das 9 contas ficaram com selo — o Arthur não.**
- **Selo Fix:** conta com selo roda o fluxo inteiro sem gateway. Regra: pular o
  pagamento exige **selo nos dois lados**; se o prestador que aceitou for conta
  real, a cobrança entra em vigor. Chave em `Admin → Usuários`, botão "Seguir sem
  pagamento" na tela do serviço, tarja nos dois lados. **Não grava em `payments`**
  — é isso que mantém carteira e faturamento limpos.
- **Taxas corrigidas:** cartão 3,79% → **4,98%** (a tarifa real do MP) e a tarifa
  do cartão virou **acréscimo ao contratante** (`chargedTotal = valor/(1-taxa)`).
  O prestador passa a receber **o mesmo nos dois meios**; o custo da Fixly no
  cartão vai a zero. Estudo completo em `docs/08`, plano em `docs/09`.
- **`scripts/check-mp.mjs`:** diagnóstico do Mercado Pago (token válido? teste ou
  produção? public key do mesmo bloco? Pix e cartão ativos? webhook aceitando a
  assinatura?). Detecta a troca Public Key × Access Token, que é o erro nº 1 e
  devolve um `403` do MP que não explica nada.

## v9.1 (2026-07-31): cancelamento do prestador + pedidos em tempo real

- **Prestador pode desistir** (`cancelJobAsProvider`). O desfecho é decidido no
  servidor pelo estado do pagamento: proposta ainda não escolhida → retira a
  proposta; escolhido e **não pago** → o pedido **volta para a fila**
  (`provider_id=null`, `buscando`); escolhido e **pago** → **estorna o
  contratante** e cancela. O estorno vem ANTES de mexer no banco.
  Antes disso o botão "Recusar" só existia no status `aceito` e fazia um update
  direto para `cancelado` — matava o pedido do cliente e deixava o dinheiro preso.
- **Tempo real** (migração 0024): o quadro do prestador assina `postgres_changes`
  em `service_requests`. Pedido novo aparece na hora; o `AutoRefresh` de 15 s
  continua como rede de segurança.
- **Isolamento do Selo Fix na lista do prestador** — faltava. A RPC
  `dispatch_request` já filtrava, mas a lista "Pedidos disponíveis" é uma query
  separada e mostrava tudo.
- ⚠️ **Dado de teste corrigido:** João Mendes e Ana Paula Lima estavam com
  coordenadas de **São Paulo** (seed) — 337 km do dono. Nenhum pedido de
  Encanador em Curitiba alcançava ninguém, e parecia bug de dispatch. Foram
  movidos para Pinhais e Curitiba. **Robson continua com raio de 10 km e fica a
  11,6 km** do endereço de teste do dono — se ele precisar entrar nos testes, é
  o raio dele que precisa aumentar, na tela do próprio prestador.

## Estado atual (2026-08-12)
- **Migrações aplicadas:** 0001–**0025**.
- Builda limpo (`tsc --noEmit` + `npm run build`).
- ⚠️ **`npm run db:apply` continua QUEBRADO** (falha no 0004 por dado do 0008).
  Para migração nova use `scripts/apply-migration.mjs <arquivo>` (um arquivo, em
  transação própria).

### ✅ E-mail: RESOLVIDO (Brevo)
Funcionando e testado ponta a ponta em 30/07/2026 — código entregue
(`requests` → `delivered` no log da Brevo). Provedor: **Brevo** (mesma conta da
DVN), remetente `nao-responda@fixly.company`, variáveis já no Render.
- Diagnóstico: `node --env-file=.env.local scripts/check-email.mjs [email]`
- O que libera o envio é o **remetente ativo**, não o domínio autenticado.
- Detalhes e armadilhas de DNS: `07-configuracao-servicos.md`.
- 🔴 Se `EMAIL_DEV_CODES` existir no Render, **apagar** (vazaria o código na tela).

### 🔴 O QUE FALTA CONFIGURAR (depende do dono — Matheus)
1. **Mercado Pago** (`MP_ACCESS_TOKEN`, `NEXT_PUBLIC_MP_PUBLIC_KEY`,
   `MP_WEBHOOK_SECRET`). Sem elas o pagamento roda **simulado** (mock): a UI toda
   funciona, mas não entra dinheiro. Ver `07-configuracao-servicos.md`.
2. **Decisão de taxas** (ver `08-estudo-meios-de-pagamento.md`): repassar a tarifa
   do cartão ao contratante e parcelar só com juros. E corrigir
   `GATEWAY_FEE_RATES.cartao` (está 3,79%, o MP cobra 4,98% na hora).

## Como começar uma nova sessão (checklist)
1. Ler `docs/README.md` + `docs/03-arquitetura-e-armadilhas.md` + esta seção.
2. `cd sistema-web` e conferir que builda: `npx tsc --noEmit && npm run build`.
3. `git log --oneline | head` para o último estado.
4. Migração nova → `scripts/apply-migration.mjs` (nunca o `db:apply` completo).
5. Ao terminar: `tsc` + `build` + commit + `git push origin main` (Render publica).
   **Depois do push, VERIFICAR que subiu de verdade** (curl no HTML servido +
   grep por um marcador da mudança) e avisar o dono pra dar **hard-refresh**
   (o navegador dele costuma servir cache). Atualizar estes docs.

## Próxima leva sugerida
- **Notificações in-app** (sino/badge): o dono pede desde a parte 4. O
  `AutoRefresh` já resolveu o "preciso dar F5", mas falta o aviso ativo
  (nova proposta, contra-proposta, prestador concluiu, pagamento liberado).
  E-mail dessas notificações fica fácil agora que o Resend está modelado.
- **Assinatura recorrente do Empreiteiro:** hoje "Ativar assinatura" é simulada.
  Com o MP configurado, virar `preapproval` (assinatura recorrente).
- **Saque automático:** hoje `Admin → Saques` é fila manual (paga o PIX e marca).
  Automatizar depende de a conta do MP ter API de transferência liberada.
- **Renovar token OAuth do split:** o token do prestador vale ~6 meses.
  `oauthRefresh()` está pronto em `lib/mercadopago.ts`, falta um job que rode.
- **Reenvio de documentos** após reprovação (fluxo do cadastro).
- **Online/offline** do prestador: o toggle ainda é cosmético (não persiste).
- **Léxico da busca:** `lib/serviceSearch.ts` é o lugar de corrigir uma busca que
  o dono achar errada — é só ajustar peso/termo, sem tocar em mais nada. Vale
  guardar as buscas reais dos clientes para alimentar o léxico.

## Adiado pelo dono
- **Laudos:** exigirão **certificado de técnico**. O dono vai estudar e escrever a regra.
- **Números de taxa:** `ADVANCE_FEE_RATE = 0.08`, teto 50%, `PLATFORM_FEE_RATE = 0.15`,
  `GATEWAY_FEE_RATES` e `SETTLEMENT_DAYS` (Pix D+1, cartão D+2) estão em
  `lib/pricing.ts`. **Conferir contra o contrato real do Mercado Pago** quando sair.

## Ideias maiores do plano original (ainda não iniciadas)
Do PDF "Serviços e diferenciais": **Fixly Condomínios** (B2B síndicos),
**Agenda Inteligente com IA** (rota/cronograma), e IA nos orçamentos.
(O roteamento de categoria **já virou** um motor de busca de verdade em
`lib/serviceSearch.ts` — v8.)

## Armadilhas recorrentes (ler antes de repetir erro)
- **db:apply quebrado no 0004** → `scripts/apply-migration.mjs`.
- **Deploy + cache:** depois do push, o dono quase sempre vê a versão **antiga**
  (cache do navegador) OU o deploy ainda está rodando. Sempre confirmar no HTML
  servido (curl+grep de um marcador) antes de dizer "está corrigido", e pedir
  hard-refresh/aba privada.
- **RLS é por linha, não por coluna** → integridade de coluna via trigger
  (`guard_request_changes`, `guard_profile_changes`).
- **Enums:** não usar `ALTER TYPE ADD VALUE`; para novos estados use coluna
  (foi por isso que "prestador concluiu" virou `provider_done_at`, e não um
  status novo).
- **Categorias ocultas:** filtrar `.eq("hidden", false)` em TODA query de catálogo,
  **e** garantir que a busca não devolva slug oculto (`REDIRECT` no `serviceSearch`).
- **Ícone comprimido:** em `flex`, um SVG sem `shrink-0` ao lado de texto longo é
  esmagado a zero — foi o que "apagou" o ícone da Impermeabilização.
- **`text-align` do `<button>`:** o UA centraliza. Sem `text-left`, item de grade
  com nome de 2 linhas fica centralizado e desalinhado dos de 1 linha.
- **cwd reseta** para `/Users/matheusneckel/Projetos` — sempre `cd sistema-web`.
- **Tabelas server-only:** `email_codes` e `provider_gateway_accounts` têm RLS
  ligado e **zero policies** de propósito. Só a service_role acessa. Não "conserte"
  isso adicionando policy.

## Contas de teste
| Papel | Login | Senha |
|---|---|---|
| Admin | `matheus@dvn.com.br` | `1234` |
| Contratante | `contratante@fixly.com.br` | `fixly1234` |
| Prestador | `prestador@fixly.com.br` | `fixly1234` |

Fluxo ponta a ponta rápido: **Admin → Testes** (link mágico + "Forçar etapa").
Handles públicos de teste: `/p/carlos.eletricista`, `/p/ana.eletrica`,
`/p/joao.encanador`, `/e/oliveira.construcoes`.

> **Cadastro novo em ambiente de teste:** como agora exige código por e-mail,
> ou configure o Resend, ou rode com `EMAIL_DEV_CODES=1`.
