// E2E v2 · Fase 6: barra en cápsula de cristal, segmentado, etiquetas, crecer al pasar el ratón
// y estilos (Actual, Constelación, Pulso de luz) con bloqueo para cuentas gratis.
import { log, setup, login, completeOnboarding, settings } from "./helpers.mjs";

const { browser, track, fail, shot, finish } = await setup();

// ---------- Dueño en móvil (390×844) ----------
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", hasTouch: false });
  const p = await login(ctx, track, "pinchan.panchan@gmail.com");
  await completeOnboarding(p, { owner: true });

  // Barra: cápsula que no toca los bordes, solo iconos, píldora en la activa, Nota rápida aparte a la derecha
  const cap = await p.locator('[data-testid="nav-capsule"]').boundingBox();
  if (cap.x < 8 || cap.x + cap.width > 390 - 8 || 844 - (cap.y + cap.height) < 8) await fail(`la cápsula toca los bordes: ${JSON.stringify(cap)}`);
  const radius = await p.locator('[data-testid="nav-capsule"]').evaluate((e) => getComputedStyle(e).borderRadius);
  if (parseFloat(radius) < 30) await fail(`la barra no es una cápsula (radius ${radius})`);
  // El nombre solo está para lectores de pantalla (sr-only: 1×1 px), no se ve.
  const visibleText = await p.locator('[data-testid="nav-capsule"] a span').evaluateAll((els) => els.filter((e) => e.textContent.trim() && e.getBoundingClientRect().width > 1).map((e) => e.textContent));
  if (visibleText.length) await fail(`la barra muestra texto: «${visibleText.join(", ")}»`);
  if ((await p.locator('[data-testid="nav-pill"]').count()) !== 1) await fail("no hay píldora en la pestaña activa");
  const note = await p.locator('[data-testid="nav-quick-note"]').boundingBox();
  if (note.x < cap.x + cap.width) await fail("la Nota rápida no va a la derecha de la cápsula");
  if (Math.abs(note.width - note.height) > 1) await fail("la Nota rápida no es un círculo");
  if ((await p.locator('button[aria-label="Nota rápida"]').count()) !== 1) await fail("hay más de un botón de Nota rápida");
  const pillInHome = await p.locator('a[aria-current="page"] [data-testid="nav-pill"]').count();
  if (!pillInHome) await fail("la píldora no está en Cerebro");
  await p.click("a:has-text('Memorias')");
  await p.waitForSelector('a[aria-current="page"][href="/memories"] [data-testid="nav-pill"]');
  log("barra: cápsula flotante, solo iconos, píldora activa, Nota rápida en círculo a la derecha");

  // Segmentado de Memorias en cápsula de cristal con píldora
  const tab = p.locator('[role="tablist"]').first();
  const tr = await tab.evaluate((e) => [getComputedStyle(e).borderRadius, getComputedStyle(e).backdropFilter]);
  if (parseFloat(tr[0]) < 20 || !/blur/.test(tr[1])) await fail(`segmentado sin cristal: ${tr}`);
  const activeBg = await p.locator('[role="tab"][aria-selected="true"]').first().evaluate((e) => getComputedStyle(e).backgroundColor);
  if (activeBg !== "rgba(0, 0, 0, 0)") await fail(`la pestaña activa sigue rellena de acento: ${activeBg}`);
  log("Memorias: segmentado de cristal con píldora");
  await shot(p, "v6-memorias");

  await settings(p, "estilo");
  // Dueño: todo desbloqueado
  if (await p.locator('[data-testid^="style-"][data-locked]').count()) await fail("el dueño tiene estilos bloqueados");
  await p.click('[data-testid="style-constelacion"]');
  await p.waitForFunction(() => document.documentElement.dataset.style === "constelacion");
  await p.click("a:has-text('Cerebro')");
  const greet = p.locator('[data-testid="greeting"]');
  await greet.waitFor();
  const font = await greet.evaluate((e) => getComputedStyle(e).fontFamily);
  if (!/serif/i.test(font) || /^-apple-system/.test(font)) await fail(`el saludo no va en serif: ${font}`);
  if (!(await p.locator('canvas[aria-label^="Constelación"]').count())) await fail("no está la esfera de constelación");
  const bg = await p.evaluate(() => getComputedStyle(document.documentElement).backgroundImage + getComputedStyle(document.documentElement).backgroundColor);
  log("Constelación: saludo en serif, esfera de puntos, fondo", bg.slice(0, 60));
  await shot(p, "v6-constelacion");

  await settings(p, "estilo");
  await p.click('[data-testid="style-pulso"]');
  await p.waitForFunction(() => document.documentElement.dataset.style === "pulso");
  await p.click("a:has-text('Cerebro')");
  await p.waitForSelector('[data-testid="active-indicator"]:has-text("Activo")');
  if (await p.locator('[data-testid="greeting"]').count()) await fail("Pulso de luz no debería mostrar el saludo");
  if (!(await p.locator('canvas[aria-label^="Pulso de luz"]').count())) await fail("no está la luz de Pulso");
  log("Pulso de luz: indicador «Activo», sin saludo, punto de luz");
  await shot(p, "v6-pulso");

  // Se recuerda tras recargar (sin destello del estilo por defecto)
  await p.reload();
  const early = await p.evaluate(() => document.documentElement.dataset.style);
  if (early !== "pulso") await fail(`tras recargar el estilo es ${early}`);
  log("el estilo se mantiene al recargar");

  await settings(p, "estilo");
  await p.click('[data-testid="style-actual"]');
  await p.waitForFunction(() => (document.documentElement.dataset.style ?? "actual") === "actual");
  await ctx.close();
}

