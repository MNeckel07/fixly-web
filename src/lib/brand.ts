/**
 * Identidade visual do Fixly — fonte única de verdade das cores da marca.
 * Espelha o app mobile (src/constants/colors.ts) para manter consistência.
 */
export const Brand = {
  primary: "#FFC107", // amarelo Fixly
  primaryDark: "#E6A800",
  dark: "#1F2329", // grafite
  darkSecondary: "#2A2F37",
  gray: "#5B616B",
  grayLight: "#9AA0A8",
  background: "#FAFAFA",
  surface: "#FFFFFF",
  success: "#16A34A",
  danger: "#DC2626",
  warning: "#EA580C",
  info: "#2563EB",
} as const;

/** Papéis de acesso do sistema. */
export type Role = "contratante" | "prestador" | "admin";

/** Status do cadastro (fluxo de aprovação pelo admin). */
export type ProfileStatus = "pendente" | "aprovado" | "reprovado";

export const ROLE_LABELS: Record<Role, string> = {
  contratante: "Contratante",
  prestador: "Prestador",
  admin: "Administrador",
};

/** Rota inicial de cada papel após o login. */
export const ROLE_HOME: Record<Role, string> = {
  contratante: "/app/contratante",
  prestador: "/app/prestador",
  admin: "/admin",
};
