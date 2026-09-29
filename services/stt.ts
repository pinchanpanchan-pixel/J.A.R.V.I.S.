"use client";
import { apiFetch } from "@/lib/api";
import { voiceConfig } from "./tts";

/**
 * STT con Whisper (/api/stt). Devuelve null si no hay clave (modo simulado) o falla:
 * entonces se usa el texto del reconocimiento nativo del navegador.
 */
export async function transcribe(audio: Blob, opts: { prompt?: string; language?: string } = {}): Promise<string | null> {
  const cfg = await voiceConfig();
  if (!cfg.stt) return null;
  const form = new FormData();
  form.append("audio", audio);
  if (opts.prompt) form.append("prompt", opts.prompt);
  if (opts.language) form.append("language", opts.language);
  try {
    const res = await apiFetch("/api/stt", { method: "POST", body: form });
    if (!res.ok) return null;
    const j = (await res.json()) as { text?: string };
    return j.text?.trim() || null;
  } catch {
    return null;
  }
}