// ---------- Ordenador: etiquetas y crecer al pasar el ratón ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: "block" });
  const p = await login(ctx, track, "amigo6@example.com");
  await completeOnboarding(p, { owner: false });

  await p.hover('button[aria-label="Conversación"]');
  const tip = p.locator('[data-testid="tooltip"]');
  await tip.waitFor({ timeout: 3000 });
  if ((await tip.innerText()).trim() !== "Conversación") await fail(`etiqueta incorrecta: ${await tip.innerText()}`);
  if (await p.locator('button[aria-label="Conversación"][title]').count()) await fail("sigue el title nativo (saldrían dos etiquetas)");
  log("etiqueta al pasar el ratón por un botón de icono");

  await p.hover('a[href="/diary"]');
  await p.waitForSelector('[data-testid="tooltip"]:has-text("Diario")');
  log("etiqueta en los iconos de la barra");

  await p.hover('[data-testid="dot-button"]');
  await p.waitForTimeout(700);
  if (await tip.count()) await fail("la bolita no debería mostrar etiqueta");

  await p.hover('[data-testid="nav-quick-note"]');
  await p.waitForTimeout(350);
  const scale = await p.locator('[data-testid="nav-quick-note"]').evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).a);
  if (!(scale > 1.01)) await fail(`el botón no crece al pasar el ratón (scale ${scale})`);
  log("los botones crecen al pasar el ratón", scale.toFixed(3));

  // Cuenta gratis: Constelación y Pulso bloqueados
  await settings(p, "estilo");
  if ((await p.locator('[data-testid^="style-"][data-locked]').count()) !== 2) await fail("la cuenta gratis debería ver 2 estilos bloqueados");
  await p.click('[data-testid="style-constelacion"]');
  await p.waitForSelector("text=vienen con los planes de pago");
  await p.waitForTimeout(400);
  if (((await p.evaluate(() => document.documentElement.dataset.style)) ?? "actual") !== "actual") await fail("una cuenta gratis ha podido usar un estilo de pago");
  log("cuenta gratis: estilos de pago bloqueados");
  await ctx.close();
}

await finish();
log("v2phase6 OK");
