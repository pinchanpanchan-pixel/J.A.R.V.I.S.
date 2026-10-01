"use client";
import { useMemo, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { Toggle } from "@/components/ui/Toggle";
import { useTable } from "@/hooks/useTable";
import { useSync } from "@/components/providers/SyncProvider";
import { connectedSet, REQUIREMENT_LABEL, shortcutGroups, SHORTCUT_ACTIONS, type ShortcutGroup } from "@/lib/shortcuts";
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

/**
 * Ajustes → Atajos: una fila por acción (frases en español e inglés juntas). Los de serie se
 * encienden/apagan; los tuyos se editan y se borran. Sincronizados entre dispositivos.
 */
export function ShortcutsManager({ locked }: { locked: boolean }) {
  const { engine } = useSync();
  const { user } = useProfile();
  const { rows } = useTable("shortcuts");
  const { rows: connectors } = useTable("connectors_tokens");
  const list = useMemo(() => shortcutGroups(rows, connectedSet(connectors)), [rows, connectors]);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
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

  const reset = () => {
    setTrigger("");
    setParam("");
    setAction("home_command");
    setEditing(null);
    setError(null);
  };

  const save = async () => {
    if (!engine) return;
    const t = trigger.trim();
    if (t.length < 3) return setError("La frase tiene que tener al menos 3 letras.");
    if (needs && !param.trim()) return setError("Falta completar la acción.");
    const data = { trigger_phrase: t, action, params: needs ? { [needs]: param.trim() } : {} };
    if (editing) await engine.update("shortcuts", editing, data);
    else await engine.insert("shortcuts", { ...data, is_default: false, enabled: true });
    reset();
  };

  const edit = (g: ShortcutGroup) => {
    setEditing(g.id);
    setTrigger(g.phrases.es[0] ?? "");
    setAction(g.action);
    setParam(String(Object.values(g.params ?? {})[0] ?? ""));
    setError(null);
  };

  const remove = async (id: string) => {
    if (confirmDel !== id) {
      setConfirmDel(id);
      setTimeout(() => setConfirmDel((c) => (c === id ? null : c)), 3000);
      return;
    }
    setConfirmDel(null);
    if (editing === id) reset();
    await engine?.remove("shortcuts", id);
  };

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1.5">
        {list.map((g) => {
          const detail = Object.values(g.params ?? {})[0];
          return (
            <li key={g.id} className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${editing === g.id ? "bg-arc/[0.08] ring-1 ring-arc/30" : "bg-white/[0.04]"}`}>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium leading-snug">{g.phrases.es.map((p) => `«${p}»`).join(" · ")}</div>
                {g.phrases.en.length > 0 && <div className="mt-0.5 text-[12px] leading-snug text-white/45">EN: {g.phrases.en.join(" · ")}</div>}
                <div className="mt-1 text-[11px] text-white/40">
                  {actionLabel(g.action)}
                  {detail ? `: ${String(detail)}` : ""}
                  {!g.available && g.requires ? ` · ${REQUIREMENT_LABEL[g.requires]}` : ""}
                </div>
              </div>
              {g.isDefault ? (
                <Toggle checked={g.enabled} disabled={locked || !g.available} onChange={(v) => void toggleDefault(g.id, v)} label={`Atajo ${g.phrases.es[0]}`} />
              ) : (
                <div className="flex items-center gap-1">
                  <button onClick={() => edit(g)} aria-label="Editar atajo" title="Editar" className="rounded-full p-2 text-white/45 hover:bg-white/10 hover:text-white">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => void remove(g.id)}
                    aria-label={confirmDel === g.id ? "Confirmar borrado" : "Borrar atajo"}
                    title={confirmDel === g.id ? "Pulsa otra vez para borrar" : "Borrar"}
                    className={`rounded-full p-2 transition ${confirmDel === g.id ? "bg-red-500/20 text-red-300" : "text-white/45 hover:bg-white/10 hover:text-red-300"}`}
                  >
                    {confirmDel === g.id ? <Check className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-col gap-2 rounded-2xl border border-white/[0.07] p-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-white/60">{editing ? "Editar atajo" : "Nuevo atajo"}</div>
          {editing && (
            <button onClick={reset} className="flex items-center gap-1 text-xs text-white/50 hover:text-white">
              <X className="h-3.5 w-3.5" /> Cancelar
            </button>
          )}
        </div>
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
        <button onClick={() => void save()} disabled={locked} className="jv-btn-ghost">
          {editing ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {editing ? "Guardar cambios" : "Añadir atajo"}
        </button>
        {locked && <p className="text-center text-[11px] text-white/40">Atajos personalizados en Pro Lite y Pro.</p>}
      </div>
    </div>
  );
}
