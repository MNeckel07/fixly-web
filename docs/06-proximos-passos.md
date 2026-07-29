# 06 — Próximos passos e instruções para a próxima sessão

## Estado atual (fim da sessão — v7, 2026-07-28)
- **Tudo no ar** em https://fixly.company (Render auto-deploy de `main`,
  repo `MNeckel07/fixly-web`). Último commit: `8b2caa5`.
- **Migrações aplicadas:** 0001–0021. As 0019/0020/0021 já estão no banco real.
  ⚠️ **`npm run db:apply` está QUEBRADO** (falha no 0004 por dado do 0008) —
  **aplicar cada migração NOVA individualmente** (transação própria, via um
  script `pg` com `SUPABASE_DB_URL`). Não rodar o db:apply completo.
- Builda limpo (`tsc --noEmit` + `npm run build`).

### O que foi entregue nas últimas levas (detalhe em 05-changelog)
- **v6 (parte 4):** logo clicável, reputação começa em 0/"Novo", cartão QR,
  avatar do prestador, fotos+complemento+"usar endereço" no pedido, adiantamento
  (split simulado), Reformas→Orçamento, empreiteiro multi-serviço + profiler
  público `/e/<handle>`, categoria pesquisável no cadastro. Typewriter no login.
- **v6.1 (segurança):** trigger `guard_request_changes` (só o contratante avalia;
  estados finais não voltam), bucket `pedidos` **privado** + `can_view_pedido()` +
  URL assinada, rate limiting (`createAccount` + proxy). Auditoria: sem segredo no
  bundle; `sb_publishable_` é anon (ok); RLS em todas as tabelas.
- **v7 (parte 5):** catálogo curado (8 em destaque via `featured`; `banheiros` e
  `faz_tudo` `hidden`), busca + "Ver todos" + ícones coloridos (`CategoryPicker`),
  seletor de modalidade no "+ Solicitar" (`ModalityChooser`), **Express sem preço
  automático** (prestador digita; `dispatch_request` não cria proposta), prestador
  **ocupado**, adiantamento **teto 50% + aprovação do contratante**
  (`advance_approved`/`approveAdvance`), **contra-proposta** (`proposals.counter_*`),
  roteador com termos decisivos, GPS preenche a rua (reverse geocode), complemento
  obrigatório, cartão QR horizontal, rótulo "Proposta recebida", fix de overflow
  mobile no `/p` e `/e` (flex-wrap + `overflow-x-hidden`).

## Como começar uma nova sessão (checklist)
1. Ler `docs/README.md` e `docs/03-arquitetura-e-armadilhas.md` + esta seção.
2. `cd sistema-web` e conferir que builda: `npx tsc --noEmit && npm run build`.
3. `git log --oneline | head` para o último estado.
4. Banco: criar migração nova em `supabase/migrations/`, e **aplicá-la sozinha**
   (não `db:apply` completo — está quebrado no 0004). Ver "Estado atual".
5. Ao terminar: `tsc` + `build` + commit + `git push origin main` (Render publica).
   **Depois do push, VERIFICAR que subiu de verdade** (curl no HTML servido +
   grep por um marcador da mudança) e avisar o dono pra dar **hard-refresh**
   (o navegador dele costuma servir cache). Atualizar estes docs.

## Próxima leva sugerida (gestão de melhorias)
- **Notificações** (item recorrente do dono): começar pelo **in-app** (sino/badge
  em eventos: nova proposta, contra-proposta, serviço aceito, adiantamento,
  pagamento). E-mail/push dependem da Resend/infra.
- **Confirmação de e-mail real:** hoje o cadastro é auto-confirmado (`createAccount`
  com `email_confirm`). Trocar pela confirmação de verdade **exige `RESEND_API_KEY`**
  (pedir ao dono). Código de e-mail pronto em `lib/email.ts`.
- **Varredura mobile:** aplicar o padrão de `flex-wrap`/`overflow-x-hidden` em
  outras telas se o dono apontar mais overflow (ele testa muito no iPhone).
- **Prestador "Meus orçamentos":** aba Trabalho mostra 1 job por vez; criar lista.
- **Online/offline** do prestador: toggle é cosmético; persistir em `profiles`.
- **Reenvio de documentos** após reprovação (fluxo do cadastro).

## Adiado pelo dono
- **Laudos:** exigirão **certificado de técnico**. O dono vai estudar e escrever a regra.
- **Regras finas de pagamento reais:** o split/adiantamento está **modelado e
  simulado**. Números provisórios: `ADVANCE_FEE_RATE = 0.08` e **teto 50%** (em
  `lib/pricing.ts` e `submit_proposal`/UI). Ajustar quando o dono definir.

## Pendência real (depende do dono — Matheus)
### 🔴 Mercado Pago de verdade
Hoje o pagamento é **mock** (`lib/gateway.ts` + `lib/mercadopago.ts`, ativados por
`MP_ACCESS_TOKEN`). Para valer:
- Pedir as **credenciais de teste** (Access Token `TEST-...` + Public Key `TEST-...`).
- Integrar **cobrança** (PIX + cartão + wallets) via Checkout Bricks/Preference e
  **webhook** (URL pública do Render) para confirmar o `retido`.
- **Liberação real do adiantamento** na aprovação do contratante (hoje só marca
  `advance_approved`), e o restante na conclusão.
- **Assinatura recorrente** do Empreiteiro (substituir a ativação simulada).
- Repasse/split ao prestador (marketplace fee).

## Ideias maiores do plano original (ainda não iniciadas)
Do PDF "Serviços e diferenciais": **Fixly Condomínios** (B2B síndicos),
**Agenda Inteligente com IA** (rota/cronograma), **IA real** no roteamento de
categoria (hoje heurística em `lib/categoryRouter.ts`) e nos orçamentos.

## Armadilhas recorrentes desta sessão (ler antes de repetir erro)
- **db:apply quebrado no 0004** → aplicar migrações novas individualmente.
- **Deploy + cache:** depois do push, o dono quase sempre vê a versão **antiga**
  (cache do navegador) OU o deploy ainda está rodando. Sempre confirmar no HTML
  servido (curl+grep de um marcador) antes de dizer "está corrigido", e pedir
  hard-refresh/aba privada.
- **RLS é por linha, não por coluna** → integridade de coluna via trigger
  (`guard_request_changes`). Ver [[feedback-security-review-playbook]].
- **Enums:** não usar `ALTER TYPE ADD VALUE`; para novos estados use coluna `text`
  (ex.: `proposals.counter_status`).
- **Categorias ocultas:** filtrar `.eq("hidden", false)` em TODA query de catálogo
  voltada a contratante/prestador (login, home, solicitar, cadastro, empreiteiro).
- **cwd reseta** para `/Users/matheusneckel/Projetos` — sempre `cd sistema-web`.

## Contas de teste
| Papel | Login | Senha |
|---|---|---|
| Admin | `matheus@dvn.com.br` | `1234` |
| Contratante | `contratante@fixly.com.br` | `fixly1234` |
| Prestador | `prestador@fixly.com.br` | `fixly1234` |

Fluxo ponta a ponta rápido: **Admin → Testes** (link mágico + "Forçar etapa").
Handles públicos de teste: `/p/carlos.eletricista`, `/p/ana.eletrica`, `/p/joao.encanador`.
