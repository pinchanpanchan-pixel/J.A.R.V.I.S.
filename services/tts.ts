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
 *  - ElevenLabs en streaming (/api/tts, eleven_flash_v2_5): el <audio> empieza a sonar con
 *    los primeros bytes. La respuesta se trocea en frases: la primera va sola (arranque
 *    < 400 ms) y la siguiente se precarga mientras suena la actual.
 *  - Respaldo: Web Speech API (sin clave de ElevenLabs o plan Free).
 *  - Se puede interrumpir en cualquier momento (stop).
 */
export interface SpeakOptions {
  voice: VoiceKey;
  premium: boolean;
  rate?: number;
  volume?: number;
  onStart?: () => void;
}

let config: Promise<{ tts: boolean; stt: boolean }> | null = null;
export function voiceConfig() {
  if (!config) {
    config = fetch("/api/voice/config")
      .then((r) => r.json())
      .catch(() => ({ tts: false, stt: false }));
  }
  return config;
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

function playEl(p: Player, url: string, mySession: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (mySession !== session) return resolve(true);
    const el = p.el;
    const done = (ok: boolean) => {
      el.onended = null;
      el.onerror = null;
      pendingPlays.delete(done);
      resolve(ok);
    };
    pendingPlays.add(done);
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
        if (!ok) {
          // ElevenLabs falló a mitad: el resto con Web Speech (nunca se queda callado)
          await speakWeb(parts.slice(i).join(" "), opts, mySession);
          break;
        }
      }
    } else {
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

/** Vista previa en Ajustes/Onboarding: «Ey hermano, estoy aquí.» con cada voz. */
export async function previewVoice(key: VoiceKey, premium = true): Promise<void> {
  await speak(VOICE_SAMPLE_TEXT, { voice: key, premium });
}
