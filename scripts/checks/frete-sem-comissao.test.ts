/**
 * O FRETE NÃO PAGA COMISSÃO — decisão do dono, 26/08/2026.
 *
 * A Fixly cobra 15% sobre o SERVIÇO. O frete (taxa de deslocamento) entra no
 * que o cliente paga e sai inteiro para o profissional: é reembolso do custo de
 * chegar até lá, não receita de serviço.
 *
 *   node --experimental-strip-types --test scripts/checks/frete-sem-comissao.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { paymentBreakdown, providerNet, platformFee } from "../../src/lib/pricing.ts";
import { contaDoCancelamento } from "../../src/lib/cancellation.ts";

const perto = (a: number, b: number, msg: string) =>
  assert.ok(Math.abs(a - b) < 0.011, `${msg}: ${a} ≠ ${b}`);

test("Pix: cliente paga serviço + frete; comissão só sobre o serviço", () => {
  const bd = paymentBreakdown(1000, "pix", 0, 200);
  assert.equal(bd.serviceAmount, 1000);
  assert.equal(bd.travelFee, 200);
  assert.equal(bd.amount, 1200);              // sem acréscimo no Pix
  assert.equal(bd.platformFee, 150);          // 15% de 1000, NÃO de 1200
  assert.equal(bd.providerNet, 1050);         // 1000 - 150 + 200
});

test("o frete NÃO muda a comissão", () => {
  const sem = paymentBreakdown(1000, "pix", 0, 0);
  const com = paymentBreakdown(1000, "pix", 0, 500);
  assert.equal(sem.platformFee, com.platformFee);
  assert.equal(com.providerNet - sem.providerNet, 500); // o frete passa inteiro
});

test("cartão: a tarifa do gateway incide sobre o TOTAL cobrado", () => {
  // a tarifa do gateway não é escolha nossa — ele cobra sobre o que passa
  const bd = paymentBreakdown(1000, "cartao", 0, 200);
  assert.ok(bd.amount > 1200, "o acréscimo do cartão deveria entrar");
  perto(bd.surcharge, bd.amount - 1200, "acréscimo = total - (serviço+frete)");
  assert.equal(bd.platformFee, 150); // ainda 15% do serviço
  assert.equal(bd.providerNet, 1050); // e o prestador recebe o mesmo do Pix
});

test("nada se perde: total cobrado = serviço + frete + acréscimo", () => {
  for (const metodo of ["pix", "cartao"] as const) {
    for (const frete of [0, 37.55, 200]) {
      const bd = paymentBreakdown(849.99, metodo, 0, frete);
      perto(bd.amount, bd.serviceAmount + bd.travelFee + bd.surcharge, `${metodo}/${frete}`);
    }
  }
});

test("adiantamento continua sendo sobre o serviço, e o frete não muda a taxa", () => {
  const bd = paymentBreakdown(1000, "pix", 50, 200);
  assert.equal(bd.advanceAmount, 500);              // 50% de 1000
  perto(bd.providerUpfront + bd.providerOnApproval, bd.providerNet, "upfront+aprovação = líquido");
});

test("providerNet(serviço, frete) não cobra comissão do frete", () => {
  assert.equal(providerNet(1000, 200), 1000 - platformFee(1000) + 200);
  // a armadilha que este teste existe para pegar:
  assert.notEqual(providerNet(1000, 200), providerNet(1200));
});

/* ── cancelamento: a mesma regra vale na retenção ────────────────────────── */

const base = {
  status: "aceito",
  mode: null as string | null,
  urgent: false,
  final_price: 1200, // 1000 de serviço + 200 de frete
  estimated_price: null,
  travel_fee: 200,
  created_at: "2026-08-25T09:00:00Z",
  accepted_at: "2026-08-25T10:00:00Z",
  departed_at: null as string | null,
  started_at: null as string | null,
  provider_id: "p1",
};
const agora = new Date("2026-08-25T12:00:00Z");

test("3.2 — a retenção de 30% é toda de SERVIÇO (paga comissão)", () => {
  const c = contaDoCancelamento(base, "desisti", agora);
  assert.equal(c.retido, 300);
  assert.equal(c.retidoServico, 300);
  assert.equal(c.retidoFrete, 0);
  assert.equal(providerNet(c.retidoServico, c.retidoFrete), 255); // 300 - 15%
});

test("3.3 — quando vence o FRETE, a retenção não paga comissão", () => {
  // serviço 100 + frete 200 → 50% do serviço = 50, frete = 200 → vence o frete
  const c = contaDoCancelamento(
    { ...base, final_price: 300, travel_fee: 200, status: "a_caminho", departed_at: "2026-08-25T11:00:00Z" },
    "desisti",
    agora,
  );
  assert.equal(c.retido, 200);
  assert.equal(c.retidoServico, 0);
  assert.equal(c.retidoFrete, 200);
  assert.equal(providerNet(c.retidoServico, c.retidoFrete), 200); // inteiro
});

test("5.1 — no-show do cliente: o deslocamento vai inteiro ao profissional", () => {
  const c = contaDoCancelamento({ ...base, status: "a_caminho" }, "no_show_cliente", agora);
  assert.equal(c.retidoFrete, 200);
  assert.equal(providerNet(c.retidoServico, c.retidoFrete), 200);
});

test("a soma das partes é sempre o retido", () => {
  for (const m of ["desisti", "no_show_cliente", "no_show_profissional"] as const) {
    for (const st of [base, { ...base, status: "a_caminho", departed_at: "2026-08-25T11:00:00Z" }]) {
      const c = contaDoCancelamento(st as never, m, agora);
      if (c.apuracao) continue;
      perto(c.retidoServico + c.retidoFrete, c.retido, `${c.stage}/${m}`);
    }
  }
});
