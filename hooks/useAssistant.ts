"use client";
import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSync } from "@/components/providers/SyncProvider";
import { useProfile } from "@/hooks/useProfile";
import { useBrain } from "@/hooks/useBrain";
import { useTable } from "@/hooks/useTable";
import { openQuickNote } from "@/components/QuickNote";
import { apiJson } from "@/lib/api";
import { stableId } from "@/lib/ids";
import { connectedSet, effectiveShortcuts } from "@/lib/shortcuts";
import { routeUtterance } from "@/skills";
import type { SkillContext } from "@/skills/types";

export interface AssistantReply {
  reply: string;
  via: "skill" | "brain";
  navigate?: string;
}

/**
 * El asistente completo: guarda lo que dices → atajos → skills → cerebro.
 * Lo usan el chat de texto y la voz, así que ambos se comportan igual.
 */
export function useAssistant() {
  const { engine } = useSync();
  const router = useRouter();
  const { user, userName, assistantName, features } = useProfile();
  const brain = useBrain();
  const { rows: shortcutRows } = useTable("shortcuts");
  const { rows: connectorRows } = useTable("connectors_tokens");
  const connectorsRef = useRef(connectorRows);
  connectorsRef.current = connectorRows;
  const [busy, setBusy] = useState(false);
  const shortcutsRef = useRef(shortcutRows);
  shortcutsRef.current = shortcutRows;

  const handle = useCallback(
    async (text: string, opts: { source?: "text" | "voice" } = {}): Promise<AssistantReply | null> => {
      const message = text.trim();
      if (!engine || !user || !message) return null;
      setBusy(true);
      try {
        await engine.insert("chat_messages", { role: "user", content: message, provider: null, metadata: { source: opts.source ?? "text" } });
        const loc = await engine.get("user_locations", stableId(user.id, "primary-location"));
        const ctx: SkillContext = {
          engine,
          userId: user.id,
          userName,
          assistantName,
          timezone: loc?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
          features,
          navigate: (p) => router.push(p),
          openQuickNote,
          askBrain: async (msg, extra) => (await brain.send(msg, { extra, silent: true, skipUserInsert: true }))?.reply ?? "No me llega la conexión, hermano.",
          connector: (provider, body) => apiJson(`/api/connectors/${provider}/action`, { method: "POST", body: JSON.stringify(body) }),
          now: () => new Date(),
        };
        const r = await routeUtterance(message, ctx, effectiveShortcuts(shortcutsRef.current, connectedSet(connectorsRef.current)));
        if (r) {
          if (r.reply) await engine.insert("chat_messages", { role: "assistant", content: r.reply, provider: "skill", metadata: {} });
          if (r.navigate) router.push(r.navigate);
          return { reply: r.reply, via: "skill", navigate: r.navigate };
        }
        const res = await brain.send(message, { source: opts.source, skipUserInsert: true });
        return res ? { reply: res.reply, via: "brain" } : null;
      } finally {
        setBusy(false);
      }
    },
    [engine, user, userName, assistantName, features, router, brain],
  );

  return { handle, busy: busy || brain.thinking, error: brain.error };
}
