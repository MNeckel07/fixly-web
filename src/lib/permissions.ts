/** Seções do painel admin que podem ser liberadas por permissão. */
export const ADMIN_PERMISSIONS = [
  { key: "cadastros", label: "Aprovações de cadastro" },
  { key: "usuarios", label: "Usuários e permissões" },
  { key: "vendas", label: "Vendas" },
  { key: "precificacao", label: "Precificação" },
  { key: "servicos", label: "Serviços" },
  { key: "suporte", label: "Suporte (tickets)" },
  { key: "equipe", label: "Equipe (chat interno)" },
  { key: "documentos", label: "Tipos de documento" },
  { key: "testes", label: "Modo de teste" },
] as const;

export type PermKey = (typeof ADMIN_PERMISSIONS)[number]["key"];

export const ALL_PERM_KEYS: PermKey[] = ADMIN_PERMISSIONS.map((p) => p.key);

/**
 * Regra: lista vazia/nula = acesso total (admin "dono"). Caso contrário, só as
 * chaves listadas. A "Visão geral" (/admin) é sempre acessível.
 */
export function hasPerm(permissions: string[] | null | undefined, key: PermKey): boolean {
  if (!permissions || permissions.length === 0) return true;
  return permissions.includes(key);
}
