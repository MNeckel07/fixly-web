# 04 — Migrações (supabase/migrations)

Todas idempotentes. Rodar com `npm run db:apply` (lista em `scripts/apply-schema.mjs`).

| # | Arquivo | O que faz |
|---|---|---|
| 0001 | `init` | enums, `service_categories` (8 seed), `profiles`, `documents`, `service_requests`, `proposals`, `payments`, `is_admin()`, guard de role/status, RLS, bucket `documentos` |
| 0002 | `dispatch` | RPCs `dispatch_request` (dispara p/ prestadores) e `accept_request` |
| 0003 | `v2` | chat (`conversations`, `conversation_participants`, `messages`, bucket `chat`, realtime), `document_types` (configurável), campos completos de perfil, breakdown de pagamento, `active`, funções `start_approval_chat`/`start_service_chat` |
| 0004 | `tickets_multicategoria` | `shares_conversation()` (fix chat: participantes se veem), `tickets` + `create_ticket`/`admin_open_ticket`, **`provider_categories`** (multi-categoria), dispatch por raio+multi-categoria |
| 0005 | `ticket_number` | número sequencial global dos tickets (sequence) |
| 0006 | `security` | **PII → `profiles_private`**; guard expandido (rating/jobs/active/moderação); trigger `on_request_completed` (nota/contagem por trigger, com bypass GUC); **payments write só admin** |
| 0007 | `open_requests_visibility` | RLS: prestador vê QUALQUER pedido sem prestador designado (fix do raio — antes só via 'buscando') |
| 0008 | `admin_team_chat` | conversa tipo 'equipe' + `start_admin_chat` (chat entre admins) |
| 0009 | `pricing` | (LEGADO) `pricing_rules`, faixa no pedido, `submit_proposal` com teto — **substituído pelo 0015** |
| 0010 | `dispatch_range` | (LEGADO) dispatch dentro da faixa — substituído pelo 0015 |
| 0011 | `admin_users` | `profiles.funcao`/`permissions[]`, `profiles_private.username` (login por usuário) |
| 0012 | `categorias_reforma` | +21 categorias de obra, pricing_rules seed, coluna `service_requests.review` |
| 0013 | `test_mode` | `profiles.is_test` + marca as contas de teste (Modo de Teste) |
| 0014 | `profiler` | `profiles.handle`/`headline`, `portfolio_items`, `follows`, bucket público `portfolio` |
| 0015 | `provider_pricing` | **PIVÔ: preço do prestador.** `submit_proposal` sem teto; `dispatch_request` usa o preço-base do próprio prestador |
| 0016 | `provider_reviews` | `get_provider_reviews()` SECURITY DEFINER (avaliações públicas no Profiler) |
| 0017 | `orcamento` | `service_requests.mode` ('express'/'orcamento') + `visit_at` |
| 0018 | `empreiteiros` | tabela `empreiteiros` (B2B, assinatura) + RLS |

**Observação:** `pricing_rules` (0009/0012) ficou **sem uso** após o pivô 0015 —
a aba admin de Precificação foi removida. A tabela permanece (inócua).
