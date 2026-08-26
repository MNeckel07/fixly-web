# 03 — Arquitetura e ARMADILHAS

## Estrutura de pastas (src/)
```
app/
  robots.ts                                          # ⚠️ na RAIZ (ver armadilha)
  api/                                               # route handlers (sem layout)
  (site)/           → A LANDING pública, raiz de fixly.company
    layout.tsx        · root layout PRÓPRIO (Bricolage/Poppins/Azeret)
    globals-site.css  · CSS PRÓPRIO (zinco frio + shadcn)
    page.tsx · sitemap.ts
  (app)/            → O PRODUTO
    layout.tsx        · root layout do app (Poppins)
    globals.css       · CSS do app (paleta Fixly)
    login/ · cadastro/[role]/ · aguardando/          # auth
    app/contratante/  → home, solicitar, servico/[id], historico, suporte,
                         perfil, profiler, empreiteiros
    app/prestador/    → home(pedidos), trabalho, ganhos, profiler, suporte, perfil
    admin/            → (visão), cadastros, usuarios, vendas, servicos, suporte,
                         mensagens(equipe), documentos, empreiteiros, testes
    p/[handle]/       → PERFIL PÚBLICO do Profiler (SEM login — fora do proxy)
lib/         → auth, permissions, pricing, categoryRouter, geo, terms, site (costura
               da landing), cancellation, negotiation, reports, password, brand, types,
               supabase/{client,server,middleware}, gateway, mercadopago
components/  → ui, site (landing), auth, shell, admin, contratante, prestador, chat,
               map, profiler, support, empreiteiros
```

### Por que DOIS route groups, e não uma pasta só
`(site)` e `(app)` são **root layouts separados** — cada um com seu `<html>`,
suas fontes e seu CSS. Não é organização: é a única forma de os dois designs
coexistirem. A landing traz uma base opinativa (`h1,h2,h3` em Bricolage,
`* { border-border }`, `--radius-*` do shadcn, `scroll-behavior: smooth`) que,
num `globals.css` compartilhado, **reescreveria o visual do app inteiro** —
`rounded-xl` iria de 12 px para ~17 px em todas as telas, e todo título viraria
Bricolage. Com dois root layouts, `/` carrega uma folha e `/login` carrega
outra; conferido no navegador (hashes diferentes, `rounded-xl` = 12 px no app).

⚠️ **Route group não aparece na URL.** `/admin` continua `/admin`; o que mudou
foi o caminho em disco — e é por isso que `scripts/strip-admin.mjs` teve de ser
atualizado e ganhou falha fechada.

⚠️ Os imports de server action carregam o group: `@/app/(app)/app/contratante/pay.actions`.
É feio e é de propósito — o alias que esconderia isso faria o código mentir
sobre onde os arquivos estão.


- **Proxy** (`proxy.ts` → `lib/supabase/middleware.ts`): protege `/app` e `/admin`
  (redireciona pra /login sem sessão). **Não** protege `/p/...` (público). O papel
  (role) é reforçado nos layouts via `requireRole()`.
- **Server components** fazem as queries; **server actions** (`*.actions.ts`) fazem
  operações sensíveis (pagamento, criar conta, admin). Cliente Supabase:
  `lib/supabase/server.ts` (server, tem `createClient` + `createAdminClient` com a
  secret key — marcado `import "server-only"`) e `lib/supabase/client.ts` (browser).

## Modelo de segurança (resumo — detalhes em SECURITY.md)
- **RLS em todas as tabelas.** `is_admin()`, `is_conversation_participant()`,
  `shares_conversation()`, `guard_profile_changes()` são `SECURITY DEFINER`.
- **PII isolada:** dados sensíveis (email, phone, cpf, rg, endereço, banco, username)
  vivem em **`profiles_private`** (só o dono e admin leem). `profiles` só tem o
  público. `getProfile()` **mescla** o private do próprio usuário. Admin lê o de
  outros com join `private:profiles_private(...)`.
- **Pagamentos:** escrita de `payments` é **admin-only** (RLS). As server actions
  (`processPayment`, `approveService`, `cancelService`) usam `createAdminClient()`.
  O **valor é derivado no servidor** (proposta aceita / final_price), nunca do cliente.
- **Reputação protegida:** `guard_profile_changes` bloqueia o usuário de mudar o
  próprio role/status/active/rating/jobs_done/reviewed/reject_reason. `rating` e
  `jobs_done` são recalculados por trigger (`on_request_completed`). Triggers
  confiáveis furam o guard com `set_config('fixly.guard_bypass','on',true)`.
