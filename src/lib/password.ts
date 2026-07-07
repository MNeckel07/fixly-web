export type PasswordCheck = { label: string; ok: boolean };

/** Regras de força de senha do Fixly. */
export function checkPassword(pw: string): PasswordCheck[] {
  return [
    { label: "Pelo menos 10 caracteres", ok: pw.length >= 10 },
    { label: "1 letra maiúscula (A-Z)", ok: /[A-Z]/.test(pw) },
    { label: "1 letra minúscula (a-z)", ok: /[a-z]/.test(pw) },
    { label: "1 número (0-9)", ok: /[0-9]/.test(pw) },
    { label: "1 caractere especial (!@#$…)", ok: /[^A-Za-z0-9]/.test(pw) },
  ];
}

export function isPasswordStrong(pw: string): boolean {
  return checkPassword(pw).every((c) => c.ok);
}
