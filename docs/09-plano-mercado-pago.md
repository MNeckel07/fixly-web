# 09 — Plano de implementação do pagamento (Mercado Pago + Selo Fix)

> Escrito em **30/07/2026**, depois do estudo de taxas (arquivo `08`) e das
> decisões do dono nesta data. Este arquivo é o roteiro da implementação: o que
> já existe, o que eu faço, o que só o Matheus pode fazer, e como testar.

---

## 1. Ponto de partida: o código de pagamento JÁ ESTÁ PRONTO

Isto não é uma implementação do zero. Desde a v8 está tudo escrito e rodando
local em modo simulado.

> 🔴 **Mas NÃO está publicado.** Descoberto em 30/07/2026: a v8 inteira nunca foi
> commitada — o `main` estava no commit da v7 e o `fixly.company` respondia
> **404** na rota do webhook. O banco, esse sim, já tinha a migração `0022`
> aplicada. Doc não é prova de deploy: conferir com `curl` numa rota que só
> existe na versão nova.

| Peça | Arquivo | Estado |
|---|---|---|
| Camada de gateway (abstrata) | `src/lib/gateway.ts` | ✅ pronta, cai em mock sem credencial |
| Integração Mercado Pago | `src/lib/mercadopago.ts` | ✅ Pix, cartão, estorno, OAuth |
| Webhook **com assinatura** | `src/app/api/pagamentos/webhook/route.ts` | ✅ valida HMAC, recusa 401 sem secret |
| Tela de pagamento + QR Pix | `ServiceDetail.tsx` / `PixPanel.tsx` | ✅ com polling de segurança a cada 5 s |
| Escrow + carteira + saques | migração `0022` (`provider_balance`, `withdrawals`) | ✅ |
| Conta do valor (comissão/tarifa) | `src/lib/pricing.ts` | ⚠️ constantes desatualizadas (item 4.2) |

**Conclusão:** falta **credencial** (só o dono faz), **três mudanças de código**
(itens 4.1 a 4.3) e **teste ponta a ponta**. Não há reescrita.

---

## 2. Decisões tomadas em 30/07/2026

| # | Decisão | Efeito |
|---|---|---|
| 1 | **Fluxo com selo é ambiente de teste** — não continua, não gera dinheiro, ninguém recebe nem paga | Serviço com selo **não cria linha em `payments`**, não entra na carteira do prestador nem no faturamento |
| 2 | **O selo vale para os dois lados** (contratante e prestador) | Dá para rodar o processo inteiro ponta a ponta sem dinheiro |
| 3 | **Sem cobrança exige selo NOS DOIS LADOS** | Se o prestador que aceitar não tiver selo, a cobrança **entra em vigor** normalmente |
| 3b | **Isolamento assimétrico** no disparo | Prestador com selo só recebe pedido de conta com selo; pedido de conta com selo **pode** ir para prestador real |
| 4 | **Taxa do cartão vai para quem escolhe cartão** (estudo `08`) | Pix R$ 150,00 / Cartão R$ 157,86 — custo da Fixly vai a zero |

---

## 3. Spec do **Selo Fix**

### O que é
Uma marca que o admin liga em contas específicas (`Admin → Usuários`). Conta com
selo roda o fluxo completo do site **sem gateway de pagamento no meio** — serve
para validar front e back em produção, demonstrar o produto e treinar equipe.

### Regras
1. **Quem liga:** só admin, em `Admin → Usuários`. O trigger do banco
   (`guard_profile_changes`) passa a **bloquear** qualquer tentativa de um
   usuário marcar o próprio selo — mesma proteção que já existe para `role` e
   `status`.
2. **Sem cobrança exige selo nos DOIS lados** (a regra mais importante). A opção
   de pular o pagamento só aparece quando **contratante e prestador** têm selo.
   Basta um dos lados ser conta real para a cobrança entrar em vigor — é o caso
   do Arthur e de **toda conta nova**, que nasce sem selo.
3. **Isolamento assimétrico** no disparo (`dispatch_request`):
   - prestador **com** selo **não** recebe pedido de contratante **sem** selo —
     protege o cliente real de receber proposta de uma conta de vitrine;
   - contratante **com** selo **continua** alcançando prestador real — é assim
     que o Arthur pega um serviço e o pagamento entra em vigor.
