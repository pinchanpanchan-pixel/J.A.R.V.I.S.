// E2E Fase 5: pagos (simulados), códigos de descuento, propietario y panel de códigos.
import { log, setup, login, completeOnboarding, logout } from "./helpers.mjs";

const { browser, fail, track, shot, finish } = await setup();
// Mismo contexto = misma «nube» simulada para todos los usuarios (los códigos son globales)
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });

// ---- Usuario 1: código inválido, BROTHER50 y pago con tarjeta
let p = await login(ctx, track, "ana@example.com");
await completeOnboarding(p, {
  owner: false,
  name: "Ana",
  shot,
  payment: async (pg) => {
    const html = await pg.content();
    if (!/Pagar con PayPal/.test(html) || !/Pagar con tarjeta/.test(html)) await fail("faltan los botones de PayPal o tarjeta");
    await pg.click("text=Tengo código de descuento");
    await pg.fill('input[aria-label="Código de descuento"]', "NOEXISTE");
    await pg.click("button:has-text('Aplicar')");
    await pg.waitForSelector("text=Código no válido");
    log("código inválido → «Código no válido»");
    await pg.fill('input[aria-label="Código de descuento"]', "brother50");
    await pg.click("button:has-text('Aplicar')");
    await pg.waitForSelector("text=/BROTHER50: −50 %/");
    await pg.waitForSelector("text=$14.50");
    await shot(pg, "p5-discount");
    log("BROTHER50 → Pro a $14.50 (tachado $29)");
    await pg.click("text=Pagar con tarjeta");
    await pg.waitForSelector("text=/Simular pago de/");
    await pg.click("text=Confirmar pago simulado");
    await pg.waitForSelector("text=Bienvenido, hermano.", { timeout: 15000 });
    log("pago simulado con tarjeta → plan activado");
  },
});
await p.click("a:has-text('Ajustes')");
await p.waitForSelector("text=/Plan Pro · mensual/");
await p.click("a:has-text('Diario')");
await p.waitForSelector("text=Diario");
if (await p.locator("text=Tu diario privado").count()) await fail("el diario debería estar desbloqueado tras pagar");
log("Ana: Pro activo, diario desbloqueado");
await logout(p);

// ---- Usuario 2 (v2): PANCHAN100 es solo para propietarios → para Bea no existe
p = await login(ctx, track, "bea@example.com");
await completeOnboarding(p, {
  owner: false,
  name: "Bea",
  payment: async (pg) => {
    await pg.click("text=Tengo código de descuento");
    await pg.fill('input[aria-label="Código de descuento"]', "PANCHAN100");
    await pg.click("button:has-text('Aplicar')");
    await pg.waitForSelector("text=Código no válido");
    log("PANCHAN100 con una cuenta normal → «Código no válido»");
    await pg.click("text=Seguir con el plan Free");
  },
});
await p.click("a:has-text('Ajustes')");
await p.waitForSelector("text=Suscripción");
if (await p.locator("text=OWNER - Lifetime").count()) await fail("Bea no debería ser propietaria");
if (await p.locator("text=Proveedores de IA").count()) await fail("un cliente no debe ver Proveedores de IA");
if (await p.locator("text=Códigos de descuento").count()) await fail("un cliente no debe ver Códigos de descuento");
log("Bea: sigue en Free, sin Proveedores de IA ni Códigos de descuento");
await logout(p);

// ---- Propietario por email: nunca ve el pago; panel de códigos con CRUD
p = await login(ctx, track, "pinchan.panchan@gmail.com");
await completeOnboarding(p, { owner: true });
await p.click("a:has-text('Ajustes')");
await p.waitForSelector("text=OWNER - Lifetime");
if (await p.locator("text=Desbloquea a tu hermano completo").count()) await fail("el propietario no debe ver el pago");
await p.waitForSelector('[data-testid="code-BROTHER50"] >> text=/Usos 1\/100/');
await p.waitForSelector('[data-testid="code-PANCHAN100"] >> text=/Usos 0\/∞/');
await p.waitForSelector("text=Proveedores de IA");
log("panel: usos reales (BROTHER50 1/100, PANCHAN100 0/∞: el intento de Bea no cuenta) + Proveedores de IA visible");
await p.click("text=Crear código");
await p.fill('input[aria-label="Código"]', "VIP40");
await p.fill('input[aria-label="Porcentaje"]', "40");
await p.fill('input[aria-label="Usos máximos"]', "5");
await p.click('[role="dialog"] button:has-text("Crear")');
await p.waitForSelector('[data-testid="code-VIP40"] >> text=/Usos 0\/5/');
await p.click('[data-testid="code-FRIENDS20"] [role="switch"]');
await p.click('button[aria-label="Borrar LAUNCH30"]');
await p.waitForSelector('[data-testid="code-LAUNCH30"]', { state: "detached" });
await shot(p, "p5-admin");
log("panel: crear VIP40, desactivar FRIENDS20, borrar LAUNCH30");
await logout(p);

// ---- Usuario 3: comprueba los cambios del panel
p = await login(ctx, track, "carlos@example.com");
await completeOnboarding(p, {
  owner: false,
  name: "Carlos",
  payment: async (pg) => {
    await pg.click("text=Tengo código de descuento");
    await pg.fill('input[aria-label="Código de descuento"]', "FRIENDS20");
    await pg.click("button:has-text('Aplicar')");
    await pg.waitForSelector("text=Código no válido");
    await pg.fill('input[aria-label="Código de descuento"]', "VIP40");
    await pg.click("button:has-text('Aplicar')");
    await pg.waitForSelector("text=/VIP40: −40 %/");
    await pg.click("text=Seguir con el plan Free");
  },
});
log("Carlos: FRIENDS20 desactivado rechazado, VIP40 válido");

await finish();
console.log("✓ E2E fase 5 OK");
