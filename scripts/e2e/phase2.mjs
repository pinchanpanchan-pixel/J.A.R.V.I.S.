// E2E Fase 2: onboarding (el propietario salta el pago), UI principal, memorias, diario, hogar, modo flotante.
import { BASE, log, setup, login, completeOnboarding, addQuickNote, settings } from "./helpers.mjs";

const { browser, fail, track, shot, finish } = await setup();

// ---------- Propietario ----------
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const a = await login(ctx, track, "pinchan.panchan@gmail.com");
const o = await completeOnboarding(a, { owner: true, shot });
if (o.total !== 9) await fail(`el propietario debería tener 9 pasos (sin pago), tiene ${o.total}`);
if (!o.locationRequired) await fail("la ubicación debe ser obligatoria");
log("propietario: 9 pasos (con «Aprende tu voz», salta el pago), ubicación obligatoria");
await a.waitForSelector("h1:has-text('Friday')");
await shot(a, "p2-brain");
log("Cerebro con nombre personalizado (Friday)");

await a.fill('input[placeholder="Escríbeme, hermano…"]', "hola");
await a.click('button[aria-label="Enviar"]');
await a.waitForSelector("text=/Aquí estoy|Buenas, hermano|Te escucho/", { timeout: 10000 });
log("chat responde con personalidad");

await addQuickNote(a, "Llamar a mamá el domingo");

await a.click("a:has-text('Memorias')");
await a.click('button[aria-label="Nuevo bloque"]');
await a.fill('input[placeholder="Título"]', "Viaje a Medellín");
await a.fill('[role="dialog"] textarea', "Hotel en El Poblado");
await a.fill('input[placeholder^="Etiquetas"]', "viajes, familia");
await a.click('[role="dialog"] button:has-text("Guardar")');
await a.waitForSelector("text=Viaje a Medellín");
await a.fill('input[type="search"]', "medellin");
await a.waitForSelector("text=Viaje a Medellín");
await shot(a, "p2-memories");
await a.click("button:has-text('Notas rápidas')");
await a.waitForSelector("text=Llamar a mamá el domingo");
log("memorias: bloque, búsqueda sin acentos, nota rápida");

await a.click("a:has-text('Diario')");
await a.click("button:has-text('Hoy')");
await a.fill('[role="dialog"] textarea', "Hoy ha sido un buen día. Terminé la fase 2.");
await a.click("text=Guardar cifrado");
await a.waitForSelector("text=Hoy ha sido un buen día.");
await a.click("text=Hoy ha sido un buen día.");
await a.waitForSelector("text=Terminé la fase 2.");
await shot(a, "p2-diary");
log("diario: entrada cifrada y descifrada");

await a.click("a:has-text('Hogar')");
await a.click("text=Añadir dispositivos de demostración");
await a.waitForSelector("text=Tira LED");
await a.waitForSelector("text=Echo");
await a.click("text=Apagar todo");
await a.waitForFunction(() => !document.body.innerText.match(/[1-9]\/\d encendidos/));
await shot(a, "p2-home");
log("hogar: dispositivos y apagar todo");

await settings(a);
await a.waitForSelector("text=OWNER - Lifetime");
if (await a.locator('[data-testid="settings-suscripcion"]').count()) await fail("el propietario no debe ver la suscripción");
await a.click('[data-testid="settings-flotante"]');
await a.click('button[aria-label="Modo flotante"][role="switch"]');
await a.waitForSelector('button[aria-label="Friday flotante"]');
await shot(a, "p2-settings");
log("ajustes: OWNER - Lifetime, sin pago, modo flotante activo");

const b = track(await ctx.newPage());
await b.goto(`${BASE}/memories`);
await b.waitForSelector("text=Viaje a Medellín", { timeout: 15000 });
await b.waitForSelector('button[aria-label="Friday flotante"]');
if (await b.locator("text=¿Cómo te llamo, hermano?").count()) await fail("el segundo dispositivo no debería repetir el onboarding");
log("segundo dispositivo: todo sincronizado (incluido el modo flotante), sin repetir onboarding");

// ---------- Usuario normal ----------
const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
const c = await login(ctx2, track, "amigo@example.com");
const u = await completeOnboarding(c, { owner: false, shot });
if (u.total !== 10) await fail(`usuario normal debería tener 10 pasos, tiene ${u.total}`);
await c.click("a:has-text('Diario')");
await c.waitForSelector("text=Tu diario privado");
await settings(c);
await c.waitForSelector('[data-testid="settings-suscripcion"]');
log("usuario Free: 10 pasos, diario bloqueado y suscripción visible");

await finish();
console.log("✓ E2E fase 2 OK");
