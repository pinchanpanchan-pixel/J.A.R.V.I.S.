"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useProfile } from "@/hooks/useProfile";
import { useAssistant } from "@/hooks/useAssistant";
import { useSync } from "@/components/providers/SyncProvider";
import { registerOfflineTranscriber } from "@/components/providers/OfflineAudioSync";
import { enqueueAudio, processAudioQueue } from "@/lib/offline/audioQueue";
import { JARVIS_EVENTS } from "@/lib/events";
import { installAudioUnlock, unlockAudio } from "@/services/audio/context";
import { mic, micPermission } from "@/services/audio/mic";
import { PhraseCapture, type CapturedPhrase } from "@/services/audio/capture";
import { ClapDetector } from "@/services/audio/clapDetector";
import { matchWake } from "@/services/audio/wakeWord";
import { startRecognition, recognitionSupported, type Recognizer } from "@/services/audio/recognition";
import { playActivation, playAlert, playDeactivation, preloadSounds } from "@/services/audio/sounds";
import { isSpeaking, primeTtsPlayers, speak as ttsSpeak, speechLevel, stopSpeaking } from "@/services/tts";
import { transcribe } from "@/services/stt";
import { embedding, similarity, wavToPcm, VOICEPRINT_RATE } from "@/services/audio/voiceprint";
import { downsample } from "@/services/audio/wav";
import { normalizeWake } from "@/services/audio/wakeWord";
import type { VoiceKey } from "@/types/db";

const EAR_OFF_KEY = "jarvis.earOff";
/** Tras responder por voz, sigue escuchando este tiempo por si continúas la conversación. */
const FOLLOW_UP_MS = 6000;
const MAX_FOLLOW_UPS = 2;

export type VoiceMode = "idle" | "listening" | "thinking" | "speaking";
type Source = "button" | "clap" | "wake" | "event";

