"use client";

/** Envoltorio de la Web Speech API (reconocimiento nativo del navegador). */
type SR = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

export function recognitionSupported(): boolean {
  return typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
}

function create(): SR | null {
  const C = (window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }).SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: new () => SR }).webkitSpeechRecognition;
  return C ? new C() : null;
}

export interface Recognizer {
  stop(): void;
  /** Último texto (provisional o final). */
  text(): string;
}

/**
 * Reconocimiento.
 *  continuous=true se reinicia solo (Chrome lo corta cada ~60 s o tras silencio).
 */
export function startRecognition(opts: {
  lang?: string;
  continuous?: boolean;
  onResult: (text: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
}): Recognizer | null {
  if (!recognitionSupported()) return null;
  let stopped = false;
  let last = "";
  let rec: SR | null = null;
  let failures = 0;

  const boot = () => {
    rec = create();
    if (!rec) return;
    rec.lang = opts.lang ?? "es-ES";
    rec.continuous = !!opts.continuous;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      failures = 0;
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (final) {
        last = final.trim();
        opts.onResult(last, true);
      } else if (interim) {
        last = interim.trim();
        opts.onResult(last, false);
      }
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") stopped = true;
      if (e.error !== "no-speech" && e.error !== "aborted") failures++;
      opts.onError?.(e.error);
    };
    rec.onend = () => {
      if (!stopped && opts.continuous && failures < 5) setTimeout(boot, failures ? 1000 * failures : 150);
    };
    try {
      rec.start();
    } catch {
      /* ya arrancado */
    }
  };
  boot();
  return {
    stop() {
      stopped = true;
      try {
        rec?.abort();
      } catch {
        /* nada */
      }
    },
    text: () => last,
  };
}
