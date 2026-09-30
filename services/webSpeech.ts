"use client";
import { voiceByKey } from "@/lib/voices";
import type { VoiceKey } from "@/types/db";

/** Respaldo de voz con la Web Speech API (sin voz neuronal disponible o plan Free). */
export function webSpeechAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const list = window.speechSynthesis.getVoices();
    if (list.length) return resolve(list);
    const done = () => resolve(window.speechSynthesis.getVoices());
    window.speechSynthesis.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, 800);
  });
}

export async function pickWebVoice(key: VoiceKey): Promise<SpeechSynthesisVoice | null> {
  const def = voiceByKey(key).fallback;
  const voices = await loadVoices();
  return (
    voices.find((v) => def.preferNames.some((n) => v.name.includes(n)) && v.lang.startsWith(def.lang.slice(0, 2))) ??
    voices.find((v) => v.lang === def.lang) ??
    voices.find((v) => v.lang.startsWith("es")) ??
    null
  );
}

export interface WebSpeakHandle {
  done: Promise<void>;
  cancel: () => void;
}

export function webSpeak(text: string, key: VoiceKey, opts: { rate?: number; volume?: number; onBoundary?: () => void } = {}): WebSpeakHandle {
  if (!webSpeechAvailable()) return { done: Promise.resolve(), cancel: () => undefined };
  const def = voiceByKey(key).fallback;
  let cancel = () => undefined as void;
  const done = (async () => {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = await pickWebVoice(key);
    if (v) u.voice = v;
    u.lang = v?.lang ?? (key === "british_original" ? "es-ES" : def.lang);
    u.pitch = def.pitch;
    u.rate = def.rate * (opts.rate ?? 1);
    u.volume = opts.volume ?? 1;
    if (opts.onBoundary) u.onboundary = opts.onBoundary;
    await new Promise<void>((resolve) => {
      u.onend = () => resolve();
      u.onerror = () => resolve();
      cancel = () => {
        window.speechSynthesis.cancel();
        resolve();
      };
      window.speechSynthesis.speak(u);
    });
  })();
  return { done, cancel: () => cancel() };
}
