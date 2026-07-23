# 05 — Changelog (grandes marcos)

Ordem cronológica das grandes entregas. Detalhe fino está no `git log`.

## v1 — Base
- Scaffold Next 16 + Supabase; login único + 3 papéis; cadastro com upload de
  documentos + aprovação do admin (e-mail); app do contratante e do prestador;
  schema 0001–0002; deploy Supabase real conectado.

## v2 — Chat, dashboards, pagamento, segurança inicial
- Chat realtime estilo WhatsApp (recibos, anexos); dashboards admin (cadastros,
  vendas); tipos de documento configuráveis; termos de aceite; **sem emojis**
  (ícones lucide); mapa com GPS/rota; pagamento com split + breakdown; Mercado
  Pago plugável (mock). Sidebar colapsável, logout com confirmação.

## v3 — Ajustes de produto + gestão
- Chat corrigido (RLS participantes); página de detalhe do serviço; localização
  GPS+CEP; tickets de suporte; multi-categoria + raio funcional; senha forte;
  logo símbolo; nº da casa obrigatório; avaliação obrigatória; "Meus Serviços";
  **gestão de usuários admin + permissões + login por usuário**; **Modo de Teste**
  (link mágico + forçar etapas).

## v4 — Blindagem de segurança
- **PII → profiles_private**; pagamento server-side; guard de reputação + triggers;
  headers/CSP; `SECURITY.md`. Deploy no Render + domínio `fixly.company` (DNS).

## v5 — Melhorias (docs "Melhoras part1") + Profiler + pivô de preço
- Fase A: 29 categorias + roteamento por texto; Fase B: home com
  Express/Orçamento/Reformas/Profiler.
- **Profiler**: público `/p/<handle>`, portfólio, QR, avaliações, selo, **rede
  social (seguir/feed)** no contratante e no prestador.
- **PIVÔ DE PREÇO**: plataforma não define preço; prestador propõe; contratante
  escolhe entre propostas (Express) ou pede orçamento a um profissional escolhido
  (Orçamento com visita técnica). Precificação (admin) **removida**.
- **Empreiteiros** (B2B, mensalidade sem comissão).
- **Finalização**: cancelamento de serviço (+ reembolso mock), edição de perfil,
  nota de garantia da meritocracia.
- **SEO removido do escopo** (vai ser tratado em outro domínio/projeto à parte).
