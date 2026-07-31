// ============================================================
//  FIXLY — Aplica UMA migração, em transação própria.
//
//  Uso:  node --env-file=.env.local scripts/apply-migration.mjs 0022_melhoras_p6.sql
//
//  Por que existe: o `apply-schema.mjs` reroda 0001→N e QUEBRA no 0004
//  (`conversations_type_check` é violado por dados criados a partir do 0008).
//  Então, para migração nova, aplicamos só o arquivo novo — dentro de begin/commit,
//  para que uma falha no meio não deixe o banco pela metade.
// ============================================================

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const file = process.argv[2];
if (!file) {
  console.error("\n❌ Informe o arquivo: node --env-file=.env.local scripts/apply-migration.mjs 0022_melhoras_p6.sql\n");
  process.exit(1);
}

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error("\n❌ Falta SUPABASE_DB_URL no .env.local.\n");
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const path = join(here, "..", "supabase", "migrations", file);
const sql = readFileSync(path, "utf8");

const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  console.log(`▶  aplicando ${file} (${sql.length} bytes)...`);
  await client.query("begin");
  await client.query(sql);
  await client.query("commit");
  console.log(`✅ ${file} aplicada com sucesso.`);
} catch (err) {
  try { await client.query("rollback"); } catch { /* conexão já caiu */ }
  console.error(`\n❌ Falha em ${file} — nada foi aplicado (rollback).\n`);
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
