"use client";
import { useEffect, useState } from "react";
import { KeyRound, Loader2, Plus, Trash2, Zap } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Toggle } from "@/components/ui/Toggle";
import { useTable } from "@/hooks/useTable";
import { useSync } from "@/components/providers/SyncProvider";
import { sealSecret } from "@/lib/api";
import { AI_PROVIDERS } from "@/lib/ai/types";
import { ACTIVE_PROVIDER_KEY } from "@/hooks/useBrain";
import type { AIProvider } from "@/types/db";

const providerName = (p: string) => AI_PROVIDERS.find((x) => x.id === p)?.name ?? (p === "mock" ? "Simulado" : p);

/** Ajustes → Avanzado → Proveedores de IA. Claves ilimitadas por proveedor, cifradas y sincronizadas. */
export function AIProvidersManager({ locked }: { locked: boolean }) {
  const { engine } = useSync();
  const { rows } = useTable("ai_provider_keys", { sort: (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) });
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<AIProvider>("anthropic");
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<{ provider: string; model: string | null } | null>(null);

  useEffect(() => {
    const read = () => {
      try {
        setActive(JSON.parse(localStorage.getItem(ACTIVE_PROVIDER_KEY) ?? "null"));
      } catch {
        setActive(null);
      }
    };
    read();
    const t = setInterval(read, 3000);
    return () => clearInterval(t);
  }, []);

  const save = async () => {
    const k = key.trim();
    if (!engine || k.length < 12) {
      setError("Esa clave parece demasiado corta, hermano.");
      return;
    }
    const expected = AI_PROVIDERS.find((p) => p.id === provider)?.keyPrefix;
    if (expected && !k.startsWith(expected)) {
      setError(`Las claves de ${providerName(provider)} suelen empezar por «${expected}». Revísala.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { ciphertext, last4 } = await sealSecret(k, "ai_key");
      await engine.insert("ai_provider_keys", {
        provider,
        label: label.trim() || null,
        key_ciphertext: ciphertext,
        key_last4: last4 ?? k.slice(-4),
        enabled: true,
        fail_count: 0,
        last_error: null,
        last_used_at: null,
      });
      setKey("");
      setLabel("");
      setOpen(false);
    } catch {
      setError("No he podido cifrar la clave. ¿Tienes conexión?");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 rounded-2xl bg-arc/10 px-3 py-2.5 text-sm">
        <Zap className="h-4 w-4 shrink-0 text-arc" />
        <span className="text-white/80">
          Proveedor activo: <b className="text-white">{active ? providerName(active.provider) : "Claude (por defecto)"}</b>
          {active?.model ? <span className="text-white/45"> · {active.model}</span> : null}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-white/45">
        Uso primero tus claves (en rotación) y, si una falla o se queda sin cupo, salto a la siguiente. Si no hay ninguna, uso Claude.
      </p>

      {rows.length > 0 && (
        <ul className="flex flex-col gap-2">
          {rows.map((k) => (
            <li key={k.id} className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3">
              <KeyRound className="h-4 w-4 shrink-0 text-white/40" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {providerName(k.provider)}
                  {k.label ? <span className="text-white/45"> · {k.label}</span> : null}
                </div>
                <div className="text-[11px] text-white/40">
                  ••••{k.key_last4}
                  {k.fail_count > 0 ? <span className="text-amber-300"> · {k.fail_count} fallos ({k.last_error})</span> : k.last_used_at ? " · funcionando" : " · sin usar aún"}
                </div>
              </div>
              <Toggle checked={k.enabled} onChange={(v) => void engine?.update("ai_provider_keys", k.id, { enabled: v })} label={`Activar ${providerName(k.provider)}`} />
              <button onClick={() => void engine?.remove("ai_provider_keys", k.id)} className="p-1 text-white/30 hover:text-red-300" aria-label="Eliminar clave">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button onClick={() => setOpen(true)} disabled={locked} className="jv-btn-ghost">
        <Plus className="h-4 w-4" /> Añadir proveedor
      </button>
      {locked && <p className="text-center text-[11px] text-white/40">Multi-proveedor disponible en Pro.</p>}

      <Sheet open={open} onClose={() => setOpen(false)} title="Añadir proveedor">
        <div className="flex flex-col gap-3">
          <select className="jv-input" value={provider} onChange={(e) => setProvider(e.target.value as AIProvider)} aria-label="Proveedor">
            {AI_PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            className="jv-input font-mono text-sm"
            type="password"
            autoComplete="off"
            placeholder={`API key (${AI_PROVIDERS.find((p) => p.id === provider)?.hint})`}
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <input className="jv-input" placeholder="Nombre (opcional): «cuenta trabajo»" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} />
          <p className="text-[11px] text-white/40">Se cifra (AES-256) antes de guardarse. Nunca se muestra entera ni se registra.</p>
          {error && <p className="text-xs text-red-300">{error}</p>}
          <button onClick={() => void save()} disabled={saving || !key.trim()} className="jv-btn-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Guardar
          </button>
        </div>
      </Sheet>
    </div>
  );
}
