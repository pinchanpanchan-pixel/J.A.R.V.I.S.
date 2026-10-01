import config from "@/config/shortcuts.json";
import type { ConnectorTokenRow, ShortcutRow } from "@/types/db";
import { normalizeText } from "@/skills/types";
import { isMockMode } from "@/lib/env";

export type ShortcutActionId = (typeof config.actions)[number]["id"];
export const SHORTCUT_ACTIONS = config.actions as Array<{ id: string; label: string; params: string[] }>;

/** Conexión que necesita un atajo de serie: «home» = cualquier hogar inteligente; si no, id del conector. */
export type ShortcutRequirement = "home" | "spotify";

interface DefaultGroup {
  id: string;
  action: string;
  requires?: ShortcutRequirement;
  phrases: { es: string[]; en: string[] };
}
const DEFAULTS = config.defaults as DefaultGroup[];

/** Una fila por acción (lo que se ve en Ajustes): frases en español e inglés juntas. */
export interface ShortcutGroup {
  id: string;
  action: string;
  params: Record<string, unknown>;
  isDefault: boolean;
  enabled: boolean;
  phrases: { es: string[]; en: string[] };
  requires?: ShortcutRequirement;
  /** false si le falta la conexión que necesita (entonces no se puede encender). */
  available: boolean;
}

/** Una frase concreta (lo que usa el reconocimiento). */
export interface EffectiveShortcut {
  id: string;
  trigger: string;
  action: string;
  params: Record<string, unknown>;
  isDefault: boolean;
  enabled: boolean;
}

export const REQUIREMENT_LABEL: Record<ShortcutRequirement, string> = {
  home: "Necesita conectar tu hogar inteligente",
  spotify: "Necesita conectar Spotify",
};

/**
 * ¿Está la conexión? Solo cuenta una cuenta conectada de verdad; el estado «mock» (interruptor
 * marcado sin iniciar sesión) solo vale en modo simulado.
 */
export function connectedSet(tokens: ConnectorTokenRow[], allowMock = isMockMode): Set<string> {
  const s = new Set<string>();
  for (const t of tokens) {
    if (!t.enabled || !(t.status === "connected" || (allowMock && t.status === "mock"))) continue;
    s.add(t.provider);
    if (t.kind === "home") s.add("home");
  }
  return s;
}

/**
 * Grupos de atajos: los tuyos + los de serie. Una fila is_default con params.defaultId
 * enciende/apaga el de serie. Los que dependen de una conexión vienen apagados hasta tenerla.
 */
export function shortcutGroups(rows: ShortcutRow[], connected: Set<string> = new Set()): ShortcutGroup[] {
  const overrides = new Map(rows.filter((r) => r.is_default).map((r) => [String(r.params?.defaultId ?? ""), r]));
  const defaults = DEFAULTS.map((d) => {
    const available = !d.requires || connected.has(d.requires);
    const o = overrides.get(d.id);
    return {
      id: d.id,
      action: d.action,
      params: {},
      isDefault: true,
      enabled: available && (o ? o.enabled : true),
      phrases: d.phrases,
      requires: d.requires,
      available,
    };
  });
  const custom = rows
    .filter((r) => !r.is_default)
    .map((r) => ({ id: r.id, action: r.action, params: r.params ?? {}, isDefault: false, enabled: r.enabled, phrases: { es: [r.trigger_phrase], en: [] }, available: true }));
  return [...custom, ...defaults];
}

/** Lista plana de frases para reconocer (las personalizadas primero: tienen prioridad). */
export function effectiveShortcuts(rows: ShortcutRow[], connected: Set<string> = new Set()): EffectiveShortcut[] {
  return shortcutGroups(rows, connected).flatMap((g) =>
    [...g.phrases.es, ...g.phrases.en].map((trigger, i) => ({
      id: i === 0 ? g.id : `${g.id}#${i}`,
      trigger,
      action: g.action,
      params: g.params,
      isDefault: g.isDefault,
      enabled: g.enabled,
    })),
  );
}

/** Coincide si la frase ES el atajo o EMPIEZA por él (las personalizadas tienen prioridad). */
export function matchShortcut(text: string, shortcuts: EffectiveShortcut[], assistantName = "jarvis"): EffectiveShortcut | null {
  const name = normalizeText(assistantName.replace(/\./g, ""));
  const t = normalizeText(text)
    .replace(/^(hey |oye |ey |ok )/, "")
    .replace(new RegExp(`^(${name}|jarvis|friday) `), "");
  for (const s of shortcuts) {
    if (!s.enabled) continue;
    const trig = normalizeText(s.trigger);
    if (trig && (t === trig || t.startsWith(`${trig} `))) return s;
  }
  return null;
}
