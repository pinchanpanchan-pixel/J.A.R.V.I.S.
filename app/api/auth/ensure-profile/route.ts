import { NextResponse } from "next/server";
import { z } from "zod";
import { isMockMode } from "@/lib/env";
import { getSupabaseAdmin, getSupabaseServer } from "@/lib/supabase/server";
import { computeOwnerProfile, ensureProfile } from "@/lib/auth/ensureProfile";

export const dynamic = "force-dynamic";

const MockBody = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  if (isMockMode) {
    const parsed = MockBody.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    return NextResponse.json(computeOwnerProfile(parsed.data.email));
  }

  const sb = getSupabaseServer();
  const admin = getSupabaseAdmin();
  if (!sb || !admin) return NextResponse.json({ error: "server_not_configured" }, { status: 500 });
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await ensureProfile(admin, { id: user.id, email: user.email }));
}
