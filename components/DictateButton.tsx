"use client";
import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { PhraseCapture } from "@/services/audio/capture";
import { mic } from "@/services/audio/mic";
import { startRecognition, recognitionSupported, type Recognizer } from "@/services/audio/recognition";
import { transcribe } from "@/services/stt";
import { voiceConfig } from "@/services/tts";
import { unlockAudio } from "@/services/audio/context";

/**
 * Dictado (Diario y Nota rápida). Pulsar = empezar; pulsar otra vez = terminar.
 *  - Con transcripción en el servidor (Gemini o Whisper): se graba el audio y se transcribe
 *    entero al terminar (lo más fiable, también en iPhone).
 *  - Sin ella: reconocimiento del navegador, guardando también la última frase a medias
 *    (antes se perdía si parabas justo al terminar de hablar).
 * Nunca se usan los dos a la vez: en iPhone se pelean por el micrófono.
 */
export function DictateButton({ onText, compact = false }: { onText: (t: string) => void; compact?: boolean }) {
  const [state, setState] = useState<"idle" | "rec" | "busy">("idle");
  const [secs, setSecs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const cap = useRef<PhraseCapture | null>(null);
  const rec = useRef<Recognizer | null>(null);
  const finals = useRef("");
  const interim = useRef("");
  const ownsMic = useRef(false);

  useEffect(() => {
    if (state !== "rec") return;
    const t0 = Date.now();
    const t = setInterval(() => setSecs(Math.floor((Date.now() - t0) / 1000)), 500);
    return () => clearInterval(t);
  }, [state]);

  useEffect(() => {
    return () => {
      cap.current?.cancel();
      rec.current?.stop();
      if (ownsMic.current) mic.stop();
    };
  }, []);

  const stop = async () => {
    setState("busy");
    let text = "";
    if (cap.current) {
      const phrase = await cap.current.finish();
      cap.current = null;
      if (ownsMic.current) mic.stop();
      ownsMic.current = false;
      text = (phrase ? await transcribe(phrase.wav) : null) ?? "";
      if (!phrase) setError("No he oído nada. Prueba otra vez.");
      else if (!text) setError("No he entendido nada. Prueba más cerca del micro.");
    } else {
      rec.current?.stop();
      rec.current = null;
      text = `${finals.current} ${interim.current}`.trim();
      if (!text) setError("No he entendido nada. Prueba otra vez.");
    }
    if (text.trim()) onText(text.trim());
    setState("idle");
  };

  const start = async () => {
    setError(null);
    setSecs(0);
    await unlockAudio();
    const cfg = await voiceConfig();
    if (cfg.stt) {
      if (!mic.active) ownsMic.current = true;
      const c = new PhraseCapture("manual");
      cap.current = c;
      try {
        await c.start();
        setState("rec");
      } catch {
        cap.current = null;
        setError("Necesito permiso para el micrófono.");
      }
      return;
    }
    if (!recognitionSupported()) {
      setError("Este navegador no permite dictar. Prueba en Safari o Chrome.");
      return;
    }
    finals.current = "";
    interim.current = "";
    rec.current = startRecognition({
      continuous: true,
      onResult: (t, final) => {
        if (final) {
          finals.current = `${finals.current} ${t}`.trim();
          interim.current = "";
        } else interim.current = t;
      },
      onError: (e) => {
        if (e === "not-allowed") setError("Necesito permiso para el micrófono.");
      },
    });
    setState("rec");
  };

  const toggle = () => void (state === "rec" ? stop() : start());
  const mmss = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={state === "busy"}
        className={`jv-btn-ghost ${compact ? "px-3 py-2" : "px-4 py-2"} text-sm ${state === "rec" ? "border-alert/60 text-alert" : ""}`}
        aria-label={state === "rec" ? "Terminar dictado" : "Dictar"}
        title={state === "rec" ? "Terminar dictado" : "Dictar"}
      >
        {state === "busy" ? <Loader2 className="h-4 w-4 animate-spin" /> : state === "rec" ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        {state === "rec" ? `Terminar · ${mmss}` : state === "busy" ? "Escribiendo…" : "Dictar"}
      </button>
      {error && (
        <span role="status" className="text-[11.5px] text-amber-200/80">
          {error}
        </span>
      )}
    </div>
  );
}
