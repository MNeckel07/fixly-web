# Provas (checks)

Dois tipos de arquivo, os dois pensados para rodar **contra o banco real sem
sujá-lo** ou **sem banco nenhum**:

| arquivo | como roda |
|---|---|
| `*.sql` | dentro da transação do `dry-run-migration.mjs` (tudo volta atrás no fim) |
| `*.test.ts` | `node --experimental-strip-types --test scripts/checks/<arquivo>` |

```bash
# regra de negócio pura (sem banco, sem gateway, sem navegador)
node --experimental-strip-types --test scripts/checks/politica-cancelamento.test.ts

# provas que precisam do banco (aplicam a migração, testam e dão rollback)
node --env-file=.env.local scripts/dry-run-migration.mjs \
  0036_frete_negociacao_contestacao_cancelamento.sql \
  scripts/checks/0036_negociacao_e_contestacao.sql
```

⚠️ Esta pasta está no `exclude` do `tsconfig.json`. Os testes importam com
extensão (`../../src/lib/cancellation.ts`) porque é o que o Node exige para
rodar TypeScript direto — e o `tsc` do Next recusa esse formato
(`allowImportingTsExtensions`). Excluir a pasta mantém os dois felizes: o
`npm run build` ignora, e o Node roda.

⚠️ Nos `.sql`, leia os ids que o teste precisa **antes** de assumir uma sessão
(`request.jwt.claims`): depois disso a RLS vale, e um `select` de perfil de
admin feito "como prestador" volta vazio — o `sub` sai nulo e o teste falha com
"Sem permissão" sem dizer por quê.
