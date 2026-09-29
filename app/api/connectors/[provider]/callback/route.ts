import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";
import { stableId } from "@/lib/ids";
import { seal } from "@/lib/crypto";
import { getSupabaseServer } from "@/lib/supabase/server";
import { exchangeToken, OAUTH } from "@/connectors/apps/oauth";

export const dynamic = "force-dynamic";

/** Callback OAuth: valida `state`, intercambia el código y guarda los tokens CIFRADOS. */
export async function GET(req: Request, { params }: { params: { provider: string } }) {
  const url = new URL(req.url);
  const back = (status: string) => NextResponse.redirect(new URL(`/settings?connector=${params.provider}&status=${status}#conexiones`, url.origin));
  const expected = cookies().get(`oauth_${params.provider}`)?.value;
  cookies().delete(`oauth_${params.provider}`);
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
    });
    const { error } = await sb.from("connectors_tokens").upsert(
      {
        id: stableId(user.id, "connector", params.provider),
        user_id: user.id,
        provider: params.provider,
        kind: "app",
        enabled: true,
        status: "connected",
        access_token_ciphertext: seal(t.access_token, "oauth", user.id),
        refresh_token_ciphertext: t.refresh_token ? seal(t.refresh_token, "oauth", user.id) : null,
        expires_at: t.expires_in ? new Date(Date.now() + t.expires_in * 1000).toISOString() : null,
        scopes: (t.scope ?? "").split(/[ ,]/).filter(Boolean),
        metadata: { workspace: t.workspace_name ?? null },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    return back(error ? "save_failed" : "connected");
  } catch {
    return back("exchange_failed");
  }
}
