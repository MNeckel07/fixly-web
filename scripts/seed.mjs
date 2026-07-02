// ============================================================
//  FIXLY — Seed de usuários de teste (3 frentes)
//  Uso:  node --env-file=.env.local scripts/seed.mjs
//  Requer SUPABASE_SECRET_KEY (sb_secret_...) no .env.local
//  e o schema (0001 + 0002) já aplicado no banco.
// ============================================================

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!url || !secret) {
  console.error(
    "\n❌ Faltam variáveis. Preencha SUPABASE_SECRET_KEY (e NEXT_PUBLIC_SUPABASE_URL) em .env.local.\n" +
      "   A secret key está em: Supabase > Project Settings > API Keys > 'secret'.\n",
  );
  process.exit(1);
}

const supa = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PW = "fixly1234";
// centro aprox. de São Paulo (base para localizar os usuários de teste)
const SP = { lat: -23.5505, lng: -46.6333 };
const near = (dLat, dLng) => ({ lat: SP.lat + dLat, lng: SP.lng + dLng });

async function ensureUser(email, password, fullName) {
  // tenta criar; se já existir, recupera o id
  const { data, error } = await supa.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (!error && data?.user) return data.user.id;

  // já existe → procura na lista
  let page = 1;
  while (page <= 10) {
    const { data: list } = await supa.auth.admin.listUsers({ page, perPage: 200 });
    const found = list?.users?.find((u) => u.email === email);
    if (found) {
      await supa.auth.admin.updateUserById(found.id, { password, email_confirm: true });
      return found.id;
    }
    if (!list || list.users.length < 200) break;
    page++;
  }
  throw new Error("Não foi possível criar/localizar " + email);
}

async function upsertProfile(row) {
  const { error } = await supa.from("profiles").upsert(row, { onConflict: "id" });
  if (error) throw new Error(`profile ${row.email}: ${error.message}`);
}

async function main() {
  console.log("🌱 Semeando usuários de teste do Fixly...\n");

  // categorias
  const { data: cats } = await supa.from("service_categories").select("id, slug");
  if (!cats || cats.length === 0) {
    console.error("❌ Nenhuma categoria encontrada. Rode o schema (0001_init.sql) antes.");
    process.exit(1);
  }
  const catId = (slug) => cats.find((c) => c.slug === slug)?.id ?? null;

  const seed = [
    // ── ADMIN (a conta do Matheus + uma genérica) ──
    { email: "matheus@dvn.com.br", password: "1234", full_name: "Matheus (Admin)", role: "admin", status: "aprovado" },
    { email: "admin@fixly.com.br", password: PW, full_name: "Equipe Fixly", role: "admin", status: "aprovado" },

    // ── CONTRATANTE ──
    { email: "contratante@fixly.com.br", password: PW, full_name: "Marina Souza", role: "contratante", status: "aprovado", phone: "(11) 98888-0001", cpf: "111.111.111-11", city: "São Paulo", ...SP },

    // ── PRESTADORES (aprovados, para gerar propostas) ──
    { email: "prestador@fixly.com.br", password: PW, full_name: "Carlos Oliveira", role: "prestador", status: "aprovado", phone: "(11) 97777-0001", cpf: "222.222.222-22", city: "São Paulo", category_id: catId("eletricista"), base_price: 120, service_radius_km: 15, rating: 4.9, jobs_done: 128, bio: "Eletricista com 8 anos de experiência em residências e comércios.", ...near(0.012, -0.008) },
    { email: "ana.eletrica@fixly.com.br", password: PW, full_name: "Ana Paula Lima", role: "prestador", status: "aprovado", phone: "(11) 97777-0002", cpf: "333.333.333-33", city: "São Paulo", category_id: catId("eletricista"), base_price: 110, service_radius_km: 12, rating: 4.7, jobs_done: 86, bio: "Especialista em instalações e quadros de energia.", ...near(-0.015, 0.01) },
    { email: "joao.encanador@fixly.com.br", password: PW, full_name: "João Mendes", role: "prestador", status: "aprovado", phone: "(11) 97777-0003", cpf: "444.444.444-44", city: "São Paulo", category_id: catId("encanador"), base_price: 100, service_radius_km: 20, rating: 4.8, jobs_done: 152, bio: "Encanador — vazamentos, desentupimentos e reparos.", ...near(0.02, 0.015) },

    // ── PRESTADOR PENDENTE (para testar a aprovação no admin) ──
    { email: "pendente@fixly.com.br", password: PW, full_name: "Roberto Alves", role: "prestador", status: "pendente", phone: "(11) 97777-0009", cpf: "555.555.555-55", city: "São Paulo", category_id: catId("pintor"), base_price: 150, service_radius_km: 10, bio: "Pintor residencial buscando aprovação no Fixly.", ...near(-0.01, -0.02) },
  ];

  for (const s of seed) {
    const { password, ...profile } = s;
    const id = await ensureUser(s.email, password, s.full_name);
    await upsertProfile({ id, ...profile });
    console.log(`  ✓ ${s.role.padEnd(12)} ${s.email}  (senha: ${password})`);
  }

  console.log("\n✅ Seed concluído! Faça login em http://localhost:3000/login\n");
  console.log("   Admin:        matheus@dvn.com.br / 1234");
  console.log("   Contratante:  contratante@fixly.com.br / fixly1234");
  console.log("   Prestador:    prestador@fixly.com.br / fixly1234");
  console.log("   (há 1 prestador PENDENTE para você aprovar no painel admin)\n");
}

main().catch((e) => {
  console.error("\n❌ Erro no seed:", e.message, "\n");
  process.exit(1);
});
