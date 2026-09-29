import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { isMockMode, publicEnv } from "@/lib/env";
import { getRequestUser } from "@/lib/auth/requestUser";
import { OAUTH, oauthCredentials } from "@/connectors/apps/oauth";

export const dynamic = "force-dynamic";

/** Inicia OAuth. Devuelve la URL del proveedor (el cliente redirige). */
export async function GET(req: Request, { params }: { params: { provider: string } }) {
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const cfg = OAUTH[params.provider];
  if (!cfg) return NextResponse.json({ error: "unsupported" }, { status: 400 });
  const creds = oauthCredentials(params.provider);
  if (isMockMode || !creds) return NextResponse.json({ mock: true });

  const state = randomBytes(24).toString("base64url");
  cookies().set(`oauth_${params.provider}`, state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  const redirectUri = `${publicEnv.appUrl}/api/connectors/${params.provider}/callback`;
  const q = new URLSearchParams({
    client_id: creds.clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    state,
    ...(cfg.scopes.length ? { scope: cfg.scopes.join(" ") } : {}),
    ...cfg.extraAuthParams,
  });
  return NextResponse.json({ url: `${cfg.authUrl}?${q}` });
}
