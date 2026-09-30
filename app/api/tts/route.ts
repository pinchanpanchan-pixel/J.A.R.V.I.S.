import { z } from "zod";
import { getRequestUser } from "@/lib/auth/requestUser";
import { getServerFeatures } from "@/lib/auth/serverPlan";
import { rateLimit } from "@/lib/rateLimit";
import { synthesize, ttsEngines } from "@/lib/tts/server";
import { VOICE_SAMPLE_TEXT } from "@/lib/voices";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Query = z.object({
  text: z.string().min(1).max(1000),
  voice: z.enum(["british_original", "young_brother", "deep_calm", "spanish_brother"]).default("british_original"),
});

const json = (body: unknown, status: number) => Response.json(body, { status });

/**
 * Voz de J.A.R.V.I.S. (GET para que <audio src> la reproduzca directamente): Google Cloud TTS
 * y, si no, Gemini TTS. Sin motor disponible => 503 y el cliente usa la voz del navegador.
 * La frase de muestra de las voces la puede escuchar cualquiera (onboarding); el resto requiere
 * un plan con voz premium.
 */
export async function GET(req: Request) {
  if (ttsEngines().length === 0) return json({ error: "tts_unavailable", fallback: true }, 503);
  const user = await getRequestUser(req);
  if (!user) return json({ error: "unauthorized" }, 401);

  const url = new URL(req.url);
  const parsed = Query.safeParse({ text: url.searchParams.get("text"), voice: url.searchParams.get("voice") ?? undefined });
  if (!parsed.success) return json({ error: "invalid_query" }, 400);
  const sample = parsed.data.text === VOICE_SAMPLE_TEXT;
  if (!sample) {
    const { features } = await getServerFeatures(user.id);
    if (!features.premiumVoice) return json({ error: "plan_required", fallback: true }, 402);
  }
  if (!rateLimit(`tts:${user.id}`, 90)) return json({ error: "rate_limited" }, 429);

  try {
    const audio = await synthesize(parsed.data.text, parsed.data.voice, req.signal);
    return new Response(audio.bytes as BodyInit, {
      headers: {
        "content-type": audio.contentType,
        // Mismo texto y voz = mismo audio: el navegador lo reutiliza (muestras, frases repetidas).
        "cache-control": "private, max-age=86400",
        "x-tts-engine": audio.engine,
      },
    });
  } catch {
    return json({ error: "tts_failed", fallback: true }, 502);
  }
}
