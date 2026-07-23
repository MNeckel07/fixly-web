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

## TL;DR (o essencial)
- **Marketplace de serviços** (tipo Uber/GetNinjas) com 3 frentes numa app só:
  **contratante**, **prestador**, **admin**. Next.js 16 + Supabase.
- **No ar:** https://fixly.company (Render, auto-deploy do GitHub `MNeckel07/fixly-web`).
- **Local:** `cd sistema-web && npm run dev` → http://localhost:3000
- **Regra de preço (importante):** a **plataforma NÃO define preço**. Quem
  precifica é o **prestador**; o contratante escolhe entre propostas.
- **Pagamento:** escrow **simulado** (mock). Mercado Pago real é a maior
  pendência (precisa das credenciais do dono).
- **Contas de teste:** admin `matheus@dvn.com.br` / `1234`; contratante e
  prestador `@fixly.com.br` / `fixly1234`. Há um **Modo de Teste** em Admin → Testes.
- ⚠️ **Armadilhas** que vão te morder se não ler o arquivo 03: embed
  `profiles→service_categories` ambíguo (usar hint), host do pooler `aws-1`,
  o `cwd` do bash reseta, PII em `profiles_private`.
