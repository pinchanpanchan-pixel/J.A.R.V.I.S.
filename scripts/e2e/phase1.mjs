// E2E Fase 1: login (propietario), sincronización entre 2 "dispositivos", modo offline, aislamiento entre usuarios.
import { BASE, log, setup, login, completeOnboarding, addQuickNote } from "./helpers.mjs";

const { browser, fail, track, shot, finish } = await setup();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });

const probe = track(await ctx.newPage());
await probe.goto(`${BASE}/`);
await probe.waitForURL("**/login");
log("redirige a /login sin sesión");
await probe.close();

const a = await login(ctx, track, "pinchan.panchan@gmail.com");
await completeOnboarding(a, { owner: true });
await a.click("a:has-text('Ajustes')");
await a.waitForSelector("text=OWNER - Lifetime", { timeout: 15000 });
log("propietario detectado: OWNER - Lifetime");

// Segundo "dispositivo" (misma cuenta, otra pestaña)
const b = track(await ctx.newPage());
await b.goto(`${BASE}/memories?tab=notes`);
await b.waitForSelector("text=Notas rápidas");

await a.waitForTimeout(3000); // deja que termine de subir la cola del onboarding
await a.bringToFront();
await a.click('button[aria-label="Nota rápida"]');
await a.fill('[role="dialog"] textarea', "Comprar leche");
// La hoja termina de abrirse antes de medir (solo se mide la sincronización).
await a.locator('[role="dialog"] button:has-text("Guardar")').click({ trial: true });
const appeared = b.waitForSelector("text=Comprar leche", { timeout: 5000 }); // se vigila B en paralelo
const savedAt = Date.now();
await a.click('[role="dialog"] button:has-text("Guardar")');
await appeared;
const ms = Date.now() - savedAt;
log(`nota del dispositivo A visible en B en ${ms} ms (incluye 120 ms de latencia simulada)`);
if (ms > 1000) await fail(`sincronización demasiado lenta: ${ms} ms (objetivo < 1 s)`);

// Offline
await ctx.setOffline(true);
await a.waitForSelector("text=Sin internet, hermano", { timeout: 5000 });
log("tarjeta offline visible + modo grabadora");
await shot(a, "phase1-offline");
await a.click('button[aria-label="Minimizar aviso"]');
await a.waitForSelector("text=Offline · guardando en local");
await addQuickNote(a, "Nota offline");
await a.waitForSelector("text=/Offline · guardando en local · [1-9]/");
log("nota offline en cola (pendiente)");
await ctx.setOffline(false);
await b.waitForSelector("text=Nota offline", { timeout: 20000 });
log("al volver la conexión la cola se subió y llegó a B");

// Borrado sincronizado
await b.locator("li", { hasText: "Comprar leche" }).locator('button[aria-label="Borrar nota"]').click();
await a.goto(`${BASE}/memories?tab=notes`);
await a.waitForSelector("text=Nota offline");
if (await a.locator("text=Comprar leche").count()) await fail("el borrado no se sincronizó");
log("borrado sincronizado");

// Otro usuario: sin datos ajenos
const ctx2 = await browser.newContext();
const c = await login(ctx2, track, "amigo@example.com");
await completeOnboarding(c, { owner: false });
await c.goto(`${BASE}/memories?tab=notes`);
await c.waitForSelector("text=Sin notas rápidas");
log("otro usuario: sin datos ajenos");

await finish();
console.log("✓ E2E fase 1 OK");
