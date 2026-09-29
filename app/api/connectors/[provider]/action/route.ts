import { NextResponse } from "next/server";
import { z } from "zod";
import { isMockMode } from "@/lib/env";
import { getRequestUser } from "@/lib/auth/requestUser";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getAccessToken } from "@/connectors/apps/tokens";
import { calendarEvents, gmailUnread, notionSearch, spotifyControl } from "@/connectors/apps/actions";

export const dynamic = "force-dynamic";

const Body = z.object({
  action: z.string().max(40),
  day: z.number().int().min(-7).max(7).optional(),
  timezone: z.string().max(60).optional(),
  query: z.string().max(200).optional(),
});

/** Acciones de conectores usadas por las skills (agenda, correo, música, Notion). */
export async function POST(req: Request, { params }: { params: { provider: string } }) {
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { action, day = 0, timezone = "UTC", query = "" } = parsed.data;

  let token: string | null = null;
  if (!isMockMode) {
    const sb = getSupabaseServer();
    if (sb) token = await getAccessToken(sb, user.id, params.provider).catch(() => null);
  }
  try {
    switch (`${params.provider}:${action}`) {
      case "google_calendar:events":
        return NextResponse.json(await calendarEvents(token, day, timezone));
      case "gmail:unread":
        return NextResponse.json(await gmailUnread(token));
      case "spotify:play":
      case "spotify:pause":
      case "spotify:next":
      case "spotify:previous":
        return NextResponse.json(await spotifyControl(token, action as "play"));
      case "notion:search":
        return NextResponse.json(await notionSearch(token, query));
      default:
        return NextResponse.json({ error: "unsupported_action" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 502 });
  }
}
