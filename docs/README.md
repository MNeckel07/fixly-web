# 📚 Documentação do Fixly — Sistema Web

> **Para o Claude de sessões futuras:** leia estes arquivos **antes de mexer no
> código**. Eles têm o estado atual, as armadilhas (que já custaram debugging) e
> o que fazer em seguida. Mantenha-os atualizados ao fim de cada sessão.

## Índice
1. [`01-visao-geral.md`](01-visao-geral.md) — o que é, stack, estado atual, features.
2. [`02-rodar-e-deploy.md`](02-rodar-e-deploy.md) — rodar local, Supabase, deploy Render, domínio, env vars.
3. [`03-arquitetura-e-armadilhas.md`](03-arquitetura-e-armadilhas.md) — estrutura, modelo de segurança/RLS, **armadilhas** (ler!).
4. [`04-migracoes.md`](04-migracoes.md) — o que cada migração 0001–0018 faz.
5. [`05-changelog.md`](05-changelog.md) — histórico das grandes mudanças.
6. [`06-proximos-passos.md`](06-proximos-passos.md) — pendências e instruções pra continuar.
7. [`07-configuracao-servicos.md`](07-configuracao-servicos.md) — **passo a passo do dono**:
   Resend (e-mail) e Mercado Pago (pagamento + split), com as variáveis do Render.
8. [`08-estudo-meios-de-pagamento.md`](08-estudo-meios-de-pagamento.md) — **estudo de taxas**
   (30/07/2026): comparativo de 8 gateways, simulação no ticket real, recomendação
   e o que muda em `pricing.ts`.
9. [`09-plano-mercado-pago.md`](09-plano-mercado-pago.md) — **plano de implementação**:
   fases, spec do **Selo Fix** (fluxo sem cobrança), roteiro de teste e go-live.
10. [`10-ambiente-admin-separado.md`](10-ambiente-admin-separado.md) — **painel em
    domínio próprio** (fixly.fun): como funciona a barreira por `APP_ROLE`, o passo
    a passo do domínio na Hostinger/Render e o que a separação entrega (e o que não).

## TL;DR (o essencial)
- **Marketplace de serviços** (tipo Uber/GetNinjas) com 3 frentes numa app só:
  **contratante**, **prestador**, **admin**. Next.js 16 + Supabase.
- **No ar:** https://fixly.company (Render, auto-deploy do GitHub `MNeckel07/fixly-web`).
- **Local:** `cd sistema-web && npm run dev` → http://localhost:3000
- **Regra de preço (importante):** a **plataforma NÃO define preço**. Quem
  precifica é o **prestador**; o contratante escolhe entre propostas.
- **Pagamento:** Mercado Pago **implementado** (Pix com QR + webhook assinado,
  cartão por Checkout Transparente, estorno, split opcional). Roda em **mock**
  enquanto faltarem as credenciais → ver arquivo **07**.
- **E-mail:** confirmação por **código de 6 dígitos** no cadastro, na recuperação
  e na troca de senha. ⚠️ **Sem `RESEND_API_KEY` o cadastro não conclui** → arquivo **07**.
- **Contas de teste:** admin `matheus@dvn.com.br` / `1234`; contratante e
  prestador `@fixly.com.br` / `fixly1234`. Há um **Modo de Teste** em Admin → Testes.
- ⚠️ **Armadilhas** que vão te morder se não ler o arquivo 03: embed
  `profiles→service_categories` ambíguo (usar hint), host do pooler `aws-1`,
  o `cwd` do bash reseta, PII em `profiles_private`.
