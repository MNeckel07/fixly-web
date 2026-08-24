import { chromium, devices } from "/Users/matheusneckel/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs";

const EMAIL = process.argv[2];
const SENHA = process.argv[3];
const ROTA  = process.argv[4];

const browser = await chromium.launch({ executablePath: "/Users/matheusneckel/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing" });
const ctx = await browser.newContext({ ...devices["Pixel 7"] });
const page = await ctx.newPage();

const erros = [];
const console_ = [];
page.on("pageerror", (e) => erros.push("PAGEERROR: " + e.message));
page.on("console", (m) => { if (["error","warning"].includes(m.type())) console_.push(`[${m.type()}] ${m.text().slice(0,200)}`); });
page.on("crash", () => erros.push("!!! A ABA TRAVOU (crash) !!!"));
page.on("requestfailed", (r) => erros.push(`REQ FALHOU: ${r.url().slice(0,90)} -> ${r.failure()?.errorText}`));

try {
  console.log("1) abrindo /login ...");
  await page.goto("https://fixly.company/login", { waitUntil: "domcontentloaded", timeout: 90000 });
  console.log("   titulo:", await page.title());

  console.log("2) preenchendo e entrando ...");
  const papel = ROTA && ROTA.includes("prestador") ? "Prestador" : "Contratante";
  await page.getByRole("button", { name: new RegExp("^" + papel) }).first().click().catch(()=>{});
  await page.locator('input[type="text"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(SENHA);
  await Promise.all([
    page.waitForURL(u => !u.pathname.includes("/login"), { timeout: 90000 }).catch(() => {}),
    page.locator('button[type="submit"]').first().click(),
  ]);
  await page.waitForTimeout(6000);
  console.log("   url agora:", page.url());

  if (ROTA) { console.log("3) indo para", ROTA); await page.goto("https://fixly.company"+ROTA, { waitUntil:"domcontentloaded", timeout: 90000 }); await page.waitForTimeout(8000); }

  const m = await page.evaluate(() => ({
    heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize/1048576) : null,
    corpo: document.body?.innerText?.slice(0,150) ?? "(vazio)",
  })).catch(e => ({ erro: e.message }));
  console.log("   memoria JS:", m.heap, "MB | conteudo:", JSON.stringify(m.corpo));
} catch (e) {
  console.log("EXCECAO:", e.message.slice(0, 300));
}

console.log("\n=== ERROS ==="); console.log(erros.length ? erros.slice(0,15).join("\n") : "(nenhum)");
console.log("\n=== CONSOLE ==="); console.log(console_.length ? console_.slice(0,15).join("\n") : "(limpo)");
await browser.close();
