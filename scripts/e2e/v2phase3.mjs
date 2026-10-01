// E2E v2 · Fase 3: login con código de 6 dígitos (sin Apple), «Cómo funciono» desde Ajustes
// y API de propietario protegida en el servidor.
import { BASE, log, setup, completeOnboarding } from "./helpers.mjs";

const { browser, track, fail, shot, finish } = await setup();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
const p = track(await ctx.newPage());
await p.goto(`${BASE}/login`);
await p.waitForSelector("text=Continuar con Google");
if (await p.locator("text=/Apple/").count()) await fail("no debería haber login con Apple");
await p.fill('input[type="email"]', "Pinchan.Panchan@gmail.com");
await p.click("button:has-text('Enviarme un código')");
await p.waitForSelector("text=Mira tu correo");
await p.waitForSelector("text=pinchan.panchan@gmail.com");
await p.waitForSelector("text=/Reenviar en \\d+ s/");
const code = (await p.locator('[data-testid="mock-code"] b').innerText()).trim();
if (!/^\d{6}$/.test(code)) await fail(`el código no tiene 6 dígitos: ${code}`);
await shot(p, "v2p3-code");
const wrong = code === "000000" ? "111111" : "000000";
await p.fill('input[aria-label="Código de 6 dígitos"]', wrong);
await p.waitForSelector("text=Código incorrecto. Revísalo o pide otro.");
log("código incorrecto → aviso y se puede reintentar");
await p.fill('input[aria-label="Código de 6 dígitos"]', code);
await p.waitForURL((u) => u.pathname === "/", { timeout: 15000 });
log("código correcto (6 dígitos) → dentro, sin salir de la app");

await completeOnboarding(p, { owner: true });
await p.click("a:has-text('Ajustes')");
await p.waitForSelector("text=Proveedores de IA");
await p.click('button[aria-label="Probar el cerebro"]');
await p.waitForSelector("text=/Cerebro simulado|Gemini|Claude/", { timeout: 15000 });
log("propietario: Proveedores de IA con orden de proveedores y prueba en directo");
await p.click("button:has-text('Cómo funciono')");
await p.waitForSelector('[role="dialog"] >> text=El punto que respira');
await p.keyboard.press("Escape");
log("«Cómo funciono» se vuelve a abrir desde Ajustes → Ayuda");

// API de propietario: 200 para el propietario, 403 para cualquier otra cuenta
const stats = await p.evaluate(async () => {
  const s = JSON.parse(localStorage.getItem("jarvis.mockSession") ?? "{}");
  const call = (id, email) => fetch("/api/admin/stats", { headers: { "x-jarvis-mock-user": id, "x-jarvis-mock-email": email } }).then((r) => r.status);
  return [await call(s.id, s.email), await call("44444444-4444-4444-8444-444444444444", "cliente@example.com")];
});
if (stats[0] !== 200 || stats[1] !== 403) await fail(`/api/admin/stats debería ser 200/403 y es ${stats.join("/")}`);
log("/api/admin/stats: 200 propietario, 403 cliente");

await finish();
console.log("✓ E2E v2 fase 3 OK");
