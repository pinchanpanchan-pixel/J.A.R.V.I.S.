"use client";
import { useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { PhraseCapture } from "@/services/audio/capture";
import { startRecognition, type Recognizer } from "@/services/audio/recognition";
import { transcribe } from "@/services/stt";
import { unlockAudio } from "@/services/audio/context";

/** Dictado: graba, transcribe con Whisper (o el reconocimiento del navegador) y devuelve el texto. */
export function DictateButton({ onText }: { onText: (t: string) => void }) {
  const [state, setState] = useState<"idle" | "rec" | "busy">("idle");
  const cap = useRef<PhraseCapture | null>(null);
  const rec = useRef<Recognizer | null>(null);
  const live = useRef("");

  const toggle = async () => {
    if (state === "rec") {
      setState("busy");
      const phrase = await cap.current?.finish();
      rec.current?.stop();
      const text = (phrase ? await transcribe(phrase.wav) : null) ?? live.current;
      if (text?.trim()) onText(text.trim());
      setState("idle");
      return;
    }
    await unlockAudio();
    live.current = "";
    rec.current = startRecognition({ continuous: true, onResult: (t, final) => final && (live.current = `${live.current} ${t}`.trim()) });
    cap.current = new PhraseCapture("manual");
    try {
      await cap.current.start();
      setState("rec");
    } catch {
      rec.current?.stop();
      setState("idle");
    }
  };

  return (
    <button type="button" onClick={() => void toggle()} disabled={state === "busy"} className={`jv-btn-ghost px-4 py-2 text-sm ${state === "rec" ? "border-alert text-alert" : ""}`} aria-label="Dictar">
      {state === "busy" ? <Loader2 className="h-4 w-4 animate-spin" /> : state === "rec" ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      {state === "rec" ? "Parar" : "Dictar"}
    </button>
  );
}
