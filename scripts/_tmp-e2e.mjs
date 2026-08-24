import pg from "pg";
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

const CLIENTE = (await c.query(`select id from profiles where full_name='Marina Souza' and is_test`)).rows[0].id;
const PREST   = (await c.query(`select id from profiles where full_name='Carlos Oliveira' and is_test`)).rows[0].id;
const CAT     = 'f2616422-0004-46d9-892e-71d9fd488146';

// Serviço sintético: 8 dias desde a conclusão do prestador, SEM pagamento
// (caminho no_charge/Selo) — exercita o laço sem tocar em dinheiro real.
const ins = await c.query(`
  insert into service_requests
    (client_id, provider_id, category_id, description, status, mode, no_charge, provider_done_at, address, created_at)
  values ($1,$2,$3,'[TESTE AUTOMATIZADO] liberacao de escrow — apagar','aceito','express',true,
          now() - interval '8 days','Centro - Curitiba/PR', now() - interval '12 days')
  returning id`, [CLIENTE, PREST, CAT]);
const id = ins.rows[0].id;
console.log("pedido sintetico criado:", id);
console.log("estado antes:", JSON.stringify((await c.query(`select status, provider_done_at from service_requests where id=$1`,[id])).rows));
await c.end();
console.log("ID=" + id);
