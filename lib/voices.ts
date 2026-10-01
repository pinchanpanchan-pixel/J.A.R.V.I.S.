import type { VoiceKey } from "@/types/db";

export interface VoiceDef {
  key: VoiceKey;
  name: string;
  description: string;
  /** Prefijo de variable de entorno: <envVar>_GOOGLE sobrescribe la voz de Google. */
  envVar: string;
  /** Google Cloud TTS (Chirp 3 HD). rate: velocidad opcional. */
  google: { name: string; rate?: number };
  /**
   * Gemini TTS: voz prediseñada. Sin indicaciones de estilo en el texto: el modelo a veces
   * las leía en voz alta. Cada voz ya tiene su timbre propio.
   */
  gemini: { voice: string };
  /** Parámetros del respaldo Web Speech API. */
  fallback: { lang: string; pitch: number; rate: number; preferNames: string[] };
  accent: string; // color de la tarjeta
}

export const VOICE_SAMPLE_TEXT = "Ey hermano, estoy aquí.";

export const VOICES: VoiceDef[] = [
  {
    key: "british_original",
    name: "Británico original",
    description: "El clásico. Elegante y preciso.",
    envVar: "VOICE_BRITISH_ORIGINAL",
    google: { name: "es-ES-Chirp3-HD-Charon" },
    gemini: { voice: "Charon" },
    fallback: { lang: "en-GB", pitch: 0.9, rate: 1.0, preferNames: ["Daniel", "Arthur", "Google UK English Male", "Oliver"] },
    accent: "#64FFDA",
  },
  {
    key: "young_brother",
    name: "Hermano joven",
    description: "Cercano, con energía.",
    envVar: "VOICE_YOUNG_BROTHER",
    google: { name: "es-US-Chirp3-HD-Puck" },
    gemini: { voice: "Puck" },
    fallback: { lang: "es-ES", pitch: 1.15, rate: 1.08, preferNames: ["Jorge", "Pablo", "Google español"] },
    accent: "#38BDF8",
  },
  {
    key: "deep_calm",
    name: "Profundo y calmado",
    description: "Para la noche. Te baja las pulsaciones.",
    envVar: "VOICE_DEEP_CALM",
    google: { name: "es-ES-Chirp3-HD-Enceladus", rate: 0.92 },
    gemini: { voice: "Enceladus" },
    fallback: { lang: "es-ES", pitch: 0.7, rate: 0.9, preferNames: ["Diego", "Juan", "Google español"] },
    accent: "#A78BFA",
  },
  {
    key: "spanish_brother",
    name: "Hermano español",
    description: "De aquí. Directo y con cariño.",
    envVar: "VOICE_SPANISH_BROTHER",
    google: { name: "es-ES-Chirp3-HD-Orus" },
    gemini: { voice: "Orus" },
    fallback: { lang: "es-ES", pitch: 1.0, rate: 1.0, preferNames: ["Jorge", "Monica", "Google español de España"] },
    accent: "#F5C451",
  },
];

export const voiceByKey = (k: VoiceKey | null | undefined): VoiceDef => VOICES.find((v) => v.key === k) ?? VOICES[0];
