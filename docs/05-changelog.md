# 05 — Changelog (grandes marcos)

Ordem cronológica das grandes entregas. Detalhe fino está no `git log`.

## v15 — A landing virou a raiz de fixly.company

Quem acessa `fixly.company` agora cai na **landing**, e qualquer botão de ação
leva ao sistema no mesmo domínio (`/cadastro/contratante`, `/cadastro/prestador`,
`/login`). Nada de subdomínio, nada de segundo serviço.

**Por que a landing se mudou, e não o app.** O caminho natural seria o oposto —
landing na raiz, app em `app.fixly.company`. Isso **quebraria dinheiro em
silêncio**: a migração 0032 tem `https://fixly.company/api/cron/escrow` escrito
em SQL dentro do `pg_cron`, e o webhook do Mercado Pago aponta para o mesmo
domínio. A liberação automática do escrow simplesmente pararia, sem erro
visível. Servir os dois de serviços separados no Render também foi descartado: o
plano gratuito hiberna, e a página que mais precisa ser rápida viraria a mais
lenta do site.

**Como os dois designs convivem.** `src/app/(site)` e `src/app/(app)` são
**root layouts separados**, cada um com suas fontes e seu CSS. Sem isso a base
da landing (títulos em Bricolage, `--radius-*` do shadcn, `border-border`
global) reescreveria o visual do app inteiro — `rounded-xl` sairia de 12 px para
~17 px em todas as telas. Conferido no navegador: folhas de estilo diferentes,
`rounded-xl` = 12 px no app, Poppins nos títulos do app e Bricolage nos da
landing.

**O que a separação original deixou de bom:** a costura de `lib/site.ts`
funcionou como prometido — a junção custou **três linhas** (as URLs viraram
relativas) e **nenhum componente da página foi tocado**.

**Ajustes que a mudança exigiu:**
- `scripts/strip-admin.mjs` apontava para `src/app/admin`, que virou
  `src/app/(app)/admin`. Um caminho errado ali é silencioso e perigoso (o build
  passa e o painel vai junto para o site público), então o script ganhou **falha
  fechada**: se não remover todos os alvos, aborta o build.
- Os imports de server action passaram a carregar o group
  (`@/app/(app)/app/contratante/pay.actions`) — 31 arquivos.
- `robots.ts` teve de ficar **fora** do group (dentro dele o Next não gera a
  rota, sem avisar) e passou a responder `disallow: /` no domínio do painel.
- A pasta `Fixly/landing` virou arquivo, com `LEIA-ME-PRIMEIRO.md` explicando.

## v14 — Rodada de testes "Fixly 11" (migração 0036)

Entrega do PDF *Fixly 11* (teste de usuário feito pela equipe). A comparação
sintoma → causa importa mais que a lista: **dois relatos diferentes eram o mesmo
bug, e um terceiro não era nada do que parecia.**

**Bugs, com a causa achada:**

