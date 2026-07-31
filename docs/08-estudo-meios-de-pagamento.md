# 08 — Estudo de meios de pagamento (Pix e cartão)

> **Levantado em 30/07/2026**, direto nas páginas oficiais de preço de cada
> empresa (fontes no fim). Tarifa de gateway muda sem aviso — **reconfira antes
> de assinar qualquer coisa** e depois atualize este arquivo.

---

## Resumo para quem tem 2 minutos

1. **Nenhum dos candidatos sérios cobra mensalidade.** O critério "custo de uso
   zero" não elimina quase ninguém — ele é atendido por padrão no Brasil. O que
   separa as opções é **quanto pesa por transação no ticket do Fixly**, que é
   baixo (a maioria dos serviços fica entre **R$ 68 e R$ 252**).
2. **No Pix, na nossa faixa de ticket, o Mercado Pago ganha:** 0,99% puro, sem
   tarifa fixa. Concorrentes com tarifa fixa (Asaas R$ 1,99, Pagar.me) são
   *piores* em ticket baixo e só viram vantagem acima de ~R$ 200.
3. **No cartão, o Mercado Pago é o mais caro do comparativo** (4,98% para receber
   na hora). E, do jeito que o código está hoje, **quem paga essa tarifa é o
   prestador** — ela sai do líquido dele. São 33% da nossa comissão em tarifa.
4. **A mudança que realmente zera o nosso custo não é trocar de gateway — é
   repassar a tarifa do cartão para quem escolhe pagar no cartão** (Pix R$ 150 /
   cartão R$ 157,86). É legal no Brasil (Lei 13.455/2017) e é o que todo mundo faz.
5. **Recomendação: ficar no Mercado Pago** (já integrado, melhor conversão, melhor
   Pix para o nosso ticket) **+ duas mudanças de modelo de preço** (item 6).
   Trocar de gateway agora é trabalho grande para economizar centavos por serviço.
6. ⚠️ **Achado no código:** `GATEWAY_FEE_RATES.cartao` está em **3,79%**, mas a
   tarifa real do MP é **4,98%** (na hora). Estamos calculando 1,19 ponto a menos
   do que o MP cobra — a diferença sai do nosso bolso em todo serviço pago no
   cartão. Ver item 7.

---

## 1. Os critérios (o que esse estudo mediu)

| # | Critério | Por que importa para o Fixly |
|---|---|---|
| 1 | **Custo fixo zero** | Exigência sua: sem mensalidade, sem setup, sem aluguel de API |
| 2 | **Pix + cartão de crédito** | Os dois meios pedidos |
| 3 | **Split / marketplace** | O Fixly fica com 15% e o resto é do prestador |
| 4 | **Escrow (retenção)** | O "pagamento protegido" é a promessa do produto: o dinheiro só sai depois que o contratante aprova |
| 5 | **Custo de repassar ao prestador** | O custo escondido: cada serviço gera **um saque**. Isso escala com a *quantidade* de serviços, não com o valor |
| 6 | **Ticket real do Fixly** | Categorias com preço-base R$ 80–180 e faixa de 0,85× a 1,4× → **R$ 68 a R$ 252**. Reformas fogem disso (milhares) |

O critério 6 é o que decide quase tudo. **Tarifa fixa mata ticket baixo:**
R$ 1,99 num serviço de R$ 80 é 2,5%; num de R$ 3.000 é 0,07%.

---

## 2. Tabela comparativa — as taxas de hoje (30/07/2026)

