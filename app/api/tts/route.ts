import { z } from "zod";
import { getRequestUser } from "@/lib/auth/requestUser";
import { getServerFeatures } from "@/lib/auth/serverPlan";
import { rateLimit } from "@/lib/rateLimit";
import { ELEVEN_MODEL, elevenKey, voiceIdFor } from "@/lib/voiceServer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Query = z.object({
  text: z.string().min(1).max(1000),
  voice: z.enum(["british_original", "young_brother", "deep_calm", "spanish_brother"]).default("british_original"),
});

const json = (body: unknown, status: number) => Response.json(body, { status });

/**
 * TTS en STREAMING con ElevenLabs (GET para que <audio src> empiece a sonar con los
 * primeros bytes: latencia < 400 ms con eleven_flash_v2_5). Sin clave => 503 y el
 * cliente usa Web Speech.
 */
export async function GET(req: Request) {
  const key = elevenKey();
  if (!key) return json({ error: "tts_unavailable", fallback: true }, 503);
  const user = await getRequestUser(req);
  if (!user) return json({ error: "unauthorized" }, 401);
  const { features } = await getServerFeatures(user.id);
  if (!features.premiumVoice) return json({ error: "plan_required", fallback: true }, 402);
  if (!rateLimit(`tts:${user.id}`, 60)) return json({ error: "rate_limited" }, 429);

  const url = new URL(req.url);
  const parsed = Query.safeParse({ text: url.searchParams.get("text"), voice: url.searchParams.get("voice") ?? undefined });
  if (!parsed.success) return json({ error: "invalid_query" }, 400);

  const upstream = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceIdFor(parsed.data.voice)}/stream?output_format=mp3_44100_64`,
    {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({
        text: parsed.data.text,
        model_id: ELEVEN_MODEL,
        voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true },
      }),
      signal: req.signal,
    },
  ).catch(() => null);

  if (!upstream || !upstream.ok || !upstream.body) {
    return json({ error: "tts_failed", status: upstream?.status ?? 0, fallback: true }, 502);
  }
  // Se reenvía el stream tal cual: el navegador empieza a reproducir al recibir el primer trozo.
  return new Response(upstream.body, {
    headers: { "content-type": "audio/mpeg", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}
