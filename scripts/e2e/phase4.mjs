// E2E Fase 4: skills, atajos, proveedores de IA, importación de WhatsApp, memoria visual,
// diario con análisis, hogar y WorldMonitor (USGS interceptado con un sismo cerca de Madrid).
import JSZip from "jszip";
import { readFileSync } from "node:fs";
import { BASE, log, setup, login, completeOnboarding } from "./helpers.mjs";

const { browser, fail, track, shot, finish } = await setup({ args: ["--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });

// USGS: un sismo de 5,2 cerca de Granada (~360 km de Madrid)
let usgsCalls = 0;
await ctx.route("https://earthquake.usgs.gov/**", (r) => {
  usgsCalls++;
  const u = new URL(r.request().url());
  return r.fulfill({
    headers: { "access-control-allow-origin": "*" },
    json: {
      type: "FeatureCollection",
      features: Number(u.searchParams.get("minmagnitude")) <= 5.2 && Number(u.searchParams.get("maxradiuskm")) >= 400
        ? [{ id: "us7000test", properties: { mag: 5.2, place: "10 km N de Granada", time: Date.now(), url: "https://usgs", tsunami: 0, alert: null }, geometry: { coordinates: [-3.6, 37.18, 12] } }]
        : [],
    },
  });
});

const a = await login(ctx, track, "pinchan.panchan@gmail.com");
await completeOnboarding(a, { owner: true, name: "Pancho", assistant: "Friday" });

// Primero, el vigilante ya ha detectado el sismo: alerta a pantalla completa
await a.waitForSelector('[role="alertdialog"]', { timeout: 20000 });
await a.waitForSelector("text=/Ey Pancho, hay un sismo de magnitud 5,2 a 3\\d\\d km de ti, ¿estás bien\\?/");
await shot(a, "p4-quake-alert");
log(`WorldMonitor: USGS consultado (${usgsCalls}) → alerta a pantalla completa con el texto exacto`);
await a.click("text=¿Qué hago?");
await a.waitForSelector("text=Agáchate, cúbrete y agárrate");
await a.keyboard.press("Escape");
await a.click("text=Estoy bien");
await a.waitForSelector('[role="alertdialog"]', { state: "detached" });
log("alerta: sugerencias de seguridad y «Estoy bien» la cierra (sincronizado)");

const say = async (text) => {
  await a.click("a:has-text('Cerebro')");
  await a.fill('input[placeholder="Escríbeme, hermano…"]', text);
  await a.click('button[aria-label="Enviar"]');
};
const pill = (re, timeout = 10000) => a.waitForSelector(`[data-testid="transcript-pill"] >> text=${re}`, { timeout });

await say("apunta que comprar pan");
await pill("/Apuntado, hermano/");
await say("recuerda que mi hermana se llama Lucía");
await pill("/No se me olvida/");
log("skills: nota rápida y «recuerda que…»");

await a.click("a:has-text('Hogar')");
await a.click("text=Añadir dispositivos de demostración");
await a.waitForSelector("text=Echo");
await say("apaga todas las luces");
await pill("/Hecho, hermano/");
await say("apaga todo a las 11pm");
await pill("/23:00/");
log("hogar: «apaga todas las luces» y automatización «a las 11pm»");

// Atajo personalizado
await a.click("a:has-text('Ajustes')");
await a.fill('input[placeholder^="Cuando diga"]', "modo cine");
await a.selectOption('select[aria-label="Acción"]', "home_command");
await a.fill('input[placeholder^="Orden:"]', "enciende la tira led");
await a.click("text=Añadir atajo");
await a.waitForSelector("text=«modo cine»");
await say("modo cine");
await pill("/tira led, encendido/");
log("atajo personalizado «modo cine» → orden del hogar");

await say("abre mis notas");
await a.waitForURL("**/memories?tab=notes");
await a.waitForSelector("text=comprar pan");
log("navegación por voz/texto: «abre mis notas»");

// Proveedores de IA: añadir clave (se cifra), fallback registrado
await a.click("a:has-text('Ajustes')");
await a.click("text=Añadir una clave propia");
await a.selectOption('select[aria-label="Proveedor"]', "groq");
await a.fill('input[placeholder^="API key"]', "gsk_test_key_1234567890abcd");
await a.click('[role="dialog"] button:has-text("Guardar")');
await a.waitForSelector("text=••••abcd");
const stored = await a.evaluate(async () => {
  const dbs = await indexedDB.databases();
  return dbs.map((d) => d.name).filter((n) => n?.includes("ai_provider_keys"));
});
if (!stored.length) await fail("no se guardó la clave en la caché local");
await say("¿qué opinas de mi idea de negocio?");
await pill("/circuitos saturados/", 30000);
await a.click("a:has-text('Ajustes')");
await a.waitForSelector("text=/1 fallos/");
log("proveedores de IA: clave cifrada ••••abcd, fallo registrado y respuesta amable (sin red a Groq)");
await shot(a, "p4-ai-providers");

// Importar WhatsApp
const zip = new JSZip();
zip.file("_chat.txt", `[28/09/26, 22:10:05] Laura: ¿Mañana cenamos?\n[28/09/26, 22:11:30] Pancho: Claro\nPaso a por ti a las 9\n[29/09/26, 13:45:12] Laura: ‎<adjunto: 00000012-PHOTO-2026-09-29-13-45-12.jpg>`);
zip.file("00000012-PHOTO-2026-09-29-13-45-12.jpg", "fake");
const buf = await zip.generateAsync({ type: "nodebuffer" });
await a.setInputFiles('input[aria-label="Archivo de WhatsApp"]', { name: "WhatsApp Chat - Laura.zip", mimeType: "application/zip", buffer: buf });
await a.waitForSelector('[data-testid="import-progress"] >> text=100%', { timeout: 20000 });
await a.waitForSelector("text=/3\\/3 mensajes · Laura, Pancho · 1 adjuntos/");
await shot(a, "p4-whatsapp");
await a.click("a:has-text('Memorias')");
await a.waitForSelector("text=WhatsApp · Laura · 28 sept 2026");
log("WhatsApp: .zip importado al 100 % con fechas originales, participantes y adjuntos");

// Memoria visual
await a.setInputFiles('[data-testid="photo-input"]', { name: "foto.png", mimeType: "image/png", buffer: readFileSync("public/icons/icon-192.png") });
await a.waitForSelector("text=Foto guardada", { timeout: 20000 });
if (!(await a.locator("article img").count())) await fail("la memoria visual no muestra la miniatura");
log("memoria visual: foto analizada y guardada con miniatura");

// Diario con análisis
await a.click("a:has-text('Diario')");
await a.click("button:has-text('Hoy')");
await a.fill('[role="dialog"] textarea', "Hoy ha sido un día genial. Terminé el proyecto del trabajo y comí con mamá. Me siento orgulloso.");
await a.click("text=Guardar cifrado");
await a.waitForSelector("text=/alegría/");
await a.waitForSelector("text=#trabajo");
await shot(a, "p4-diary");
log("diario: análisis (emociones y etiquetas) + cifrado");
await a.click("text=Hoy ha sido un día genial.");
await a.waitForSelector("text=Momentos clave");

// Prueba de alerta desde Ajustes
await a.click("a:has-text('Ajustes')");
await a.click("text=Probar alerta");
await a.waitForSelector('[role="alertdialog"] >> text=Sismo de magnitud 5,1 (prueba)');
await a.click("text=Estoy bien");
log("WorldMonitor: botón «Probar alerta»");

await finish();
console.log("✓ E2E fase 4 OK");
