// ============================================================
//  FIXLY — Ensaio de migração: aplica e DESFAZ (rollback sempre).
//
//  Uso:
//    node --env-file=.env.local scripts/dry-run-migration.mjs 0026_melhoras_p7.sql
//    node --env-file=.env.local scripts/dry-run-migration.mjs 0026_melhoras_p7.sql /tmp/checks.sql
//
//  Por que existe: o banco do Fixly é UM SÓ (o de produção). Descobrir erro de
//  sintaxe, constraint violada por dado antigo ou trigger que não faz o que a
//  gente acha DEPOIS do commit custa caro. Aqui roda tudo de verdade — inclusive
//  os dados que já existem — e volta atrás no fim.
//
//  O segundo arquivo (opcional) roda DEPOIS da migração, ainda dentro da mesma
//  transação: é onde ficam os testes ("insere um pedido e confere que o endereço
//  exato saiu da tabela pública"). Cada `select` tem o resultado impresso.
//
//  ⚠️ Rollback não desfaz sequence/`nextval` nem trabalho de fora do Postgres,
//  mas para DDL + DML normal ele volta tudo.
// ============================================================

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, isAbsolute } from "node:path";
import pg from "pg";

const file = process.argv[2];
const checksFile = process.argv[3];
if (!file) {
  console.error("\n❌ Informe a migração: node --env-file=.env.local scripts/dry-run-migration.mjs 0026_melhoras_p7.sql\n");
  process.exit(1);
}

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error("\n❌ Falta SUPABASE_DB_URL no .env.local.\n");
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "..", "supabase", "migrations", file), "utf8");
const checks = checksFile
  ? readFileSync(isAbsolute(checksFile) ? checksFile : join(process.cwd(), checksFile), "utf8")
  : null;

const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  await client.query("begin");
  console.log(`▶  ensaiando ${file} (${sql.length} bytes)...`);
  await client.query(sql);
  console.log("✅ migração rodou sem erro");

  if (checks) {
    console.log("\n▶  conferências:\n");
    const res = await client.query(checks);
    for (const r of Array.isArray(res) ? res : [res]) {
      if (r.command === "SELECT") console.table(r.rows);
    }
  }
} catch (err) {
  console.error(`\n❌ Falhou: ${err.message}`);
  if (err.position) console.error(`   posição ${err.position}`);
  if (err.detail) console.error(`   detalhe: ${err.detail}`);
  process.exitCode = 1;
} finally {
  try { await client.query("rollback"); console.log("\n↩️  rollback — o banco continua como estava."); } catch { /* conexão caiu */ }
  await client.end();
}
