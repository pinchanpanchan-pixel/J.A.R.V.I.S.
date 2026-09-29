"use client";
import { useEffect, useState } from "react";
import { Mic, Square } from "lucide-react";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useSync } from "@/components/providers/SyncProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { enqueueAudio, listAudio } from "@/lib/offline/audioQueue";

/** Modo grabadora automático cuando no hay conexión. */
export function OfflineRecorder() {
  const { user } = useAuth();
  const { kvFactory } = useSync();
  const { recording, level, error, start, stop } = useAudioRecorder();
  const [saved, setSaved] = useState(0);

  useEffect(() => {
    if (!kvFactory || !user) return;
    void listAudio(kvFactory, user.id).then((l) => setSaved(l.length));
  }, [kvFactory, user]);

  const toggle = async () => {
    if (!recording) return start();
    const result = await stop();
    if (result && kvFactory && user && result.blob.size > 0) {
      await enqueueAudio(kvFactory, { userId: user.id, ...result });
      setSaved((n) => n + 1);
    }
  };

  return (
    <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white/5 p-3">
      <button
        onClick={toggle}
        className={`flex h-11 w-11 items-center justify-center rounded-full transition ${
          recording ? "bg-alert" : "bg-arc/90 text-navy-900"
        }`}
        style={recording ? { boxShadow: `0 0 ${8 + level * 30}px rgba(255,59,48,.7)` } : undefined}
        aria-label={recording ? "Parar grabación" : "Grabar nota de voz"}
      >
        {recording ? <Square className="h-4 w-4 text-white" /> : <Mic className="h-5 w-5" />}
      </button>
      <div className="text-xs text-white/70">
        {recording ? "Grabando… te escucho." : "Modo grabadora: háblame y lo proceso al volver la conexión."}
        {saved > 0 && <div className="text-white/40">{saved} grabaciones guardadas en local.</div>}
        {error && <div className="text-red-300">{error}</div>}
      </div>
    </div>
  );
}