| Gateway | Mensalidade | **Pix (receber)** | **Cartão à vista** | Prazo do cartão | Split nativo | Escrow nativo | Pix de saída (repasse) |
|---|---|---|---|---|---|---|---|
| **Mercado Pago** | não | **0,99%** | **4,98%** na hora · 4,49% D+14 · **3,99% D+30** | escolha sua | ✅ `application_fee` (grátis) | ❌ (fica na nossa conta) | grátis¹ |
| **Asaas** | não | R$ 1,99 fixo² | 2,99% + R$ 0,49 | D+32 (antecipar ~1,15%/mês) | ✅ grátis | ✅ **Conta Escrow** — mas **R$ 99,90/mês + R$ 9,90 por subconta/mês** | 30 grátis/mês, depois R$ 2,00 |
| **Efí (ex-Gerencianet)** | não | 1,19% | 3,49% | D+31 | ✅ Split Pix grátis | ❌ | **grátis** |
| **Pagar.me (Stone)** | não | 1,19% | 4,39% | D+15 | ✅ recebedores | ❌ | R$ 3,67 |
| **AbacatePay** | não | **R$ 0,80 fixo** | 3,5% + R$ 0,60 | D+32 | ❌ não documentado | ❌ | R$ 0,80 (20/mês), depois R$ 2,50 |
| **Woovi / OpenPix** | não | 0,80% (mín R$ 0,50 / **máx R$ 5,00**) ou R$ 0,85 fixo | ❌ **não tem cartão** | — | ✅ Pix Split grátis | ❌ | R$ 1,00 |
| **Stripe** | não | 1,19% (só por convite) | 3,99% + R$ 0,39 | — | ✅ Connect **+0,25%** | ❌ | — |
| **Iugu** | **R$ 49–499/mês** | 0,99% | 4,49%+ | — | ✅ | — | — |

¹ O MP anuncia Pix/TED de saída grátis e ilimitado, mas há material de terceiros
dizendo que **transferência para terceiros** pode ser tarifada conforme o plano.
**Confirmar no contrato** — a nossa fila de saques paga terceiros, não a nós mesmos.
² R$ 0,99 nos 3 primeiros meses. A isenção das "100 primeiras/mês" do Asaas
**não vale** para QR dinâmico de cobrança via API, que é exatamente o nosso caso.

**Já eliminados:**
- **Iugu** — tem mensalidade. Fura o critério 1.
- **Woovi/OpenPix** — não faz cartão. Serviria só como trilho de Pix.
- **Stripe** — Pix só por convite, cartão mais caro que a média BR e ainda soma
  0,25% do Connect. Faz sentido para cobrar fora do Brasil; não é o nosso caso.

---

## 3. Quanto custa de verdade, no ticket do Fixly

Tarifa de recebimento **+ 1 repasse Pix ao prestador** (o modelo escrow que já
está no ar). Entre parênteses, o custo como % do serviço.

### Pix

| Gateway | R$ 80 | R$ 150 | R$ 250 | R$ 800 | R$ 3.000 |
|---|---|---|---|---|---|
| **Mercado Pago** | **R$ 0,79** (0,99%) | **R$ 1,49** (0,99%) | **R$ 2,48** (0,99%) | R$ 7,92 (0,99%) | R$ 29,70 (0,99%) |
| Asaas | R$ 3,99 (4,99%) | R$ 3,99 (2,66%) | R$ 3,99 (1,60%) | R$ 3,99 (0,50%) | R$ 3,99 (0,13%) |
| Efí | R$ 0,95 (1,19%) | R$ 1,79 (1,19%) | R$ 2,98 (1,19%) | R$ 9,52 (1,19%) | R$ 35,70 (1,19%) |
| Pagar.me | R$ 4,62 (5,78%) | R$ 5,46 (3,64%) | R$ 6,65 (2,66%) | R$ 13,19 (1,65%) | R$ 39,37 (1,31%) |
| AbacatePay | R$ 1,60 (2,00%) | R$ 1,60 (1,07%) | **R$ 1,60** (0,64%) | **R$ 1,60** (0,20%) | **R$ 1,60** (0,05%) |
| Woovi (%) | R$ 1,64 (2,05%) | R$ 2,20 (1,47%) | R$ 3,00 (1,20%) | R$ 6,00 (0,75%) | R$ 6,00 (0,20%) |

**Ponto de virada:** até ~R$ 160 o Mercado Pago é o mais barato do mercado no Pix.
Acima disso, quem cobra tarifa fixa passa na frente — e em reforma de R$ 3.000 a
diferença fica gritante (**R$ 29,70 no MP contra R$ 1,60 na AbacatePay**).

### Cartão de crédito à vista

