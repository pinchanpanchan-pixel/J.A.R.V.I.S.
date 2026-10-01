"use client";
import { GlassSelect } from "@/components/ui/GlassSelect";
import { useEffect, useState } from "react";
import { ArrowRight, KeyRound, Loader2, Play, Plus, Server, Trash2, Zap } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Toggle } from "@/components/ui/Toggle";
import { useTable } from "@/hooks/useTable";
import { useSync } from "@/components/providers/SyncProvider";
import { apiJson, sealSecret } from "@/lib/api";
import { AI_PROVIDERS } from "@/lib/ai/types";
import { ACTIVE_PROVIDER_KEY } from "@/hooks/useBrain";
import type { AIProvider } from "@/types/db";

const providerName = (p: string) => AI_PROVIDERS.find((x) => x.id === p)?.name ?? (p === "mock" ? "Simulado" : p);

/**
 * Ajustes → Proveedores de IA (SOLO cuentas propietarias; el servidor también lo impide).
 * Explica de dónde sale cada respuesta y deja probar el cerebro en directo.
 */
export function AIProvidersManager({ locked = false }: { locked?: boolean }) {
  const { engine } = useSync();
  const { rows } = useTable("ai_provider_keys", { sort: (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) });
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<AIProvider>("anthropic");
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<{ provider: string; model: string | null } | null>(null);
  const [server, setServer] = useState<{ chain: string[]; geminiModel: string } | null>(null);
  const [test, setTest] = useState<{ state: "idle" | "busy" | "done"; text?: string; provider?: string; model?: string; ms?: number }>({ state: "idle" });

  useEffect(() => {
    void apiJson<{ chain: string[]; geminiModel: string }>("/api/ai/status")
      .then(setServer)
      .catch(() => setServer(null));
  }, []);

  const runTest = async () => {
    setTest({ state: "busy" });
    const t0 = performance.now();
    try {
      const r = await apiJson<{ reply: string; provider: string; model?: string }>("/api/brain", {
        method: "POST",
        body: JSON.stringify({ message: "Prueba de conexión: responde solo «Funcionando, hermano.»", history: [] }),
      });
      setTest({ state: "done", text: r.reply, provider: r.provider, model: r.model, ms: Math.round(performance.now() - t0) });
    } catch {
      setTest({ state: "done", text: "No he podido conectar con el servidor.", provider: "none" });
    }
  };

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
      <p className="text-[13px] leading-relaxed text-white/60">
        Solo lo ven las cuentas propietarias. Los clientes no tienen que tocar nada: el cerebro funciona con la clave del servidor. Aquí puedes añadir claves tuyas
        para tener más cupo o probar otros modelos.
      </p>

      {/* Orden en el que se intenta responder */}
      <div className="flex flex-wrap items-center gap-1.5 text-[12px]" aria-label="Orden de proveedores">
        {rows.some((k) => k.enabled) && (
          <>
            <span className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-white/80">
              <KeyRound className="h-3.5 w-3.5" /> Tus claves ({rows.filter((k) => k.enabled).length})
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-white/30" />
          </>
        )}
        {(server?.chain.length ? server.chain : ["gemini"]).map((p, i, all) => (
          <span key={p} className="flex items-center gap-1.5">
            <span className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 ${server?.chain.length ? "bg-arc/10 text-arc" : "bg-white/[0.04] text-white/40"}`}>
              <Server className="h-3.5 w-3.5" /> {p === "gemini" ? "Gemini del servidor" : "Claude del servidor"}
            </span>
            {i < all.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-white/30" />}
          </span>
        ))}
      </div>
      {server && server.chain.length === 0 && (
        <p className="text-[12px] text-amber-200/80">El servidor no tiene clave: falta GEMINI_API_KEY en Vercel (ahora responde el cerebro simulado).</p>
      )}
      <p className="text-xs leading-relaxed text-white/45">
        Si una opción falla o se queda sin cupo, salto a la siguiente sin que se note.{server?.geminiModel ? ` Modelo de Gemini: ${server.geminiModel}.` : ""}
      </p>

      <div className="flex items-center gap-2 rounded-2xl bg-arc/10 px-3 py-2.5 text-sm">
        <Zap className="h-4 w-4 shrink-0 text-arc" />
        <span className="flex-1 text-white/80">
          Última respuesta: <b className="text-white">{active ? providerName(active.provider) : "aún ninguna"}</b>
          {active?.model ? <span className="text-white/45"> · {active.model}</span> : null}
        </span>
        <button onClick={() => void runTest()} disabled={test.state === "busy"} aria-label="Probar el cerebro" title="Probar el cerebro" className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs hover:bg-white/15">
          {test.state === "busy" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Probar
        </button>
      </div>
      {test.state === "done" && (
        <p role="status" className="rounded-2xl bg-white/[0.04] px-3 py-2.5 text-[13px] text-white/75">
          «{test.text}»
          <span className="block text-[11px] text-white/40">
            {test.provider === "mock"
              ? "Cerebro simulado (sin clave en el servidor)"
              : test.provider === "none"
                ? "Ningún proveedor respondió"
                : `${providerName(test.provider ?? "")}${test.model ? ` · ${test.model}` : ""}`}
            {test.ms ? ` · ${(test.ms / 1000).toFixed(1)} s` : ""}
          </span>
        </p>
      )}

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
        <Plus className="h-4 w-4" /> Añadir una clave propia
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Añadir proveedor">
        <div className="flex flex-col gap-3">
          <GlassSelect<AIProvider> ariaLabel="Proveedor" value={provider} onChange={setProvider} options={AI_PROVIDERS.map((p) => ({ value: p.id, label: p.name }))} />
          <input
            className="jv-input font-mono"
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
