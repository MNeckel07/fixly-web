# 06 — Próximos passos e instruções para a próxima sessão

## Como começar uma nova sessão (checklist)
1. Ler `docs/README.md` e `docs/03-arquitetura-e-armadilhas.md`.
2. `cd sistema-web` e conferir que builda: `npx tsc --noEmit && npm run build`.
3. Ver `git log --oneline | head` para o que foi feito por último.
4. Se for mexer no banco: criar migração nova em `supabase/migrations/`, adicionar
   na lista de `scripts/apply-schema.mjs`, aplicar com `db:apply`.
5. Ao terminar: `tsc` + `build` + commit + `git push origin main` (Render publica),
   e **atualizar estes docs** (changelog + este arquivo).

## Pendência real (depende do dono — Matheus)
### 🔴 Mercado Pago de verdade
Hoje o pagamento é **mock** (`lib/gateway.ts` + `lib/mercadopago.ts`, ativados por
`MP_ACCESS_TOKEN`). Para valer:
- Pedir ao dono as **credenciais de teste** do Mercado Pago (Access Token `TEST-...`
  + Public Key `TEST-...`) e depois as de produção.
- Integrar **cobrança** do serviço (PIX com QR + cartão + wallets) via Checkout
  Bricks/Preference, e **webhook** (URL pública do Render) para confirmar o `retido`.
- Integrar **assinatura recorrente** do Empreiteiro (substituir a ativação
  simulada em `app/admin/empreiteiros/actions.ts` / `EmpreiteiroForm`).
- Repasse/split ao prestador (marketplace fee) — o breakdown já existe; falta o
  split real (pode exigir cada prestador conectar conta MP, ou payout manual).

## Refinos opcionais (não bloqueiam)
- **Resend real:** setar `RESEND_API_KEY` (hoje os e-mails de aprovação viram
  preview no log). Código pronto em `lib/email.ts`.
- **Prestador "Meus orçamentos":** a aba **Trabalho** mostra **1** job por vez.
  Se o prestador tiver vários orçamentos pendentes, criar uma lista dedicada.
- **Empreiteiro:** fotos/portfólio no anúncio; hoje é só texto.
- **Online/offline** do prestador: o toggle é cosmético (não persiste). Persistir
  em `profiles` + filtrar dispatch por online.
- **Reenvio de documentos** após reprovação (fluxo do cadastro).
- **Notificações** além do badge de chat (e-mail/push em eventos: nova proposta,
  serviço aceito, pagamento etc.).
- **Limpar legado:** `pricing_rules` (tabela sem uso) e migrações 0009/0010 podem
  ser marcadas como legado (não remover sem cuidado — `db:apply` roda tudo).

## Ideias maiores do plano original (ainda não iniciadas)
Do PDF "Serviços e diferenciais": **Fixly Condomínios** (B2B síndicos),
**Agenda Inteligente com IA** (rota/cronograma), **IA real** no roteamento de
categoria (hoje é heurística por palavra-chave em `lib/categoryRouter.ts`) e nos
orçamentos automáticos, **assinaturas Premium** para prestadores.

## Contas de teste
| Papel | Login | Senha |
|---|---|---|
| Admin | `matheus@dvn.com.br` | `1234` |
| Contratante | `contratante@fixly.com.br` | `fixly1234` |
| Prestador | `prestador@fixly.com.br` | `fixly1234` |

Para testar o fluxo ponta a ponta rápido: **Admin → Testes** (link mágico p/
entrar como as contas + "Forçar etapa" de um serviço de teste). Handles públicos
de teste: `/p/carlos.eletricista`, `/p/ana.eletrica`, `/p/joao.encanador`.
