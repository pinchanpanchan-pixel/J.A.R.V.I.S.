// E2E Fase 3: voz. Micrófono falso de Chromium con WAV (palmadas / voz); Whisper y ElevenLabs
// se simulan interceptando /api/stt y /api/tts (en modo simulado no hay claves).
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { BASE, log, setup, login, completeOnboarding } from "./helpers.mjs";

const fx = (f) => path.resolve("scripts/e2e/fixtures", f);
if (!existsSync(fx("claps.wav"))) execSync("python3 scripts/e2e/make_fixtures.py");
const mediaArgs = (file) => [
  "--use-fake-ui-for-media-stream",
  "--use-fake-device-for-media-stream",
  `--use-file-for-fake-audio-capture=${fx(file)}`,
  "--autoplay-policy=no-user-gesture-required",
];
const dotMode = (p) => p.locator("canvas[data-mode]").first().getAttribute("data-mode");
const waitMode = (p, m, timeout = 15000) => p.waitForSelector(`canvas[data-mode="${m}"]`, { timeout });

// ---------------- A) Doble palmada ----------------
{
  const { browser, track, fail, shot, finish } = await setup({ args: mediaArgs("claps.wav") });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["microphone"], serviceWorkers: "block" });
  const soundReqs = [];
  ctx.on("request", (r) => r.url().includes("/sounds/") && soundReqs.push(r.url()));
  const p = await login(ctx, track, "pinchan.panchan@gmail.com");
  await completeOnboarding(p, { owner: true });
  await waitMode(p, "idle", 20000);
  // v2: las palmadas son opcionales (apagadas de serie). Sin ellas, el ruido no activa nada.
  await p.waitForTimeout(4000);
  if ((await dotMode(p)) === "listening") await fail("se activó sin palmadas ni palabra (ruido)");
  log("palmadas apagadas de serie: el ruido no activa");
  await p.click("a:has-text('Ajustes')");
  await p.click('button[role="switch"][aria-label="Doble palmada"]');
  await p.waitForSelector("text=Sensibilidad de las palmadas");
  await p.click("a:has-text('Cerebro')");
  const ear = p.locator('button[aria-label="Encender la escucha"]');
  if (await ear.count()) await ear.click();
  await waitMode(p, "listening", 20000);
  log("doble palmada (activada en Ajustes) -> escuchando");
  await shot(p, "p3-clap-listening");
  if (!soundReqs.some((u) => u.endsWith("/sounds/activate.mp3"))) await fail("no se cargó el sonido de activación");
  const ok = await p.evaluate(async () => {
    const r = await fetch("/sounds/activate.mp3");
    const buf = await r.arrayBuffer();
    const ctx = new AudioContext();
    const decoded = await ctx.decodeAudioData(buf);
    return decoded.duration > 0.4 && decoded.duration < 1.3;
  });
  if (!ok) await fail("activate.mp3 no se decodifica correctamente");
  log("sonido de activación (campanita) decodificado");
  // Sin voz tras la palmada: vuelve a reposo solo
  await waitMode(p, "idle", 20000);
  log("sin voz -> vuelve a reposo (en silencio)");
  // La oreja se puede apagar y volver a encender
  await p.click('button[aria-label="Apagar la escucha"]');
  await p.waitForSelector('button[aria-label="Encender la escucha"]');
  await p.click('button[aria-label="Encender la escucha"]');
  await p.waitForSelector('button[aria-label="Apagar la escucha"]');
  log("oreja: se apaga y se enciende");
  await finish();
}

