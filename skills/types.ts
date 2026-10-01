import type { SyncEngine } from "@/lib/sync/engine";
import type { PlanFeatures } from "@/lib/plans";

/** Contexto que reciben las skills (cliente). */
export interface SkillContext {
  engine: SyncEngine;
  userId: string;
  userName: string;
  assistantName: string;
  timezone: string;
  features: PlanFeatures;
  navigate: (path: string) => void;
  openQuickNote: (prefill?: string) => void;
  /** Pide al cerebro una respuesta usando datos aportados por la skill. */
  askBrain: (message: string, extra: string) => Promise<string>;
  /** Llama a una acción de conector (agenda, correo, música…). */
  connector: <T>(provider: string, body: Record<string, unknown>) => Promise<T>;
  now: () => Date;
}

export interface SkillResult {
  reply: string;
  navigate?: string;
  /** Enlace externo que abrir (ruta de Maps, vídeo de YouTube, documento…). */
  openUrl?: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  /** Palabras/frases que la activan (documentación + coincidencia rápida). */
  triggerKeywords: string[];
  /** Función del plan que necesita (si falta, se ofrece mejorar el plan). */
  requires?: keyof PlanFeatures;
  /** Devuelve datos de la coincidencia o null. `t` llega normalizado (minúsculas, sin acentos). */
  match: (t: string, raw: string) => Record<string, unknown> | null;
  /** Ejecuta. Devolver null = no la maneja → la conversación sigue con el cerebro. */
  execute: (ctx: SkillContext, raw: string, m: Record<string, unknown>) => Promise<SkillResult | null>;
}

export const normalizeText = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[¿?¡!.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Fecha local YYYY-MM-DD en una zona horaria. */
export function dayKey(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
