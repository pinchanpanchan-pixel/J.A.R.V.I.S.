import config from "@/config/shortcuts.json";
import type { ShortcutRow } from "@/types/db";
import { normalizeText } from "@/skills/types";

export type ShortcutActionId = (typeof config.actions)[number]["id"];
export const SHORTCUT_ACTIONS = config.actions as Array<{ id: string; label: string; params: string[] }>;

export interface EffectiveShortcut {
  id: string;
  trigger: string;
  action: string;
  params: Record<string, unknown>;
  isDefault: boolean;
  enabled: boolean;
}

/** Atajos por defecto + los del usuario. Una fila is_default con el mismo id desactiva/edita el de serie. */
export function effectiveShortcuts(rows: ShortcutRow[]): EffectiveShortcut[] {
  const overrides = new Map(rows.filter((r) => r.is_default).map((r) => [String(r.params?.defaultId ?? ""), r]));
  const defaults = config.defaults.map((d) => {
    const o = overrides.get(d.id);
    return { id: d.id, trigger: d.trigger, action: d.action, params: d.params, isDefault: true, enabled: o ? o.enabled : true };
  });
  const custom = rows
    .filter((r) => !r.is_default)
    .map((r) => ({ id: r.id, trigger: r.trigger_phrase, action: r.action, params: r.params ?? {}, isDefault: false, enabled: r.enabled }));
  return [...custom, ...defaults];
}

/** Coincide si la frase ES el atajo o EMPIEZA por él (las personalizadas tienen prioridad). */
export function matchShortcut(text: string, shortcuts: EffectiveShortcut[]): EffectiveShortcut | null {
  const t = normalizeText(text).replace(/^(hey |oye |ey )?(jarvis |friday )?/, "");
  for (const s of shortcuts) {
    if (!s.enabled) continue;
    const trig = normalizeText(s.trigger);
    if (trig && (t === trig || t.startsWith(`${trig} `))) return s;
  }
  return null;
}
