// E2E v2 · Fase 5: pantallas. Mide de verdad cada arreglo (posiciones, saltos, deslizar…).
import { log, setup, login, completeOnboarding, settings } from "./helpers.mjs";

const { browser, track, fail, shot, finish } = await setup();

// ---------- Ordenador (1280×720) ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: "block", permissions: ["notifications"] });
  const p = await login(ctx, track, "pinchan.panchan@gmail.com");
  await completeOnboarding(p, { owner: true });

  const meta = await p.locator('meta[name="viewport"]').getAttribute("content");
  if (/maximum-scale=1|user-scalable=no/.test(meta ?? "")) await fail(`el zoom sigue bloqueado: ${meta}`);
  log("zoom permitido");

  const input = await p.locator('input[placeholder="Escríbeme, hermano…"]').boundingBox();
  const nav = await p.locator('nav[aria-label="Navegación principal"]').boundingBox();
  if (input.y + input.height > nav.y) await fail(`el cuadro de escribir queda detrás de la barra (${input.y + input.height} > ${nav.y})`);
  const note = await p.locator('nav button[aria-label="Nota rápida"]').boundingBox();
  const send = await p.locator('button[aria-label="Enviar"]').boundingBox();
  if (note.y < send.y + send.height) await fail("Nota rápida y Enviar siguen pegados");
  log("ordenador: cuadro de escribir por encima de la barra; Nota rápida lejos de Enviar");

  // Memorias: la cabecera no salta al cambiar de pestaña
  await p.click("a:has-text('Memorias')");
  const memHeader = p.locator('header:has(h1:has-text("Memorias"))');
  await memHeader.waitFor();
  const h1 = await memHeader.boundingBox();
  await p.click("text=/Notas rápidas ·/");
  await p.waitForTimeout(300);
  const h2 = await memHeader.boundingBox();
  if (Math.abs(h1.height - h2.height) > 1) await fail(`la cabecera de Memorias salta (${h1.height} → ${h2.height})`);
  log("Memorias: la cabecera no salta");

  // Ajustes: lista de apartados; notificaciones «Activadas»; ▶ no hace saltar la página
  await settings(p, "diario");
  await p.waitForSelector('[data-testid="push-enabled"]');
  log("notificaciones ya concedidas → «Activadas»");
  await settings(p, "voz");
  await p.evaluate(() => window.scrollTo(0, 200));
  const y0 = await p.evaluate(() => window.scrollY);
  await p.click('button[aria-label="Escuchar Hermano joven"]');
  await p.waitForTimeout(800);
  const y1 = await p.evaluate(() => window.scrollY);
  if (Math.abs(y1 - y0) > 4) await fail(`al pulsar ▶ la página salta ${y1 - y0}px`);
  log("▶ en una voz: la página no salta");

  // Nuevo atajo: desplegable de cristal con las opciones visibles
  await settings(p, "atajos");
  await p.click('button[role="combobox"][aria-label="Acción"]');
  const lb = await p.locator('[role="listbox"]').boundingBox();
  if (!lb || lb.y < 0 || lb.y + lb.height > 720) await fail("el desplegable de Nuevo atajo se sale de la pantalla");
  if ((await p.locator('[role="listbox"] [role="option"]').count()) < 10) await fail("no se ven todas las opciones de acción");
  await p.keyboard.press("Escape");
  log("Nuevo atajo: desplegable liquid glass con todas las opciones a la vista");

  // «Añadir proveedor» por encima de todo
  await settings(p, "ia");
  await p.click("text=Añadir una clave propia");
  const top = await p.evaluate(() => {
    const d = [...document.querySelectorAll('[role="dialog"]')].find((x) => x.getAttribute("aria-label") === "Añadir proveedor");
    const r = d.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + 20);
    return d.contains(el);
  });
  if (!top) await fail("«Añadir proveedor» queda por debajo de algo");
  await p.keyboard.press("Escape");
  log("«Añadir proveedor» queda encima de todo");
  await shot(p, "v2p5-settings");
  await ctx.close();
}

// ---------- iPhone (390×844, táctil) ----------
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: "block" });
  const p = await login(ctx, track, "mateolabandayt@gmail.com");
  await completeOnboarding(p, { owner: true, name: "Mateo" });

  // Modo flotante: el panel no se sale por la derecha y explica lo del iPhone
  await settings(p, "flotante");
  await p.click('button[aria-label="Modo flotante"][role="switch"]');
  await p.click("a:has-text('Cerebro')");
  const dot = p.locator('button[aria-label="Friday flotante"]');
  await dot.waitFor();
  await dot.tap();
  const card = await p.locator('[data-testid="floating-card"]').boundingBox();
  if (card.x + card.width > 390 + 1 || card.x < 0) await fail(`el panel flotante se sale (${card.x}…${card.x + card.width})`);
  log("modo flotante: el panel cabe en pantalla");
  await p.click('[data-testid="floating-card"] button[aria-label="Cerrar"]');

  // Diario: escribir, ver el análisis, editar, leyenda y deslizar para eliminar
  await p.click("a:has-text('Diario')");
  await p.click("button:has-text('Hoy')");
  await p.fill('[role="dialog"] textarea', "Hoy ha sido un día genial. Terminé el proyecto del trabajo y comí con mamá. Me siento orgulloso.");
  await p.click("text=Guardar cifrado");
  await p.waitForSelector("text=El punto es tu ánimo del día:");
  await p.click('[data-testid="diary-entry"] >> text=/alegr/');
  await p.waitForSelector('[data-testid="diary-analysis"] >> text=Ánimo del día:');
  await p.waitForSelector('[data-testid="diary-analysis"] >> text=Momentos clave');
  if (await p.locator('[data-testid="diary-entry"] >> text=/[😊🙏💪❤️✨🗑]/u').count()) await fail("quedan emojis en el diario");
  await p.click('[data-testid="diary-entry"] button:has-text("Editar")');
  await p.fill('[role="dialog"] textarea', "Hoy fue un día duro y triste, discutí en el trabajo y estoy agotado.");
  await p.click("text=Guardar cambios");
  await p.waitForSelector("text=/tristeza|estrés|cansancio/");
  log("diario: análisis (ánimo, emociones, momentos clave), editar, leyenda del punto, sin emojis");
  await p.waitForSelector('[role="dialog"]', { state: "detached" });
  const entry = p.locator('[data-testid="diary-entry"]').first();
  const b = await entry.boundingBox();
  await p.mouse.move(b.x + b.width - 30, b.y + 30);
  await p.mouse.down();
  await p.mouse.move(b.x + b.width - 90, b.y + 32, { steps: 6 });
  await p.mouse.move(b.x + b.width - 150, b.y + 32, { steps: 6 });
  await p.mouse.up();
  // La tarjeta se ha desplazado y deja ver «Eliminar»
  await p.waitForFunction(() => {
    const btn = document.querySelector('button[aria-label="Eliminar entrada"]');
    const r = btn.getBoundingClientRect();
    return btn.contains(document.elementFromPoint(r.left + r.width / 2, r.top + 30));
  });
  await shot(p, "v2p5-diary-swipe");
  const del = await p.locator('button[aria-label="Eliminar entrada"]').boundingBox();
  await p.touchscreen.tap(del.x + del.width / 2, del.y + 30);
  await p.waitForSelector('[data-testid="diary-entry"]', { state: "detached" });
  log("diario: deslizar a la izquierda → «Eliminar» (sin emojis) y se borra");
  await ctx.close();
}

await finish();
console.log("✓ E2E v2 fase 5 OK");
