"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSync } from "@/components/providers/SyncProvider";
import { useProfile } from "@/hooks/useProfile";
import { useTable } from "@/hooks/useTable";
import { apiJson } from "@/lib/api";
import { isMockMode, publicEnv } from "@/lib/env";
import { nowIso, stableId } from "@/lib/ids";
import { MOCK_DEVICES } from "@/connectors/home/mockDevices";
import type { ConnectorMeta } from "@/connectors/types";
import type { ConnectorTokenRow } from "@/types/db";
import type { AnyRow } from "@/lib/sync/remote";

export type ConnectorState = "connected" | "off" | "import" | "link" | "unavailable";

export interface ConnectorView {
  state: ConnectorState;
  /** «Conectado como …» */
  account: string | null;
  row: ConnectorTokenRow | null;
}

let statusCache: Promise<{ mock: boolean; configured: string[] }> | null = null;
const serverStatus = () => (statusCache ??= apiJson<{ mock: boolean; configured: string[] }>("/api/connectors/status").catch(() => ({ mock: isMockMode, configured: [] })));

/**
 * Estado y acciones de las conexiones (apps y hogar).
 *  - OAuth real: se abre el inicio de sesión del proveedor y al volver se ve «Conectado como …».
 *  - Modo simulado: se marca como conectado de prueba (como haría el servidor).
 */
export function useConnectors() {
  const { rows } = useTable("connectors_tokens");
  const { engine, mockCloud } = useSync();
  const { user } = useProfile();
  const [configured, setConfigured] = useState<Set<string> | null>(null);

  useEffect(() => {
    void serverStatus().then((s) => setConfigured(new Set(s.configured)));
  }, []);

  const byProvider = useMemo(() => new Map(rows.map((r) => [r.provider, r])), [rows]);

  const view = useCallback(
    (c: ConnectorMeta): ConnectorView => {
      const row = byProvider.get(c.id) ?? null;
      const account = ((row?.metadata as { account?: string } | null)?.account as string) ?? null;
      if (c.auth === "import") return { state: "import", account: null, row };
      if (c.auth === "link") return { state: "link", account: null, row };
      if (c.auth === "unavailable") return { state: "unavailable", account: null, row };
      const on = !!row?.enabled && (row.status === "connected" || (isMockMode && row.status === "mock"));
      return { state: on ? "connected" : "off", account: on ? account : null, row };
    },
    [byProvider],
  );

  /** ¿Está listo el inicio de sesión de este proveedor en el servidor? (null = aún no se sabe) */
  const isConfigured = useCallback((c: ConnectorMeta) => (isMockMode ? true : configured ? configured.has(c.id) : null), [configured]);

  /** Fila escrita «como el servidor» en modo simulado. */
  const mockWrite = useCallback(
    async (c: ConnectorMeta, patch: Partial<ConnectorTokenRow>) => {
      if (!mockCloud || !user) return;
      const id = stableId(user.id, "connector", c.id);
      const prev = (await mockCloud.getRow("connectors_tokens", id)) as AnyRow | null;
      await mockCloud.pushAsBackend("connectors_tokens", {
        ...(prev ?? { id, user_id: user.id, provider: c.id, kind: c.kind, scopes: [], access_token_ciphertext: null, refresh_token_ciphertext: null, expires_at: null, last_synced_at: null, created_at: nowIso() }),
        ...patch,
        updated_at: nowIso(),
      } as AnyRow);
    },
    [mockCloud, user],
  );

  /** Inicia sesión con la app. Devuelve "redirect" (se va al proveedor), "done" o "not_configured". */
  const connect = useCallback(
    async (c: ConnectorMeta, returnTo: string): Promise<"redirect" | "done" | "not_configured" | "error"> => {
      if (isMockMode) {
        await mockWrite(c, { enabled: true, status: "mock", metadata: { account: `${user?.email ?? "tu cuenta"} (prueba)` } });
        return "done";
      }
      try {
        const r = await apiJson<{ url?: string; configured?: boolean }>(`/api/connectors/${c.id}/start?return=${encodeURIComponent(returnTo)}`);
        if (r.url) {
          window.location.href = r.url;
          return "redirect";
        }
        return r.configured === false ? "not_configured" : "error";
      } catch {
        return "error";
      }
    },
    [mockWrite, user?.email],
  );

  const disconnect = useCallback(
    async (c: ConnectorMeta) => {
      if (isMockMode) {
        await mockWrite(c, { enabled: false, status: "disconnected", metadata: {} });
        return;
      }
      await apiJson(`/api/connectors/${c.id}/disconnect`, { method: "POST" }).catch(() => null);
      // Al momento en este dispositivo (el servidor ya borró los tokens)
      if (engine && user) await engine.upsert("connectors_tokens", stableId(user.id, "connector", c.id), { provider: c.id, kind: c.kind, enabled: false, status: "disconnected" });
    },
    [engine, mockWrite, user],
  );

  /** Govee / Tuya: guarda la clave (el servidor la comprueba leyendo tus dispositivos). */
  const saveKey = useCallback(
    async (c: ConnectorMeta, fields: Record<string, string>): Promise<{ ok: boolean; devices?: number; error?: string }> => {
      try {
        const r = await apiJson<{ ok: boolean; devices: number; mock?: boolean }>(`/api/connectors/${c.id}/key`, { method: "POST", body: JSON.stringify({ fields }) });
        if (r.mock && engine && user) {
          const demo = MOCK_DEVICES.filter((d) => d.provider === c.id);
          for (const d of demo) await engine.upsert("smart_home_devices", stableId(user.id, d.provider, d.external_id), { ...d, online: true });
          await mockWrite(c, { enabled: true, status: "mock", metadata: { account: `${demo.length} dispositivos (prueba)` } });
          return { ok: true, devices: demo.length };
        }
        return { ok: true, devices: r.devices };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        return { ok: false, error: /invalid_key|400/.test(msg) ? "invalid_key" : "error" };
      }
    },
    [engine, mockWrite, user],
  );

  /**
   * Apps de Apple: copia tu código personal y abre el Atajo «J.A.R.V.I.S.» de iCloud.
   * Al añadirlo, el iPhone te pide pegar el código (ya está en el portapapeles).
   */
  const addIosShortcut = useCallback(async (): Promise<"opened" | "copied" | "not_published" | "error"> => {
    try {
      const { token } = await apiJson<{ token: string }>("/api/ios/token", { method: "POST" });
      await navigator.clipboard?.writeText(token).catch(() => undefined);
      if (!publicEnv.iosShortcutUrl) return "not_published";
      window.location.href = publicEnv.iosShortcutUrl;
      return "opened";
    } catch {
      return "error";
    }
  }, []);

  return { view, isConfigured, connect, disconnect, saveKey, addIosShortcut };
}
