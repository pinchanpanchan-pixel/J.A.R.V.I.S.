"use client";
import { VOICE_SAMPLE_TEXT } from "@/lib/voices";
import { isMockMode } from "@/lib/env";
import { getMockSession } from "@/lib/auth/mockAuth";
import type { VoiceKey } from "@/types/db";
import { getAudioContext } from "./audio/context";
import { splitSentences } from "./audio/sentences";
import { webSpeak, webSpeechAvailable, type WebSpeakHandle } from "./webSpeech";

/**
 * TTS de J.A.R.V.I.S.
 *  - Voz neuronal del servidor (/api/tts: Google Cloud TTS o Gemini TTS). La respuesta se
 *    trocea en frases: la primera va sola (arranque rápido) y la siguiente se precarga
 *    mientras suena la actual.
 *  - Respaldo: voz del navegador (Web Speech API), avisando con onTtsNotice.
 *  - Se puede interrumpir en cualquier momento (stop).
 */
export interface SpeakOptions {
  voice: VoiceKey;
  premium: boolean;
  rate?: number;
  volume?: number;
  onStart?: () => void;
}

export interface VoiceConfig {
  tts: boolean;
  engine?: "google" | "gemini" | null;
  stt: boolean;
}
let config: Promise<VoiceConfig> | null = null;
export function voiceConfig() {
  if (!config) {
    config = fetch("/api/voice/config")
      .then((r) => r.json())
      .catch(() => ({ tts: false, stt: false }));
  }
  return config;
}

/** Aviso cuando suena la voz del navegador en lugar de la neuronal (null = todo bien). */
export type TtsNotice = null | "unavailable" | "failed" | "plan";
let notice: TtsNotice = null;
const noticeListeners = new Set<(n: TtsNotice) => void>();
function setNotice(n: TtsNotice) {
  if (n === notice) return;
  notice = n;
  noticeListeners.forEach((l) => l(n));
}
export function onTtsNotice(l: (n: TtsNotice) => void): () => void {
  noticeListeners.add(l);
  l(notice);
  return () => void noticeListeners.delete(l);
}

// Dos <audio> que se alternan (uno suena, el otro precarga). Cada uno con su analizador.
interface Player {
  el: HTMLAudioElement;
  analyser: AnalyserNode | null;
}
let players: Player[] | null = null;
function getPlayers(): Player[] {
  if (players) return players;
  players = [0, 1].map(() => {
    const el = new Audio();
    el.preload = "auto";
    el.setAttribute("playsinline", "true");
    let analyser: AnalyserNode | null = null;
    try {
      const ctx = getAudioContext();
      const src = ctx.createMediaElementSource(el);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser).connect(ctx.destination);
    } catch {
      analyser = null; // el audio suena igual, solo sin nivel
    }
    return { el, analyser };
  });
  return players;
}

function ttsUrl(text: string, voice: VoiceKey): string {
  const q = new URLSearchParams({ text, voice });
  if (isMockMode) {
    const s = getMockSession();
    if (s) q.set("mockUser", s.id);
  }
  return `/api/tts?${q}`;
}

let session = 0;
let speaking = false;
let current: Player | null = null;
let web: WebSpeakHandle | null = null;
let webPulse = 0;
const buf = new Uint8Array(256);

export function isSpeaking() {
  return speaking;
}

/** Nivel 0..1 de la voz para animar el punto líquido. */
export function speechLevel(): number {
  if (!speaking) return 0;
  if (current?.analyser) {
    current.analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128;
      sum += v * v;
    }
    return Math.min(1, Math.sqrt(sum / buf.length) * 5);
  }
  // Web Speech no expone audio: pulso sintético con los límites de palabra.
  webPulse *= 0.9;
  return 0.25 + webPulse * 0.6 + 0.1 * Math.sin(performance.now() / 90);
}

// Promesas de reproducción en curso: al interrumpir se resuelven (si no, quedarían colgadas).
const pendingPlays = new Set<(ok: boolean) => void>();

export function stopSpeaking() {
  session++;
  speaking = false;
  pendingPlays.forEach((r) => r(true));
  pendingPlays.clear();
  web?.cancel();
  web = null;
  for (const p of players ?? []) {
    p.el.pause();
    p.el.removeAttribute("src");
    p.el.load();
  }
  current = null;
}

const START_TIMEOUT_MS = 22_000;

function playEl(p: Player, url: string, mySession: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (mySession !== session) return resolve(true);
    const el = p.el;
    const done = (ok: boolean) => {
      clearTimeout(slow);
      el.onplaying = null;
      el.onended = null;
      el.onerror = null;
      pendingPlays.delete(done);
      resolve(ok);
    };
    pendingPlays.add(done);
    // Si la voz neuronal no empieza a sonar a tiempo, se pasa a la del navegador.
    const slow = setTimeout(() => {
      el.pause();
      el.removeAttribute("src"); // que no empiece a sonar tarde encima de la otra voz
      done(false);
    }, START_TIMEOUT_MS);
    el.onplaying = () => clearTimeout(slow);
    el.onended = () => done(true);
    el.onerror = () => done(false);
    if (el.src !== new URL(url, location.href).href) el.src = url;
    el.play().catch(() => done(false));
  });
}

/** Habla el texto. Resuelve cuando termina (o se interrumpe). */
export async function speak(text: string, opts: SpeakOptions): Promise<void> {
  stopSpeaking();
  const mySession = session;
  const parts = splitSentences(text);
  if (parts.length === 0) return;
  speaking = true;
  opts.onStart?.();
  const cfg = await voiceConfig();
  const premium = opts.premium && cfg.tts;

  try {
    if (premium) {
      const ps = getPlayers();
      let ok = true;
      for (let i = 0; i < parts.length && mySession === session; i++) {
        const p = ps[i % 2];
        const next = ps[(i + 1) % 2];
        current = p;
        p.el.volume = opts.volume ?? 1;
        p.el.playbackRate = opts.rate ?? 1;
        // precarga la siguiente frase mientras suena esta
        if (parts[i + 1]) {
          next.el.src = ttsUrl(parts[i + 1], opts.voice);
          next.el.load();
        }
        ok = await playEl(p, ttsUrl(parts[i], opts.voice), mySession);
        if (!ok && mySession === session) {
          // La voz neuronal falló: el resto con la del navegador (nunca se queda callado)
          setNotice("failed");
          await speakWeb(parts.slice(i).join(" "), opts, mySession);
          break;
        }
      }
      if (ok) setNotice(null);
    } else {
      setNotice(cfg.tts ? "plan" : "unavailable");
      await speakWeb(text, opts, mySession);
    }
  } finally {
    if (mySession === session) {
      speaking = false;
      current = null;
    }
  }
}

async function speakWeb(text: string, opts: SpeakOptions, mySession: number) {
  if (!webSpeechAvailable() || mySession !== session) return;
  web = webSpeak(text, opts.voice, { rate: opts.rate, volume: opts.volume, onBoundary: () => (webPulse = 1) });
  await web.done;
}

/** Vista previa en Ajustes/Onboarding: la misma frase con cada voz (la muestra es para todos los planes). */
export async function previewVoice(key: VoiceKey): Promise<void> {
  await speak(VOICE_SAMPLE_TEXT, { voice: key, premium: true });
}
