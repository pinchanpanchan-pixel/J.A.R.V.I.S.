"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, Mic, RotateCcw, ShieldCheck } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useProfileActions } from "@/hooks/useProfileActions";
import { PhraseCapture } from "@/services/audio/capture";
import { mic } from "@/services/audio/mic";
import { unlockAudio } from "@/services/audio/context";
import { embedding, enroll, similarity, suggestThreshold, wavToPcm } from "@/services/audio/voiceprint";

/**
 * Grabar la voz del dueño: 3 frases cortas -> huella (vector, nunca el audio) en voice_prefs.
 * Después, prueba rápida: dices algo y te enseña cuánto se parece a tu huella.
 */
export function VoiceprintEnroll({ onDone, compact = false }: { onDone?: () => void; compact?: boolean }) {
  const { voice, userName, assistantName } = useProfile();
  const { updateVoice } = useProfileActions();
  const name = assistantName.replace(/\./g, "");
  const phrases = [`Hola ${name}, soy ${userName}.`, `${name}, ¿qué tiempo hace hoy?`, "Apunta que mañana tengo una reunión a las diez."];
  const enrolled = !!voice?.voiceprint?.length;

  const [step, setStep] = useState(0); // frase que toca grabar
  const [samples, setSamples] = useState<number[][]>([]);
  const [state, setState] = useState<"idle" | "rec" | "busy" | "testing">("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [redo, setRedo] = useState(false);
  const [level, setLevel] = useState(0);
  const cap = useRef<PhraseCapture | null>(null);
  // Solo se cierra el micro si lo abrimos aquí (si la escucha continua lo usa, se respeta).
  const ownsMic = useRef(false);
  const releaseMic = () => {
    if (ownsMic.current) mic.stop();
    ownsMic.current = false;
  };

  useEffect(() => {
    if (state !== "rec" && state !== "testing") return;
    let raf = 0;
    const tick = () => {
      setLevel(mic.level);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state]);

  useEffect(() => {
    return () => {
      cap.current?.cancel();
      releaseMic();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Graba una frase (termina sola al callarte) y devuelve su huella. */
  const record = async (): Promise<number[] | null> => {
    await unlockAudio();
    if (!mic.active) ownsMic.current = true;
    const c = new PhraseCapture("vad", { noSpeechTimeoutMs: 6000 });
    cap.current = c;
    try {
      await c.start();
    } catch {
      setMsg("Necesito permiso para el micrófono.");
      return null;
    }
    const phrase = await c.done;
    cap.current = null;
    if (!phrase) return null;
    return embedding(wavToPcm(await phrase.wav.arrayBuffer()));
  };

  const recordNext = async () => {
    setMsg(null);
    setState("rec");
    const e = await record();
    setState("idle");
    if (!e) {
      setMsg("No te he oído bien. Prueba otra vez, un poco más cerca.");
      return;
    }
    const all = [...samples, e];
    setSamples(all);
    if (all.length < phrases.length) {
      setStep(all.length);
      return;
    }
    setState("busy");
    const print = enroll(all);
    if (print) {
      await updateVoice({ voiceprint: print, voiceprint_threshold: suggestThreshold(all, print), owner_voice_only: true });
      setRedo(false);
      setMsg("Listo. A partir de ahora solo te respondo a ti.");
    }
    releaseMic();
    setState("idle");
  };

  const test = async () => {
    if (!voice?.voiceprint?.length) return;
    setMsg(null);
    setScore(null);
    setState("testing");
    const e = await record();
    releaseMic();
    setState("idle");
    if (!e) {
      setMsg("No te he oído bien. Prueba otra vez.");
      return;
    }
    setScore(similarity(e, voice.voiceprint));
  };

  const restart = () => {
    setSamples([]);
    setStep(0);
    setScore(null);
    setMsg(null);
    setRedo(true);
  };

  const threshold = Number(voice?.voiceprint_threshold ?? 0.82);
  const showRecorder = !enrolled || redo;

  return (
    <div className="flex flex-col gap-4">
      {!compact && (
        <p className="text-[13.5px] leading-relaxed text-white/60">
          Lee en voz alta 3 frases cortas. Guardo una huella de tu voz (unos números, no la grabación) para responder solo cuando hables tú.
        </p>
      )}

      {showRecorder ? (
        <>
          <div className="flex items-center justify-center gap-2" aria-label={`Frase ${Math.min(step + 1, 3)} de 3`}>
            {phrases.map((_, i) => (
              <span key={i} className={`h-1.5 w-8 rounded-full transition ${i < samples.length ? "bg-arc" : i === step ? "bg-white/40" : "bg-white/10"}`} />
            ))}
          </div>
          <AnimatePresence mode="wait">
            <motion.p
              key={step}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-center text-[17px] font-medium leading-snug"
            >
              «{phrases[Math.min(step, phrases.length - 1)]}»
            </motion.p>
          </AnimatePresence>
          <RecordButton state={state} level={level} label={state === "rec" ? "Te escucho… (para sola al callarte)" : "Pulsa y lee la frase"} onClick={() => void recordNext()} />
        </>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-arc/20 bg-arc/[0.06] px-5 py-4 text-center">
          <ShieldCheck className="h-6 w-6 text-arc" />
          <p className="text-sm text-white/80">Tu voz está guardada. Solo respondo cuando hablas tú.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => void test()} disabled={state !== "idle"} className="jv-btn-ghost px-4 py-2 text-sm">
              {state === "testing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />} Probar
            </button>
            <button type="button" onClick={restart} className="jv-btn-ghost px-4 py-2 text-sm">
              <RotateCcw className="h-4 w-4" /> Volver a grabar
            </button>
          </div>
          {score !== null && (
            <p role="status" className={`text-sm ${score >= threshold ? "text-arc" : "text-amber-200"}`}>
              {score >= threshold ? `Eres tú (${Math.round(score * 100)} % de parecido).` : `No te reconozco (${Math.round(score * 100)} %). Prueba más cerca o vuelve a grabar.`}
            </p>
          )}
        </div>
      )}

      {msg && (
        <p role="status" className="flex items-center justify-center gap-1.5 text-center text-sm text-white/70">
          {msg.startsWith("Listo") && <Check className="h-4 w-4 text-arc" />}
          {msg}
        </p>
      )}

      <details className="rounded-2xl bg-white/[0.03] px-4 py-3 text-[12.5px] leading-relaxed text-white/50">
        <summary className="cursor-pointer text-white/65">Qué puede y qué no puede hacer</summary>
        <p className="mt-2">
          Sirve para que no responda a la tele, a la radio ni a otras personas de casa. No es tan seguro como Face ID o «Oye Siri»: una web no tiene acceso al
          chip de reconocimiento del iPhone. Un resfriado, otro micrófono o mucho ruido pueden hacer que no te reconozca (vuelve a grabar si pasa a menudo), y una
          grabación tuya o una voz muy parecida podrían colarse. No lo uses para proteger nada importante.
        </p>
      </details>

      {onDone && (
        <button type="button" onClick={onDone} className="text-sm text-white/50 underline-offset-4 hover:text-white hover:underline">
          {enrolled && !redo ? "Continuar" : "Ahora no"}
        </button>
      )}
    </div>
  );
}

function RecordButton({ state, level, label, onClick }: { state: string; level: number; label: string; onClick: () => void }) {
  const rec = state === "rec";
  return (
    <div className="flex flex-col items-center gap-2">
      <motion.button
        type="button"
        onClick={onClick}
        disabled={state !== "idle"}
        whileTap={{ scale: 0.94 }}
        className={`relative flex h-16 w-16 items-center justify-center rounded-full ${rec ? "bg-arc text-navy-900" : "bg-white/10 text-arc hover:bg-white/15"}`}
        aria-label={rec ? "Grabando" : "Grabar frase"}
      >
        {rec && <motion.span className="absolute inset-0 rounded-full border-2 border-arc" animate={{ scale: 1.2 + level * 0.8, opacity: [0.7, 0] }} transition={{ duration: 0.9, repeat: Infinity }} />}
        {state === "busy" ? <Loader2 className="h-6 w-6 animate-spin" /> : <Mic className="h-6 w-6" />}
      </motion.button>
      <span className="text-xs text-white/45">{label}</span>
    </div>
  );
}
