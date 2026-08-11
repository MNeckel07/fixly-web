// ============================================================
//  FIXLY — remove o painel do build do SITE PÚBLICO
//
//  Roda antes do `next build` no serviço `fixly-web` (APP_ROLE=site).
//
//  POR QUE EXISTE
//  --------------
//  Bloquear `/admin` por rota impede a navegação, mas **não** tira os
//  endpoints do ar: as ~17 server actions do painel (`impersonationLink`,
//  `deleteUser`, `createStaffUser`, `settleWithdrawal`, `setFixBadge`…) são
//  compiladas como POST acionáveis no domínio público, guardadas apenas pelo
//  `assertAdmin()`. Uma falha nessa checagem — ou um dia de descuido — vira
//  acesso a dado administrativo pelo fixly.company.
//
//  Apagando a pasta antes do build, esses endpoints **não existem** naquele
//  servidor. É a diferença entre "a porta está trancada" e "não há porta".
//
//  SEGURANÇA DO PRÓPRIO SCRIPT
//  ---------------------------
//  Ele APAGA arquivos do código-fonte. No Render isso é inofensivo (o
//  checkout é descartável), na sua máquina seria um estrago. Por isso ele se
//  recusa a rodar fora do Render sem `--force`.
// ============================================================

import { rmSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const alvos = ["src/app/admin", "src/components/admin"];

const papel = (process.env.APP_ROLE ?? "").trim().toLowerCase();
const noRender = process.env.RENDER === "true";
const forcado = process.argv.includes("--force");

// 1) Só o site público perde o painel. No serviço do admin, nada a fazer.
if (papel !== "site") {
  console.log(`[strip-admin] APP_ROLE=${papel || "(vazio)"} — painel mantido no build.`);
  process.exit(0);
}

// 2) Trava de segurança: fora do Render, só com --force explícito.
if (!noRender && !forcado) {
  console.error("[strip-admin] ⛔ recusado: isto APAGA src/app/admin do código-fonte.");
  console.error("             No Render roda sozinho (RENDER=true). Localmente, use --force");
  console.error("             e só num checkout descartável — nunca na sua pasta de trabalho.");
  process.exit(1);
}

let removidos = 0;
for (const alvo of alvos) {
  const caminho = resolve(raiz, alvo);
  if (existsSync(caminho)) {
    rmSync(caminho, { recursive: true, force: true });
    console.log(`[strip-admin] removido: ${alvo}`);
    removidos++;
  }
}

console.log(
  removidos > 0
    ? `[strip-admin] ✅ site público sem o painel (${removidos} pasta(s)). As server actions do admin não vão para este servidor.`
    : "[strip-admin] nada a remover (o painel já não estava presente).",
);