- **Storage:** `documentos` (privado, URL assinada), `chat` (privado, participante),
  `portfolio` (público — é vitrine).

## ⚠️ ARMADILHAS (já custaram debugging — leia!)

### 🔴 `"use server"` só exporta função async — e um export solto derruba a PÁGINA inteira
Aconteceu em 25/08/2026. `app/app/report.actions.ts` exportava
`export const MOTIVOS = [...]`. O Next recusa o módulo com

```
A "use server" file can only export async functions, found object.
```

E o estrago não fica na denúncia: **o Next junta as ações de toda a página num
módulo de ações só**, então caíram junto `cancelService`, `updateRequest`,
`processPayment`, `approveService` — telas que não têm nada a ver com denúncia.

O que o usuário vê é apenas `Minified React error #441`, escrito no lugar do
texto da caixa de diálogo. **Esse número não diz nada sobre a causa**: é o
genérico do React (`resolveErrorProd`, no react-server-dom) para "a server
action explodiu"; a mensagem real só existe no servidor. Procurar o bug dentro
de `cancelService` não leva a lugar nenhum — o código dela está certo.

**Diagnóstico:** rode `npm run dev` e leia o log do servidor. Em dev a mensagem
vem inteira, com o nome do export e o `ACTIONS_MODULE` no stack.

**Varredura preventiva** (o que sobrar precisa ser `interface`/`type`):
```bash
for f in $(grep -rl '^"use server"' src); do
  grep -nE '^export ' "$f" | grep -v 'export async function'
done
```

**Conserto:** mover a constante para um módulo comum (`src/lib/…`) e importar
nos dois lados. **Não reexportar** do arquivo de actions — reexport tem o mesmo
efeito do export.

### 🔴 O prestador NÃO lê o perfil do contratante — cuidado com filtro que depende disso
`prof_select` libera só: você mesmo, admin, ou **prestador aprovado**. Um
contratante é invisível para o prestador. Consequência achada em 25/08/2026:
em `app/prestador/page.tsx`, o filtro do Selo Fixly lia `fix_badge` do cliente
por `join` — voltava `null`, e

```ts
if (profile.fix_badge && !cliente?.fix_badge) return false;   // true && !undefined
```

descartava **todo** pedido. Resultado: **todo profissional com selo via "0
pedidos na sua região"**, inclusive os mandados direto para ele.

A regra é de pareamento de contas e precisa de um dado que a sessão do prestador
legitimamente não pode ler → a leitura do `fix_badge` do cliente passou a usar
`createAdminClient()` (server-only, só esse campo). **Regra geral:** um `join`
que a RLS pode zerar nunca deve virar condição negativa de filtro. Ou lê com
chave de servidor, ou a lógica vai para uma função `SECURITY DEFINER`.

### `robots.ts` dentro de route group NÃO gera rota (e não avisa)
Com `src/app/(site)/robots.ts` o `/robots.txt` **some da tabela de rotas do
build**: sem erro, sem aviso, e o site sobe sem robots. O que torna a falha fácil
de não notar é que o `sitemap.ts` **no mesmo diretório funciona normalmente**.
Solução: `robots.ts` fica em `src/app/`, fora dos groups. Depois de qualquer
mexida, confira `/robots.txt` na tabela de rotas do `npm run build`.

⚠️ E ele responde nos DOIS domínios: no painel (`fixly.fun`) precisa de
`disallow: "/"`, senão um `allow` desfaz numa linha todo o cuidado do
`lib/appRole.ts`.

### 🔴 Nas provas SQL, leia os ids ANTES de assumir uma sessão
Nos checks do `dry-run-migration.mjs` a gente troca de usuário com
`set_config('request.jwt.claims', ...)`. A partir daí a RLS vale para o próprio
teste: um `select id from profiles where role='admin'` feito "como prestador"
volta **vazio**, o `sub` do JWT sai nulo, `auth.uid()` vira null e a função
responde `Sem permissão` — sem nenhuma pista de que o problema era o teste, não
o código. Capture todos os ids no começo do bloco, antes do primeiro
`set_config`.

### 🔴 Redefinir função do banco: partir da versão MAIS RECENTE
`create or replace function` **substitui a definição inteira**. Copiar a versão
que aparecer primeiro no `grep` reverte, em silêncio, tudo o que migrações
posteriores fizeram nela — e o Postgres aceita sem reclamar.

