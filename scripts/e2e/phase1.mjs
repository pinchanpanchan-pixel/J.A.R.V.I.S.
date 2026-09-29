// E2E Fase 1: login (propietario), sincronización entre 2 "dispositivos", modo offline.
// Uso: node scripts/e2e/phase1.mjs  (con la app en http://localhost:3000)
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const exe = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const shots = process.env.SHOTS_DIR;
const log = (...a) => console.log("•", ...a);
const fail = (m) => {
  console.error("✗", m);
  process.exit(1);
};

const browser = await chromium.launch({ executablePath: exe });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: [] });
const errors = [];
const a = await ctx.newPage();
a.on("pageerror", (e) => errors.push(String(e)));

await a.goto(`${BASE}/`);
await a.waitForURL("**/login");
log("redirige a /login sin sesión");
await a.fill('input[type="email"]', "pinchan.panchan@gmail.com");
await a.click('button[type="submit"]');
await a.waitForSelector("text=OWNER · Lifetime", { timeout: 15000 });
log("propietario detectado: OWNER · Lifetime");
shots && (await a.screenshot({ path: `${shots}/phase1-home.png` }));

// Segundo "dispositivo" (misma cuenta, otra pestaña)
const b = await ctx.newPage();
b.on("pageerror", (e) => errors.push(String(e)));
await b.goto(`${BASE}/`);
await b.waitForSelector("text=OWNER · Lifetime", { timeout: 15000 });

const t0 = Date.now();
await a.fill('input[placeholder="Nota rápida…"]', "Comprar leche");
await a.click("text=Guardar");
await b.waitForSelector("text=Comprar leche", { timeout: 5000 });
log(`nota del dispositivo A visible en B en ${Date.now() - t0} ms`);

// Offline
await ctx.setOffline(true);
await a.waitForSelector("text=Sin internet, hermano", { timeout: 5000 });
log("tarjeta offline visible + modo grabadora");
shots && (await a.screenshot({ path: `${shots}/phase1-offline.png` }));
await a.click('button[aria-label="Minimizar aviso"]');
await a.waitForSelector("text=Offline · guardando en local");
await a.fill('input[placeholder="Nota rápida…"]', "Nota offline");
await a.click("text=Guardar");
await a.waitForSelector("text=Nota offline");
const pendingText = await a.locator("pre").innerText();
if (!/"pending": [1-9]/.test(pendingText)) fail("la nota offline no quedó en cola: " + pendingText);
log("nota offline en cola (pending > 0)");
await ctx.setOffline(false);
await b.waitForSelector("text=Nota offline", { timeout: 20000 });
log("al volver la conexión la cola se subió y llegó a B");

// Borrado sincronizado
await b.locator("li", { hasText: "Comprar leche" }).locator("text=Borrar").click();
await a.waitForSelector("text=Comprar leche", { state: "detached", timeout: 5000 });
log("borrado sincronizado");

// Usuario normal: no propietario
const ctx2 = await browser.newContext();
const c = await ctx2.newPage();
c.on("pageerror", (e) => errors.push(String(e)));
await c.goto(`${BASE}/login`);
await c.fill('input[type="email"]', "amigo@example.com");
await c.click('button[type="submit"]');
await c.waitForSelector("text=Free", { timeout: 15000 });
if (await c.locator("text=Comprar leche").count()) fail("otro usuario ve notas ajenas");
log("usuario normal: plan Free, sin datos ajenos");

if (errors.length) fail("errores JS: " + errors.join("\n"));
await browser.close();
console.log("✓ E2E fase 1 OK");
