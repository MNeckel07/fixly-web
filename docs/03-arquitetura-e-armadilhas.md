# 03 — Arquitetura e ARMADILHAS

## Estrutura de pastas (src/)
```
app/
  login/ · cadastro/[role]/ · aguardando/            # auth
  app/contratante/  → home, solicitar, servico/[id], historico, suporte,
                       perfil, profiler, empreiteiros
  app/prestador/    → home(pedidos), trabalho, ganhos, profiler, suporte, perfil
  admin/            → (visão), cadastros, usuarios, vendas, servicos, suporte,
                       mensagens(equipe), documentos, empreiteiros, testes
  p/[handle]/       → PERFIL PÚBLICO do Profiler (SEM login — fora do proxy)
lib/         → auth, permissions, pricing, categoryRouter, geo, terms,
               password, brand, types, supabase/{client,server,middleware}, gateway, mercadopago
components/  → ui, auth, shell, admin, contratante, prestador, chat, map, profiler, support, empreiteiros
```
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
