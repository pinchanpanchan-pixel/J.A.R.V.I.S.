import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { secret } from "@/lib/serverEnv";
import { connectorById } from "../registry";

/**
 * OAuth por conector. Las apps de Google comparten un cliente (GOOGLE_CLIENT_ID) y cada una
 * pide solo su permiso (con include_granted_scopes se acumulan). Outlook y OneDrive
 * comparten el de Microsoft. Las variables de cada uno están en docs/CONNECTORS.md.
 */
export interface OAuthProviderConfig {
  authUrl: string;
  tokenUrl: string;
  clientIdEnv: string;
  clientSecretEnv: string;
  scopes: string[];
  /** Strava y Todoist separan los permisos con comas. */
  scopeSeparator?: string;
  extraAuthParams?: Record<string, string>;
  /** Client ID + secret en cabecera Basic al intercambiar el código. */
  basicAuth?: boolean;
  /** PKCE obligatorio (Canva). */
  pkce?: boolean;
}

const scopesOf = (id: string) => connectorById(id)?.scopes ?? [];

const GOOGLE = {
  authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  clientIdEnv: "GOOGLE_CLIENT_ID",
  clientSecretEnv: "GOOGLE_CLIENT_SECRET",
  extraAuthParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
};
const MICROSOFT = {
  authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
  tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
  clientIdEnv: "MICROSOFT_CLIENT_ID",
  clientSecretEnv: "MICROSOFT_CLIENT_SECRET",
  extraAuthParams: { prompt: "select_account" },
};

