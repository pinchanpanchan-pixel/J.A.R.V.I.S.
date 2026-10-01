"use client";
import { useCallback, useRef, useState } from "react";
import { useSync } from "@/components/providers/SyncProvider";
import { useProfile } from "@/hooks/useProfile";
import { apiJson } from "@/lib/api";
import { recallMemories } from "@/lib/brain/recall";
import { isMockMode } from "@/lib/env";
import { stableId } from "@/lib/ids";
import type { ProviderAttempt } from "@/lib/ai/types";

export interface BrainReply {
  reply: string;
  provider: string;
  keyId?: string | null;
  model?: string;
  attempts?: ProviderAttempt[];
}

export const ACTIVE_PROVIDER_KEY = "jarvis.activeProvider";

/** Conversación con el cerebro: guarda los mensajes (sincronizados) y recupera memorias relevantes. */
export function useBrain() {
  const { engine } = useSync();
  const { userName, assistantName, core, user } = useProfile();
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const send = useCallback(
    async (
      text: string,
      opts: { source?: "text" | "voice"; extra?: string; silent?: boolean; skipUserInsert?: boolean } = {},
    ): Promise<BrainReply | null> => {
      const message = text.trim();
      if (!engine || !message || busy.current) return null;
      busy.current = true;
      setThinking(true);
      setError(null);
      try {
        if (!opts.skipUserInsert) {
          await engine.insert("chat_messages", { role: "user", content: message, provider: null, metadata: { source: opts.source ?? "text" } });
        }
        const history = (await engine.list("chat_messages"))
          .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
          .slice(-13, -1)
          .filter((m) => m.role !== "system")
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
        // Antes de responder consulta su memoria: bloques, notas rápidas y diario.
        const [blocks, notes, diary] = await Promise.all([engine.list("memory_blocks"), engine.list("quick_notes"), engine.list("diary_entries")]);
        const memories = recallMemories({ blocks, notes, diary }, message);
        const keys = await engine.list("ai_provider_keys");
        const loc = user ? await engine.get("user_locations", stableId(user.id, "primary-location")) : null;
        const res = await apiJson<BrainReply>("/api/brain", {
          method: "POST",
          body: JSON.stringify({
            message,
            history,
            context: {
              userName,
              assistantName,
              memories,
              facts: (core?.facts ?? []).map((f) => f.fact).slice(-50),
              location: loc ? [loc.city, loc.state, loc.country].filter(Boolean).join(", ") || null : null,
              timezone: loc?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
              extra: opts.extra ?? null,
            },
            // Modo simulado: la BD vive en el navegador; las claves viajan CIFRADAS.
            keys: isMockMode ? keys.map((k) => ({ id: k.id, provider: k.provider, key_ciphertext: k.key_ciphertext, enabled: k.enabled })) : undefined,
          }),
        });
        await recordAttempts(engine, res);
        if (!opts.silent) {
          await engine.insert("chat_messages", { role: "assistant", content: res.reply, provider: res.provider, metadata: {} });
        }
        return res;
      } catch (e) {
        const msg = navigator.onLine ? "Se me ha cruzado un cable. Prueba otra vez, hermano." : "Sin conexión: guardo tu mensaje y te respondo al volver.";
        setError(msg);
        return null;
      } finally {
        busy.current = false;
        setThinking(false);
      }
    },
    [engine, userName, assistantName, core, user],
  );

  return { send, thinking, error };
}

/** Guarda qué proveedor respondió y anota fallos en las claves (sincronizado). */
async function recordAttempts(engine: NonNullable<ReturnType<typeof useSync>["engine"]>, res: BrainReply) {
  try {
    if (res.provider !== "none") localStorage.setItem(ACTIVE_PROVIDER_KEY, JSON.stringify({ provider: res.provider, model: res.model ?? null, at: new Date().toISOString() }));
  } catch {
    /* sin almacenamiento */
  }
  for (const a of res.attempts ?? []) {
    if (a.keyId === "owner") continue;
    const row = await engine.get("ai_provider_keys", a.keyId);
    if (!row) continue;
    await engine.update(
      "ai_provider_keys",
      a.keyId,
      a.ok
        ? { last_used_at: new Date().toISOString(), fail_count: 0, last_error: null }
        : { fail_count: row.fail_count + 1, last_error: `${a.status ?? ""} ${a.error ?? ""}`.trim().slice(0, 200) },
    );
  }
}
