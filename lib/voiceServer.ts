import "server-only";
import { secret } from "@/lib/serverEnv";
import { VOICES } from "@/lib/voices";
import type { VoiceKey } from "@/types/db";

export const ELEVEN_MODEL = "eleven_flash_v2_5"; // el de menor latencia, multilingüe

export function elevenKey() {
  return secret("ELEVENLABS_API_KEY");
}
export function openaiKey() {
  return secret("OPENAI_API_KEY");
}

/** Voice ID de ElevenLabs: .env (VOICE_*) o el valor por defecto de la especificación. */
export function voiceIdFor(key: VoiceKey): string {
  const def = VOICES.find((v) => v.key === key) ?? VOICES[0];
  return process.env[def.envVar]?.trim() || def.defaultVoiceId;
}
