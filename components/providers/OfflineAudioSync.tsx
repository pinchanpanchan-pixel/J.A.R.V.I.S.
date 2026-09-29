"use client";
import { useEffect } from "react";
import { useSync } from "./SyncProvider";
import { useAuth } from "./AuthProvider";
import { processAudioQueue, setAudioProcessor } from "@/lib/offline/audioQueue";
import { createAudioProcessor, type Transcriber } from "@/lib/offline/defaultAudioProcessor";

let transcriber: Transcriber | undefined;
/** La capa de voz registra aquí su transcriptor (Whisper). */
export function registerOfflineTranscriber(fn: Transcriber) {
  transcriber = fn;
}

/** Procesa las grabaciones offline cuando vuelve la conexión. */
export function OfflineAudioSync() {
  const { engine, kvFactory, ready } = useSync();
  const { user } = useAuth();

  useEffect(() => {
    if (!engine || !kvFactory || !ready || !user) return;
    setAudioProcessor(createAudioProcessor(engine, kvFactory, (item) => (transcriber ? transcriber(item) : Promise.resolve(null))));
    const run = () => {
      if (navigator.onLine) void processAudioQueue(kvFactory, user.id);
    };
    run();
    window.addEventListener("online", run);
    return () => {
      window.removeEventListener("online", run);
      setAudioProcessor(null);
    };
  }, [engine, kvFactory, ready, user]);

  return null;
}