interface VoiceContextValue {
  mode: VoiceMode;
  /** Lo que el usuario está diciendo / dijo (píldora de transcripción en vivo). */
  transcript: string | null;
  /** Última respuesta hablada. */
  reply: string | null;
  notice: string | null;
  getLevel: () => number;
  holdStart: () => void;
  holdEnd: () => void;
  activate: (source?: Source) => void;
  speak: (text: string) => Promise<void>;
  /** J.A.R.V.I.S. interrumpe al usuario (p.ej. alerta de WorldMonitor). */
  interrupt: (text: string, opts?: { sound?: string }) => Promise<void>;
  stop: () => void;
  /** Escucha continua (palabra de activación / palmadas) activa. */
  wakeActive: boolean;
  wakeWanted: boolean;
  /** El usuario ha apagado la oreja en este dispositivo. */
  wakePaused: boolean;
  enableWake: () => Promise<void>;
  /** Oreja: enciende o apaga la escucha continua en este dispositivo. */
  toggleWake: () => Promise<void>;
  recognitionAvailable: boolean;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

export function VoiceProvider({ children }: { children: ReactNode }) {
  const { profile, voice, features, assistantName, userName, user } = useProfile();
  const { kvFactory } = useSync();
  const { handle } = useAssistant();

  const [mode, setModeState] = useState<VoiceMode>("idle");
  const modeRef = useRef<VoiceMode>("idle");
  const setMode = (m: VoiceMode) => {
    modeRef.current = m;
    setModeState(m);
  };
  const [transcript, setTranscript] = useState<string | null>(null);
  const [reply, setReply] = useState<string | null>(null);
  const replyRef = useRef<string | null>(null);
  replyRef.current = reply;
  const [notice, setNotice] = useState<string | null>(null);
  const [wakeActive, setWakeActive] = useState(false);
  const [wakePaused, setWakePaused] = useState(false);
  const wakeActiveRef = useRef(false);
  wakeActiveRef.current = wakeActive;
  useEffect(() => {
    try {
      setWakePaused(localStorage.getItem(EAR_OFF_KEY) === "1");
    } catch {
      /* sin almacenamiento: oreja encendida */
    }
  }, []);

  const captureRef = useRef<PhraseCapture | null>(null);
  const liveRecRef = useRef<Recognizer | null>(null);
  const wakeRecRef = useRef<Recognizer | null>(null);
  const clapUnsubRef = useRef<(() => void) | null>(null);
  const holdingRef = useRef(false);

  // Ajustes actuales en refs (evita cierres obsoletos en callbacks de audio)
  const cfg = useRef({
    voice: "british_original" as VoiceKey,
    premium: false,
    rate: 1,
    volume: 1,
    assistantName,
    userName,
    print: null as number[] | null,
    printThreshold: 0.82,
  });
  cfg.current = {
    print: voice?.owner_voice_only && Array.isArray(voice.voiceprint) && voice.voiceprint.length ? voice.voiceprint : null,
    printThreshold: Number(voice?.voiceprint_threshold ?? 0.82),
    voice: (voice?.voice_key ?? "british_original") as VoiceKey,
    premium: features.premiumVoice,
    rate: Number(voice?.rate ?? 1),
    volume: Number(voice?.volume ?? 1),
    assistantName,
    userName,
  };
  const wakeWordOn = !!profile?.wake_word_enabled;
  const clapOn = !!profile?.wake_clap_enabled;
  const wakeWanted = wakeWordOn || clapOn;
  const ownerOnly = !!(voice?.owner_voice_only && voice?.voiceprint?.length);

  useEffect(() => {
    installAudioUnlock();
    preloadSounds();
    const prime = () => primeTtsPlayers();
    window.addEventListener("pointerdown", prime, { once: true });
    return () => window.removeEventListener("pointerdown", prime);
  }, []);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice((n) => (n === msg ? null : n)), 3500);
  };

  // ------------------------------------------------------------------
  // Hablar
  // ------------------------------------------------------------------
  const speak = useCallback(async (text: string) => {
    setReply(text);
    setMode("speaking");
    await ttsSpeak(text, { voice: cfg.current.voice, premium: cfg.current.premium, rate: cfg.current.rate, volume: cfg.current.volume });
    if (modeRef.current === "speaking") setMode("idle");
  }, []);

  const stop = useCallback(() => {
    stopSpeaking();
    captureRef.current?.cancel();
    captureRef.current = null;
    liveRecRef.current?.stop();
    liveRecRef.current = null;
    holdingRef.current = false;
    if (!wakeActiveRef.current) mic.stop();
    setMode("idle");
  }, []);

  // ------------------------------------------------------------------
  // Voz del dueño: últimos segundos del micro para verificar órdenes directas
  // («Jarvis, apaga la luz») y comprobación de la huella.
  // ------------------------------------------------------------------
  const ringRef = useRef<Float32Array[]>([]);
  useEffect(() => {
    if (!ownerOnly || !wakeActive) {
      ringRef.current = [];
      return;
    }
    const off = mic.onFrame((f) => {
      const ring = ringRef.current;
      ring.push(f.samples);
      const max = Math.ceil((4 * mic.sampleRate) / f.samples.length); // ~4 s
      if (ring.length > max) ring.splice(0, ring.length - max);
    });
    return off;
  }, [ownerOnly, wakeActive]);

  /** true si no hay huella o si la voz se parece lo suficiente a la del dueño. */
  const isOwnerVoice = useCallback(async (wav: Blob | null): Promise<boolean> => {
    const print = cfg.current.print;
    if (!print) return true;
    let pcm: Float32Array | null = null;
    if (wav) pcm = wavToPcm(await wav.arrayBuffer());
    else if (ringRef.current.length) {
      const all = new Float32Array(ringRef.current.reduce((n, c) => n + c.length, 0));
      let o = 0;
      for (const c of ringRef.current) {
        all.set(c, o);
        o += c.length;
      }
      pcm = downsample(all, mic.sampleRate, VOICEPRINT_RATE);
    }
    const e = pcm ? embedding(pcm) : null;
    if (!e) return true; // muy poca voz para juzgar: no se bloquea
    return similarity(e, print) >= cfg.current.printThreshold;
  }, []);

  // ------------------------------------------------------------------
  // Procesar lo que ha dicho el usuario
  // ------------------------------------------------------------------
  const followUpRef = useRef<() => void>(() => undefined);
  const followUpsRef = useRef(0);
  const processPhrase = useCallback(
    async (phrase: CapturedPhrase | null, liveText: string, origin: "manual" | "vad" | "followup" | "wake" = "vad") => {
      if (!phrase && !liveText) {
        setMode("idle");
        return;
      }
      // Solo el dueño (si grabó su voz y lo activó): al resto se le ignora en silencio.
      if (cfg.current.print && !(await isOwnerVoice(phrase?.wav ?? null))) {
        setMode("idle");
        if (origin === "manual") flash(`Solo respondo a la voz de ${cfg.current.userName}.`);
        return;
      }
      // Sin conexión: modo grabadora — se guarda y se procesa al volver la red.
      if (!navigator.onLine) {
        if (phrase && kvFactory && user) {
          await enqueueAudio(kvFactory, { userId: user.id, blob: phrase.wav, mimeType: "audio/wav", durationMs: phrase.durationMs });
          flash("Sin internet, hermano: lo he grabado y lo proceso al volver la conexión.");
        }
        setMode("idle");
        return;
      }
      setMode("thinking");
      const prompt = `${cfg.current.assistantName}, ${cfg.current.userName}.`;
      const text = (phrase ? await transcribe(phrase.wav, { prompt, timeoutMs: liveText ? 10_000 : 20_000 }) : null) ?? liveText;
      if (!text?.trim()) {
        setMode("idle");
        // Ruido sin frase: silencio total. Solo se avisa si lo pediste tú manteniendo pulsado.
        if (origin === "manual") flash("No te he entendido, hermano. Repítemelo.");
        return;
      }
      setTranscript(text);
      const res = await handle(text, { source: "voice" });
      if (!res?.reply) {
        setMode("idle");
        return;
      }
      await speak(res.reply);
      // Conversación de verdad: tras responder sigue escuchando unos segundos sin repetir su nombre.
      if (modeRef.current === "idle" && document.visibilityState === "visible") followUpRef.current();
    },
    [kvFactory, user, handle, speak, isOwnerVoice],
  );

  // ------------------------------------------------------------------
  // Escucha continua: palabra de activación + doble palmada
  // ------------------------------------------------------------------
  const activateRef = useRef<(s?: Source) => void>(() => undefined);
  const handleCommandRef = useRef<(cmd: string) => void>(() => undefined);

  const stopWakeRecognition = useCallback(() => {
    wakeRecRef.current?.stop();
    wakeRecRef.current = null;
  }, []);

  const startWakeRecognition = useCallback(() => {
    if (!wakeWordOn || wakeRecRef.current || !recognitionSupported()) return;
    wakeRecRef.current = startRecognition({
      continuous: true,
      onResult: (text, isFinal) => {
        if (!isFinal) return;
        const m = matchWake(text, cfg.current.assistantName);
        if (!m.matched) return;
        // Mientras habla, no se activa con su propia voz (el texto oído está en su respuesta).
        if (isSpeaking() && replyRef.current && normalizeWake(replyRef.current).includes(normalizeWake(text))) return;
        if (m.command.length > 2) handleCommandRef.current(m.command);
        else activateRef.current("wake");
      },
    });
  }, [wakeWordOn]);

  const startClap = useCallback(async () => {
    if (!clapOn || clapUnsubRef.current) return;
    await mic.start();
    // Más exigente que antes con el ruido de fondo: una palmada es un golpe seco muy por encima del ambiente.
    const det = new ClapDetector({ threshold: Number(voice?.clap_threshold ?? 0.35), noiseRatio: 6 });
    clapUnsubRef.current = mic.onFrame((f) => {
      if (holdingRef.current || modeRef.current === "listening" || modeRef.current === "thinking") return;
      if (det.feed(f.peak, f.rms, f.t)) activateRef.current("clap");
    });
  }, [clapOn, voice?.clap_threshold]);

  const stopWake = useCallback(() => {
    stopWakeRecognition();
    clapUnsubRef.current?.();
    clapUnsubRef.current = null;
    if (!captureRef.current) mic.stop();
    setWakeActive(false);
  }, [stopWakeRecognition]);

  const enableWake = useCallback(async () => {
    await unlockAudio();
    try {
      if (clapOn) await startClap();
      else await mic.start(); // pide el permiso del micro igualmente
      startWakeRecognition();
      setWakeActive(true);
    } catch {
      flash("Necesito permiso para el micrófono, hermano.");
      setWakeActive(false);
    }
  }, [clapOn, startClap, startWakeRecognition]);

  const toggleWake = useCallback(async () => {
    const pause = wakeActive; // encendida -> se apaga; apagada -> se enciende
    try {
      localStorage.setItem(EAR_OFF_KEY, pause ? "1" : "0");
    } catch {
      /* nada */
    }
    setWakePaused(pause);
    if (pause) stopWake();
    else await enableWake();
  }, [wakeActive, stopWake, enableWake]);

  // Arranque automático si el permiso ya estaba concedido; pausa en segundo plano.
  useEffect(() => {
    if (!wakeWanted || wakePaused) {
      stopWake();
      return;
    }
    let cancelled = false;
    const sync = async () => {
      if (document.visibilityState !== "visible") {
        stopWake();
        return;
      }
      if ((await micPermission()) === "granted" && !cancelled) await enableWake();
    };
    void sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", sync);
    };
  }, [wakeWanted, wakePaused, enableWake, stopWake]);

  // Si cambia el ajuste de palmada / palabra, reinicia lo necesario
  useEffect(() => {
    if (!wakeActive) return;
    if (!clapOn) {
      clapUnsubRef.current?.();
      clapUnsubRef.current = null;
    } else void startClap();
    if (!wakeWordOn) stopWakeRecognition();
    else startWakeRecognition();
  }, [clapOn, wakeWordOn, wakeActive, startClap, startWakeRecognition, stopWakeRecognition]);

  useEffect(() => () => stopWake(), [stopWake]);

  // ------------------------------------------------------------------
  // Captura de frase (compartida por botón / palmada / palabra)
  // ------------------------------------------------------------------
  const beginCapture = useCallback(
    async (kind: "manual" | "vad", origin: "manual" | "vad" | "followup" = kind) => {
      stopSpeaking(); // el usuario interrumpe a J.A.R.V.I.S.
      captureRef.current?.cancel();
      stopWakeRecognition(); // un solo reconocedor a la vez
      setTranscript(null);
      setMode("listening");
      const cap = new PhraseCapture(kind, { noSpeechTimeoutMs: origin === "followup" ? FOLLOW_UP_MS : 7000 });
      captureRef.current = cap;
      let live = "";
      liveRecRef.current = startRecognition({
        continuous: kind === "manual",
        onResult: (t) => {
          live = t;
          setTranscript(t);
        },
      });
      try {
        await cap.start();
      } catch {
        flash("Necesito permiso para el micrófono, hermano.");
        setMode("idle");
        captureRef.current = null;
        return;
      }
      const phrase = await cap.done;
      liveRecRef.current?.stop();
      liveRecRef.current = null;
      if (captureRef.current !== cap) return; // cancelada o sustituida
      captureRef.current = null;
      if (phrase || origin !== "followup") void playDeactivation();
      if (wakeActive) startWakeRecognition();
      if (!phrase && !holdingRef.current && kind === "vad" && !live) {
        setMode("idle");
        if (!wakeActiveRef.current) mic.stop();
        return;
      }
      await processPhrase(phrase, live, origin);
      // Sin escucha continua el micro se cierra al terminar (no queda abierto en segundo plano).
      if (!captureRef.current && !wakeActiveRef.current) mic.stop();
    },
    [processPhrase, startWakeRecognition, stopWakeRecognition, wakeActive],
  );

  const activate = useCallback(
    (_source: Source = "button") => {
      if (modeRef.current === "listening" || modeRef.current === "thinking") return;
      followUpsRef.current = 0;
      void unlockAudio();
      void playActivation();
      void beginCapture("vad");
    },
    [beginCapture],
  );
  activateRef.current = activate;
  followUpRef.current = () => {
    // Solo si el micro ya está abierto (escucha activa o conversación por voz), y como mucho
    // dos réplicas seguidas sin volver a decir su nombre (que la tele no le dé conversación).
    if (!mic.active || followUpsRef.current >= MAX_FOLLOW_UPS) return;
    followUpsRef.current++;
    void beginCapture("vad", "followup");
  };

  handleCommandRef.current = (cmd: string) => {
    if (modeRef.current === "listening" || modeRef.current === "thinking") return;
    stopSpeaking();
    followUpsRef.current = 0;
    void playActivation();
    setTranscript(cmd);
    void processPhrase(null, cmd, "wake");
  };

  const holdStart = useCallback(() => {
    if (!profile?.wake_button_enabled) return;
    holdingRef.current = true;
    followUpsRef.current = 0;
    void unlockAudio();
    void beginCapture("manual");
  }, [beginCapture, profile?.wake_button_enabled]);

  const holdEnd = useCallback(() => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    void captureRef.current?.finish();
  }, []);

  // ------------------------------------------------------------------
  // Interrupción proactiva de J.A.R.V.I.S. (urgente)
  // ------------------------------------------------------------------
  const interrupt = useCallback(
    async (text: string, opts: { sound?: string } = {}) => {
      captureRef.current?.cancel();
      captureRef.current = null;
      liveRecRef.current?.stop();
      stopSpeaking();
      if (opts.sound) {
        const stopSound = await playAlert(opts.sound);
        await new Promise((r) => setTimeout(r, 1800));
        stopSound();
      }
      await speak(text);
    },
    [speak],
  );

  // Otros componentes piden hablar (punto flotante, notificación, atajo)
  useEffect(() => {
    const onTalk = () => activate("event");
    window.addEventListener(JARVIS_EVENTS.talk, onTalk);
    return () => window.removeEventListener(JARVIS_EVENTS.talk, onTalk);
  }, [activate]);

  // Grabaciones offline: se transcriben con Whisper al volver la conexión
  useEffect(() => {
    registerOfflineTranscriber((item) => transcribe(item.blob, { prompt: `${cfg.current.assistantName}, ${cfg.current.userName}.` }));
    const onOnline = () => kvFactory && user && void processAudioQueue(kvFactory, user.id);
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [kvFactory, user]);

  const getLevel = useCallback(() => {
    if (modeRef.current === "listening") return mic?.level ?? 0;
    if (modeRef.current === "speaking" || isSpeaking()) return speechLevel();
    return 0;
  }, []);

  const value = useMemo<VoiceContextValue>(
    () => ({
      mode,
      transcript,
      reply,
      notice,
      getLevel,
      holdStart,
      holdEnd,
      activate,
      speak,
      interrupt,
      stop,
      wakeActive,
      wakeWanted,
      wakePaused,
      enableWake,
      toggleWake,
      recognitionAvailable: typeof window !== "undefined" && recognitionSupported(),
    }),
    [mode, transcript, reply, notice, getLevel, holdStart, holdEnd, activate, speak, interrupt, stop, wakeActive, wakeWanted, wakePaused, enableWake, toggleWake],
  );

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}

export function useVoice(): VoiceContextValue {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error("useVoice debe usarse dentro de <VoiceProvider>");
  return ctx;
}
