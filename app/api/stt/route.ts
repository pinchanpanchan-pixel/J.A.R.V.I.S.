import { getRequestUser } from "@/lib/auth/requestUser";
import { rateLimit } from "@/lib/rateLimit";
import { openaiKey } from "@/lib/voiceServer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 24 * 1024 * 1024; // límite de Whisper: 25 MB

/** STT con Whisper (OpenAI). Recibe multipart `audio` (+ `prompt` opcional con nombres propios). */
export async function POST(req: Request) {
  const key = openaiKey();
  if (!key) return Response.json({ error: "stt_unavailable", fallback: true }, { status: 503 });
  const user = await getRequestUser(req);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!rateLimit(`stt:${user.id}`, 40)) return Response.json({ error: "rate_limited" }, { status: 429 });

  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return Response.json({ error: "missing_audio" }, { status: 400 });
  if (audio.size > MAX_BYTES) return Response.json({ error: "audio_too_large" }, { status: 413 });

  const type = audio.type || "audio/wav";
  const ext = type.includes("wav") ? "wav" : type.includes("mp4") || type.includes("aac") || type.includes("m4a") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
  const body = new FormData();
  body.append("file", new File([audio], `audio.${ext}`, { type }));
  body.append("model", "whisper-1");
  body.append("response_format", "json");
  const prompt = String(form?.get("prompt") ?? "").slice(0, 400);
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
