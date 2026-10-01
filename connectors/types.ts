import type { ConnectorTokenRow } from "@/types/db";

/**
 * Arquitectura de conectores: cada integración implementa un adaptador con
 * connect / sync / disconnect. Los tokens se guardan cifrados en connectors_tokens
 * y se sincronizan entre dispositivos.
 */
export type ConnectorKind = "app" | "home";

/**
 *  oauth         — Inicio de sesión real con la app (Google, Spotify, Notion, Microsoft…)
 *  ios_shortcut  — Apps de Apple vía un Atajo de iOS ya hecho (una web no tiene acceso directo)
 *  import        — No es una cuenta: subes tú los archivos (fotos, chats de WhatsApp)
 *  api_key       — Clave que da la app del fabricante (Govee, Tuya)
 *  link          — No necesita cuenta: J.A.R.V.I.S. abre la app (Google Maps)
 *  unavailable   — El fabricante aún no deja conectarse desde una web (Alexa, Google Home)
 */
export type AuthMethod = "oauth" | "ios_shortcut" | "import" | "api_key" | "link" | "unavailable";

export interface ConnectorMeta {
  id: string;
  name: string;
  kind: ConnectorKind;
  auth: AuthMethod;
  color: string;
  glyph: string; // letra/símbolo de respaldo si no hay logo
  /** Qué podrá hacer J.A.R.V.I.S. con ella (se ve en la ficha de la app). */
  description: string;
  scopes?: string[];
  /** Explicación cuando la integración tiene limitaciones (se ve en la ficha, no en la rejilla). */
  note?: string;
  /** Cuenta OAuth compartida (todas las apps de Google usan «google»; Outlook y OneDrive, «microsoft»). */
  account?: "google" | "microsoft";
  /** Palabras extra para el buscador. */
  keywords?: string[];
  /** Campos de la clave (api_key). */
  keyFields?: Array<{ id: string; label: string; placeholder?: string; secret?: boolean; options?: Array<{ value: string; label: string }> }>;
  /** Dónde se consigue la clave / cómo se hace (api_key). */
  keyHelp?: string;
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
