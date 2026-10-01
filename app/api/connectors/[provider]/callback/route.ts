import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";
import { stableId } from "@/lib/ids";
import { seal } from "@/lib/crypto";
import { getSupabaseServer } from "@/lib/supabase/server";
import { connectorById } from "@/connectors/registry";
import { OAUTH, exchangeToken, fetchAccount, hueLinkBridge } from "@/connectors/apps/oauth";
import { safeReturn } from "@/lib/safeReturn";
import { syncHomeDevices } from "@/connectors/home/sync";

export const dynamic = "force-dynamic";

/**
 * Callback OAuth: valida `state`, intercambia el código, averigua la cuenta («Conectado como …»)
 * y guarda los tokens CIFRADOS. Después vuelve a donde estabas (onboarding o Ajustes).
 */
export async function GET(req: Request, { params }: { params: { provider: string } }) {
  const url = new URL(req.url);
  const jar = cookies();
  const returnTo = safeReturn(jar.get("oauth_return")?.value ?? null);
  const back = (status: string) => {
    const to = new URL(returnTo, url.origin);
    to.searchParams.set("connector", params.provider);
    to.searchParams.set("status", status);
    return NextResponse.redirect(to);
  };
  const expected = jar.get(`oauth_${params.provider}`)?.value;
  const verifier = jar.get(`oauth_pkce_${params.provider}`)?.value;
  jar.delete(`oauth_${params.provider}`);
  jar.delete(`oauth_pkce_${params.provider}`);
  jar.delete("oauth_return");
  if (!OAUTH[params.provider] || !expected || expected !== url.searchParams.get("state")) return back("invalid_state");
  const code = url.searchParams.get("code");
  if (!code) return back("denied");

  const sb = getSupabaseServer();
  const {
    data: { user },
  } = (await sb?.auth.getUser()) ?? { data: { user: null } };
  if (!sb || !user) return back("unauthorized");

  try {
    const t = await exchangeToken(params.provider, {
      grant_type: "authorization_code",
      code,
      redirect_uri: `${publicEnv.appUrl}/api/connectors/${params.provider}/callback`,
      ...(verifier ? { code_verifier: verifier } : {}),
    });
    const account = await fetchAccount(params.provider, t);
    const metadata: Record<string, unknown> = { account, workspace: (t.workspace_name as string) ?? null };
    if (params.provider === "hue") {
      metadata.username = await hueLinkBridge(t.access_token);
      if (!metadata.username) return back("hue_bridge");
    }
    const { error } = await sb.from("connectors_tokens").upsert(
      {
        id: stableId(user.id, "connector", params.provider),
        user_id: user.id,
        provider: params.provider,
        kind: connectorById(params.provider)?.kind ?? "app",
        enabled: true,
        status: "connected",
        access_token_ciphertext: seal(t.access_token, "oauth", user.id),
        refresh_token_ciphertext: t.refresh_token ? seal(t.refresh_token, "oauth", user.id) : null,
        expires_at: t.expires_in ? new Date(Date.now() + t.expires_in * 1000).toISOString() : null,
        scopes: (t.scope ?? "").split(/[ ,]/).filter(Boolean),
        metadata,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (error) return back("save_failed");
    // Hogar: se traen ya los dispositivos (no hace falta esperar a la siguiente sincronización).
    if (connectorById(params.provider)?.kind === "home") await syncHomeDevices(sb, user.id, params.provider).catch(() => 0);
    return back("connected");
  } catch {
    return back("exchange_failed");
  }
}