| Gateway | R$ 80 | R$ 150 | R$ 250 | R$ 800 | R$ 3.000 |
|---|---|---|---|---|---|
| **Mercado Pago (na hora)** | R$ 3,98 (4,97%) | R$ 7,47 (4,98%) | R$ 12,45 (4,98%) | R$ 39,84 (4,98%) | R$ 149,40 (4,98%) |
| Mercado Pago (D+30) | R$ 3,19 (3,99%) | R$ 5,98 (3,99%) | R$ 9,97 (3,99%) | R$ 31,92 (3,99%) | R$ 119,70 (3,99%) |
| **Efí (D+31)** | **R$ 2,79** (3,49%) | **R$ 5,24** (3,49%) | **R$ 8,72** (3,49%) | R$ 27,92 (3,49%) | R$ 104,70 (3,49%) |
| Asaas (D+32) | R$ 4,88 (6,10%) | R$ 6,98 (4,65%) | R$ 9,96 (3,98%) | **R$ 26,41** (3,30%) | **R$ 92,19** (3,07%) |
| Asaas (com antecipação) | R$ 5,80 (7,25%) | R$ 8,70 (5,80%) | R$ 12,84 (5,14%) | R$ 35,61 (4,45%) | R$ 126,69 (4,22%) |
| AbacatePay (D+32) | R$ 4,20 (5,25%) | R$ 6,65 (4,43%) | R$ 10,15 (4,06%) | R$ 29,40 (3,67%) | R$ 106,40 (3,55%) |
| Pagar.me (D+15) | R$ 7,18 (8,97%) | R$ 10,25 (6,83%) | R$ 14,64 (5,86%) | R$ 38,79 (4,85%) | R$ 135,37 (4,51%) |

⚠️ **Atenção ao prazo, não só ao percentual.** As opções baratas (Efí, Asaas,
AbacatePay) só são baratas se você **esperar ~30 dias** para receber. O prestador
espera o dinheiro poucos dias depois do serviço aprovado — ou seja, **alguém
banca a antecipação**. Descontando isso (~1,15%/mês), quase todo mundo empata
perto de 4–4,5%, e a vantagem real do MP é receber na hora sem crédito nenhum.

### O que isso faz com a nossa comissão de 15% (Mercado Pago)

| Serviço | Comissão Fixly | Tarifa Pix | Tarifa cartão |
|---|---|---|---|
| R$ 80 | R$ 12,00 | R$ 0,79 = **6,6%** da comissão | R$ 3,98 = **33,2%** da comissão |
| R$ 150 | R$ 22,50 | R$ 1,49 = 6,6% | R$ 7,47 = 33,2% |
| R$ 800 | R$ 120,00 | R$ 7,92 = 6,6% | R$ 39,84 = 33,2% |

**Um terço da comissão vira tarifa quando o cliente paga no cartão.** É o número
mais importante deste documento.

---

## 4. As armadilhas que não aparecem na tabela de preço

### 4.1 Parcelamento sem juros é o buraco mais caro
O MP cobra a tarifa do cartão **+ um adicional por parcela** quando o cliente
parcela "sem juros": +4,59% (2×), +9,96% (6×), **+17,28% (12×)**. Somando a taxa
base, um serviço parcelado em 12× custaria **mais de 22%** — mais que a nossa
comissão inteira. **Regra: parcelamento só com juros repassados ao contratante**
(o MP tem esse modo pronto, é uma flag na criação do pagamento).

### 4.2 "Receber na hora" não vem ligado no começo
O MP avisa que vendedor novo pode não ter a opção de receber na hora nas
primeiras vendas (cai para ~7 dias) até criar histórico. Não quebra nada, mas
**a data de "cai dia X" que mostramos ao prestador vai errar** no arranque.

### 4.3 O custo do repasse escala por serviço, não por valor
Cada serviço = 1 saque. Se o Pix de saída for tarifado em R$ 2,00, 500 serviços
por mês são R$ 1.000/mês em tarifa de transferência — independente de os
serviços serem de R$ 80 ou de R$ 3.000. É o número que mais dói quando o volume
cresce, e é exatamente o que o **split de verdade** elimina.

### 4.4 Chargeback (cartão)
Nenhuma tabela acima cobre o estorno por contestação. No cartão, o contratante
pode contestar **depois** de o prestador já ter sacado — e o prejuízo volta para
quem recebeu, ou seja, para o Fixly. Isso é argumento forte para:
(a) manter o Pix como meio preferido e mais barato;
(b) não liberar adiantamento alto em pagamento no cartão.

---

## 5. Split de verdade × o escrow que temos hoje

Isto não é sobre taxa — é sobre **risco e escala**. Hoje o dinheiro entra na
conta do Fixly, fica retido, e um admin paga o Pix do prestador na mão
(Admin → Saques).

