import { NextResponse } from "next/server";
import { openaiKey } from "@/lib/voiceServer";
import { ttsEngines } from "@/lib/tts/server";

export const dynamic = "force-dynamic";

/** Qué motores de voz están disponibles (sin revelar claves). */
export async function GET() {
  const engines = ttsEngines();
  return NextResponse.json({ tts: engines.length > 0, engine: engines[0] ?? null, stt: !!openaiKey() });
}
