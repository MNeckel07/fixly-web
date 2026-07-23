# 05 — Changelog (grandes marcos)

Ordem cronológica das grandes entregas. Detalhe fino está no `git log`.

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
