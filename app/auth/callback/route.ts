import { NextResponse } from "next/server";
import { isMockMode } from "@/lib/env";
import { getSupabaseAdmin, getSupabaseServer } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensureProfile";

export const dynamic = "force-dynamic";

/** Callback OAuth (Google / Apple) y magic link de email. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = url.searchParams.get("next") ?? "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  if (isMockMode) return NextResponse.redirect(new URL(safeNext, url.origin));

  const code = url.searchParams.get("code");
  const sb = getSupabaseServer();
  if (!code || !sb) return NextResponse.redirect(new URL("/login?error=callback", url.origin));

  const { data, error } = await sb.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(new URL("/login?error=auth", url.origin));

  const admin = getSupabaseAdmin();
  if (admin && data.user.email) {
    await ensureProfile(admin, { id: data.user.id, email: data.user.email });
  }
  return NextResponse.redirect(new URL(safeNext, url.origin));
}