| Arquitetura | Como funciona | Prós | Contras |
|---|---|---|---|
| **Escrow na nossa conta** (hoje) | Dinheiro fica com o Fixly, saque manual | Prestador só precisa de chave Pix; funciona já | Saque manual não escala, erro de chave/fraude interna, e **o dinheiro de terceiros passa por nós** |
| **Split MP por OAuth** | Prestador conecta a conta MP dele; o MP divide na hora | Grátis, tira o dinheiro do nosso fluxo | Prestador **precisa ter conta MP** e **reautorizar a cada ~6 meses**; e **não tem retenção** (perde o "pagamento protegido") |
| **Subcontas Asaas + Conta Escrow** | Criamos a conta do prestador por API; o Asaas retém e libera quando mandamos | É o nosso modelo inteiro, nativo: split + retenção + liberação por API | **R$ 99,90/mês + R$ 9,90 por subconta/mês** (fura o custo zero); KYC completo por prestador; no período de avaliação há limite de 10 subcontas e R$ 2.000 por subconta |

### O ponto regulatório (não bloqueia hoje, mas anote)
O BACEN entende que quem **retém e repassa dinheiro de terceiros** participa do
arranjo de pagamento — a figura do subadquirente/facilitador. A autorização
formal como instituição de pagamento só é exigida a partir de limites de
movimentação (a régua começou em R$ 500 milhões/ano e vem **caindo até 2028** —
já esteve em R$ 300 milhões). **O Fixly está muito longe disso**, então o modelo
atual é o padrão de mercado para quem está começando e não é impedimento agora.
A saída natural, quando o volume crescer, é o split — o dinheiro deixa de passar
por nós. Some-se a isso a reforma tributária, que caminha para exigir split
payment de marketplaces na cobrança de CBS/IBS.

> 📌 **Duas coisas para levar ao contador antes de ligar produção:** (1) o dinheiro
> que entra e sai não é receita nossa — receita é só a comissão de 15%; a
> contabilidade e a nota fiscal precisam refletir isso; (2) qual documento fiscal
> o Fixly emite (intermediação) e qual o prestador emite.

---

## 6. Recomendação

### Fase 1 — agora: continuar no Mercado Pago, mudando o modelo de preço
Trocar de gateway hoje custaria semanas de trabalho para economizar centavos por
serviço — e o MP tem a melhor conversão do Brasil (o cliente reconhece a marca) e
o melhor Pix na nossa faixa de ticket. O que muda:

1. **Repassar a tarifa do cartão a quem escolhe o cartão.** A tela passa a
   mostrar dois preços: *Pix R$ 150,00* / *Cartão R$ 157,86*. Isso é legal
   (Lei 13.455/2017 autoriza preço diferente por meio de pagamento), é o padrão
   do mercado, e resolve duas coisas de uma vez: **o custo do Fixly vai a zero** e
   **o prestador para de perder 5% por uma escolha que não foi dele**.
2. **Parcelamento só com juros ao contratante.** Nunca absorver os +17,28% do 12×.
3. **Pix continua o caminho barato** — 0,99% sai da nossa comissão sem doer
   (6,6% dela) e dá para manter o preço "cheio" no Pix como incentivo.

Resultado: **custo de gateway do Fixly ≈ R$ 0** em ambos os meios, sem trocar
nada de infraestrutura.

### Fase 2 — gatilhos para reavaliar (não faça antes)
| Gatilho | O que fazer |
|---|---|
| Ticket médio passar de ~R$ 300 (reformas virarem parte relevante) | Ligar um **segundo trilho de Pix** por tarifa fixa (AbacatePay R$ 0,80 ou Woovi com teto de R$ 5,00). Em serviço de R$ 3.000 economiza R$ 28 por transação |
| Fila de saques passar de ~100/mês | Migrar para **split de verdade**. Aqui o Asaas (subconta + Conta Escrow) passa a valer a mensalidade: R$ 99,90 se paga sozinha contra o custo do trabalho manual e do risco |
| Volume de cartão ficar alto e o caixa aguentar D+30 | Negociar taxa com o MP (acima de ~R$ 20 mil/mês costuma haver plano comercial) **antes** de trocar de gateway |

`src/lib/gateway.ts` já é uma camada abstrata — trocar ou somar um gateway é
localizado, não é reescrever o sistema. Isso foi feito de propósito.

### O que **não** fazer
- ❌ Não migrar para Asaas agora só pela tarifa de cartão menor: no nosso ticket
  ela é **maior** (R$ 6,98 contra R$ 7,47 em R$ 150 — e isso esperando 32 dias).
