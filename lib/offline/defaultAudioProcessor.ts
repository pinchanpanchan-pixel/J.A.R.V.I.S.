"use client";
import type { SyncEngine } from "@/lib/sync/engine";
import type { KVFactory } from "@/lib/sync/kv";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isMockMode } from "@/lib/env";
import type { AudioProcessor, QueuedAudio } from "./audioQueue";

export type Transcriber = (item: QueuedAudio) => Promise<string | null>;

/**
 * Procesador de grabaciones offline: sube el audio (Storage) y crea un bloque de
 * memoria con la transcripción (si hay transcriptor) o como pendiente.
 */
export function createAudioProcessor(
  engine: SyncEngine,
  factory: KVFactory,
  transcribe?: Transcriber,
): AudioProcessor {
  return async (item) => {
    const ext = item.mimeType.includes("mp4") || item.mimeType.includes("aac") ? "m4a" : "webm";
    const path = `${item.userId}/offline/${item.id}.${ext}`;
    if (isMockMode) {
      await factory("audio-files").set(path, item.blob);
    } else {
      const sb = getSupabaseBrowser()!;
      const { error } = await sb.storage.from("audio").upload(path, item.blob, {
        contentType: item.mimeType,
        upsert: true,
      });
      if (error) throw new Error(error.message);
    }
    const text = transcribe ? await transcribe(item) : null;
    const when = new Date(item.createdAt);
    await engine.insert("memory_blocks", {
      title: `Nota de voz · ${when.toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })}`,
      content: text ?? "Grabada sin conexión. Transcripción pendiente.",
      tags: ["voz", "offline"],
      source: "voice",
      original_date: item.createdAt,
      metadata: { audio_path: path, duration_ms: item.durationMs, transcribed: !!text },
    });
  };
}
