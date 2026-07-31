// ============================================================
//  FIXLY — Diagnóstico do Mercado Pago
//  Uso:  node --env-file=.env.local scripts/check-mp.mjs
//        node --env-file=.env.local scripts/check-mp.mjs --pix        (cobra R$ 0,01 de verdade)
//        node --env-file=.env.local scripts/check-mp.mjs --pix 5      (cobra R$ 5,00)
//        node --env-file=.env.local scripts/check-mp.mjs --cancel <id>
//        node --env-file=.env.local scripts/check-mp.mjs --url https://fixly.company
//
//  Responde, sem imprimir nenhuma credencial:
//   1. o ACCESS TOKEN é válido? é de TESTE ou de PRODUÇÃO?
//   2. a PUBLIC KEY é do mesmo ambiente? (misturar TEST- com APP_USR- é o erro
//      mais comum — o cartão falha e a mensagem do MP não explica)
//   3. a conta aceita Pix e cartão?
//   4. o webhook está no ar e a MP_WEBHOOK_SECRET confere?
//   5. (--pix) cria uma cobrança Pix REAL e devolve o copia-e-cola
//
//  Por que existe: sem isto, "o pagamento não funciona" tem 5 causas possíveis
//  e a gente ficaria chutando — mesma dor que o check-email.mjs resolveu.
// ============================================================

