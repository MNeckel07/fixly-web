# 06 — Próximos passos e instruções para a próxima sessão

# 📍 PONTO DE PARADA — 12/08/2026 (parte 7)

A leva "parte 7" está **escrita, compilando e ensaiada no banco**, mas ainda
**NÃO publicada**: falta aplicar a migração `0026` e dar push. As duas coisas
andam juntas — ver [[feedback_migracao_antes_do_deploy]].

```bash
# 1) aplicar (a 0026 já passou no ensaio com rollback)
node --env-file=.env.local scripts/apply-migration.mjs 0026_melhoras_p7.sql
# 2) publicar
git push origin main
# 3) conferir que subiu (curl + grep de um marcador) e pedir hard-refresh ao dono
```

**O que a 0026 muda em produção no instante em que roda** (por isso ela é do
tipo que NÃO pode ficar esperando o deploy):
- `service_requests.address/lat/lng` viram **aproximados** para todos os pedidos
  que já existem. Com o código antigo no ar, o contratante veria a região no
  lugar do endereço completo (degrada, não quebra).
- `prop_update` vira admin-only: o código antigo faz `update` direto em
  `proposals` para contra-propor → **a contra-proposta pararia de funcionar até
  o push**.

**Ensaios que já rodaram** (`scripts/dry-run-migration.mjs`, tudo com rollback):
- migração aplica limpa sobre os dados reais (55 pedidos migrados);
- RLS provada com JWT falso: prestador **candidato** lê 0 linhas de
  `service_request_locations`; **designado depois do aceite** lê 1; o contratante
  dono lê os dois pedidos dele;
- negociação ponta a ponta: proposta → contra-proposta do contratante →
  contra-proposta **do prestador** → aceite → serviço fechado, com os bloqueios
  certos (contrapor 2× seguidas e aceitar com negociação aberta dão erro);
- chat: pedido fica `pendente`, mensagem é **barrada pela RLS** até o outro lado
  aceitar, e depois do aceite continua a MESMA conversa;
- máscara de contato: telefone e e-mail viram `[contato oculto]`; "350 reais" fica.

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
