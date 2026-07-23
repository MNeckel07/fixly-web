# 01 — Visão geral

## O que é
**Fixly** — marketplace de serviços domésticos e de obra (tipo Uber/GetNinjas).
Uma única aplicação web com **3 experiências por papel (role)**:
- **Contratante** — pede serviços, recebe propostas, escolhe, paga (escrow), avalia.
- **Prestador** — recebe pedidos, propõe preço, executa, recebe (menos comissão/tarifa).
- **Admin** — aprova cadastros, gerencia usuários/permissões, vendas, suporte, testes.

Login único (`/login`) → escolhe o papel → entra na área correspondente.

## Stack
- **Next.js 16** (App Router, Server Actions, Turbopack) + **TypeScript**
- **Tailwind CSS v4**
- **Supabase** — Postgres, Auth, Storage, **RLS** (segurança no banco)
- **Leaflet + OpenStreetMap** — mapa/rota (sem chave/custo)
- **qrcode** — cartão QR do Profiler
- **Resend** — e-mails (hoje em preview; falta a API key)
- **Mercado Pago** — pagamento (hoje **mock**; falta credencial)
- Deploy: **Render** + domínio **fixly.company** (Hostinger)

## Marca
Amarelo `#FFC107`, tinta escura `#1F2329`. Fonte **Poppins**. Logo símbolo em
`public/fixly-symbol.png` (componente `src/components/ui/Logo.tsx`). **Sem emojis
na UI** — ícones `lucide-react` (mapeados em `src/components/ui/icons.tsx`).

## Estado atual (o que está pronto)
Praticamente tudo o que foi planejado. Frentes:

**Contratante**
- Home com entradas: **Express** (imediato), **Solicitar Orçamento** (visita
  técnica), **Reformas** (categorias de obra), **Pesquisar Profiler**, **Empreiteiros**.
- Busca por texto livre ("Não encontrou? descreva") → roteia por palavra-chave
  (`src/lib/categoryRouter.ts`).
- **29 categorias** (serviços comuns + obra).
- Fluxo **Express**: cria pedido (sem preço) → página do serviço mostra as
  **propostas** (nome, preço, nota, Selo, "Ver perfil e avaliações") → escolhe →
  paga (escrow, breakdown) → acompanha no mapa → **avalia (estrelas + comentário obrigatório)**.
- Fluxo **Orçamento**: escolhe categoria → escolhe um profissional (Profilers) →
  chat direto → combina visita → prestador **envia o valor** → contratante paga.
- **Meus Serviços** (histórico), **Suporte** (tickets), **Perfil** (editável),
  **cancelamento** de serviço (com reembolso mock).

**Prestador**
- **Pedidos** disponíveis (filtrados por **raio** e **categoria**) → envia
  **proposta com preço livre**.
- **Trabalho** (job ativo): rota até o cliente, concluir; no modo Orçamento,
  **envia o valor**; pode **recusar**.
- **Ganhos** (breakdown por serviço), **Meu Profiler** (portfólio + comunidade),
  **Suporte**, **Perfil** (dados + área de atendimento).

**Profiler** (motor de divulgação)
- Página **pública** `/p/<handle>` (sem login): portfólio de fotos, avaliações,
  **Selo Fixly** (≥4,5★) + nota de **garantia**, seguidores, **cartão com QR**.
- **Rede social**: seguir + **feed** (abas Explorar/Seguindo) no contratante e no prestador.

**Empreiteiros** (B2B)
- Diretório "quero achar um empreiteiro", cadastro do anúncio, **mensalidade sem
  comissão** (assinatura hoje **simulada**). Admin gerencia assinaturas.

**Admin**
- Visão geral, Aprovações (com chat embutido + e-mail), **Usuários & permissões**
  (cria admins, login por usuário/e-mail), Vendas (gráficos), Serviços, Suporte
  (tickets), Equipe (chat interno), Documentos (tipos configuráveis), Empreiteiros,
  **Modo de Teste**. Menu filtrado por permissão.

**Segurança** — ver arquivo 03. PII isolada, escrow server-side, RLS em tudo,
headers/CSP, guard de reputação. Auditoria em `SECURITY.md` (raiz do repo).
