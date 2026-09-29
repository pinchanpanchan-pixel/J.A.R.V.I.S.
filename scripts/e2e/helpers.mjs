// Utilidades compartidas de los tests E2E.
import { chromium } from "playwright-core";

export const BASE = process.env.BASE_URL ?? "http://localhost:3000";
export const shotsDir = process.env.SHOTS_DIR;
export const log = (...a) => console.log("•", ...a);

export async function setup() {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const errors = [];
  const pages = [];
  const fail = async (m) => {
    console.error("✗", m?.message ?? m);
    for (const [i, p] of pages.entries()) {
      try {
        if (shotsDir) await p.screenshot({ path: `${shotsDir}/fail-${i}.png` });
        console.error(`--- page ${i} ${p.url()}\n` + (await p.locator("body").innerText()).slice(0, 800));
      } catch {}
    }
    if (errors.length) console.error("errores JS:\n" + errors.join("\n"));
    process.exit(1);
  };
  process.on("unhandledRejection", fail);
  process.on("uncaughtException", fail);
  const track = (p) => {
    p.on("pageerror", (e) => errors.push(String(e)));
    p.on("dialog", (d) => d.accept());
    pages.push(p);
    return p;
  };
  const shot = async (p, name) => shotsDir && (await p.screenshot({ path: `${shotsDir}/${name}.png` }));
  const finish = async () => {
    for (const p of pages) if (!p.isClosed() && (await p.locator("text=/cambios? rechazados?/").count())) await fail("hay cambios rechazados por el servidor");
    if (errors.length) await fail("errores JS:\n" + errors.join("\n"));
    await browser.close();
  };
  return { browser, errors, pages, fail, track, shot, finish };
}

export async function login(ctx, track, email) {
  const p = track(await ctx.newPage());
  await p.goto(`${BASE}/login`);
  await p.fill('input[type="email"]', email);
  await p.click('button[type="submit"]');
  return p;
}

/** Recorre el onboarding completo. */
export async function completeOnboarding(p, { owner, name = "Pancho", assistant = "Friday", shot } = {}) {
  await p.waitForSelector("text=¿Cómo te llamo, hermano?", { timeout: 20000 });
  const tag = owner ? "owner" : "user";
  await shot?.(p, `onb1-${tag}`);
  const dots = await p.locator('[aria-label^="Paso 1 de"]').getAttribute("aria-label");
  const total = Number(dots.split(" de ")[1]);
  await p.fill('input[placeholder="Tu nombre"]', name);
  await p.locator('[role="dialog"] input').nth(1).fill(assistant);
  await p.click("text=Continuar");
  await p.waitForSelector("text=Elige mi voz");
  await shot?.(p, `onb2-${tag}`);
  await p.click("text=Continuar");
  await p.waitForSelector("text=Conecta tu mundo");
  await p.click("text=Seleccionar todo");
  await p.waitForSelector("text=Quitar todo");
  await shot?.(p, `onb3-${tag}`);
  await p.click("text=Continuar");
  await p.waitForSelector("text=Tu hogar");
  await p.click("text=Saltar");
  await p.waitForSelector("text=¿Dónde estás, hermano?");
  const locked = await p.locator("button:has-text('Continuar')").isDisabled();
  await p.click("text=Maps");
  await p.fill('input[placeholder="Pega link de Google Maps"]', "https://www.google.com/maps/place/Sol/@40.4168,-3.7038,17z");
  await p.click("text=Leer enlace");
  await p.waitForSelector("text=Guardar ubicación", { timeout: 15000 });
  await shot?.(p, `onb5-${tag}`);
  await p.click("text=Guardar ubicación");
  await p.waitForSelector("text=Guardada ✓");
  await p.click("text=Continuar");
  if (!owner) {
    await p.waitForSelector("text=Desbloquea a tu hermano completo");
    await shot?.(p, `onb6-${tag}`);
    await p.click("text=Seguir con el plan Free");
  }
  await p.waitForSelector("text=Guardaré tu diario privado");
  await p.click("button:has-text('Noche')");
  await shot?.(p, `onb7-${tag}`);
  await p.click("text=Continuar");
  await p.waitForSelector("text=El punto que respira");
  await p.click("text=Siguiente");
  await p.click("text=Siguiente");
  await p.click("text=Entendido");
  await p.waitForSelector("text=Vamos allá, hermano");
  await p.click("text=Vamos allá, hermano");
  await p.waitForSelector("text=¿Cómo te llamo, hermano?", { state: "detached" });
  return { total, locationRequired: locked };
}

/** Añade una nota rápida. Devuelve el instante (ms) en que se pulsó «Guardar». */
export async function addQuickNote(p, text) {
  await p.bringToFront();
  await p.click('button[aria-label="Nota rápida"]');
  await p.fill('[role="dialog"] textarea', text);
  const savedAt = Date.now();
  await p.click('[role="dialog"] button:has-text("Guardar")');
  await p.waitForSelector('[role="dialog"]', { state: "detached" });
  return savedAt;
}
