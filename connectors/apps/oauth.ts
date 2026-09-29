import "server-only";
import { secret } from "@/lib/serverEnv";
import { APP_CONNECTORS } from "../registry";

/** Configuración OAuth por proveedor. Google cubre Calendar, Gmail y Drive (scopes distintos). */
export interface OAuthProviderConfig {
  authUrl: string;
  tokenUrl: string;
  clientIdEnv: string;
  clientSecretEnv: string;
  scopes: string[];
  extraAuthParams?: Record<string, string>;
  /** Notion usa Basic auth en el intercambio de código. */
  basicAuth?: boolean;
}

const GOOGLE = {
  authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  clientIdEnv: "GOOGLE_CLIENT_ID",
  clientSecretEnv: "GOOGLE_CLIENT_SECRET",
  extraAuthParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
};

export const OAUTH: Record<string, OAuthProviderConfig> = {
  google_calendar: { ...GOOGLE, scopes: APP_CONNECTORS.find((c) => c.id === "google_calendar")!.scopes! },
  gmail: { ...GOOGLE, scopes: APP_CONNECTORS.find((c) => c.id === "gmail")!.scopes! },
  google_drive: { ...GOOGLE, scopes: APP_CONNECTORS.find((c) => c.id === "google_drive")!.scopes! },
  spotify: {
    authUrl: "https://accounts.spotify.com/authorize",
    tokenUrl: "https://accounts.spotify.com/api/token",
    clientIdEnv: "SPOTIFY_CLIENT_ID",
    clientSecretEnv: "SPOTIFY_CLIENT_SECRET",
    scopes: APP_CONNECTORS.find((c) => c.id === "spotify")!.scopes!,
  },
  notion: {
    authUrl: "https://api.notion.com/v1/oauth/authorize",
    tokenUrl: "https://api.notion.com/v1/oauth/token",
    clientIdEnv: "NOTION_CLIENT_ID",
    clientSecretEnv: "NOTION_CLIENT_SECRET",
    scopes: [],
    extraAuthParams: { owner: "user" },
    basicAuth: true,
  },
};

export function oauthCredentials(provider: string): { clientId: string; clientSecret: string } | null {
  const cfg = OAUTH[provider];
  if (!cfg) return null;
  const clientId = secret(cfg.clientIdEnv);
  const clientSecret = secret(cfg.clientSecretEnv);
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export async function exchangeToken(provider: string, params: Record<string, string>): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  [k: string]: unknown;
}> {
  const cfg = OAUTH[provider];
  const creds = oauthCredentials(provider);
  if (!cfg || !creds) throw new Error("oauth_not_configured");
  const body = new URLSearchParams(params);
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded" };
  if (cfg.basicAuth || provider === "spotify") {
    headers.authorization = `Basic ${Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64")}`;
  } else {
    body.set("client_id", creds.clientId);
    body.set("client_secret", creds.clientSecret);
  }
  const res = await fetch(cfg.tokenUrl, { method: "POST", headers, body, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`token_exchange_${res.status}`);
  return res.json();
}
