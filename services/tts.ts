"use client";
import { VOICE_SAMPLE_TEXT } from "@/lib/voices";
import type { VoiceKey } from "@/types/db";
import { webSpeak, type WebSpeakHandle } from "./webSpeech";

/**
 * Servicio de voz (TTS). Fase 2: respaldo Web Speech.
 * La Fase 3 añade ElevenLabs en streaming (<400 ms) manteniendo esta API.
 */
let current: WebSpeakHandle | null = null;

export function stopSpeaking() {
  current?.cancel();
  current = null;
}

export async function previewVoice(key: VoiceKey): Promise<void> {
  stopSpeaking();
  current = webSpeak(VOICE_SAMPLE_TEXT, key);
  await current.done;
}