Aconteceu em 31/07/2026: a `0023` reescreveu `dispatch_request` a partir da
`0004`, que **cria proposta automática** com preço calculado. A `0021` havia
removido isso de propósito (no Express quem digita o preço é o prestador).
Resultado: pedido novo nascia com proposta de um profissional que não clicou em
nada, e o dono viu "alguém aceitou sozinho". Consertado na `0025`.

**Antes de redefinir qualquer função:**
```bash
grep -rn "function public.<nome>" supabase/migrations/   # use a de MAIOR número
```

### `proxy.ts` fora de `src/` é ignorado SEM AVISO
O app vive em `src/app`, então o Next 16 exige **`src/proxy.ts`** (o antigo
`middleware.ts`). Na raiz do projeto o arquivo é silenciosamente ignorado —
sem erro, sem log. Ficou assim por semanas: o **rate limiting** (400 req/min por
IP, 60/min nas telas de auth) e o refresh de sessão **nunca rodaram**, enquanto o
`SECURITY.md` os dava como ativos.

**Como provar que está valendo:** `npm run build` tem que imprimir
`ƒ Proxy (Middleware)`, e um `curl` numa rota que ele deveria barrar precisa
devolver o status esperado. Proteção que não roda é pior do que não ter, porque
ninguém procura por ela.

### Bloquear rota ≠ tirar o endpoint do ar
`/admin` respondendo 404 impede a navegação, mas as **server actions** daquela
área continuam compiladas e acionáveis por POST no mesmo domínio — protegidas só
pelo `assertAdmin()`. Foi o caso do `fixly.company`, que carregava 17 delas
(incluindo `impersonationLink`, que gera link mágico de acesso a conta).
Por isso existe o `scripts/strip-admin.mjs`: no build do site ele **apaga** a
pasta do painel. Ao criar qualquer área privilegiada nova, pergunte não só "dá
para navegar até lá?" mas "o endpoint existe neste servidor?".

### `notification_url` do Mercado Pago não aceita localhost
Se `NEXT_PUBLIC_APP_URL` for `http://localhost:3000`, o MP recusa a cobrança
inteira com `400 notification_url attribute must be url valid`. O
`mercadopago.ts` só manda o campo quando a URL é https pública; rodando local, a
tela do Pix confirma pelo polling de 5 s.
1. **Embed `profiles → service_categories` é AMBÍGUO.** Depois que criamos
   `provider_categories` (many-to-many), o PostgREST vê 2 caminhos e **falha a
   query inteira** (não só o embed). Em queries sobre a tabela **`profiles`**, use
   sempre o hint: `category:service_categories!profiles_category_id_fkey(...)`.
   Em queries sobre `service_requests` **não** precisa (só um caminho).
2. **Pooler do Supabase:** host é `aws-1-...` (não `aws-0`). Conexão direta
   `db.<ref>.supabase.co` não resolve (IPv6). Ver arquivo 02.
3. **`cwd` do bash reseta** para `/Users/matheusneckel/Projetos`. Sempre `cd sistema-web`.
4. **Enums:** evite `ALTER TYPE ... ADD VALUE` (problemas de transação). Preferimos
   **colunas** (`mode` em service_requests, `is_test` em profiles) a novos valores de enum.
5. **Rotas novas no dev:** às vezes o `next dev` já rodando não pega uma rota nova
   (deu 404). Reinicie o dev limpo se uma rota nova retornar 404 indevido.
6. **Migração idempotente:** `db:apply` roda tudo de novo. Algumas migrações
   `add column if not exists` recriam colunas que a `0006` dropou (PII) — mas a
   `0006` roda por último dessas e dropa de novo; os dados ficam em `profiles_private`
   (on conflict do nothing). Mantenha essa ordem.
7. **Cadastro:** "Confirm email" está ligado no Supabase → o cadastro usa
   `createAccount` (admin API, email_confirm) pra funcionar mesmo assim.
8. **Preço:** NÃO existe mais preço da plataforma. `pricing_rules` e a aba
   Precificação foram **removidas**; a tabela ainda existe mas está **sem uso**.
9. **`npm run db:apply` está QUEBRADO para re-execução completa.** Ele reroda
   0001→N e o **0004 falha** (`conversations_type_check` é violado por linhas com
   `type='equipe'`, que só existe a partir do 0008). Para aplicar migrações novas,
   rode **apenas os arquivos novos**, cada um numa transação (script pontual com
   `pg`, `begin`/`commit`). Não "conserte" o 0004 sem cuidado.
