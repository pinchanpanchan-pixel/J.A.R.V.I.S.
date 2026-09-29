"use client";
import { useCallback, useRef, useState } from "react";
import { useSync } from "@/components/providers/SyncProvider";
import { useProfile } from "@/hooks/useProfile";
import { apiJson } from "@/lib/api";
import { searchItems } from "@/lib/search";

export interface BrainReply {
  reply: string;
  provider: string;
  action?: { type: string; [k: string]: unknown } | null;
}

/** Conversación con el cerebro: guarda los mensajes (sincronizados) y recupera memorias relevantes. */
export function useBrain() {
  const { engine } = useSync();
  const { userName, assistantName } = useProfile();
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const send = useCallback(
    async (text: string, opts: { source?: "text" | "voice" } = {}): Promise<BrainReply | null> => {
      const message = text.trim();
      if (!engine || !message || busy.current) return null;
      busy.current = true;
      setThinking(true);
      setError(null);
      try {
        await engine.insert("chat_messages", { role: "user", content: message, provider: null, metadata: { source: opts.source ?? "text" } });
        const history = (await engine.list("chat_messages"))
          .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
          .slice(-13, -1)
          .filter((m) => m.role !== "system")
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
        const memories = searchItems(await engine.list("memory_blocks"), message, 5).map((m) => `${m.title}: ${m.content}`.slice(0, 500));
        const res = await apiJson<BrainReply>("/api/brain", {
          method: "POST",
          body: JSON.stringify({ message, history, context: { userName, assistantName, memories } }),
        });
        await engine.insert("chat_messages", { role: "assistant", content: res.reply, provider: res.provider, metadata: res.action ? { action: res.action } : {} });
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
    [engine, userName, assistantName],
  );

  return { send, thinking, error };
}