export const OAUTH: Record<string, OAuthProviderConfig> = {
  google_calendar: { ...GOOGLE, scopes: scopesOf("google_calendar") },
  gmail: { ...GOOGLE, scopes: scopesOf("gmail") },
  google_drive: { ...GOOGLE, scopes: scopesOf("google_drive") },
  google_docs: { ...GOOGLE, scopes: scopesOf("google_docs") },
  google_sheets: { ...GOOGLE, scopes: scopesOf("google_sheets") },
  google_slides: { ...GOOGLE, scopes: scopesOf("google_slides") },
  youtube: { ...GOOGLE, scopes: scopesOf("youtube") },
  outlook: { ...MICROSOFT, scopes: scopesOf("outlook") },
  onedrive: { ...MICROSOFT, scopes: scopesOf("onedrive") },
  spotify: {
    authUrl: "https://accounts.spotify.com/authorize",
    tokenUrl: "https://accounts.spotify.com/api/token",
    clientIdEnv: "SPOTIFY_CLIENT_ID",
    clientSecretEnv: "SPOTIFY_CLIENT_SECRET",
    scopes: scopesOf("spotify"),
    basicAuth: true,
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
  canva: {
    authUrl: "https://www.canva.com/api/oauth/authorize",
    tokenUrl: "https://api.canva.com/rest/v1/oauth/token",
    clientIdEnv: "CANVA_CLIENT_ID",
    clientSecretEnv: "CANVA_CLIENT_SECRET",
    scopes: scopesOf("canva"),
    basicAuth: true,
    pkce: true,
  },
  todoist: {
    authUrl: "https://todoist.com/oauth/authorize",
    tokenUrl: "https://todoist.com/oauth/access_token",
    clientIdEnv: "TODOIST_CLIENT_ID",
    clientSecretEnv: "TODOIST_CLIENT_SECRET",
    scopes: scopesOf("todoist"),
    scopeSeparator: ",",
  },
  strava: {
    authUrl: "https://www.strava.com/oauth/authorize",
    tokenUrl: "https://www.strava.com/oauth/token",
    clientIdEnv: "STRAVA_CLIENT_ID",
    clientSecretEnv: "STRAVA_CLIENT_SECRET",
    scopes: scopesOf("strava"),
    scopeSeparator: ",",
    extraAuthParams: { approval_prompt: "auto" },
  },
  hue: {
    authUrl: "https://api.meethue.com/v2/oauth2/authorize",
    tokenUrl: "https://api.meethue.com/v2/oauth2/token",
    clientIdEnv: "HUE_CLIENT_ID",
    clientSecretEnv: "HUE_CLIENT_SECRET",
    scopes: [],
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

/** Qué conectores tienen credenciales en el servidor (para enseñar «Pronto» en los que no). */
export function configuredProviders(): string[] {
  return Object.keys(OAUTH).filter((p) => !!oauthCredentials(p));
}

export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(48).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

/** URL de inicio de sesión del proveedor. */
export function authorizeUrl(provider: string, opts: { clientId: string; redirectUri: string; state: string; codeChallenge?: string }): string {
  const cfg = OAUTH[provider];
  const q = new URLSearchParams({
    client_id: opts.clientId,
    response_type: "code",
    redirect_uri: opts.redirectUri,
    state: opts.state,
    ...(cfg.scopes.length ? { scope: cfg.scopes.join(cfg.scopeSeparator ?? " ") } : {}),
    ...(opts.codeChallenge ? { code_challenge: opts.codeChallenge, code_challenge_method: "S256" } : {}),
    ...cfg.extraAuthParams,
  });
  return `${cfg.authUrl}?${q}`;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  [k: string]: unknown;
}

export async function exchangeToken(provider: string, params: Record<string, string>, fetchImpl: typeof fetch = fetch): Promise<TokenResponse> {
  const cfg = OAUTH[provider];
  const creds = oauthCredentials(provider);
  if (!cfg || !creds) throw new Error("oauth_not_configured");
  const body = new URLSearchParams(params);
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded", accept: "application/json" };
  if (cfg.basicAuth) {
    headers.authorization = `Basic ${Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64")}`;
  } else {
    body.set("client_id", creds.clientId);
    body.set("client_secret", creds.clientSecret);
  }
  const res = await fetchImpl(cfg.tokenUrl, { method: "POST", headers, body, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`token_exchange_${res.status}`);
  return (await res.json()) as TokenResponse;
}

/**
 * «Conectado como …»: nombre o email de la cuenta, con el token recién obtenido.
 * Si el proveedor no responde, devuelve null (se verá «Conectado»).
 */
export async function fetchAccount(provider: string, t: TokenResponse, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const get = async (url: string, init: RequestInit = {}) => {
    const res = await fetchImpl(url, { ...init, headers: { authorization: `Bearer ${t.access_token}`, ...((init.headers as Record<string, string>) ?? {}) }, signal: AbortSignal.timeout(8000) });
    return res.ok ? ((await res.json()) as Record<string, unknown>) : null;
  };
  try {
    if (OAUTH[provider]?.clientIdEnv === "GOOGLE_CLIENT_ID") return ((await get("https://openidconnect.googleapis.com/v1/userinfo"))?.email as string) ?? null;
    if (OAUTH[provider]?.clientIdEnv === "MICROSOFT_CLIENT_ID") {
      const me = await get("https://graph.microsoft.com/v1.0/me");
      return ((me?.mail ?? me?.userPrincipalName) as string) ?? null;
    }
    switch (provider) {
      case "spotify": {
        const me = await get("https://api.spotify.com/v1/me");
        return ((me?.email ?? me?.display_name) as string) ?? null;
      }
      case "notion": {
        const owner = t.owner as { user?: { name?: string; person?: { email?: string } } } | undefined;
        return owner?.user?.person?.email ?? owner?.user?.name ?? (t.workspace_name as string) ?? null;
      }
      case "canva": {
        const p = (await get("https://api.canva.com/rest/v1/users/me/profile"))?.profile as { display_name?: string } | undefined;
        return p?.display_name ?? null;
      }
      case "todoist": {
        const j = await get("https://api.todoist.com/sync/v9/sync", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ sync_token: "*", resource_types: '["user"]' }),
        });
        const u = j?.user as { email?: string; full_name?: string } | undefined;
        return u?.email ?? u?.full_name ?? null;
      }
      case "strava": {
        const a = t.athlete as { firstname?: string; lastname?: string } | undefined;
        return a ? `${a.firstname ?? ""} ${a.lastname ?? ""}`.trim() || null : null;
      }
      case "hue":
        return "tu puente Philips Hue";
    }
  } catch {
    /* sin identidad: «Conectado» a secas */
  }
  return null;
}

/**
 * Hue Remote API: tras el OAuth hay que «pulsar» el botón del puente en remoto y crear un
 * usuario de la aplicación (username) para poder controlar las luces.
 */
export async function hueLinkBridge(accessToken: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const base = "https://api.meethue.com/route/api";
  const headers = { authorization: `Bearer ${accessToken}`, "content-type": "application/json" };
  await fetchImpl(`${base}/0/config`, { method: "PUT", headers, body: JSON.stringify({ linkbutton: true }) }).catch(() => null);
  const res = await fetchImpl(base, { method: "POST", headers, body: JSON.stringify({ devicetype: "jarvis#web" }) }).catch(() => null);
  if (!res?.ok) return null;
  const j = (await res.json()) as Array<{ success?: { username?: string } }>;
  return j.find((x) => x.success?.username)?.success?.username ?? null;
}
