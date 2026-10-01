"use client";
import { apiFetch } from "@/lib/api";
import { voiceConfig } from "./tts";

/**
 * STT del servidor (/api/stt: Whisper o Gemini). Devuelve null si no hay motor o falla:
 * entonces se usa el texto del reconocimiento nativo del navegador.
 */
export async function transcribe(audio: Blob, opts: { prompt?: string; language?: string; timeoutMs?: number } = {}): Promise<string | null> {
  const cfg = await voiceConfig();
  if (!cfg.stt) return null;
  const form = new FormData();
  form.append("audio", audio);
  if (opts.prompt) form.append("prompt", opts.prompt);
  if (opts.language) form.append("language", opts.language);
  try {
    // Con la capa gratuita a veces tarda: pasado el límite se usa lo que entendió el navegador.
    const res = await apiFetch("/api/stt", { method: "POST", body: form, signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000) });
    if (!res.ok) return null;
    const j = (await res.json()) as { text?: string };
    // "" = solo ruido (no hay frase): distinto de null (no se pudo transcribir).
    return typeof j.text === "string" ? j.text.trim() : null;
  } catch {
    return null;
  }
}
