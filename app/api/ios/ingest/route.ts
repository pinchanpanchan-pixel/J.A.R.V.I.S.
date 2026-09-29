import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const Item = z.object({
  title: z.string().max(300).default(""),
  content: z.string().max(20000).default(""),
  date: z.string().max(40).optional(),
});
const Body = z.object({
  type: z.enum(["note", "reminder", "contact", "event", "text"]),
  items: z.array(Item).min(1).max(500),
});

const TAG: Record<string, string> = { note: "apple-notes", reminder: "recordatorio", contact: "contacto", event: "agenda", text: "atajo" };

/**
 * Puente con las apps de Apple: un Atajo de iOS hace POST aquí con
 *   Authorization: Bearer <token personal>   y   {type, items:[{title, content, date}]}
 * Cada elemento se guarda como bloque de memoria (se sincroniza a todos los dispositivos).
 */
export async function POST(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!/^jv_[\w-]{20,}$/.test(token)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const hash = createHash("sha256").update(token).digest("hex");
  const { data: conn } = await admin.from("connectors_tokens").select("user_id, enabled").eq("provider", "ios_shortcuts").contains("metadata", { token_hash: hash }).maybeSingle();
  if (!conn?.enabled) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!rateLimit(`ios:${conn.user_id}`, 20)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const rows = parsed.data.items.map((it) => {
    const d = it.date ? new Date(it.date) : null;
    return {
      user_id: conn.user_id,
      title: it.title || it.content.slice(0, 60),
      content: it.content || it.title,
      tags: [TAG[parsed.data.type], "ios"],
      source: "import" as const,
      original_date: d && !Number.isNaN(d.getTime()) ? d.toISOString() : null,
      metadata: { via: "ios_shortcut", type: parsed.data.type },
    };
  });
  const { error } = await admin.from("memory_blocks").insert(rows);
  if (error) return NextResponse.json({ error: "save_failed" }, { status: 500 });
  await admin.from("connectors_tokens").update({ last_synced_at: new Date().toISOString() }).eq("user_id", conn.user_id).eq("provider", "ios_shortcuts");
  return NextResponse.json({ ok: true, saved: rows.length });
}
