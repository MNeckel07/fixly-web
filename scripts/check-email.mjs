// ============================================================
//  FIXLY — Diagnóstico do envio de e-mail
//  Uso:  node --env-file=.env.local scripts/check-email.mjs
//        node --env-file=.env.local scripts/check-email.mjs alguem@email.com
//
//  Responde, sem imprimir a chave:
//   1. a chave do provedor é válida?
//   2. o domínio está autenticado e o remetente ativo?
//   3. os últimos envios saíram? (entregues / bounce / spam)
//  Passando um e-mail, dispara um envio de teste com o template real.
//
//  Por que existe: quando o cadastro "não manda o código", a causa é sempre
//  uma destas três — e sem isto a gente ficava chutando.
// ============================================================

const key = process.env.BREVO_API_KEY;
const from = process.env.EMAIL_FROM ?? "";
const destino = process.argv[2];

if (!key) {
  console.error("❌ BREVO_API_KEY não definida. Rode com: node --env-file=.env.local scripts/check-email.mjs");
  process.exit(1);
}

const api = async (path, init) => {
  const r = await fetch(`https://api.brevo.com/v3${path}`, {
    ...init,
    headers: { "api-key": key, accept: "application/json", "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch {}
  return { status: r.status, json: j, text: t };
};

console.log(`chave: ${key.length} chars · prefixo ${key.startsWith("xkeysib-") ? "✅ ok" : "❌ falta 'xkeysib-'"}`);
console.log(`EMAIL_FROM: ${from || "(vazio)"}\n`);

// 1) chave
let r = await api("/account");
if (r.status !== 200) {
  console.error(`❌ chave inválida — HTTP ${r.status}: ${r.text.slice(0, 200)}`);
  process.exit(1);
}
console.log(`✅ chave válida — ${r.json.companyName} · ${r.json.email}`);
const plano = (r.json.plan ?? [])[0] ?? {};
console.log(`   plano ${plano.type} · créditos ${plano.credits}\n`);

// 2) domínio + remetente
r = await api("/senders/domains");
for (const d of r.json?.domains ?? []) {
  const nome = d.domain_name ?? d.domain;
  console.log(`${d.authenticated ? "✅" : "⏳"} domínio ${nome} — autenticado: ${d.authenticated}`);
}
r = await api("/senders");
for (const s of r.json?.senders ?? []) {
  console.log(`${s.active ? "✅" : "⏳"} remetente ${s.email} — ativo: ${s.active}`);
}
// o remetente do EMAIL_FROM está entre os ativos?
const addr = (from.match(/<([^>]+)>/)?.[1] ?? from).trim();
const ok = (r.json?.senders ?? []).some((s) => s.email === addr && s.active);
console.log(`\n${ok ? "✅" : "❌"} o EMAIL_FROM (${addr}) ${ok ? "está ativo" : "NÃO está entre os remetentes ativos — a Brevo vai recusar"}`);

// 3) envio de teste (opcional)
if (destino) {
  console.log(`\n📨 enviando teste para ${destino}...`);
  const m = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  const sender = m ? { name: m[1] || "Fixly", email: m[2] } : { name: "Fixly", email: from };
  const env = await api("/smtp/email", {
    method: "POST",
    body: JSON.stringify({
      sender,
      to: [{ email: destino }],
      subject: "Teste de envio — Fixly",
      htmlContent: "<p>Se você recebeu isto, o envio de e-mail do Fixly está funcionando.</p>",
    }),
  });
  console.log(env.status === 201 ? `   ✅ aceito pela Brevo (messageId ${env.json?.messageId})` : `   ❌ HTTP ${env.status}: ${env.text.slice(0, 250)}`);
}

// 4) últimos eventos
r = await api("/smtp/statistics/events?limit=6&sort=desc");
console.log("\n═══ últimos envios ═══");
for (const e of r.json?.events ?? []) {
  console.log(`  ${new Date(e.date).toLocaleString("pt-BR")}  ${String(e.event).padEnd(10)} → ${e.email}${e.reason ? "  (" + e.reason + ")" : ""}`);
}
