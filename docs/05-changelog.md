# 05 — Changelog (grandes marcos)

Ordem cronológica das grandes entregas. Detalhe fino está no `git log`.

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
