import type { Plan, Period } from "@/types/db";

/**
 * Planes de J.A.R.V.I.S.
 *  Free       0 $     — prueba del círculo que respira, 1 voz, 3 skills, sin permisos totales
 *  Pro Lite   19 $/mes — todo lo del onboarding pero con límites
 *  Pro        29 $/mes — EL QUE QUEREMOS VENDER: todo ilimitado
 *  Founder    199 $ lifetime — solo los primeros 500
 *  pro_lifetime — propietario / códigos 100%
 */
export interface PlanFeatures {
  sync: boolean;
  maxMemoryBlocks: number | null; // null = ilimitado
  voices: number; // nº de voces disponibles
  premiumVoice: boolean; // voz neuronal (Google/Gemini TTS); si no, Web Speech
  maxSkills: number | null;
  connectors: boolean;
  maxConnectors: number | null;
  smartHome: boolean;
  diary: boolean;
  importPast: boolean;
  vision: boolean;
  worldMonitor: boolean;
  floatingMode: boolean;
  multiProvider: boolean;
  shortcuts: boolean;
  quickNotes: boolean;
}

export const PLAN_FEATURES: Record<Plan, PlanFeatures> = {
  free: {
    sync: false, maxMemoryBlocks: 50, voices: 1, premiumVoice: false, maxSkills: 3,
    connectors: false, maxConnectors: 0, smartHome: false, diary: false, importPast: false,
    vision: false, worldMonitor: false, floatingMode: false, multiProvider: false,
    shortcuts: false, quickNotes: true,
  },
  pro_lite: {
    sync: true, maxMemoryBlocks: 1000, voices: 4, premiumVoice: true, maxSkills: null,
    connectors: true, maxConnectors: 3, smartHome: true, diary: true, importPast: false,
    vision: false, worldMonitor: true, floatingMode: false, multiProvider: false,
    shortcuts: true, quickNotes: true,
  },
  pro: {
    sync: true, maxMemoryBlocks: null, voices: 4, premiumVoice: true, maxSkills: null,
    connectors: true, maxConnectors: null, smartHome: true, diary: true, importPast: true,
    vision: true, worldMonitor: true, floatingMode: true, multiProvider: true,
    shortcuts: true, quickNotes: true,
  },
  founder: {} as PlanFeatures,
  pro_lifetime: {} as PlanFeatures,
};
PLAN_FEATURES.founder = { ...PLAN_FEATURES.pro };
PLAN_FEATURES.pro_lifetime = { ...PLAN_FEATURES.pro };

export interface PlanPrice {
  plan: Exclude<Plan, "free" | "pro_lifetime">;
  period: Period;
  amountCents: number;
  currency: "usd";
  label: string;
}

export const PRICES: PlanPrice[] = [
  { plan: "pro_lite", period: "monthly", amountCents: 1900, currency: "usd", label: "$19/mes" },
  { plan: "pro_lite", period: "yearly", amountCents: 19000, currency: "usd", label: "$190/año" },
  { plan: "pro", period: "monthly", amountCents: 2900, currency: "usd", label: "$29/mes" },
  { plan: "pro", period: "yearly", amountCents: 29000, currency: "usd", label: "$290/año" },
  { plan: "founder", period: "lifetime", amountCents: 19900, currency: "usd", label: "$199 de por vida" },
];

export const FOUNDER_LIMIT = 500;

export const PLAN_LABELS: Record<Plan, string> = {
  free: "Free",
  pro_lite: "Pro Lite",
  pro: "Pro",
  founder: "Founder",
  pro_lifetime: "Lifetime",
};

export function featuresFor(plan: Plan | null | undefined, isOwner = false): PlanFeatures {
  if (isOwner) return PLAN_FEATURES.pro_lifetime;
  return PLAN_FEATURES[plan ?? "free"] ?? PLAN_FEATURES.free;
}

export function isPaidPlan(plan: Plan | null | undefined): boolean {
  return !!plan && plan !== "free";
}
