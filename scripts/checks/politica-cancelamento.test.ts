/**
 * Conferência da POLÍTICA DE CANCELAMENTO contra o texto do dono.
 * Roda sem banco, sem gateway e sem navegador:
 *   node --experimental-strip-types scripts/checks/politica-cancelamento.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { contaDoCancelamento, etapaDoCancelamento } from "../../src/lib/cancellation.ts";

const agora = new Date("2026-08-25T12:00:00Z");
const base = {
  status: "aceito",
  mode: null as string | null,
  urgent: false,
  final_price: 1000,
  estimated_price: null,
  travel_fee: 0,
  created_at: "2026-08-25T09:00:00Z",
  accepted_at: "2026-08-25T10:00:00Z",
  departed_at: null as string | null,
  started_at: null as string | null,
  provider_id: "p1",
};

test("3.1 — antes do aceite: gratuito, reembolso integral", () => {
  const c = contaDoCancelamento({ ...base, provider_id: null, status: "buscando" }, "desisti", agora);
  assert.equal(c.stage, "antes_do_aceite");
  assert.equal(c.retido, 0);
  assert.equal(c.reembolso, 1000);
});

test("3.2 — após o aceite: retém 30% do valor do serviço", () => {
  const c = contaDoCancelamento(base, "desisti", agora);
  assert.equal(c.stage, "apos_aceite");
  assert.equal(c.retido, 300);
  assert.equal(c.reembolso, 700);
});

test("3.2 — a retenção incide sobre o SERVIÇO, não sobre o frete", () => {
  // total 1000 = 900 de serviço + 100 de frete → 30% de 900 = 270
  const c = contaDoCancelamento({ ...base, travel_fee: 100 }, "desisti", agora);
  assert.equal(c.valorServico, 900);
  assert.equal(c.retido, 270);
  assert.equal(c.reembolso, 730);
});

test("3.3 — após o deslocamento: 50% do serviço", () => {
  const c = contaDoCancelamento({ ...base, status: "a_caminho", departed_at: "2026-08-25T11:00:00Z" }, "desisti", agora);
  assert.equal(c.stage, "apos_deslocamento");
  assert.equal(c.retido, 500);
  assert.equal(c.reembolso, 500);
});

test("3.3 — ...ou a taxa de deslocamento, O QUE FOR MAIOR", () => {
  // serviço 100 + frete 200 → 50% do serviço = 50, frete = 200 → vence o frete
  const c = contaDoCancelamento(
    { ...base, final_price: 300, travel_fee: 200, status: "a_caminho", departed_at: "2026-08-25T11:00:00Z" },
    "desisti",
    agora,
  );
  assert.equal(c.valorServico, 100);
  assert.equal(c.retido, 200);
  assert.equal(c.reembolso, 100);
});

test("3.3 — a retenção nunca passa do total cobrado", () => {
  // frete maior que o total (dado torto): não pode gerar reembolso negativo
  const c = contaDoCancelamento(
    { ...base, final_price: 100, travel_fee: 500, status: "a_caminho", departed_at: "2026-08-25T11:00:00Z" },
    "desisti",
    agora,
  );
  assert.ok(c.retido <= 100, `retido ${c.retido} passou do total`);
  assert.ok(c.reembolso >= 0, `reembolso negativo: ${c.reembolso}`);
});

test("3.4 — execução iniciada: nada é decidido sozinho, valor fica retido", () => {
  const c = contaDoCancelamento({ ...base, status: "em_andamento", started_at: "2026-08-25T11:30:00Z" }, "desisti", agora);
  assert.equal(c.stage, "em_execucao");
  assert.equal(c.apuracao, true);
  assert.equal(c.reembolso, 0);
});

test("5.1 — cliente ausente: profissional recebe a taxa de deslocamento", () => {
  const c = contaDoCancelamento({ ...base, travel_fee: 80, status: "a_caminho" }, "no_show_cliente", agora);
  assert.equal(c.stage, "no_show_cliente");
  assert.equal(c.retido, 80);
  assert.equal(c.reembolso, 920);
});

test("5.2 — profissional ausente: reembolso integral", () => {
  const c = contaDoCancelamento({ ...base, travel_fee: 80, status: "a_caminho" }, "no_show_profissional", agora);
  assert.equal(c.retido, 0);
  assert.equal(c.reembolso, 1000);
});

test("6 — Express: dentro dos 5 minutos o cancelamento ainda é gratuito", () => {
  const dentro = { ...base, urgent: true, created_at: "2026-08-25T11:58:00Z" };
  assert.equal(etapaDoCancelamento(dentro, "desisti", agora), "antes_do_aceite");
  const fora = { ...base, urgent: true, created_at: "2026-08-25T11:00:00Z" };
  assert.equal(etapaDoCancelamento(fora, "desisti", agora), "apos_aceite");
});

test("6 — Reforma/orçamento: grátis até a aprovação do orçamento", () => {
  const semValor = { ...base, mode: "orcamento", final_price: null };
  assert.equal(etapaDoCancelamento(semValor, "desisti", agora), "antes_do_aceite");
  const aprovado = { ...base, mode: "orcamento", final_price: 1000 };
  assert.equal(etapaDoCancelamento(aprovado, "desisti", agora), "apos_aceite");
});

test("etapa mais avançada vence: em execução não vira 'aceito'", () => {
  const c = { ...base, status: "em_andamento", departed_at: "2026-08-25T11:00:00Z", started_at: "2026-08-25T11:30:00Z" };
  assert.equal(etapaDoCancelamento(c, "desisti", agora), "em_execucao");
});

test("sem pagamento não sobra centavo perdido: retido + reembolso = total", () => {
  for (const s of [
    base,
    { ...base, status: "a_caminho", departed_at: "2026-08-25T11:00:00Z" },
    { ...base, travel_fee: 137.77, final_price: 999.99 },
  ]) {
    const c = contaDoCancelamento(s as never, "desisti", agora);
    if (c.apuracao) continue;
    assert.ok(Math.abs(c.retido + c.reembolso - c.total) < 0.011, `${c.stage}: ${c.retido}+${c.reembolso}≠${c.total}`);
  }
});
