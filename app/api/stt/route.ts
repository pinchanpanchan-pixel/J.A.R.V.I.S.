import { getRequestUser } from "@/lib/auth/requestUser";
import { rateLimit } from "@/lib/rateLimit";
import { openaiKey } from "@/lib/voiceServer";
import { geminiGenerate, serverGeminiKey } from "@/lib/ai/gemini";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 24 * 1024 * 1024; // límite de Whisper: 25 MB

/** Respuesta de Gemini cuando en el audio no hay voz inteligible (ruido, golpes, música). */
const NO_SPEECH = "[silencio]";

/**
 * Transcripción con Gemini (capa gratuita). Se le pide literalidad y que NO invente: si solo
 * hay ruido devuelve vacío, para que J.A.R.V.I.S. no responda a cualquier sonido.
 */
async function geminiTranscribe(audio: Blob, prompt: string): Promise<string | null> {
  const key = serverGeminiKey();
  if (!key) return null;
  const data = Buffer.from(await audio.arrayBuffer()).toString("base64");
  try {
    const r = await geminiGenerate({
      apiKey: key,
      system:
        `Eres un transcriptor. Devuelve SOLO el texto literal que dice la persona, en su idioma (normalmente español), sin comillas ni comentarios. ` +
        `Si no hay una frase hablada clara (solo ruido, golpes, música, respiración o murmullo), devuelve exactamente ${NO_SPEECH}.` +
        (prompt ? ` Nombres que pueden aparecer: ${prompt}` : ""),
      contents: [{ role: "user", parts: [{ inlineData: { mimeType: audio.type || "audio/wav", data } }, { text: "Transcribe este audio." }] }],
      maxTokens: 512,
      // Los «lite» transcriben en ~1 s; si uno está saturado se pasa al otro enseguida.
      models: ["gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-flash-latest"],
      timeoutMs: 8_000,
    });
    const text = r.text.trim();
    return text.includes(NO_SPEECH) ? "" : text.replace(/^["«]|["»]$/g, "").trim();
  } catch {
    return null;
  }
}

/** STT: Whisper (OpenAI) si hay clave; si no, Gemini. Recibe multipart `audio` (+ `prompt` con nombres propios). */
export async function POST(req: Request) {
  const key = openaiKey();
  if (!key && !serverGeminiKey()) return Response.json({ error: "stt_unavailable", fallback: true }, { status: 503 });
  const user = await getRequestUser(req);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!rateLimit(`stt:${user.id}`, 40)) return Response.json({ error: "rate_limited" }, { status: 429 });

  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return Response.json({ error: "missing_audio" }, { status: 400 });
  if (audio.size > MAX_BYTES) return Response.json({ error: "audio_too_large" }, { status: 413 });

  const prompt = String(form?.get("prompt") ?? "").slice(0, 400);
  if (!key) {
    const text = await geminiTranscribe(audio, prompt);
    if (text === null) return Response.json({ error: "stt_failed", fallback: true }, { status: 502 });
    return Response.json({ text, engine: "gemini" });
  }

  const type = audio.type || "audio/wav";
  const ext = type.includes("wav") ? "wav" : type.includes("mp4") || type.includes("aac") || type.includes("m4a") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
  const body = new FormData();
  body.append("file", new File([audio], `audio.${ext}`, { type }));
  body.append("model", "whisper-1");
  body.append("response_format", "json");
  if (prompt) body.append("prompt", prompt);
  const language = String(form?.get("language") ?? "");
  if (/^[a-z]{2}$/.test(language)) body.append("language", language);

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${key}` },
    body,
  }).catch(() => null);
  if (!res || !res.ok) return Response.json({ error: "stt_failed", status: res?.status ?? 0, fallback: true }, { status: 502 });
  const data = (await res.json()) as { text?: string };
  return Response.json({ text: (data.text ?? "").trim() });
}
