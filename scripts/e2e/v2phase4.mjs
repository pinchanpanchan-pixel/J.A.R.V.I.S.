// E2E v2 · Fase 4: conexiones (buscador, logos, ficha, «Conectado como», desconectar todo con
// confirmación), Apple con atajo, claves de Govee, Hogar con nombres bonitos y Maps sin cuenta.
import { log, setup, login, completeOnboarding, settings } from "./helpers.mjs";

const { browser, track, fail, shot, finish } = await setup();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", permissions: ["clipboard-read", "clipboard-write"] });
await ctx.route("https://www.google.com/maps/**", (r) => r.fulfill({ contentType: "text/html", body: "<title>Maps</title>" }));
const p = await login(ctx, track, "pinchan.panchan@gmail.com");
await completeOnboarding(p, { owner: true });
log("configuración inicial: Spotify conectado con su inicio de sesión (prueba)");

await settings(p, "conexiones");
await p.waitForSelector("#conexiones");
const grid = p.locator("#conexiones");
for (const bad of ["Apple Passwords", "Contraseñas", "Inicio de sesión", "Atajos de iOS", "HomeKit"]) {
  if (await p.locator(`#conexiones >> text="${bad}"`).count()) await fail(`no debería aparecer «${bad}» en Conexiones`);
}
if ((await grid.locator("svg path").count()) < 10) await fail("faltan los logos de las apps");
await p.waitForSelector('[data-testid="connector-spotify"] >> text=/(prueba)/');
log("rejilla: logos reales, sin Contraseñas de Apple ni etiquetas pequeñas; Spotify «Conectado como … (prueba)»");

await grid.locator('input[aria-label="Buscar app"]').fill("tareas");
await p.waitForSelector('[data-testid="connector-todoist"]');
if (await grid.locator('[data-testid="connector-spotify"]').count()) await fail("el buscador no filtra");
await grid.locator('input[aria-label="Buscar app"]').fill("");
log("buscador: «tareas» encuentra Todoist");

await p.click('[data-testid="connector-photos"]');
await p.waitForSelector('[role="dialog"] >> text=/Eliges fotos y las recuerdo/');
await p.waitForSelector("button:has-text('Elegir fotos')");
await p.keyboard.press("Escape");
await p.click('[data-testid="connector-apple_calendar"]');
await p.click('[role="dialog"] button:has-text("Añadir atajo")');
await p.waitForSelector("text=/He copiado tu código/");
const clip = await p.evaluate(() => navigator.clipboard.readText());
if (!/^jv_/.test(clip)) await fail("no se copió el código personal del atajo");
await p.keyboard.press("Escape");
log("Fotos explica qué hace; Apple: «Añadir atajo» copia tu código personal");

await p.click("button:has-text('Desconectar todo')");
await p.waitForSelector("text=¿Desconectar todo?");
await p.click('[role="dialog"] button:has-text("Cancelar")');
await p.waitForSelector('[data-testid="connector-spotify"] >> text=/(prueba)/');
await p.click("button:has-text('Desconectar todo')");
await p.click('[role="dialog"] button:has-text("Desconectar todo")');
await p.waitForSelector('[data-testid="connector-spotify"] >> text=/(prueba)/', { state: "detached" });
log("«Desconectar todo» pide confirmación (cancelar no toca nada)");

// Hogar
await p.click("a:has-text('Hogar')");
await p.waitForSelector("text=/Compatible con: Philips Hue, Govee, Tuya/");
await p.click('[data-testid="connector-alexa"]');
await p.waitForSelector('[role="dialog"] >> text=No disponible todavía');
await p.keyboard.press("Escape");
await p.click('[data-testid="connector-govee"]');
await p.fill('input[aria-label="Clave de la API de Govee"]', "govee-key-1234");
await p.click('[role="dialog"] button:has-text("Conectar")');
// Al llegar los dispositivos, Hogar pasa de «conecta tu casa» a la lista (la ficha se cierra sola)
await p.waitForSelector("text=Tira LED", { timeout: 15000 });
await p.waitForSelector("text=Conectado:");
await p.waitForSelector("span:has-text('Govee')");
if (await p.locator("text=/google_home|alexa,/").count()) await fail("Hogar muestra nombres internos");
await shot(p, "v2p4-home");
log("Hogar: «Compatible con…», Alexa explicada, Govee con su clave → dispositivos, nombres bien escritos");

// Maps sin cuenta
await p.click("a:has-text('Cerebro')");
await p.fill('input[placeholder="Escríbeme, hermano…"]', "Llévame a Atocha");
const [popup] = await Promise.all([ctx.waitForEvent("page", { timeout: 10000 }), p.click('button[aria-label="Enviar"]')]);
if (!popup.url().startsWith("https://www.google.com/maps/dir/")) await fail(`Maps abrió ${popup.url()}`);
await popup.close();
log("«Llévame a Atocha» abre la ruta en Google Maps");

await finish();
console.log("✓ E2E v2 fase 4 OK");
