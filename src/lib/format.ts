/**
 * MÁSCARAS DE DIGITAÇÃO
 * =====================
 *
 * Formatam **enquanto a pessoa digita**: `13044185963` vira `130.441.859-63`
 * sozinho. Além de ficar bonito, é o que faz o usuário perceber na hora que
 * digitou um dígito a mais ou a menos — um CPF sem pontuação ninguém confere.
 *
 * Regra da casa: a máscara é só apresentação. O que vai para o banco e para o
 * gateway passa por `onlyDigits` — nada de gravar ponto e traço.
 */

export const onlyDigits = (v: string) => (v ?? "").replace(/\D/g, "");

/** 130.441.859-63 */
export function maskCpf(v: string): string {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** 12.345.678/0001-95 */
export function maskCnpj(v: string): string {
  const d = onlyDigits(v).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** (41) 99183-7845 — aceita fixo (8 dígitos) e celular (9). */
export function maskPhone(v: string): string {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** 80250-070 */
export function maskCep(v: string): string {
  const d = onlyDigits(v).slice(0, 8);
  return d.length <= 5 ? d : `${d.slice(0, 5)}-${d.slice(5)}`;
}

/** 5031 4332 1540 6351 — grupos de 4 (Amex tem 15 dígitos e vai igual). */
export function maskCardNumber(v: string): string {
  const d = onlyDigits(v).slice(0, 19);
  return d.replace(/(.{4})/g, "$1 ").trim();
}

/** MM/AA */
export function maskCardExpiry(v: string): string {
  const d = onlyDigits(v).slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

/** 00/00/0000 */
export function maskDate(v: string): string {
  const d = onlyDigits(v).slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/* ─────────────────────────── chave PIX ─────────────────────────── */

export type PixKeyType = "cpf" | "cnpj" | "celular" | "email" | "aleatoria";

export const PIX_KEY_TYPES: { id: PixKeyType; label: string; hint: string; placeholder: string }[] = [
  { id: "cpf", label: "CPF", hint: "O CPF do titular da conta", placeholder: "000.000.000-00" },
  { id: "cnpj", label: "CNPJ", hint: "O CNPJ da empresa", placeholder: "00.000.000/0000-00" },
  { id: "celular", label: "Celular", hint: "Com DDD, o mesmo do banco", placeholder: "(00) 00000-0000" },
  { id: "email", label: "E-mail", hint: "O e-mail cadastrado no banco", placeholder: "voce@email.com" },
  { id: "aleatoria", label: "Chave aleatória", hint: "Aquele código embaralhado que o banco gera", placeholder: "00000000-0000-0000-0000-000000000000" },
];

/** Formata conforme o tipo escolhido. E-mail e aleatória vão como estão. */
export function maskPixKey(value: string, type: PixKeyType): string {
  switch (type) {
    case "cpf": return maskCpf(value);
    case "cnpj": return maskCnpj(value);
    case "celular": return maskPhone(value);
    case "email": return value.trim().toLowerCase();
    case "aleatoria": return value.trim().toLowerCase().replace(/[^a-f0-9-]/g, "").slice(0, 36);
  }
}

/**
 * Valida a chave no formato que o Banco Central exige.
 * Não confere titularidade — isso só o banco sabe; aqui é para não sair um
 * saque com chave impossível (o histórico do projeto tem chave "321231").
 */
export function validatePixKey(value: string, type: PixKeyType): string | null {
  const v = value.trim();
  if (!v) return "Informe a chave.";
  switch (type) {
    case "cpf":
      return onlyDigits(v).length === 11 ? null : "O CPF precisa ter 11 dígitos.";
    case "cnpj":
      return onlyDigits(v).length === 14 ? null : "O CNPJ precisa ter 14 dígitos.";
    case "celular": {
      const d = onlyDigits(v);
      return d.length === 11 || d.length === 10 ? null : "Informe o celular com DDD.";
    }
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? null : "E-mail inválido.";
    case "aleatoria":
      return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v)
        ? null
        : "A chave aleatória tem 32 caracteres com traços, como o banco mostra.";
  }
}

/**
 * Adivinha o tipo de uma chave já salva (para reabrir a tela no tipo certo).
 * A ordem importa: e-mail e aleatória são reconhecíveis pelo formato; o resto
 * é decidido pela contagem de dígitos.
 */
export function guessPixKeyType(value: string | null | undefined): PixKeyType {
  const v = (value ?? "").trim();
  if (!v) return "cpf";
  if (v.includes("@")) return "email";
  if (/^[a-f0-9-]{36}$/i.test(v)) return "aleatoria";
  const d = onlyDigits(v);
  if (d.length === 14) return "cnpj";
  if (d.length === 11) {
    // celular brasileiro começa com DDD 11–99 e o nono dígito é 9
    return d[2] === "9" ? "celular" : "cpf";
  }
  if (d.length === 10) return "celular";
  return "cpf";
}

/** Como a chave deve ser exibida depois de salva. */
export function formatPixKey(value: string | null | undefined): string {
  if (!value) return "";
  return maskPixKey(value, guessPixKeyType(value));
}
