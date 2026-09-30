import "server-only";
import { secret } from "@/lib/serverEnv";

/** Clave de OpenAI para Whisper (transcripción). Las voces están en lib/tts/server.ts. */
export function openaiKey() {
  return secret("OPENAI_API_KEY");
}
