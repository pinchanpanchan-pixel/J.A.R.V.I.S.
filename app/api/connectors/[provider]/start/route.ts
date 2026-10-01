import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { isMockMode, publicEnv } from "@/lib/env";
import { getRequestUser } from "@/lib/auth/requestUser";
import { safeReturn } from "@/lib/safeReturn";
import { OAUTH, authorizeUrl, oauthCredentials, pkcePair } from "@/connectors/apps/oauth";

export const dynamic = "force-dynamic";

/**
 * Inicia el OAuth de un conector. Devuelve la URL del proveedor (el cliente redirige).
 *  { mock: true }        → modo simulado (el cliente lo marca como conectado de prueba)
 *  { configured: false } → falta la app de desarrollador de ese proveedor en Vercel
 */
export async function GET(req: Request, { params }: { params: { provider: string } }) {
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!OAUTH[params.provider]) return NextResponse.json({ error: "unsupported" }, { status: 400 });
  if (isMockMode) return NextResponse.json({ mock: true });
  const creds = oauthCredentials(params.provider);
  if (!creds) return NextResponse.json({ configured: false });

  const state = randomBytes(24).toString("base64url");
  const opts = { httpOnly: true, secure: true, sameSite: "lax" as const, maxAge: 600, path: "/" };
  cookies().set(`oauth_${params.provider}`, state, opts);
  cookies().set(`oauth_return`, safeReturn(new URL(req.url).searchParams.get("return")), opts);
  let codeChallenge: string | undefined;
  if (OAUTH[params.provider].pkce) {
    const { verifier, challenge } = pkcePair();
    cookies().set(`oauth_pkce_${params.provider}`, verifier, opts);
    codeChallenge = challenge;
  }
  const redirectUri = `${publicEnv.appUrl}/api/connectors/${params.provider}/callback`;
  return NextResponse.json({ url: authorizeUrl(params.provider, { clientId: creds.clientId, redirectUri, state, codeChallenge }) });
}
