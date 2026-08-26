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
// ⚠️ O painel mudou de lugar quando a landing entrou: as rotas do sistema
// passaram para o route group `(app)`. Route group não aparece na URL, então
// `/admin` continua `/admin` — mas o CAMINHO EM DISCO mudou, e este script
// apaga por caminho. Se ficar desatualizado ele não falha: apenas não remove
// nada, e as 17 server actions do admin voltam a ser endpoints acionáveis no
// fixly.company. Por isso a conferência logo abaixo é obrigatória, não enfeite.
const alvos = ["src/app/(app)/admin", "src/components/admin"];

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

// 3) Falha FECHADA. Um caminho errado aqui é silencioso e perigoso: o build
//    passa, o site sobe, e o painel vai junto sem ninguém notar.
if (removidos !== alvos.length) {
  console.error(
    `[strip-admin] ⛔ esperava remover ${alvos.length} alvos e removi ${removidos}.` +
      " Algum caminho mudou de lugar — corrija `alvos` antes de publicar.",
  );
  process.exit(1);
}

console.log(
  removidos > 0
    ? `[strip-admin] ✅ site público sem o painel (${removidos} pasta(s)). As server actions do admin não vão para este servidor.`
    : "[strip-admin] nada a remover (o painel já não estava presente).",
);
