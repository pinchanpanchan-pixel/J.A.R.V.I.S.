"use client";
import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Toggle } from "@/components/ui/Toggle";
import { useTable } from "@/hooks/useTable";
import { useSync } from "@/components/providers/SyncProvider";
import { effectiveShortcuts, SHORTCUT_ACTIONS } from "@/lib/shortcuts";
import { stableId } from "@/lib/ids";
import { useProfile } from "@/hooks/useProfile";

const PATHS = [
  ["/", "Cerebro"],
  ["/memories", "Memorias"],
  ["/memories?tab=notes", "Notas rápidas"],
  ["/diary", "Diario"],
  ["/home", "Hogar"],
  ["/settings", "Ajustes"],
];

const actionLabel = (id: string) => SHORTCUT_ACTIONS.find((a) => a.id === id)?.label ?? id;

/** Ajustes → Atajos: los de serie (activables) + los tuyos (frase + acción + parámetros). Sincronizados. */
export function ShortcutsManager({ locked }: { locked: boolean }) {
  const { engine } = useSync();
  const { user } = useProfile();
  const { rows } = useTable("shortcuts");
  const list = useMemo(() => effectiveShortcuts(rows), [rows]);
  const [trigger, setTrigger] = useState("");
  const [action, setAction] = useState("home_command");
  const [param, setParam] = useState("");
  const [error, setError] = useState<string | null>(null);
  const needs = SHORTCUT_ACTIONS.find((a) => a.id === action)?.params[0];

  const toggleDefault = async (defaultId: string, enabled: boolean) => {
    if (!engine || !user) return;
    await engine.upsert("shortcuts", stableId(user.id, "shortcut-default", defaultId), {
      trigger_phrase: "",
      action: "",
      params: { defaultId },
      is_default: true,
      enabled,
    });
  };

  const add = async () => {
    if (!engine) return;
    const t = trigger.trim();
    if (t.length < 3) return setError("La frase tiene que tener al menos 3 letras.");
    if (needs && !param.trim()) return setError("Falta completar la acción.");
    await engine.insert("shortcuts", {
      trigger_phrase: t,
      action,
      params: needs ? { [needs]: param.trim() } : {},
      is_default: false,
      enabled: true,
    });
    setTrigger("");
    setParam("");
    setError(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1.5">
        {list.map((s) => (
          <li key={s.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">«{s.trigger}»</div>
              <div className="truncate text-[11px] text-white/45">
                {actionLabel(s.action)}
                {Object.values(s.params ?? {})[0] ? `: ${String(Object.values(s.params)[0])}` : ""}
                {s.isDefault ? " · de serie" : ""}
              </div>
            </div>
            {s.isDefault ? (
              <Toggle checked={s.enabled} disabled={locked} onChange={(v) => void toggleDefault(s.id, v)} label={`Atajo ${s.trigger}`} />
            ) : (
              <button onClick={() => void engine?.remove("shortcuts", s.id)} aria-label="Borrar atajo" className="p-1 text-white/35 hover:text-red-300">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2 rounded-2xl border border-white/[0.07] p-3">
        <div className="text-xs font-semibold text-white/60">Nuevo atajo</div>
        <input className="jv-input" placeholder="Cuando diga… (p. ej. «modo cine»)" value={trigger} onChange={(e) => setTrigger(e.target.value)} disabled={locked} />
        <select className="jv-input" value={action} onChange={(e) => setAction(e.target.value)} disabled={locked} aria-label="Acción">
          {SHORTCUT_ACTIONS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
        {needs === "path" ? (
          <select className="jv-input" value={param} onChange={(e) => setParam(e.target.value)} aria-label="Sección">
            <option value="">Elige sección</option>
            {PATHS.map(([p, l]) => (
              <option key={p} value={p}>
                {l}
              </option>
            ))}
          </select>
        ) : needs ? (
          <input
            className="jv-input"
            placeholder={needs === "command" ? "Orden: «apaga todas las luces»" : needs === "text" ? "Lo que responderé" : "Lo que le pregunto al cerebro"}
            value={param}
            onChange={(e) => setParam(e.target.value)}
          />
        ) : null}
        {error && <p className="text-xs text-red-300">{error}</p>}
        <button onClick={() => void add()} disabled={locked} className="jv-btn-ghost">
          <Plus className="h-4 w-4" /> Añadir atajo
        </button>
        {locked && <p className="text-center text-[11px] text-white/40">Atajos personalizados en Pro Lite y Pro.</p>}
      </div>
    </div>
  );
}
