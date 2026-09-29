import type { ConnectorTokenRow } from "@/types/db";

/**
 * Arquitectura de conectores: cada integración implementa un adaptador con
 * connect / sync / disconnect. Los tokens se guardan cifrados en connectors_tokens
 * y se sincronizan entre dispositivos.
 */
export type ConnectorKind = "app" | "home";

/**
 *  oauth         — OAuth estándar (Google, Notion, Spotify…)
 *  ios_shortcut  — Apps de Apple vía Atajos de iOS (una PWA no tiene acceso directo)
 *  import        — Importación de archivos (WhatsApp, fotos)
 *  api_key       — Clave/token del usuario (Govee, Hue local…)
 *  native_only   — Requiere la futura app nativa
 */
export type AuthMethod = "oauth" | "ios_shortcut" | "import" | "api_key" | "native_only";

export interface ConnectorMeta {
  id: string;
  name: string;
  kind: ConnectorKind;
  auth: AuthMethod;
  color: string;
  glyph: string; // letra/símbolo del logo
  description: string;
  scopes?: string[];
  /** Explicación cuando la integración tiene limitaciones en iOS/PWA. */
  note?: string;
}

export interface ConnectorContext {
  userId: string;
  token: ConnectorTokenRow | null;
  mock: boolean;
}

export interface ConnectResult {
  status: ConnectorTokenRow["status"];
  /** URL a la que redirigir (OAuth) o a abrir (Atajo de iOS). */
  redirectUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface SyncResult {
  items: number;
  message?: string;
}

export interface ConnectorAdapter {
  meta: ConnectorMeta;
  connect(ctx: ConnectorContext): Promise<ConnectResult>;
  sync(ctx: ConnectorContext): Promise<SyncResult>;
  disconnect(ctx: ConnectorContext): Promise<void>;
}