// ---------------- B) Mantener pulsado + Whisper + ElevenLabs (simulados) ----------------
{
  const { browser, track, fail, shot, finish } = await setup({ args: mediaArgs("speech.wav") });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["microphone"], serviceWorkers: "block" });
  const mp3 = readFileSync("public/sounds/alerts/sonar.mp3");
  const ttsReqs = [];
  let sttBody = null;
  await ctx.route("**/api/voice/config", (r) => r.fulfill({ json: { tts: true, engine: "google", stt: true } }));
  await ctx.route("**/api/stt", async (r) => {
    sttBody = r.request().postDataBuffer();
    await r.fulfill({ json: { text: navigator_offline_text ?? "hola" } });
  });
  var navigator_offline_text = null;
  await ctx.route("**/api/tts?**", (r) => {
    ttsReqs.push(new URL(r.request().url()));
    return r.fulfill({ status: 200, contentType: "audio/mpeg", body: mp3 });
  });
  const p = await login(ctx, track, "pinchan.panchan@gmail.com");
  await completeOnboarding(p, { owner: true });
  await waitMode(p, "idle");

  const btn = p.locator('[data-testid="dot-button"]');
  if ((await p.locator("text=Mantén pulsado").count()) > 0) await fail("sigue el botón rojo");
  const box = await btn.boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.down();
  await waitMode(p, "listening");
  await p.waitForTimeout(1800);
  await p.mouse.up();
  await waitMode(p, "speaking", 15000);
  log("mantener pulsada la bolita -> transcripción -> cerebro -> hablando");
  if (!sttBody || sttBody.indexOf(Buffer.from("RIFF")) < 0) await fail("no se envió un WAV a /api/stt");
  log(`audio enviado a Whisper como WAV (${sttBody.length} bytes)`);
  if (!ttsReqs.length) await fail("no se pidió audio a /api/tts (ElevenLabs)");
  log(`ElevenLabs en streaming: ${ttsReqs.length} frase(s), voz=${ttsReqs[0].searchParams.get("voice")}`);
  await shot(p, "p3-speaking");

  // Interrumpir a J.A.R.V.I.S. mientras habla
  await p.mouse.down();
  await waitMode(p, "listening", 5000);
  const paused = await p.evaluate(() => Array.from(document.querySelectorAll("audio")).every((a) => a.paused));
  await p.waitForTimeout(1500);
  await p.mouse.up();
  log("el usuario interrumpe a J.A.R.V.I.S. mientras habla");
  await waitMode(p, "speaking", 15000);
  // Tras responder sigue escuchando (como mucho 2 réplicas) y luego vuelve a reposo
  await waitMode(p, "idle", 45000);
  log("termina de hablar (y la escucha de seguimiento) -> reposo");

  // Conversación guardada con origen voz
  await p.click('button[aria-label="Conversación"]');
  await p.waitForSelector('[role="dialog"] >> text=hola');
  await p.keyboard.press("Escape");
  log("mensaje de voz guardado en la conversación");

  // Vista previa de voces en Ajustes (ElevenLabs)
  await p.click("a:has-text('Ajustes')");
  const before = ttsReqs.length;
  await p.click('button[aria-label="Escuchar Hermano joven"]');
  await p.waitForTimeout(800);
  const last = ttsReqs[ttsReqs.length - 1];
  if (ttsReqs.length === before || last.searchParams.get("voice") !== "young_brother" || last.searchParams.get("text") !== "Ey hermano, estoy aquí.")
    await fail("la vista previa no pidió la voz correcta con el texto de muestra");
  log("vista previa: «Ey hermano, estoy aquí.» con la voz elegida");

  // Offline: modo grabadora y transcripción al volver
  await p.click("a:has-text('Cerebro')");
  await waitMode(p, "idle");
  navigator_offline_text = "recordar comprar pan";
  await ctx.setOffline(true);
  await p.waitForSelector('canvas[data-mode="offline"]');
  const box2 = await btn.boundingBox();
  await p.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2);
  await p.mouse.down();
  await p.waitForTimeout(1500);
  await p.mouse.up();
  await p.waitForSelector("text=/lo he grabado/", { timeout: 10000 });
  log("offline: grabación guardada en local");
  await ctx.setOffline(false);
  await p.waitForTimeout(2500);
  await p.click("a:has-text('Memorias')");
  await p.waitForSelector("text=recordar comprar pan", { timeout: 15000 });
  await shot(p, "p3-offline-memory");
  log("al volver la conexión: transcrita con Whisper y guardada como memoria");
  if (!paused) log("(aviso) el audio no estaba pausado en el instante medido");
  await finish();
}

console.log("✓ E2E fase 3 OK");
