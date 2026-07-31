# 06 — Próximos passos e instruções para a próxima sessão

# 🔴🔴 COMECE POR AQUI: FALTA O PUSH E A PRODUÇÃO ESTÁ QUEBRADA

**Situação em 2026-07-30 (fim da sessão da v9):** o trabalho das versões **v8,
v8.1, v8.2 e v9 está COMMITADO**, mas **não foi publicado** — o dono precisa
autorizar o push. Enquanto isso, o que roda no `fixly.company` é a **v7**.

**Como isso foi descoberto:** o `check-mp.mjs` apontado para produção devolveu
**404** na rota `/api/pagamentos/webhook`. Rota nova que responde 404 = código
não subiu (503 seria "subiu e falta variável"). A `docs/06` afirmava, até então,
que a v8 estava "no ar em modo degradado" — **doc não é prova de deploy**.

**Por que é urgente:** a migração **0022 JÁ FOI APLICADA no banco de produção**,
e ela aperta uma regra — só o contratante pode concluir um serviço. O código que
está **no ar** ainda conclui pelo prestador, então **"Concluir serviço" está
quebrado em produção** desde então.

```bash
cd sistema-web
npx tsc --noEmit && npm run build     # limpo em 30/07
git push origin main                  # Render publica sozinho
# depois: curl -s https://fixly.company/api/pagamentos/webhook  → tem que sair do 404
```
O push também é o que ativa a **Brevo** em produção (as variáveis já estão no
Render, mas o código que fala com ela não subiu).

> 🔴 **Antes do push, decidir sobre o Mercado Pago.** O Render **não** tem
> `MP_ACCESS_TOKEN`. Sem ela o `gateway.ts` cai no **modo mock**: o serviço é
> marcado como pago sem entrar dinheiro nenhum. Com o **Arthur** (única conta
> real, sem Selo Fix) isso é risco de verdade. Ou sobem as credenciais junto com
> o push, ou o pagamento em produção fica fingindo.

## PONTO DE PARADA EXATO (30/07/2026)

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

## Estado atual (2026-07-30)
- **Migrações aplicadas:** 0001–**0023**.
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
