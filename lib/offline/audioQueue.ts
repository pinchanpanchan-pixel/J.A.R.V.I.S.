"use client";
import type { KVFactory } from "@/lib/sync/kv";
import { uuid, nowIso } from "@/lib/ids";

/**
 * Cola de grabaciones hechas SIN conexión. Se guardan en IndexedDB y, al volver
 * la red, se procesan en orden (subida a Storage + transcripción con Whisper
 * cuando la Fase de voz registra su procesador).
 */
export interface QueuedAudio {
  id: string;
  userId: string;
  blob: Blob;
  mimeType: string;
  durationMs: number;
  createdAt: string;
  status: "pending" | "processing" | "done" | "failed";
  attempts: number;
  error?: string;
}

export type AudioProcessor = (item: QueuedAudio) => Promise<void>;

let processor: AudioProcessor | null = null;
export function setAudioProcessor(fn: AudioProcessor | null) {
  processor = fn;
}

const ns = "audio-queue";

export async function enqueueAudio(
  factory: KVFactory,
  data: Pick<QueuedAudio, "userId" | "blob" | "mimeType" | "durationMs">,
): Promise<QueuedAudio> {
  const item: QueuedAudio = {
    ...data,
    id: uuid(),
    createdAt: nowIso(),
    status: "pending",
    attempts: 0,
  };
  await factory(ns).set(`${item.createdAt}:${item.id}`, item);
  return item;
}

export async function listAudio(factory: KVFactory, userId: string): Promise<QueuedAudio[]> {
  return (await factory(ns).entries<QueuedAudio>()).map(([, v]) => v).filter((v) => v.userId === userId);
}

let running = false;
/** Procesa la cola en orden. Seguro llamarlo varias veces. */
export async function processAudioQueue(factory: KVFactory, userId: string): Promise<number> {
  if (running || !processor) return 0;
  running = true;
  let done = 0;
  try {
    const kv = factory(ns);
    for (const [key, item] of await kv.entries<QueuedAudio>()) {
      if (item.userId !== userId || item.status === "done") continue;
      if (typeof navigator !== "undefined" && !navigator.onLine) break;
      try {
        await kv.set(key, { ...item, status: "processing" });
        await processor(item);
        await kv.remove(key);
        done++;
      } catch (e) {
        await kv.set(key, {
          ...item,
          status: item.attempts + 1 >= 5 ? "failed" : "pending",
          attempts: item.attempts + 1,
          error: e instanceof Error ? e.message : String(e),
        });
        break;
      }
    }
  } finally {
    running = false;
  }
  return done;
}