- **"Não dá para cancelar o pedido" + "erro ao editar o pedido"**, os dois com
  `Minified React error #441` escrito na tela. Não era do cancelamento nem da
  edição: `app/app/report.actions.ts` (arquivo `"use server"`) exportava uma
  **constante** (`MOTIVOS`). Um módulo de server actions só pode exportar
  funções async, e o Next junta as ações de toda a página num módulo só — o
  erro derrubava `cancelService`, `updateRequest`, `processPayment`,
  `approveService`, tudo junto. O `#441` é o genérico do React para "a action
  explodiu"; a mensagem de verdade (`A "use server" file can only export async
  functions, found object`) **só aparece rodando em dev**. A lista foi para
  `lib/reports.ts` e existe uma varredura preventiva no `docs/03`.

- **"O perfil do Robson… não aparece os serviços que solicito para ele."** O
  Robson tem o Selo Fixly — e **todo prestador com selo via "0 pedidos na sua
  região", sempre**. O filtro de pareamento de contas (0023) lia o `fix_badge`
  do cliente por um `join`, e a RLS de `profiles` não deixa um prestador ler o
  perfil de um contratante: o join voltava nulo e
  `profile.fix_badge && !cliente?.fix_badge` dava `true` para todo pedido. Agora
  o `fix_badge` do cliente é lido com a chave de servidor, só para o filtro.

- **"Só consigo puxar a alvenaria" no pedido direto.** O link do Profiler leva a
  categoria **principal** no `?cat=`, e isso pulava a escolha. Com profissional
  escolhido, o `?cat=` virou atalho, não trava: a tela abre a lista dos serviços
  dele (todos os 27, no caso do Robson — o `CategoryPicker` também escondia os
  não-`featured` atrás de "Ver todos").

- **"Arrasto o ponto e ele não muda o endereço."** O pino só mudava a
  COORDENADA. Agora o ponto novo é traduzido de volta em endereço
  (reverse geocode) e escrito nos campos. O risco real não era a tela feia: era
  o pedido sair com a rua de um lugar e a coordenada de outro.

- **"Os valores todos zeraram" (R$ 0,00 na lista).** Enquanto ninguém é
  escolhido, quem tem preço é a **proposta**, não o pedido. A lista lia
  `final_price ?? estimated_price ?? 0`. Agora puxa a menor proposta viva
  ("a partir de R$ X") e, sem nenhuma, escreve "aguardando propostas" — preço
  que ainda não existe não é R$ 0,00.

**O que entrou de novo:**

- **Frete / taxa de deslocamento** na proposta, guardado **separado** do preço
  (`proposals.travel_fee`). Não é capricho de modelagem: a política de
  cancelamento manda reter "o valor da taxa de deslocamento" (itens 3.3 e 5.1) —
  somado ao preço, não haveria como saber quanto era.
- **Negociação com fim** (`lib/negotiation.ts` + `counter_proposal`): 4 valores
  no máximo, alternando contratante → profissional, **dois blocos**, e o último
  valor é sempre do profissional. "Alterar" a proposta zera as rodadas (senão
  seria a porta dos fundos do limite).
- **Filtro das propostas** por Selo Fixly e por quantidade de serviços.
- **"Propostas recebidas (X)"** na lista quando há mais de uma.
- **Contestar avaliação abaixo de 3 estrelas** (`dispute_review`): o
  profissional alega, o suporte decide em Admin → Denúncias. Acolher **esconde**
  a avaliação da média e do perfil (`review_hidden`); **nunca** reescreve a nota.
- **Política de cancelamento aplicada de verdade** (`lib/cancellation.ts`): 30%
  depois do aceite, 50% (ou o frete, o que for maior) depois do deslocamento,
  frete no no-show do cliente, reembolso integral no no-show do profissional, e
  **apuração** — sem número automático — com a execução já iniciada. O estorno no
  gateway virou **parcial**. A caixa de cancelamento mostra a conta e a cláusula
  **antes** de confirmar.

**Provas:** `scripts/checks/politica-cancelamento.test.ts` (13 casos, sem banco)
e `scripts/checks/0036_negociacao_e_contestacao.sql` (10 casos, no banco real com
rollback).

## v13 — Melhoras "parte 10" (migrações 0029/0030)

Entrega do PDF *Fixly 10* + os quatro pedidos avulsos do dono (animação do
Render, Google Pay, chave PIX e editar o pedido).

**Bugs, com a causa achada — não só o sintoma:**
- **Foto de perfil dava "new row violates row-level security policy"** (0029).
  O upload usa `upsert: true` e, nesse modo, o Storage precisa **enxergar** se o
  objeto já existe; `avatars` e `portfolio` tinham insert/update/delete e
  **nenhuma policy de select**. Era por isso que o portfólio (que sobe sem
  upsert) nunca falhava — o que despistava o diagnóstico.
- **Cancelar/pagar girando para sempre:** as ações não tinham `try/finally`,
  então um erro do servidor rejeitava a promessa e o `setBusy(false)` nunca
  rodava. Agora toda ação tem `finally` e mostra a mensagem real do erro.
- **Ganhos do mês em R$ 0,00 com 3 serviços:** a conta filtrava pelo
  `created_at` do PEDIDO. Serviço criado em julho e aprovado em agosto não caía
  em mês nenhum. Passou a valer `payments.released_at`, e o rótulo diz o mês.
- **Admin → Serviços mostrava "—":** a coluna só olhava `estimated_price`; agora
  usa valor pago > `final_price` > estimativa.
- **"2 prestadores não veem meus pedidos" NÃO era bug:** é o Selo Fix (0023) —
  prestador COM selo não enxerga pedido de cliente SEM selo, e a conta de teste
  do dono está sem selo. O que faltava era **aviso**: o `dispatch_request` já
  devolvia o alcance e o número era jogado fora. Agora alcance zero aparece na
  tela, em vez de deixar o cliente esperando proposta que não vem.

**Novidades:**
- **Máscaras automáticas** (`lib/format.ts`): CPF, CNPJ, telefone, CEP, cartão e
  validade, no cadastro, no perfil, no cartão e no empreiteiro. O banco continua
  recebendo **só dígitos** — a máscara é da tela, nunca do dado.
- **Chave PIX com botão "Configurar"**: escolhe o tipo (CPF, CNPJ, celular,
  e-mail ou aleatória) e o campo passa a formatar e validar conforme o tipo.
- **Editar o pedido depois de enviado** (ícone de lápis), enquanto ninguém
  aceitou. O endereço passa pela RPC `update_request_location` (0030): desde a
  0026 o exato mora em `service_request_locations` e o pedido guarda a versão
  embaralhada — gravar direto pela tela vazaria a rua para os prestadores.
- **EXPRESS = urgente**, com aviso nas duas pontas: o profissional lê "só
  proponha se puder ir agora"; o cliente lê "ao aceitar, ele sai agora para sua
  casa". **Sem taxa extra** — decisão do dono: quem precifica a urgência é o
  profissional, no valor da proposta.
- **Notificação de mensagem** no menu (Trabalho/Serviços e Suporte) e **por
  serviço** na lista, para saber DE QUAL deles é a mensagem.
- **Resposta do suporte avisa por e-mail** quem abriu o chamado. O selo vermelho
  só serve para quem está com o site aberto — e chamado de suporte é justamente
  o caso em que a pessoa fecha a aba e vai esperar. ⚠️ O link do e-mail usa
  `siteUrl()`, não `NEXT_PUBLIC_APP_URL`: quem responde é o admin, e no serviço
  `fixly-admin` essa variável aponta para o PAINEL — o link sairia para
  `fixly.fun/app/...`, que responde 404 de propósito.
- **Pedido direto pelo Profiler** deixa escolher entre TODOS os serviços daquele
  profissional (antes travava na categoria principal).
- Aba **"Sou empreiteiro"** no perfil do prestador.
- **Tela de carregamento com a marca** (`loading.tsx` + `BrandLoading`).
- **Apple Pay e Google Pay via STRIPE** (`lib/stripe.ts`). O Mercado Pago não
  oferece essas carteiras no Brasil e nem está na lista de gateways do Google
  Pay; pelo Stripe o Apple Pay **não** exige a conta de US$ 99. Pix e cartão
  continuam no MP. O servidor **reconfere a intenção no Stripe** antes de dar o
  serviço como pago — nada do que o navegador diz é aceito. Fica desligado
  enquanto `STRIPE_SECRET_KEY` não existir (botão que dá erro é pior que botão
  que não aparece).
- **`/api/health`** para o monitor externo que impede a hibernação no Render.

**A tela roxa do Render não dá para trocar por dentro.** É a página que a
*infraestrutura* do Render serve enquanto acorda um serviço do plano gratuito —
aparece **antes** do nosso código existir no ar. As duas saídas reais estão no
`docs/02`: plano Starter (US$ 7/mês, some de vez) ou monitor externo em
`/api/health` (escolha do dono; ⚠️ 750 h/mês na conta inteira → configurar com
janela de horário). O `BrandLoading` cobre a outra espera, a de navegação
dentro do app.

## v12.2 — Parte 8: selo com história, denúncias, cartão na carteira (migração 0028)

- **Selo Fixly ganho e perdido avisa por e-mail.** O selo saiu do "calculado na
  tela" e virou estado no banco (`profiles.seal_active` + `seal_events`), então
  existe o INSTANTE em que ele muda. E-mail nos dois sentidos: ganhar comemora,
  perder explica o motivo e o caminho de volta.
- **Revogação pela equipe** (Termos 9.1): fraude, manipulação de avaliações,
  dano grave, assédio/ameaça/discriminação e insistência em cobrar por fora
  derrubam o selo na hora, com motivo — que vai no e-mail do profissional.
- **Denúncias** (`reports`): botão discreto na tela do serviço (as duas pontas)
  e na hora de avaliar. **O denunciado não vê a denúncia** — sem isso o canal
  vira retaliação. Fila em **Admin → Denúncias**, com revogar/devolver o selo
  ali mesmo.
- **Cartão Fixly na carteira do celular:** Apple Wallet (.pkpass assinado) e
  Carteira do Google (JWT de "save link"), com o QR do perfil e o Selo. Os
  botões só aparecem quando as credenciais existem no servidor. O .pkpass é
  montado com um escritor de ZIP próprio (~60 linhas) para não arrastar
  biblioteca de compressão por causa de 4 arquivos.
- **Termos atualizados (v1.1):** natureza de facilitador e **isenção de
  garantias** (furto, roubo, danos materiais, vícios do serviço e lesões são do
  profissional, não do Fixly), regra do Selo e da revogação imediata, cláusula
  de denúncias e a seção do **Encarregado de Dados (DPO)** exigida pela LGPD.
- **Correção:** a caixa "Sair da conta?" nascia grudada no topo no
  fixly.company. Causa: o cabeçalho é `sticky ... backdrop-blur`, e
  `backdrop-filter` cria bloco de contenção — `position: fixed` passou a valer
  em relação ao cabeçalho. Agora o diálogo vai por **portal** no `document.body`.

## v12.1 — Cartões salvos + site sem cara de teste (migração 0027)

- **Cartões salvos.** Na segunda contratação o cartão já aparece na lista e o
  cliente só digita o **CVV**. O Fixly continua sem guardar cartão nenhum: quem
  guarda é o Mercado Pago, num `customer`; aqui fica só o id dele
  (`profiles_private.mp_customer_id`). Dá para remover o cartão na hora do
  pagamento. ⚠️ O token do MP é de **uso único** — a tela gera **dois** (um paga,
  o outro guarda); reaproveitar um só falha em silêncio.
  `mp_customer_env` marca em que ambiente o customer nasceu: ao virar as
  credenciais para produção, o id de teste é descartado sozinho.
- **Nenhuma mensagem de ambiente de teste nas telas do cliente.** O aviso do Pix
  em sandbox virou log do servidor, o Selo Fix virou "atendimento de cortesia" e
  o código por e-mail, quando o envio falha, diz isso — sem falar em "modo de
  teste".
- **Apple Pay e Google Pay:** registrados como pendência da próxima atualização.
  O Mercado Pago **não oferece** essas carteiras no Brasil (o Payment Brick vai
  até cartão, Pix, boleto, lotérica e Carteira MP) — entregar as duas exige um
  segundo gateway. Detalhe e caminho no `docs/06`.

## v12 — Melhoras "parte 7" (migração 0026)

**Privacidade de contato e de endereço, negociação de verdade e avisos por e-mail.**

- **Nenhum dado de contato entre usuários.** O cartão do perfil não mostra mais
  e-mail, telefone e CPF para contratante e prestador (para **admin não muda
  nada**). O único canal entre as pontas é o chat — e o chat **mascara**
  telefone e e-mail digitados, por trigger no banco (`mask_contact_info`), que
  o navegador não tem como burlar.
- **Endereço só depois do aceite.** O endereço exato saiu de `service_requests`
  e foi para `service_request_locations`, liberada pela RLS apenas ao
  contratante, ao profissional **designado** e ao admin. Enquanto o serviço não
  fecha, o prestador vê **bairro/cidade + um círculo de ~1 km** (`AreaMap`) e a
  distância aproximada. Provado por teste de RLS com JWT falso: prestador
  candidato = 0 linhas; depois do aceite = 1.
- **Alfinete no lugar certo.** `PinPicker` (pino arrastável, clique no mapa) e
  geocodificação **estruturada com o número da casa** (`geocodeAddress`), que é
  o que faz o ponto parar na porta em vez do meio da quadra. O GPS agora também
  preenche o número. Quando o número não existe no OSM, a tela **diz isso** e
  pede para arrastar o pino, em vez de fingir precisão.
- **Contra-proposta dos dois lados + chat da negociação.** O prestador pode
  responder à contra-proposta com outro valor (ida e volta até alguém aceitar).
  Qualquer um dos dois pode **pedir conversa**; o outro aceita, e esse mesmo
  chat segue até o fim do serviço (histórico único). Sem pedido, ele abre
  sozinho no aceite da proposta.
- 🔴 **Buraco fechado:** a policy de update em `proposals` deixava o contratante
  escrever qualquer coluna — inclusive `price`. Dava para baixar a proposta
  alheia para R$ 1 e aceitar. Agora a negociação inteira passa por RPC
  `security definer` e o update direto é admin-only.
- **Pedido direto pelo Profiler virou negociação.** Antes nascia `aceito`, sem
  proposta e sem como discutir valor. Agora nasce `buscando` com
  `target_provider_id`: só o escolhido enxerga, manda o preço, e vale
  contra-proposta e chat como em qualquer pedido.
- **E-mails de aviso:** conta aprovada (agora com o e-mail de acesso e link de
  login), proposta recebida, contra-proposta e mensagem no chat. `notification_log`
  evita repetição (mensagem, no máximo 1 a cada 15 min por conversa).
- **Foto de perfil** para contratante e prestador (`AvatarPicker` no cartão do
  perfil, bucket público `avatars`).
- **Taxa sem marca:** "Comissão Fixly (15%)" virou **"Taxa da plataforma (15%)"**
  nas telas de pagamento, extrato e carteira. Os 15% continuam visíveis.
- **Pix conferido:** o código está correto — o QR vem do próprio Mercado Pago
  (`point_of_interaction.transaction_data`). O "deu erro ao ler" é a credencial
  **de teste**: o BR Code aponta para uma conta de teste e o app do banco recusa.
  A tela do Pix agora **avisa isso** quando o token é `TEST-` (`isGatewaySandbox`).
- **Detalhes:** confirmação de "Sair" desceu um pouco; frase do cartão 70 → 60
  caracteres; `scripts/dry-run-migration.mjs` (ensaia a migração no banco real e
  dá rollback — foi como os testes acima rodaram sem sujar a produção).

## v8.2 — Área de atendimento no mapa + e-mail no ar
- **E-mail FUNCIONANDO** (Brevo). O que libera o envio é o **remetente ativo**,
  não o domínio autenticado: `fixly.company` seguia `autenticado: false` e o
  código chegou mesmo assim. Diagnóstico permanente em `scripts/check-email.mjs`
  (valida chave, remetente e mostra os últimos envios, sem imprimir a chave).
- **Fix de segurança:** `showDevCode` só checava `RESEND_API_KEY` — com a Brevo
  configurada, o código continuaria aparecendo **na tela** além de ir por e-mail.
  Agora usa `emailProvider()`, nos 3 fluxos (cadastro, recuperação, troca).
- **`sendEmail` falha alto** quando não há provedor (antes fingia sucesso e o
  usuário esperava um código que nunca chegava). Aviso de aprovação de cadastro
  virou `sendEmailBestEffort` — não pode derrubar uma ação já gravada no banco.
- **`ServiceAreaMap`:** o raio de atendimento saiu de cima e virou um mapa
  interativo — **círculo desenhado ao vivo** enquanto arrasta, reenquadre
  automático (dá para ler os bairros/cidades cobertos), área em km² e **tela
  cheia**. Vale no cadastro do prestador e no perfil dele.
  ⚠️ Ver armadilha 14 (className do Leaflet x React) — custou um mapa em branco.

## v8.1 — Tela de entrada e identidade
- **Favicon e ícones do app** gerados da marca (`src/app/favicon.ico`, `icon.png`,
  `apple-icon.png`) — símbolo recortado sobre quadrado branco arredondado, para
  ficar legível a 16px e em aba clara ou escura.
- **Proporção da marca:** o símbolo agora é **1,3× a fonte do nome** (`Logo`,
  `SYMBOL_RATIO`) — valia para todo o site de uma vez. As páginas públicas
  `/p` e `/e` passaram a usar o componente (antes só o texto "Fixly"), e o
  **cartão QR** ganhou o símbolo ao lado do nome.
- **Typewriter do login** virou uma barra de busca de verdade: mesma largura do
  título (`max-w-xl`, 564px medidos), 64px de altura e fonte `text-2xl`.
- **"Ficar conectado"** acima do botão Entrar: marcado, os cookies da sessão vão
  com 1 ano e o usuário **entra direto** (`/login` e `/` redirecionam quem já tem
  sessão); desmarcado, viram cookie de sessão e morrem ao fechar o navegador.
  ⚠️ `cookieOptions.maxAge` do `@supabase/ssr` é sobrescrito pela lib — por isso
  os cookies são gravados à mão. Ver armadilha 12 no arquivo 03.
- **"Esqueci minha senha"** saiu de cima do campo e foi para baixo do botão,
  acima do "Cadastre-se".

## v8 — Melhoras (doc "Fixly parte 6", migração 0022)
- **Autenticação por e-mail (novo subsistema):** código de 6 dígitos em
  `lib/otp.ts` (guarda só o sha256, validade 10 min, uso único, máx 5 tentativas)
  + `lib/verifiedEmail.ts` (comprovante HMAC que sobrevive ao formulão do cadastro).
  Usado em **3 fluxos**: cadastro, "esqueci minha senha" (`/recuperar-senha`) e
  **troca de senha logado** (exige senha atual + código).
- **Cadastro em 2 etapas:** nome, sobrenome, e-mail, telefone, senha + confirmação
  → código no e-mail → resto do cadastro. Sem o comprovante, `createAccount` recusa.
- **Busca inteligente (`lib/serviceSearch.ts`)**: motor próprio e gratuito — léxico
  treinado de ~600 termos de obra/manutenção, casamento por **frase**, **radical** e
  **erro de digitação**, dicas de ambiente, e **categoria oculta nunca é resultado**
  (era o bug de "trocar o piso do banheiro" → "Encontramos: profissional"). Também
  procura no **texto livre do prestador** (`specialties`), então "piscina" acha quem
  faz piscina mesmo sem categoria. 31/31 casos de teste do doc passando.
- **Dinheiro só depois da aprovação:** o prestador marca `provider_done_at`; o valor
  entra em Ganhos quando o **contratante aprova** (`guard_request_changes` garante).
- **Carteira do prestador:** saldo (disponível / a liberar / em serviço), **"Sacar
  dinheiro"** (RPC valida o saldo), **previsão de crédito** ("cai amanhã (30/07)"),
  adiantamento liberado aparecendo, e **Admin → Saques** para pagar o PIX.
- **Contra-proposta corrigida:** `accept_proposal()` no banco — não dá para fechar
  com contra-proposta pendente, e o preço é o da proposta (não o antigo). Botão
  virou **"Aceitar proposta"**.
- **Orçamento + Reforma fundidos** em **"Solicitar serviço"**, com o mesmo método de
  negociação do Express (propostas + contra-proposta). Pelo Profiler dá para
  direcionar a um profissional (`?prestador=<id>`). Express com texto estilo Uber.
- **Gateway de pagamento real:** Mercado Pago com **PIX** (QR + copia-e-cola +
  confirmação por webhook assinado e polling de segurança), **cartão** por Checkout
  Transparente (token no browser — o cartão não passa pelo Fixly), **estorno** no
  cancelamento, e **split** opcional via OAuth (`application_fee`).
- **Preço-base da visita removido** (cadastro, perfil e painel) — quem precifica é
  o prestador, serviço por serviço.
- **Cartão do Profiler configurável:** escolhe qual serviço aparece + frase limitada
  a 70 caracteres (a frase longa estourava o layout).
- **Correções do doc:** alinhamento das categorias sempre à esquerda e ícone da
  "Impermeabilização" (o SVG era comprimido a zero por falta de `shrink-0`); perfil
  não salvo agora avisa em vez de abrir página de erro; `/p/<handle>` mostra
  **todos** os serviços; empreiteiro sempre tem profiler; telefone obrigatório;
  **auto-refresh sem F5**; Admin Vendas usando os valores **reais** do pagamento.

## v7 — Melhoras (docs "Fixy part 5", migração 0021)
- **Catálogo curado:** 8 serviços em **destaque** (`featured`) + **busca** + **"Ver
  todos"** nos seletores (Express/Orçamento/Reforma) e no home, com ícones
  **coloridos** pela cor da categoria. Banheiros e "faz-tudo" **ocultos** (`hidden`).
- **Modalidade no Solicitar:** "+ Solicitar" abre um seletor Express/Orçamento/Reforma.
- **Express sem preço automático:** `dispatch_request` não cria mais proposta com
  valor — o **prestador digita o preço** (resolve "propostas vindo com valor incluso").
- **Prestador "ocupado":** quando já está em um serviço (a_caminho/em_andamento),
  aparece Ocupado e não pega novos pedidos; o dispatch também o ignora.
- **Adiantamento:** teto de **50%** (perfil, proposta e orçamento) + o **contratante
  aprova** a liberação do adiantamento (`advance_approved`, `approveAdvance`).
- **Contra-proposta:** o contratante negocia o preço (`proposals.counter_price`/
  `counter_status`); o prestador aceita/recusa no board.
- **% de adiantamento** aparece na proposta; roteador melhorado (termos decisivos,
  ex.: "muro" → Alvenaria); **GPS agora preenche a rua** (reverse geocode Nominatim);
  **complemento obrigatório**; hint "marque tudo o que você faz" no cadastro.
- **Cartão QR** redesenhado (horizontal, tema escuro, avatar + badge + selo).
- Rótulo "Proposta **recebida**" (contratante); rótulo curto no menu mobile.
- **Adiado:** confirmação de e-mail real (falta Resend key) e notificações.

## v1 — Base
- Scaffold Next 16 + Supabase; login único + 3 papéis; cadastro com upload de
  documentos + aprovação do admin (e-mail); app do contratante e do prestador;
  schema 0001–0002; deploy Supabase real conectado.

## v2 — Chat, dashboards, pagamento, segurança inicial
- Chat realtime estilo WhatsApp (recibos, anexos); dashboards admin (cadastros,
  vendas); tipos de documento configuráveis; termos de aceite; **sem emojis**
  (ícones lucide); mapa com GPS/rota; pagamento com split + breakdown; Mercado
  Pago plugável (mock). Sidebar colapsável, logout com confirmação.

## v3 — Ajustes de produto + gestão
- Chat corrigido (RLS participantes); página de detalhe do serviço; localização
  GPS+CEP; tickets de suporte; multi-categoria + raio funcional; senha forte;
  logo símbolo; nº da casa obrigatório; avaliação obrigatória; "Meus Serviços";
  **gestão de usuários admin + permissões + login por usuário**; **Modo de Teste**
  (link mágico + forçar etapas).

## v4 — Blindagem de segurança
- **PII → profiles_private**; pagamento server-side; guard de reputação + triggers;
  headers/CSP; `SECURITY.md`. Deploy no Render + domínio `fixly.company` (DNS).

## v5 — Melhorias (docs "Melhoras part1") + Profiler + pivô de preço
- Fase A: 29 categorias + roteamento por texto; Fase B: home com
  Express/Orçamento/Reformas/Profiler.
- **Profiler**: público `/p/<handle>`, portfólio, QR, avaliações, selo, **rede
  social (seguir/feed)** no contratante e no prestador.
- **PIVÔ DE PREÇO**: plataforma não define preço; prestador propõe; contratante
  escolhe entre propostas (Express) ou pede orçamento a um profissional escolhido
  (Orçamento com visita técnica). Precificação (admin) **removida**.
- **Empreiteiros** (B2B, mensalidade sem comissão).
- **Finalização**: cancelamento de serviço (+ reembolso mock), edição de perfil,
  nota de garantia da meritocracia.
- **SEO removido do escopo** (vai ser tratado em outro domínio/projeto à parte).

## v6 — Melhoras (docs "Fixy melhoras parte 4")
- **Logo clicável** volta ao início (contratante/prestador/admin).
- Ícone de **impermeabilização** (Droplets). Placeholder da descrição **por categoria**.
- **Reformas** agora usa o fluxo **Orçamento** (visita técnica), não mais o Express.
- **Reputação começa em 0** — novo prestador aparece como **"Novo"** (sem Selo
  automático). Helper `lib/reputation.ts` aplicado em todos os cards.
- **Cartão QR = cartão de visita**: headline + selos + avatar, desenhado num
  **canvas**; **baixar/imprimir** geram o cartão inteiro (antes só o QR).
- **Foto de perfil (avatar)** do prestador (`ProfilerEditor` → bucket `avatars`),
  exibida nos cards de busca, propostas, perfil público e no cartão.
- **Pedido com fotos** (bucket `pedidos`) + **complemento** + **"usar endereço de
  cadastro"** (Express, Orçamento e Reforma). Fotos aparecem pro prestador.
- **Adiantamento (split do prestador):** ele define **% que recebe antes** do
  serviço (padrão no perfil + ajustável por proposta). Taxa fixa extra sobre a
  parte adiantada (`ADVANCE_FEE_RATE` em `pricing.ts`) — **simulada**, refletida no
  breakdown/extrato. O valor continua sendo do prestador; o contratante paga ao
  escolher (escrow).
- **Empreiteiros:** múltiplas especialidades (`category_ids`) + **profiler público
  `/e/<handle>`** (fotos, contato, cartão QR), igual ao do prestador.
- **Cadastro do prestador:** categoria **pesquisável** + campo **"Outros"**
  (texto livre → `profiles.specialties`).

## v6.1 — Auditoria de segurança (part 4)
- **Bundle limpo:** nenhum segredo real no cliente (auditado `.next/static`).
  Os "541 key" são internals do React/Next (`key:` de JSX, `*_SEGMENT_KEY`), não
  segredos. Source maps de produção **desligados** (default).
- **Chave exposta = publishable/anon** (`sb_publishable_...`), pública por design e
  limitada por RLS. A `SUPABASE_SECRET_KEY` é **server-only** (`import "server-only"`,
  `createAdminClient`) e não vai pro bundle. MP/Resend também server-only.
- **RLS auditado** (17 tabelas, todas com RLS; PII isolada; pagamentos write só admin).
  Fechados 2 buracos de integridade via `guard_request_changes` (0020): auto-avaliação
  do prestador e farm de `jobs_done`. **Testado em produção** (deny + allow, com rollback).
- **`pedidos` virou bucket PRIVADO** (fotos de casa/serviço) — leitura só por URL
  assinada, autorizada por `can_view_pedido()`. Telas passam a assinar server-side.
- **Rate limiting** (`lib/rateLimit.ts`): `createAccount` (5/IP a cada 15 min) e proxy
  (400 req/min por IP; 60/min em `/login` e `/cadastro`). In-memory por instância —
  para autoscale, trocar por Upstash Redis.
