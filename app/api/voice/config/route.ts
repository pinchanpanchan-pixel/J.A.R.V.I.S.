import { NextResponse } from "next/server";
import { elevenKey, openaiKey } from "@/lib/voiceServer";

export const dynamic = "force-dynamic";

/** Qué motores de voz están disponibles (sin revelar claves). */
export async function GET() {
  return NextResponse.json({ tts: !!elevenKey(), stt: !!openaiKey() });
}
