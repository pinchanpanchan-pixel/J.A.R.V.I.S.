"use client";
import { apiJson } from "@/lib/api";
import { APP_CONNECTORS } from "../registry";
import type { ConnectorAdapter, ConnectorContext, ConnectResult, SyncResult } from "../types";

/**
 * Adaptadores de apps (cliente). Todos cumplen connect / sync / disconnect:
 *  - oauth:        redirige al proveedor; los tokens se guardan cifrados en el servidor.
 *  - ios_shortcut: las apps de Apple envían datos con un Atajo de iOS (token personal).
 *  - import:       importación de archivos (WhatsApp, fotos).
 */
function oauthAdapter(id: string): ConnectorAdapter {
  const meta = APP_CONNECTORS.find((c) => c.id === id)!;
  return {
    meta,
    async connect(ctx: ConnectorContext): Promise<ConnectResult> {
      if (ctx.mock) return { status: "mock" };
      const r = await apiJson<{ url?: string; mock?: boolean }>(`/api/connectors/${id}/start`);
      return r.url ? { status: "pending", redirectUrl: r.url } : { status: "mock" };
    },
    async sync(): Promise<SyncResult> {
      if (id === "google_calendar") {
        const r = await apiJson<{ events: unknown[] }>(`/api/connectors/${id}/action`, { method: "POST", body: JSON.stringify({ action: "events", day: 0, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }) });
        return { items: r.events.length };
      }
      if (id === "gmail") {
        const r = await apiJson<{ emails: unknown[] }>(`/api/connectors/${id}/action`, { method: "POST", body: JSON.stringify({ action: "unread" }) });
        return { items: r.emails.length };
      }
      return { items: 0 };
    },
    async disconnect() {
      await apiJson(`/api/connectors/${id}/disconnect`, { method: "POST" });
    },
  };
}

function shortcutAdapter(id: string): ConnectorAdapter {
  const meta = APP_CONNECTORS.find((c) => c.id === id)!;
  return {
    meta,
    async connect(): Promise<ConnectResult> {
      return { status: "pending", redirectUrl: "/settings#atajos-ios" };
    },
    async sync() {
      return { items: 0, message: "Los datos llegan cuando ejecutas el Atajo de iOS." };
    },
    async disconnect() {
      /* revocar el token personal desde Ajustes */
    },
  };
}

function importAdapter(id: string, path: string): ConnectorAdapter {
  const meta = APP_CONNECTORS.find((c) => c.id === id)!;
  return {
    meta,
    async connect() {
      return { status: "connected", redirectUrl: path };
    },
    async sync() {
      return { items: 0 };
    },
    async disconnect() {},
  };
}

export const APP_ADAPTERS: Record<string, ConnectorAdapter> = {
  notion: oauthAdapter("notion"),
  google_calendar: oauthAdapter("google_calendar"),
  gmail: oauthAdapter("gmail"),
  google_drive: oauthAdapter("google_drive"),
  spotify: oauthAdapter("spotify"),
  apple_calendar: shortcutAdapter("apple_calendar"),
  apple_reminders: shortcutAdapter("apple_reminders"),
  apple_notes: shortcutAdapter("apple_notes"),
  apple_contacts: shortcutAdapter("apple_contacts"),
  apple_passwords: shortcutAdapter("apple_passwords"),
  photos: importAdapter("photos", "/memories?photo=1"),
  whatsapp_import: importAdapter("whatsapp_import", "/settings#importar"),
};
