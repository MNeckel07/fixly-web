// ============================================================
//  FIXLY — Aplica o schema no Postgres do Supabase
//  Uso:  node --env-file=.env.local scripts/apply-schema.mjs
//  Requer SUPABASE_DB_URL (connection string URI) no .env.local
//  Supabase → Settings → Database → Connection string → URI
// ============================================================

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error(
    "\n❌ Falta SUPABASE_DB_URL no .env.local.\n" +
      "   Copie de: Supabase → Settings → Database → Connection string → URI\n" +
      "   (troque [YOUR-PASSWORD] pela senha do banco).\n",
  );
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const files = [
  "0001_init.sql",
  "0002_dispatch.sql",
  "0003_v2.sql",
  "0004_tickets_multicategoria.sql",
  "0005_ticket_number.sql",
  "0006_security.sql",
];

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  console.log("🔌 Conectando ao Postgres do Supabase...");
  await client.connect();
  for (const f of files) {
    const sql = readFileSync(join(here, "..", "supabase", "migrations", f), "utf8");
    process.stdout.write(`  ▶ aplicando ${f} ... `);
    await client.query(sql);
    console.log("ok");
  }
  console.log("\n✅ Schema aplicado com sucesso.\n");
}

main()
  .catch((e) => {
    console.error("\n❌ Erro ao aplicar schema:", e.message, "\n");
    process.exitCode = 1;
  })
  .finally(() => client.end());
