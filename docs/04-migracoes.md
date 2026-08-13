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
| 0019 | `melhoras_p4` | **rating começa em 0** (novo prestador sem Selo; trigger fallback 0 + reset dos que têm 0 serviços); `profiles.avatar_path`/`specialties`/`advance_pct`; `proposals.advance_pct` + `service_requests.advance_pct`/`photos`; `payments.advance_*`; bucket **público** `avatars` + bucket **PRIVADO** `pedidos` (RLS `pedidos_read` via `can_view_pedido()`); `submit_proposal`/`dispatch_request` carregam o adiantamento; empreiteiros `category_ids`/`handle` (único) + `empreiteiro_items` (fotos, bucket `portfolio`) |
| 0021 | `melhoras_p5` | catálogo `service_categories.featured`/`hidden` (destaca 8, esconde `banheiros`+`faz_tudo`); `service_requests.advance_approved`; `proposals.counter_price`/`counter_status` (contra-proposta, texto livre); `dispatch_request` **sem proposta automática** (Express = prestador digita o preço) e ignora ocupados; `submit_proposal` com **teto de adiantamento 50%** |
| 0020 | `security_hardening` | trigger `guard_request_changes` em `service_requests`: só o **contratante** escreve `rating`/`review` (impede auto-avaliação do prestador) e estados finais (`concluido`/`cancelado`) não voltam (impede farm de `jobs_done`) — server actions e admin passam pelo bypass/`is_admin()` |

| 0022 | `melhoras_p6` | **verificação de e-mail por código:** `email_codes` (guarda só o sha256; **RLS ligado e ZERO policies** = só service_role) + `purge_expired_email_codes()`. **`service_requests.provider_done_at`** (o prestador sinaliza o fim; o status só vira `concluido` quando o CONTRATANTE aprova — é isso que libera o dinheiro) e `guard_request_changes` reescrito: só o contratante conclui, só o prestador designado marca `provider_done_at` (e não desmarca). **Cartão do Profiler:** `profiles.card_category_id`/`card_headline` (máx 70 chars, com CHECK). **Carteira:** `payments.available_at`/`advance_released_at`/`split_mode`/`provider_gateway_id`, tabela `withdrawals` (leitura do dono + admin; escrita só admin) e RPCs `provider_balance()` / `request_withdrawal()` (**valida o saldo no servidor**). **`accept_proposal()`**: aceitar proposta no banco — recusa com contra-proposta `pendente`, usa o preço da proposta e recusa as demais. Backfill de `empreiteiros.handle` (todo anúncio ganha profiler `/e/<handle>`). `provider_gateway_accounts` (tokens OAuth do split — RLS ligado, zero policies) + `gateway_connected()` |

| 0023 | `selo_fix` | **Selo Fix — fluxo sem cobrança.** `profiles.fix_badge` (só admin liga; entrou na lista protegida do `guard_profile_changes`) e `service_requests.no_charge`. `dispatch_request` ganha **isolamento assimétrico**: prestador COM selo não recebe pedido de conta SEM selo, mas conta COM selo continua alcançando prestador real (é assim que o pagamento entra em vigor). Marca todas as contas existentes com selo, **menos o Arthur**. ⚠️ o `update` final precisa de `set_config('fixly.guard_bypass','on',true)` — conexão direta ao banco não tem `auth.uid()` e o guard recusaria |

| 0024 | `cancelamento_e_tempo_real` | `service_requests.cancel_reason` + a tabela **entra na publicação `supabase_realtime`**. É o que faz o pedido novo aparecer NA HORA no quadro do prestador (antes só no `AutoRefresh` de 15 s). O Realtime respeita a RLS: só chega evento de pedido que o prestador já poderia ler |

| 0026 | `melhoras_p7` | **Endereço exato sai do pedido.** Nova tabela `service_request_locations` (rua/nº/complemento + lat/lng reais) com RLS que só libera para o **contratante dono**, para o **prestador designado depois do aceite** e para admin. Em `service_requests`, `address`/`lat`/`lng` passam a ser **aproximados**: `fixly_area_label()` (só bairro/cidade) e `fixly_blur_coord()` (desloca até ~450 m por eixo, sempre o mesmo ponto para o mesmo pedido). O split é feito por **trigger BEFORE INSERT** (guarda o exato num GUC de transação) + AFTER INSERT — se a linha chegasse a existir com o endereço certo, o **Realtime** entregaria esse payload aos prestadores. **Negociação nos dois sentidos:** `proposals.counter_by` + RPCs `counter_proposal()` / `respond_counter()`; a policy de update em `proposals` virou **admin-only** (o contratante podia reescrever o `price` da proposta alheia e aceitar por outro valor). **Chat de negociação:** `conversations.provider_id`/`chat_status`/`requested_by`, RPCs `request_service_chat()` / `respond_chat_request()`, `start_service_chat()` e `accept_proposal()` reaproveitam a mesma conversa (histórico único) e encerram as dos candidatos que não foram escolhidos; `msg_insert` exige chat `ativa`. Junta conversas duplicadas antes do índice único (havia pares criados por corrida). **Contato oculto:** `mask_contact_info()` + trigger em `messages` (só conversa de serviço). **Pedido direto do Profiler:** `service_requests.target_provider_id` — nasce `buscando` e só o escolhido vê (RLS + `submit_proposal` + `dispatch_request`). `notification_log` (server-only, zero policies) para não repetir e-mail. Frase do cartão 70 → **60**. |

| 0025 | `fix_dispatch_sem_proposta_automatica` | conserta a regressão do 0023 no `dispatch_request` (voltara a criar proposta automática) |

**Observação:** `pricing_rules` (0009/0012) ficou **sem uso** após o pivô 0015 —
a aba admin de Precificação foi removida. A tabela permanece (inócua).