const token = process.env.MP_ACCESS_TOKEN;
const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY ?? "";
const secret = process.env.MP_WEBHOOK_SECRET ?? "";
const clientId = process.env.MP_CLIENT_ID ?? "";
const clientSecret = process.env.MP_CLIENT_SECRET ?? "";

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const argOf = (f) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};
const appUrl = (argOf("--url") ?? process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");

let falhas = 0;
const ok = (m) => console.log(`✅ ${m}`);
const warn = (m) => console.log(`⏳ ${m}`);
const bad = (m) => { falhas++; console.log(`❌ ${m}`); };

if (!token) {
  console.error("❌ MP_ACCESS_TOKEN não definida.");
  console.error("   Rode:  node --env-file=.env.local scripts/check-mp.mjs");
  console.error("   Para conferir a PRODUÇÃO sem salvar no .env.local:");
  console.error("   MP_ACCESS_TOKEN=APP_USR-... node scripts/check-mp.mjs");
  process.exit(1);
}

const mp = async (path, init = {}) => {
  const r = await fetch(`https://api.mercadopago.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.idempotencyKey ? { "X-Idempotency-Key": init.idempotencyKey } : {}),
      ...(init.headers ?? {}),
    },
  });
  const t = await r.text();
  let j = null;
  try { j = t ? JSON.parse(t) : null; } catch { j = null; }
  return { status: r.status, json: j, text: t };
};

const ambiente = (v) =>
  v.startsWith("TEST-") ? "TESTE" : v.startsWith("APP_USR-") ? "PRODUÇÃO" : "DESCONHECIDO";

/**
 * As duas credenciais começam com o mesmo prefixo e são fáceis de trocar.
 * O que as distingue é o FORMATO depois do prefixo:
 *   Public Key    → um UUID    (TEST-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) = 41 chars
 *   Access Token  → vários blocos numéricos/hex, bem mais longo (~70+)
 * Trocar as duas devolve "403 At least one policy returned UNAUTHORIZED",
 * mensagem que não explica nada — daí esta checagem vir ANTES da chamada à API.
 */
const pareceIdEPublicKey = (v) =>
  /^(TEST|APP_USR)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

// ── 1. Access token ──────────────────────────────────────────
console.log("── 1. Credenciais ──────────────────────────────────");
const ambToken = ambiente(token);
console.log(`access token: ${token.length} chars · ambiente ${ambToken}`);

if (pareceIdEPublicKey(token)) {
  bad("isto é a PUBLIC KEY, não o ACCESS TOKEN — as duas foram trocadas.");
  console.log("   A Public Key tem formato de UUID e 41 caracteres; o Access Token");
  console.log("   é bem mais longo (~70) e tem vários blocos de números.");
  console.log("   Troque os valores de MP_ACCESS_TOKEN e NEXT_PUBLIC_MP_PUBLIC_KEY no .env.local.");
  process.exit(1);
}

let me = await mp("/users/me");
if (me.status !== 200) {
  bad(`access token inválido — HTTP ${me.status}: ${(me.json?.message ?? me.text).slice(0, 160)}`);
  console.log("\n   Copie de novo em: https://www.mercadopago.com.br/developers → Suas integrações");
  console.log("   → aplicação Fixly → Credenciais de teste OU de produção.");
  process.exit(1);
}
ok(`token válido — conta ${me.json.nickname} (id ${me.json.id}) · país ${me.json.site_id}`);
if (me.json.site_id !== "MLB") {
  bad(`a conta é do país ${me.json.site_id}, não do Brasil (MLB). Pix não vai existir nessa conta.`);
}
const isTestUser = (me.json.tags ?? []).includes("test_user");
if (ambToken === "PRODUÇÃO" && isTestUser) {
  bad("token de PRODUÇÃO em uma CONTA DE TESTE — o dinheiro não é real.");
} else if (ambToken === "TESTE") {
  warn("ambiente de TESTE: nada de dinheiro real. Use os cartões de teste do MP.");
} else if (ambToken === "PRODUÇÃO") {
  ok("ambiente de PRODUÇÃO — cobranças com dinheiro REAL.");
}

// ── 2. Public key (Checkout Bricks / cartão) ─────────────────
console.log("\n── 2. Public key (cartão no navegador) ─────────────");
if (!publicKey) {
  bad("NEXT_PUBLIC_MP_PUBLIC_KEY vazia — a tela do CARTÃO não carrega (só Pix aparece).");
} else if (!pareceIdEPublicKey(publicKey)) {
  bad("isto NÃO parece uma Public Key (ela tem formato de UUID, 41 caracteres).");
  console.log("   Provavelmente é o Access Token colado no campo errado.");
} else {
  const ambPk = ambiente(publicKey);
  if (ambPk !== ambToken) {
    bad(`AMBIENTES MISTURADOS: token é ${ambToken} e public key é ${ambPk}.`);
    console.log("   É a causa nº 1 de 'cartão não funciona'. As duas têm que ser do mesmo bloco.");
  } else {
    ok(`public key no mesmo ambiente (${ambPk})`);
  }
}

// ── 3. Meios de pagamento habilitados ────────────────────────
console.log("\n── 3. Meios de pagamento da conta ──────────────────");
const pm = await mp("/v1/payment_methods");
if (pm.status !== 200) {
  bad(`não consegui listar os meios — HTTP ${pm.status}`);
} else {
  const lista = pm.json ?? [];
  const pix = lista.find((m) => m.id === "pix");
  const cartoes = lista.filter((m) => m.payment_type_id === "credit_card");
  pix && pix.status === "active"
    ? ok("Pix ativo na conta")
    : bad("Pix NÃO está ativo — cadastre uma chave Pix na conta MP antes de cobrar.");
  cartoes.length
    ? ok(`cartão de crédito ativo — ${cartoes.length} bandeiras (${cartoes.slice(0, 5).map((c) => c.id).join(", ")}…)`)
    : bad("nenhuma bandeira de cartão ativa na conta.");
}

// ── 4. Webhook ───────────────────────────────────────────────
console.log("\n── 4. Webhook (é o que confirma o Pix) ─────────────");
if (!secret) {
  bad("MP_WEBHOOK_SECRET vazia — a rota RECUSA toda notificação (401) e o Pix nunca confirma.");
} else {
  ok(`MP_WEBHOOK_SECRET definida (${secret.length} chars)`);
}
if (!appUrl) {
  warn("sem NEXT_PUBLIC_APP_URL — pulei o teste da rota. Use --url https://fixly.company");
} else {
  const hook = `${appUrl}/api/pagamentos/webhook`;
  console.log(`   URL: ${hook}`);
  try {
    const g = await fetch(hook, { headers: { "cache-control": "no-cache" } });
    const gt = (await g.text()).slice(0, 120);
    g.ok && gt.includes("fixly-webhook")
      ? ok("rota no ar (GET respondeu)")
      : bad(`rota respondeu HTTP ${g.status}: ${gt}`);
  } catch (e) {
    bad(`rota inacessível: ${e.message}`);
    if (appUrl.includes("localhost")) {
      console.log("   (localhost é esperado falhar se o `npm run dev` não estiver rodando)");
    }
  }

  // POST assinado com um id inexistente: só valida a ASSINATURA.
  //  401 → a secret daqui não é a do painel;  qualquer outro → assinatura OK.
  if (secret) {
    const { createHmac } = await import("node:crypto");
    const ts = Math.floor(Date.now() / 1000);
    const dataId = "0";
    const requestId = "check-mp-" + ts;
    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const v1 = createHmac("sha256", secret).update(manifest).digest("hex");
    try {
      const p = await fetch(hook, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-signature": `ts=${ts},v1=${v1}`,
          "x-request-id": requestId,
        },
        body: JSON.stringify({ type: "payment", data: { id: dataId } }),
      });
      if (p.status === 401) {
        bad("assinatura RECUSADA — a MP_WEBHOOK_SECRET daqui não é a do painel do MP.");
        console.log("   Painel → sua aplicação → Webhooks → 'Assinatura secreta'. Copie de novo.");
      } else if (p.status === 503) {
        bad("a rota respondeu 503: o servidor que está no ar está SEM MP_ACCESS_TOKEN.");
      } else {
        ok(`assinatura aceita (HTTP ${p.status} — esperado, o id 0 não existe no MP)`);
      }
    } catch (e) {
      warn(`não deu para testar a assinatura: ${e.message}`);
    }
  }
}

// ── 5. OAuth (split opcional) ────────────────────────────────
console.log("\n── 5. OAuth do split (opcional) ────────────────────");
clientId && clientSecret
  ? ok("MP_CLIENT_ID e MP_CLIENT_SECRET definidos — botão 'Conectar Mercado Pago' ativo")
  : warn("sem MP_CLIENT_ID/MP_CLIENT_SECRET — só o modo escrow funciona (é o padrão, tudo bem)");

// ── 6. Cobrança Pix real (--pix) ─────────────────────────────
if (has("--pix")) {
  const valor = Number(argOf("--pix") ?? 0.01) || 0.01;
  console.log(`\n── 6. Cobrança Pix de teste (R$ ${valor.toFixed(2)}) ──────────`);
  if (ambToken === "PRODUÇÃO") console.log("   ⚠️  PRODUÇÃO: este Pix é DINHEIRO REAL.");
  const r = await mp("/v1/payments", {
    method: "POST",
    idempotencyKey: `check-mp-${Date.now()}`,
    body: JSON.stringify({
      transaction_amount: valor,
      description: "Fixly — teste de configuração",
      payment_method_id: "pix",
      external_reference: "check-mp",
      ...(appUrl ? { notification_url: `${appUrl}/api/pagamentos/webhook` } : {}),
      payer: { email: "teste@fixly.company" },
    }),
  });
  if (r.status !== 201 && r.status !== 200) {
    bad(`não criou a cobrança — HTTP ${r.status}: ${(r.json?.message ?? r.text).slice(0, 200)}`);
    for (const c of r.json?.cause ?? []) console.log(`   causa ${c.code}: ${c.description}`);
  } else {
    const qr = r.json?.point_of_interaction?.transaction_data?.qr_code;
    ok(`cobrança criada — id ${r.json.id} · status ${r.json.status}`);
    console.log(`\n   Copia-e-cola (pague no app do seu banco para validar ponta a ponta):\n   ${qr}\n`);
    console.log(`   Para cancelar sem pagar:`);
    console.log(`   node --env-file=.env.local scripts/check-mp.mjs --cancel ${r.json.id}`);
  }
}

// ── 7. Cancelar cobrança (--cancel) ──────────────────────────
if (has("--cancel")) {
  const id = argOf("--cancel");
  console.log(`\n── 7. Cancelando ${id} ─────────────────────────────`);
  const r = await mp(`/v1/payments/${id}`, {
    method: "PUT",
    body: JSON.stringify({ status: "cancelled" }),
  });
  r.status === 200
    ? ok(`cobrança ${id} cancelada`)
    : bad(`não cancelou — HTTP ${r.status}: ${(r.json?.message ?? r.text).slice(0, 160)}`);
}

// ── Veredito ─────────────────────────────────────────────────
console.log("\n────────────────────────────────────────────────────");
if (falhas === 0) {
  console.log("✅ Tudo certo. O pagamento está pronto para funcionar.");
} else {
  console.log(`❌ ${falhas} problema(s) acima. O pagamento NÃO vai funcionar até resolver.`);
  process.exitCode = 1;
}
