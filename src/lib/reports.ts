/**
 * MOTIVOS DE DENÚNCIA — dado puro, compartilhado entre tela e servidor.
 *
 * ⚠️ Isto morava dentro de `app/app/report.actions.ts`, que é um arquivo
 * `"use server"`. Um módulo de server actions **só pode exportar funções
 * async**: qualquer outro export derruba o módulo INTEIRO de ações da página
 * ("A 'use server' file can only export async functions, found object").
 *
 * E o estrago não fica na denúncia: o Next junta as ações de toda a página num
 * módulo só, então o erro levava junto `cancelService`, `updateRequest`,
 * `processPayment`… Do lado do navegador nada disso aparece — o React devolve
 * o genérico "Minified React error #441", que é só "a server action explodiu".
 * Foi o que apareceu em "não dá para cancelar o pedido" e em "erro ao editar".
 *
 * Por isso a lista mora aqui, num módulo comum, e o `report.actions.ts` a
 * importa como qualquer outro código.
 */
export const MOTIVOS = [
  { id: "fora_da_plataforma", label: "Pediu para pagar por fora do Fixly" },
  { id: "fraude", label: "Fraude ou tentativa de golpe" },
  { id: "dano", label: "Dano ao imóvel, a bens ou a terceiros" },
  { id: "assedio", label: "Assédio, ameaça, violência ou discriminação" },
  { id: "avaliacao", label: "Manipulação de avaliações" },
  { id: "outro", label: "Outro motivo" },
] as const;

export type MotivoDenuncia = (typeof MOTIVOS)[number]["id"];