4. **Na hora de pagar**, quando os dois lados têm selo, aparecem **duas** opções:
   - *Pagar normalmente* (Pix/cartão de verdade — continua disponível);
   - *Seguir sem pagamento (Selo Fix)* — pula a cobrança e o serviço anda.
4. **Sem dinheiro nenhum:** o caminho sem pagamento **não** grava em `payments`.
   Logo: não entra na carteira do prestador, não aparece em `Admin → Vendas`,
   não gera saque. Não precisa de regra nova em lugar nenhum — é consequência de
   não existir a linha.
5. **Rastro visível:** o serviço fica marcado (`no_charge = true`) e a tela mostra
   a tarja **"Selo Fix — serviço sem cobrança"** para os dois lados e no admin.
   Ninguém confunde com serviço real.
6. **O resto do fluxo é idêntico:** proposta, aceite, "a caminho", conclusão do
   prestador, aprovação do contratante, avaliação. É exatamente o que se quer
   testar.

### Quem recebe o selo (definido pelo dono em 30/07/2026)
**Todos, menos o Arthur.** Ou seja: Matheus (Admin), Equipe Fixly, Carlos
Oliveira, João Mendes, Ana Paula Lima, Robson, Roberto Alves e Marina Souza
ficam com selo. **Arthur Oliveira fica sem** — se ele aceitar um serviço, a
cobrança entra em vigor.

**Toda conta nova nasce sem selo** (`default false`), então o site já é "real"
para quem se cadastrar amanhã. É por isso que a coluna tem esse default e não o
contrário.

### Por que NÃO reaproveitar o `is_test` que já existe
`is_test` é a flag das **contas semente** e libera o *link mágico* de
impersonação (`Admin → Testes` entra na conta). Dar isso a um usuário real seria
abrir uma porta de invasão de conta. O Selo Fix é outra coisa: **não** libera
impersonação, só dispensa o pagamento.

---

## 4. O que eu implemento (3 frentes)

### 4.1 Selo Fix — migração `0023` + telas
```sql
alter table public.profiles
  add column if not exists fix_badge boolean not null default false;
alter table public.service_requests
  add column if not exists no_charge boolean not null default false;
```
- `guard_profile_changes`: incluir `fix_badge` na lista que só admin muda.
- `dispatch_request`: `and (client_badge or not p.fix_badge)` — o isolamento
  assimétrico da regra 3.
- `Admin → Usuários`: chave liga/desliga por usuário + coluna na listagem.
- `ServiceDetail`: botão "Seguir sem pagamento" + tarja, quando `fix_badge`.
- `pay.actions.ts`: nova server action `skipPayment(requestId)` — confere o selo
  **no servidor** (nunca confia na tela), marca `no_charge` e põe o pedido em
  `a_caminho`.

> ⚠️ Migração **aditiva** (colunas com default `false`): pode ser aplicada antes
> do push sem quebrar o que está no ar. Diferente do caso de
> [[feedback_migracao_antes_do_deploy]].

### 4.2 Taxas corrigidas + repasse do cartão (`pricing.ts`)
| Constante | Hoje | Vira |
|---|---|---|
| `GATEWAY_FEE_RATES.cartao` | 3,79% | **4,98%** (tarifa real do MP na hora) |
| `SETTLEMENT_DAYS.cartao` | 2 | 1 (com "na hora", o prazo passa a ser a NOSSA janela de saque, não a do MP) |
| Modelo | tarifa sai do líquido do **prestador** | tarifa do **cartão** vira acréscimo ao contratante |

Conta nova, para um serviço de R$ 150:

| | Pix | Cartão |
|---|---|---|
| Contratante paga | R$ 150,00 | **R$ 157,86** |
| Tarifa do MP | R$ 1,49 (sai da comissão da Fixly) | R$ 7,86 (paga pelo acréscimo) |
| Comissão Fixly (15%) | R$ 22,50 → líquido R$ 21,01 | R$ 22,50 |
| **Prestador recebe** | **R$ 127,50** | **R$ 127,50** |

O prestador passa a receber **o mesmo nos dois meios** — hoje ele perde ~5%
quando o cliente escolhe cartão, sem ter escolhido nada.
> O acréscimo é `valor / (1 - taxa)`, não `valor × (1 + taxa)`: a tarifa incide
> sobre o total cobrado. Errar isso deixa a conta ~R$ 0,40 curta em R$ 150.

