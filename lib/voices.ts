import type { VoiceKey } from "@/types/db";

export interface VoiceDef {
  key: VoiceKey;
  name: string;
  description: string;
  envVar: string;
  /** Voice ID de ElevenLabs por defecto (sobrescribible por .env). */
  defaultVoiceId: string;
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
    defaultVoiceId: "pFZP5JQG7iQjIQuC4Bku",
    fallback: { lang: "en-GB", pitch: 0.9, rate: 1.0, preferNames: ["Daniel", "Arthur", "Google UK English Male", "Oliver"] },
    accent: "#64FFDA",
  },
  {
    key: "young_brother",
    name: "Hermano joven",
    description: "Cercano, con energía.",
    envVar: "VOICE_YOUNG_BROTHER",
    defaultVoiceId: "TX3LPaxmHKxF91XS1oU3",
    fallback: { lang: "es-ES", pitch: 1.15, rate: 1.08, preferNames: ["Jorge", "Pablo", "Google español"] },
    accent: "#38BDF8",
  },
  {
    key: "deep_calm",
    name: "Profundo y calmado",
    description: "Para la noche. Te baja las pulsaciones.",
    envVar: "VOICE_DEEP_CALM",
    defaultVoiceId: "VR6AewLTigWG4xSOukaG",
    fallback: { lang: "es-ES", pitch: 0.7, rate: 0.9, preferNames: ["Diego", "Juan", "Google español"] },
    accent: "#A78BFA",
  },
  {
    key: "spanish_brother",
    name: "Hermano español",
    description: "De aquí. Directo y con cariño.",
    envVar: "VOICE_SPANISH_BROTHER",
    defaultVoiceId: "SOYHLrjzK2X1ezoPC6cr",
    fallback: { lang: "es-ES", pitch: 1.0, rate: 1.0, preferNames: ["Jorge", "Monica", "Google español de España"] },
    accent: "#F5C451",
  },
];

export const voiceByKey = (k: VoiceKey | null | undefined): VoiceDef => VOICES.find((v) => v.key === k) ?? VOICES[0];
