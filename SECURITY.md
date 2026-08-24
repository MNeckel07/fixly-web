# Fixly — Auditoria e Postura de Segurança

Auditoria pensando como atacante ("por onde eu invadiria?") sobre o sistema-web
(Next.js 16 + Supabase). Abaixo: o que foi encontrado, o que foi **corrigido** e
o que ainda é **recomendado** antes/depois de ir a produção.

## Corrigido nesta rodada

### 🔴 Crítico — Vazamento de PII e dados bancários
- **Antes:** a política RLS de `profiles` liberava a leitura de **todas as
  colunas** de **todos os prestadores aprovados** para **qualquer usuário
  logado**. Um "contratante" malicioso podia coletar CPF, RG, dados bancários,
  chave PIX, endereço, telefone e e-mail de todos os prestadores.
- **Correção:** dados sensíveis movidos para a tabela **`profiles_private`**
  (RLS: só o próprio dono e o admin leem). `profiles` guarda apenas dados
  profissionais públicos (nome, cidade, categoria, nota, bio, localização
  aproximada). Migração `0006_security.sql`.

### 🔴 Crítico — Adulteração do valor de pagamento
- **Antes:** `processPayment(requestId, amount)` confiava no **valor enviado
  pelo navegador** — dava para pagar R$ 1 num serviço caro.
- **Correção:** o valor é **derivado no servidor** a partir da proposta aceita
  (gerada no backend). A escrita na tabela `payments` passou a exigir **chave de
  servidor** (RLS bloqueia escrita direta pelo cliente).

### 🟠 Alto — Escalonamento de privilégio / fraude de reputação
- **Antes:** o usuário podia atualizar o próprio perfil, e o *guard* só barrava
  `role`/`status`. Ou seja: um prestador podia **inflar a própria nota e o nº de
  serviços**, ou **se reativar** após ser inativado pelo admin.
- **Correção:** o *guard* agora protege `role`, `status`, `active`, `rating`,
  `jobs_done`, `reviewed_at/by`, `reject_reason`. Nota e contagem de serviços são
  calculadas por **trigger confiável** no banco (`on_request_completed`), não
  editáveis pelo usuário. A migração `0033` estende a proteção ao **INSERT**:
  cadastro público só pode nascer não-admin e `pendente`, tanto pela policy RLS
  quanto pelo trigger. Isso fecha a criação direta de perfil
  `admin`/`aprovado` pelo PostgREST.

### 🟡 Médio — Cabeçalhos e superfície
- **CSP restritiva** (só Supabase, tiles OSM, Nominatim, ViaCEP, Mercado Pago),
  `X-Frame-Options: DENY` + `frame-ancestors 'none'` (anti-clickjacking),
  **HSTS**, `X-Content-Type-Options: nosniff`, `Referrer-Policy`,
  `Permissions-Policy` (geoloc só self; câmera/microfone bloqueados),
  `poweredByHeader` desligado.
- `src/lib/supabase/server.ts` marcado **`server-only`** (impede import acidental
  da chave de servidor no bundle do cliente).
- Senha mínima de **8 caracteres** no cadastro.

### 🟠 Alto/Médio — revisão completa de autorização (migrações 0033/0034)
- Cadastro direto pelo PostgREST não consegue mais nascer `admin`/`aprovado`.
- `provider_balance(uuid)` não expõe mais o faturamento de outro prestador;
  chamadas anônimas são recusadas e usuário comum só consulta o próprio UUID.
- Mensagens são imutáveis depois do envio. Participantes atualizam apenas os
  recibos `delivered_at` e `read_at`, sem alterar autoria, corpo ou anexos.
- Login por nome de usuário resolve o e-mail e autentica na mesma Server Action,
  com limite por IP e resposta genérica; nenhum e-mail administrativo é
  devolvido ao navegador.
- A consulta periódica de pagamento agora confirma a titularidade do pedido
  antes de acessar o gateway ou promover o serviço para `a_caminho`.

## Já estava correto (verificado)
- **Autorização de Server Actions:** toda ação sensível revalida no servidor —
  admin (`assertAdmin`), dono do pedido (`client_id === user.id`), participante
  do chat. Nenhuma confia só no cliente.
- **RLS em todas as tabelas**, com `is_admin()`/`is_conversation_participant()`
  em `SECURITY DEFINER` (sem recursão).
- **Documentos e anexos** em buckets **privados**, com acesso só por **URL
  assinada** temporária; upload restrito à pasta do próprio usuário/conversa.
- **Proxy** protege `/app` e `/admin`; papel reforçado nos layouts.
- Segredos só em `.env.local` (gitignored); navegador usa apenas a chave
  *publishable*.
- **XSS:** React escapa por padrão; não há `dangerouslySetInnerHTML`.

## Recomendações antes de escalar (não bloqueiam o MVP)
1. **Confirmação de e-mail:** hoje está desligada (para o protótipo). Reative no
   Supabase antes de abrir cadastro público, ou exija verificação por SMS.
2. **Proteção de senha vazada + política de força:** ative em Supabase →
   Authentication → Policies ("Leaked password protection", tamanho mínimo).
3. **MFA para admin** e, idealmente, **deploy separado** do painel
   (`admin.fixly.company`) com allowlist de IP/VPN.
4. **Rate limiting** de login/cadastro (Supabase Auth já limita; adicionar
   proteção extra em endpoints públicos/RPC se necessário).
5. **Webhook do gateway** (Mercado Pago) deve ser a **fonte de verdade** do
   status de pagamento em produção (validar assinatura), não o cliente.
6. **Localização do prestador:** hoje a lat/lng é visível a usuários logados
   (necessária para o mapa). Considerar **arredondar** para não expor o endereço
   exato de casa.
7. **Backups e PITR** no Supabase, e revisão periódica das policies.
8. Rodar `npm audit` / Dependabot no CI.