- ❌ Não adotar Iugu (mensalidade) nem Stripe (Pix por convite, cartão caro).
- ❌ Não ligar split por OAuth achando que resolve o escrow: **split e retenção
  são coisas opostas** no MP — quem faz split recebe na hora e perde a garantia.

---

## 7. O que muda no código (concreto)

| Onde | Hoje | Deveria ser | Impacto |
|---|---|---|---|
| `pricing.ts` → `GATEWAY_FEE_RATES.cartao` | `0.0379` | **`0.0498`** (na hora) | 🔴 subestima a tarifa em 1,19 pp — a diferença sai do nosso bolso |
| `pricing.ts` → `GATEWAY_FEE_RATES.pix` | `0.0099` | `0.0099` ✅ | confere com a tabela oficial |
| `pricing.ts` → `SETTLEMENT_DAYS.cartao` | `2` | `0` com "na hora" (e `7` enquanto o MP não liberar) | data de crédito mostrada errada ao prestador |
| `pricing.ts` → `paymentBreakdown` | tarifa sai do líquido do **prestador** | tarifa do cartão vira **acréscimo ao contratante** | é a mudança que zera nosso custo |
| Tela de pagamento | preço único | dois preços (Pix / cartão) + parcelas com juros | conversão e transparência |
| `mercadopago.ts` | — | parcelamento **com juros** repassados | evitar os +17,28% do 12× |

`ADVANCE_FEE_RATE` (8% sobre adiantamento) está bem acima do custo real de
antecipar (~1,15%/mês no mercado). Isso não é erro — é margem/prêmio de risco —
mas vale saber que **8% é caro** e pode virar objeção de prestador. Se quiser,
dá para baixar para 3–4% e ainda sobrar margem.

> Nada disso foi alterado ainda: este documento é o estudo que você pediu.
> São ~5 linhas de constante + a tela de pagamento. É só falar.

---

## 8. Para você confirmar antes de ligar produção

1. **Mercado Pago cobra para transferir Pix a terceiros?** (nossa fila de saques
   paga o prestador, não nós mesmos) — se cobrar, entra na conta do item 4.3.
2. **Qual prazo de recebimento a conta do Fixly tem hoje** (na hora / 7 dias) e o
   que exigem para liberar "na hora".
3. **A taxa de 4,98% é a do seu contrato?** Acima de ~R$ 20 mil/mês costuma haver
   plano comercial melhor — vale perguntar já.
4. **Contador:** tratamento da receita (só a comissão) e da nota fiscal de
   intermediação.

---

## Fontes (consultadas em 30/07/2026)

- [Mercado Pago — custos do link de pagamento](https://www.mercadopago.com.br/ferramentas-para-vender/link-de-pagamento) · [Quanto custa vender online](https://www.mercadopago.com.br/blog/quanto-custa-vender-on-line-com-mercado-pago) (atualizado 25/06/2026) · [Split de pagamento](https://www.mercadopago.com.br/blog/split-de-pagamento-dividir-comissoes-automaticamente)
- [Asaas — preços e taxas](https://www.asaas.com/precos-e-taxas) · [Split de pagamentos (docs)](https://docs.asaas.com/docs/split-de-pagamentos) · [Criação de subcontas](https://docs.asaas.com/docs/criacao-de-subcontas) · [Conta Escrow](https://docs.asaas.com/docs/introducao-conta-escrow) · [Pix Asaas](https://blog.asaas.com/pix-asaas/)
- [Efí Bank — tarifas](https://sejaefi.com.br/tarifas)
- [Pagar.me — ofertas/taxas](https://www.pagar.me/ofertas)
- [AbacatePay — preços](https://www.abacatepay.com/pricing)
- [Woovi/OpenPix — planos e preços](https://openpix.com.br/pricing/)
- [Stripe Brasil — preços](https://stripe.com/br/pricing)
- [Baptista Luz — FAQ da regulação do BACEN sobre marketplaces](https://baptistaluz.com.br/espacostartup/faq-nova-regulacao-do-bacen-sobre-marketplaces/) · [Levy & Salomão — quando pedir autorização como instituição de pagamento](https://www.levysalomao.com.br/publicacoes/artigo/instituicoes-de-pagamento-quando-pedir-autorizacao) · [iugu — regras do Bacen para marketplaces](https://www.iugu.com/blog/novas-regras-bacen-marketplaces)
