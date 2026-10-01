// E2E v2 · Fase 2: parte del tiempo por la mañana, dictado en Nota rápida, voz del dueño,
// atajos agrupados (editar/borrar) y sensibilidad de palmadas fluida.
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { log, setup, login, completeOnboarding, settings } from "./helpers.mjs";

const fx = (f) => path.resolve("scripts/e2e/fixtures", f);
if (!existsSync(fx("speech.wav"))) execSync("python3 scripts/e2e/make_fixtures.py");

const { browser, track, fail, shot, finish } = await setup({
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${fx("speech.wav")}`, "--autoplay-policy=no-user-gesture-required"],
});
// Contexto 1 (reloj falso a las 8:30 en Madrid): solo el parte de la mañana. El reloj falso congela
// las animaciones de salida, así que el resto va en un contexto normal.
const ctx1 = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["microphone"], serviceWorkers: "block", timezoneId: "Europe/Madrid" });
await ctx1.clock.install({ time: new Date("2026-10-01T06:30:00Z") });
let meteo = 0;
await ctx1.route("https://api.open-meteo.com/**", (r) => {
  meteo++;
  return r.fulfill({
    json: {
      current: { temperature_2m: 11 },
      daily: {
        time: ["2026-10-01", "2026-10-02"],
        temperature_2m_max: [19, 22],
        temperature_2m_min: [9, 12],
        apparent_temperature_max: [18, 22],
        apparent_temperature_min: [7, 11],
        precipitation_probability_max: [70, 5],
        wind_speed_10m_max: [20, 10],
        uv_index_max: [4, 6],
        weather_code: [61, 1],
      },
      hourly: { time: ["2026-10-01T16:00"], precipitation_probability: [80] },
    },
  });
});
const voiceRoutes = async (c) => {
  await c.route("**/api/voice/config", (r) => r.fulfill({ json: { tts: false, engine: null, stt: true } }));
  await c.route("**/api/stt", (r) => r.fulfill({ json: { text: "comprar leche y pan" } }));
};
await voiceRoutes(ctx1);
let p = await login(ctx1, track, "pinchan.panchan@gmail.com");
await completeOnboarding(p, { owner: true });

// 1) Parte del tiempo de la mañana (sin que lo pidas), guardado en la conversación
await p.waitForSelector("text=/máxima de 19 y mínima de 9/", { timeout: 20000 });
if (meteo < 1) await fail("no se consultó la previsión");
await shot(p, "v2p2-morning");
await p.click('button[aria-label="Conversación"]');
await p.waitForSelector('[role="dialog"] >> text=/70 %/');
await p.keyboard.press("Escape");
log("por la mañana: parte del tiempo (máx/mín, lluvia 70 %, chaqueta) y queda en la conversación");
await p.reload();
await p.waitForSelector('[data-testid="dot-button"]');
await p.waitForTimeout(2500);
await p.click('button[aria-label="Conversación"]');
const greetings = await p.locator('[role="dialog"] >> text=/máxima de 19/').count();
if (greetings !== 1) await fail(`el saludo de la mañana se repite (${greetings})`);
await p.keyboard.press("Escape");
log("al volver a abrir no lo repite (una vez por franja)");
await ctx1.close();

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["microphone"], serviceWorkers: "block" });
await voiceRoutes(ctx);
p = await login(ctx, track, "pinchan.panchan@gmail.com");
await completeOnboarding(p, { owner: true });

// 2) Dictado en la Nota rápida
await p.click('button[aria-label="Nota rápida"]');
await p.click('button[aria-label="Dictar"]');
await p.waitForSelector('button[aria-label="Terminar dictado"]');
await p.waitForTimeout(1500);
await p.click('button[aria-label="Terminar dictado"]');
await p.waitForFunction(() => document.querySelector("textarea")?.value.includes("comprar leche y pan"), null, { timeout: 10000 });
await p.click("button:has-text('Guardar')");
log("nota rápida dictada: «comprar leche y pan»");

// 3) Ajustes: voz del dueño
await settings(p, "tu-voz");
for (let i = 0; i < 3; i++) {
  await p.click('button[aria-label="Grabar frase"]');
  await p.waitForSelector('button[aria-label="Grabando"]');
  await p.waitForSelector('button[aria-label="Grabando"]', { state: "detached", timeout: 15000 });
  await p.waitForTimeout(300);
}
await p.waitForSelector("text=Tu voz está guardada", { timeout: 10000 });
await p.waitForSelector('button[role="switch"][aria-label="Responder solo a mi voz"][aria-checked="true"]');
await p.click("button:has-text('Probar')");
await p.waitForSelector("text=/Eres tú \\(\\d+ % de parecido\\)/", { timeout: 15000 });
await shot(p, "v2p2-voiceprint");
log("voz del dueño: 3 frases → huella guardada → «Eres tú» al probar");

// 4) Palmadas: barra fluida
await settings(p, "activacion");
await p.click('button[role="switch"][aria-label="Doble palmada"]');
const slider = p.locator('input[aria-label="Sensibilidad de las palmadas"]');
await slider.evaluate((el) => {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  set.call(el, "0.37");
  el.dispatchEvent(new Event("input", { bubbles: true }));
});
await p.waitForSelector("text=37 %");
await p.waitForTimeout(600);
await p.reload();
await p.waitForSelector("text=37 %", { timeout: 10000 });
log("sensibilidad de palmadas: cualquier valor (37 %) y se guarda");
await settings(p, "atajos");

// 5) Atajos: filas agrupadas ES/EN, luces/música bloqueadas sin conexión, editar y borrar los propios
await p.waitForSelector("text=EN: open notes block · open my notes");
await p.waitForSelector("text=EN: play my music");
await p.fill('input[placeholder^="Cuando diga"]', "modo prueba");
await p.click('button[role="combobox"][aria-label="Acción"]');
await p.click('[role="listbox"] [role="option"]:has-text("Responder con una frase")');
await p.fill('input[placeholder="Lo que responderé"]', "Hecho, probado");
await p.click("button:has-text('Añadir atajo')");
await p.waitForSelector("text=«modo prueba»");
await p.click('button[aria-label="Editar atajo"]');
await p.fill('input[placeholder^="Cuando diga"]', "modo ensayo");
await p.click("button:has-text('Guardar cambios')");
await p.waitForSelector("text=«modo ensayo»");
await p.click("a:has-text('Cerebro')");
await p.fill('input[placeholder="Escríbeme, hermano…"]', "modo ensayo");
await p.click('button[aria-label="Enviar"]');
await p.waitForSelector('[data-testid="transcript-pill"] >> text=Hecho, probado', { timeout: 10000 });
await settings(p, "atajos");
await p.click('button[aria-label="Borrar atajo"]');
await p.click('button[aria-label="Confirmar borrado"]');
await p.waitForSelector("text=«modo ensayo»", { state: "detached" });
await shot(p, "v2p2-shortcuts");
log("atajos: una fila por acción (ES + EN), crear → editar → usar → borrar");

await finish();
console.log("✓ E2E v2 fase 2 OK");