10. **Fotos de pedido = bucket PRIVADO `pedidos`.** Nunca montar URL pública; use
    `signRequestPhotos`/`signRequestPhotoMap` (`lib/uploads.ts`) **no servidor** com
    o cliente do usuário (o RLS `pedidos_read`/`can_view_pedido` decide o acesso).
    `avatars`/`portfolio` são públicos (vitrine) — esses podem usar URL pública.
11. **Integridade de `service_requests`:** o trigger `guard_request_changes` (0020)
    só deixa o **contratante** escrever `rating`/`review` e trava estados finais.
    Server actions que mexem em status usam o **cliente do usuário** (passam pelo
    trigger) — se for usar `createAdminClient` para forçar etapa, tudo bem (o
    trigger libera quando `auth.uid()` é nulo/service-role ou `is_admin()`).

12. **`cookieOptions.maxAge` do `@supabase/ssr` é IGNORADO.** A lib monta
    `setCookieOptions = { ...DEFAULT_COOKIE_OPTIONS, ...cookieOptions, maxAge:
    DEFAULT_COOKIE_OPTIONS.maxAge }` — ela **sobrescreve** o nosso `maxAge` com o
    default dela (400 dias). Por isso o "Ficar conectado" grava os cookies à mão,
    via `cookies.getAll/setAll` em `lib/supabase/client.ts`; o proxy faz o mesmo
    (tira `maxAge`/`expires` quando a preferência é não ficar conectado). Se
    mexer nisso, testar as DUAS pontas: marcado = cookie persistente, desmarcado
    = `expires: -1` (cookie de sessão). E conferir que o **logout** ainda limpa.
13. **Ícones do app são convenção de arquivo do Next**, não `<link>` na mão:
    `src/app/favicon.ico`, `src/app/icon.png` e `src/app/apple-icon.png`. O Next
    injeta as tags e versiona a URL. Gerados a partir de `public/fixly-symbol.png`
    — o PNG tem "poeira" de alpha 1–2 na borda, então **`getbbox()` devolve a
    imagem toda**; recortar com limite (`alpha > 40`) antes de escalar, senão o
    ícone fica minúsculo no meio do quadrado.

14. **NUNCA troque o `className` do `<div>` em que o Leaflet foi inicializado.**
    O Leaflet escreve as classes dele (`leaflet-container`, `leaflet-touch`…)
    **nesse mesmo elemento**, de forma imperativa. Se o React reescrever o
    atributo (porque a prop `className` mudou), todas somem — e o mapa fica
    **em branco**, sem erro nenhum no console, com os tiles carregados e
    invisíveis. Aconteceu no `ServiceAreaMap` ao alternar embutido ↔ tela cheia.
    **Regra:** o div do Leaflet tem className CONSTANTE (`h-full w-full`); quem
    muda de tamanho é um **wrapper** por fora. Sintoma para reconhecer:
    `document.querySelector(".leaflet-container")` volta `null` mas
    `.leaflet-tile` existe.
    E ao redimensionar, chamar `map.invalidateSize()` **depois** de o CSS
    aplicar (timeout curto) — senão ele mede o tamanho antigo.

15. **RLS é por LINHA — dado sensível numa coluna vaza.** O endereço do serviço
    ficava em `service_requests`, e a policy do 0007 deixa o prestador ler
    QUALQUER pedido em aberto (é como ele acha trabalho). Ou seja: rua, número e
    complemento de todo mundo, para qualquer prestador aprovado, sem nem propor.
    Consertado como já foi feito com a PII do perfil: **tabela separada**
    (`service_request_locations`) com a sua própria policy. Na tabela pública
    ficou só a versão aproximada (bairro + ponto deslocado).
    **Regra:** quando parte das colunas tem um público diferente do resto da
    linha, o certo é outra tabela — não `select` sem a coluna (o cliente pede o
    que quiser).

16. **Realtime entrega a linha ANTES dos seus AFTER triggers.** A primeira versão
    do split gravava o pedido com o endereço certo e um AFTER INSERT "limpava"
    depois. Funciona na tela e vaza no websocket: o prestador assina
    `service_requests` e recebe o payload do INSERT original. A saída foi o
    BEFORE INSERT já gravar a versão aproximada e guardar a exata num
    `set_config('fixly.loc_<id>', ..., true)` (escopo de transação) para o AFTER
    INSERT salvar na tabela privada. **Ao esconder um dado, pergunte também o que
    o Realtime publicou.**