### 4.3 Endurecimento para dinheiro real
- **Parcelamento com juros repassados** (evita os +17,28% do 12× sem juros).
- **Expiração do Pix** (hoje o QR não tem prazo explícito) + estado "expirado".
- **Conciliação:** tela do admin para ver pagamento no MP × `payments` no banco.

---

## 5. O que só o Matheus pode fazer

O passo a passo detalhado está em **[`07-configuracao-servicos.md`](07-configuracao-servicos.md)**
(seção 2). Resumo da ordem correta:

1. Criar a aplicação no MP: **Checkout Transparente** + modelo **Marketplace**.
2. Copiar as credenciais de **TESTE** → colar em `sistema-web/.env.local`
   (`MP_ACCESS_TOKEN`, `NEXT_PUBLIC_MP_PUBLIC_KEY`).
3. Cadastrar o webhook `https://fixly.company/api/pagamentos/webhook`, evento
   **payment**, e copiar a **assinatura secreta** → `MP_WEBHOOK_SECRET`.
4. Rodar o diagnóstico (script novo, criado nesta sessão):
   ```bash
   cd sistema-web
   node --env-file=.env.local scripts/check-mp.mjs
   ```
   Ele responde, sem imprimir credencial: token válido? teste ou produção?
   public key do mesmo ambiente? Pix e cartão ativos? webhook no ar e assinatura
   batendo? Com `--pix` cria uma cobrança real de R$ 0,01 e devolve o
   copia-e-cola; `--cancel <id>` desfaz.
5. Só depois de tudo verde: credenciais de **produção** no Render + refazer o
   webhook com a assinatura de produção.

> 🔴 **Misturar ambientes é o erro nº 1**: `MP_ACCESS_TOKEN` de produção com
> `NEXT_PUBLIC_MP_PUBLIC_KEY` de teste faz o cartão falhar com uma mensagem que
> não explica nada. O `check-mp.mjs` detecta isso na hora.

---

## 6. Roteiro de teste (na ordem)

| # | Teste | Como | Esperado |
|---|---|---|---|
| 1 | Selo Fix ponta a ponta | conta com selo: pedir → proposta → aceitar → *Seguir sem pagamento* → concluir → aprovar → avaliar | fluxo inteiro sem tela de cobrança; nada em Vendas nem na carteira |
| 2 | Isolamento | pedido de conta com selo | **não** aparece para prestador real |
| 3 | Pix real (teste) | credencial TEST + `--pix` ou pela tela | QR aparece, webhook confirma, pedido vai para "a caminho" |
| 4 | Cartão aprovado | cartão de teste `5031 4332 1540 6351`, nome **APRO** | pagamento retido na hora |
| 5 | Cartão recusado | mesmo cartão, nome **OTHE** | mensagem clara, sem gravar pagamento |
| 6 | Acréscimo do cartão | comparar as duas telas | Pix R$ 150,00 / cartão R$ 157,86, prestador R$ 127,50 nos dois |
| 7 | Aprovação libera | contratante aprova | `payments.status = liberado` + carteira do prestador com data |
| 8 | Estorno | cancelar com pagamento retido | estorna no MP **antes** de marcar no banco |
| 9 | Produção R$ 1,00 | credencial real, seu Pix | dinheiro cai na conta MP da empresa |

---

## 7. Go-live e volta atrás

**Ordem do go-live:** aplicar `0023` (aditiva, segura) → push → confirmar no HTML
servido (curl + grep) → só então trocar as credenciais do Render para produção.

**Se der errado:** apagar `MP_ACCESS_TOKEN` do Render. O `gateway.ts` volta
sozinho para o modo simulado e o site continua de pé — ninguém fica com a tela
travada. É a razão de a camada abstrata existir.

---

## 8. Riscos conhecidos

| Risco | Mitigação |
|---|---|
| Serviço com selo virar serviço real por engano | `no_charge` grava no pedido e a tarja aparece nas 3 frentes; sem linha em `payments` não há como sacar |
| Alguém ligar o próprio selo | trigger do banco bloqueia; a server action confere o selo no servidor |
| "Receber na hora" não liberado no início | o MP pode segurar em ~7 dias nas primeiras vendas — a data mostrada ao prestador vai errar; conferir no painel |
| Webhook perdido | a tela já faz polling a cada 5 s como rede de segurança |
| Chargeback depois do saque | manter Pix como meio preferido; não liberar adiantamento alto no cartão |
