"use client";
import { getAudioContext } from "./context";

/** Sonidos del sistema (decodificados una vez, reproducidos con Web Audio = latencia mínima). */
export const ALERT_SOUNDS = [
  { id: "siren", label: "Sirena" },
  { id: "pulse", label: "Pulso" },
  { id: "klaxon", label: "Claxon" },
  { id: "chime", label: "Campanas" },
  { id: "sonar", label: "Sonar" },
] as const;
export type AlertSoundId = (typeof ALERT_SOUNDS)[number]["id"];

const cache = new Map<string, Promise<AudioBuffer>>();

function load(url: string): Promise<AudioBuffer> {
  let p = cache.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => r.arrayBuffer())
      .then((b) => getAudioContext().decodeAudioData(b));
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}

export function preloadSounds() {
  void load("/sounds/activate.mp3").catch(() => undefined);
  void load("/sounds/deactivate.mp3").catch(() => undefined);
}

async function play(url: string, { volume = 1, loop = false } = {}): Promise<() => void> {
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") await ctx.resume();
    const buf = await load(url);
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.buffer = buf;
    src.loop = loop;
    src.connect(gain).connect(ctx.destination);
    src.start();
    return () => {
      try {
        src.stop();
      } catch {
        /* ya parado */
      }
    };
  } catch {
    return () => undefined;
  }
}

/** «bup bup» de activación. */
export const playActivation = () => play("/sounds/activate.mp3", { volume: 0.8 });
export const playDeactivation = () => play("/sounds/deactivate.mp3", { volume: 0.6 });
/** Alerta de WorldMonitor (fuerte). Devuelve una función para pararla. */
export const playAlert = (id: string, loop = false) => play(`/sounds/alerts/${id}.mp3`, { volume: 1, loop });