17. **Ensaie a migração antes de aplicar** — `scripts/dry-run-migration.mjs`
    roda a migração (e um arquivo de conferências) contra o banco real dentro de
    uma transação e dá **rollback** no fim. Foi assim que apareceu, antes de
    qualquer estrago, que existiam **conversas de serviço duplicadas** (duas
    chamadas simultâneas de `start_service_chat` passavam as duas pelo
    `select ... limit 1`), que teriam feito o índice único falhar. Vale também
    para provar RLS: dá para `set local role authenticated` + JWT falso e contar
    linhas por usuário.

18. **Update direto em tabela de negociação é dinheiro na mão do cliente.** A
    policy `prop_update` deixava o contratante escrever em `proposals` — e nada
    impedia `update proposals set price = 1`. Preço, status e contra-proposta só
    devem mudar por RPC `security definer` com as regras dentro. Ao criar uma
    tabela onde as duas pontas escrevem, pense em QUAIS COLUNAS cada uma pode
    tocar; se a resposta não couber numa policy, é RPC.

19. **SDK de terceiro só existe se o CSP deixar — e ele falha CALADO.** O botão
    de Apple Pay/Google Pay foi entregue com o `js.stripe.com` fora do
    `next.config.ts`. O navegador barra o script, o `carregarSdk()` devolve
    `false` e o componente esconde o botão *de propósito* — o sintoma é
    "não aparece nada", idêntico a credencial errada ou a celular sem carteira.
    Ao plugar QUALQUER script externo, mexa no CSP no mesmo commit
    (`script-src`, `connect-src`, `frame-src` e, se for pagamento, delegar
    `payment` ao iframe no `Permissions-Policy`) e **prove no header servido**:
    `npm run build && PORT=3999 npm start` + `curl -sI localhost:3999/login`.

20. **Link de e-mail escrito no painel aponta para o painel.** No serviço
    `fixly-admin` a `NEXT_PUBLIC_APP_URL` é o endereço do PAINEL — então todo
    aviso disparado de lá (resposta de suporte, aprovação de cadastro) precisa
    montar a URL com `siteUrl()`, senão o link sai para `fixly.fun/app/...`,
    que responde **404 de propósito**. Ao criar aviso novo, pergunte primeiro:
    *quem dispara isto, o site ou o painel?*

21. **Componente de menu com exceção derruba o app inteiro — e a tela engana.**
    O `UnreadNavBadge` é montado DUAS vezes para o mesmo tipo (menu do desktop
    e barra de baixo do celular). Com nome de canal fixo, o
    `supabase.channel()` devolvia o MESMO canal para as duas, a segunda
    chamava `.on("postgres_changes", …)` num canal já inscrito e o Supabase
    lançava *"cannot add postgres_changes callbacks after subscribe()"*. A
    exceção derrubava a árvore e o navegador mostrava **"This page couldn't
    load"** — que parece queda de servidor e não é: o servidor devolvia 200
    com o HTML completo. Duas regras saem daí: **canal de realtime precisa de
    nome único por instância** (`useId()`), e **componente de layout vai de
    `try/catch` por princípio** (contador que não atualiza é detalhe; app que
    não abre, não).

22. **`curl` não executa JavaScript — para bug de tela, use navegador real.**
    A pergunta que separa as duas metades é *"funciona deslogado?"*. Se a home
    e o login abrem e só a área logada quebra, o problema está no código do
    cliente, e nenhuma medição de uptime, memória ou rede vai encontrá-lo.
    Playwright + Chromium com `pageerror`/`console`/`crash` achou a causa numa
    execução. ⚠️ a versão do pacote em `~/.npm/_npx/*` pode não bater com o
    browser em `~/Library/Caches/ms-playwright`; passar `executablePath` do
    binário existente resolve sem baixar nada.

## Convenções
- Escrever código no estilo do redor (Tailwind utilitário, `lib/brand` para labels
  de papel/status, `Badge` para status, `CategoryIcon` por slug).
- **Marca:** usar sempre o componente `Logo` (nunca escrever "Fixly" à mão). Ele
  garante a proporção definida pelo dono — o símbolo é **1,3× a fonte do nome**
  (`SYMBOL_RATIO`), sobrando margem acima e abaixo do texto. `size` é a
  referência do TEXTO; o símbolo é derivado.
- Sem emojis na UI. Ícones lucide.
- Commits: mensagem clara + `Co-Authored-By: Claude ...`. Commit/push só quando fizer sentido.
- Sempre `tsc --noEmit` + `npm run build` antes de commitar mudança não trivial.
