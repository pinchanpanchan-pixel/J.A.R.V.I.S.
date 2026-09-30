import "server-only";
import { secret } from "@/lib/serverEnv";
import { serverGeminiKey } from "@/lib/ai/gemini";
import { voiceByKey } from "@/lib/voices";
import type { VoiceKey } from "@/types/db";

/**
 * Voces de J.A.R.V.I.S. en el servidor (las claves nunca llegan al cliente):
 *  1. Google Cloud Text-to-Speech (GOOGLE_TTS_API_KEY): voces neuronales Chirp 3 HD, ~0,5 s.
 *  2. Gemini TTS (GEMINI_API_KEY): voces con estilo, algo más lentas (~2 s por frase).
 *  3. Si ninguna responde, el cliente usa la voz del navegador y lo avisa.
 */
export type TtsEngine = "google" | "gemini";

export function googleTtsKey() {
  return secret("GOOGLE_TTS_API_KEY");
}

export function ttsEngines(): TtsEngine[] {
  const list: TtsEngine[] = [];
  if (googleTtsKey()) list.push("google");
  if (serverGeminiKey()) list.push("gemini");
  return list;
}

export interface Audio {
  bytes: Uint8Array;
  contentType: string;
  engine: TtsEngine;
}

/** Se corta si el cliente se va o si el motor tarda demasiado (nunca se queda colgado). */
const within = (ms: number, signal?: AbortSignal) => (signal ? AbortSignal.any([signal, AbortSignal.timeout(ms)]) : AbortSignal.timeout(ms));

class TtsError extends Error {
  constructor(public status: number) {
    super(`tts ${status}`);
  }
}

/** Nombre de voz de Google: VOICE_<KEY>_GOOGLE en .env o el de lib/voices. */
export function googleVoiceFor(key: VoiceKey) {
  const def = voiceByKey(key);
  const name = process.env[`${def.envVar}_GOOGLE`]?.trim() || def.google.name;
  const languageCode = name.split("-").slice(0, 2).join("-");
  return { name, languageCode, speakingRate: def.google.rate };
}

async function googleSynth(text: string, key: VoiceKey, apiKey: string, signal?: AbortSignal): Promise<Audio> {
  const voice = googleVoiceFor(key);
  const body = (rate: boolean) =>
    JSON.stringify({
      input: { text },
      voice: { languageCode: voice.languageCode, name: voice.name },
      audioConfig: { audioEncoding: "MP3", ...(rate && voice.speakingRate ? { speakingRate: voice.speakingRate } : {}) },
    });
  const call = (rate: boolean) =>
    fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: body(rate),
      signal: within(10_000, signal),
    }).catch(() => null);
  let res = await call(true);
  // Algunas voces no admiten cambiar la velocidad: se repite sin ella.
  if (res?.status === 400 && voice.speakingRate) res = await call(false);
  if (!res?.ok) throw new TtsError(res?.status ?? 0);
  const j = (await res.json()) as { audioContent?: string };
  if (!j.audioContent) throw new TtsError(502);
  return { bytes: Buffer.from(j.audioContent, "base64"), contentType: "audio/mpeg", engine: "google" };
}

export const GEMINI_TTS_MODELS = ["gemini-3.8-flash-lite-tts", "gemini-3.8-flash-tts", "gemini-2.5-flash-preview-tts"];

/** PCM 16 bits mono -> WAV (Gemini puede devolver audio/L16 crudo). */
export function pcmToWav(pcm: Uint8Array, sampleRate = 24_000): Uint8Array {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, Buffer.from(pcm)]);
}

async function geminiSynth(text: string, key: VoiceKey, apiKey: string, signal?: AbortSignal): Promise<Audio> {
  const def = voiceByKey(key);
  const models = process.env.GEMINI_TTS_MODEL?.trim() ? [process.env.GEMINI_TTS_MODEL.trim(), ...GEMINI_TTS_MODELS] : GEMINI_TTS_MODELS;
  let last = 502;
  const deadline = Date.now() + 20_000; // presupuesto total: mejor la voz del navegador que el silencio
  for (const model of models) {
    if (Date.now() > deadline) break;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `${def.gemini.style}: ${text}` }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: def.gemini.voice } } },
        },
      }),
      signal: within(Math.min(12_000, Math.max(1_000, deadline - Date.now())), signal),
    }).catch(() => null);
    if (!res?.ok) {
      last = res?.status ?? 0;
      if (last === 401 || last === 403) break;
      continue; // 404/429/503: siguiente modelo
    }
    const j = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> } }> };
    const data = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
    if (!data?.data) continue;
    const raw = Buffer.from(data.data, "base64");
    const mime = data.mimeType ?? "";
    if (/wav/i.test(mime)) return { bytes: raw, contentType: "audio/wav", engine: "gemini" };
    const rate = Number(/rate=(\d+)/.exec(mime)?.[1] ?? 24_000);
    return { bytes: pcmToWav(raw, rate), contentType: "audio/wav", engine: "gemini" };
  }
  throw new TtsError(last);
}

/** Sintetiza con el primer motor que responda. Lanza el último estado si ninguno lo consigue. */
export async function synthesize(text: string, key: VoiceKey, signal?: AbortSignal): Promise<Audio> {
  let last = 503;
  for (const engine of ttsEngines()) {
    try {
      if (engine === "google") return await googleSynth(text, key, googleTtsKey() as string, signal);
      return await geminiSynth(text, key, serverGeminiKey() as string, signal);
    } catch (e) {
      last = e instanceof TtsError ? e.status : 0;
      if (signal?.aborted) break;
    }
  }
  throw new TtsError(last);
}
