// Recordatorio del diario (pg_cron cada 5 min): a la hora elegida, si hoy no hay entrada → push.
import { admin, authorized, json } from "../_shared/admin.ts";
import { pushToUser } from "../_shared/push.ts";
import { zonedParts } from "../_shared/core/cron.ts";

Deno.serve(async (req) => {
  if (!authorized(req)) return json({ error: "unauthorized" }, 401);
  const sb = admin();
  const { data: users, error } = await sb
    .from("users")
    .select("id, timezone, diary_reminder_time, diary_reminded_on, subscription, is_owner")
    .not("diary_reminder_time", "is", null)
    .is("deleted_at", null);
  if (error) return json({ error: error.message }, 500);

  let sent = 0;
  const now = new Date();
  for (const u of users ?? []) {
    if (u.subscription === "free" && !u.is_owner) continue; // diario: de pago
    const tz = u.timezone || "UTC";
    const p = zonedParts(now, tz);
    const today = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
    if (u.diary_reminded_on === today) continue;
    const [h, m] = String(u.diary_reminder_time).split(":").map(Number);
    const minutesNow = p.hour * 60 + p.minute;
    if (minutesNow < h * 60 + m || minutesNow > h * 60 + m + 30) continue; // ventana de 30 min
    const { count } = await sb.from("diary_entries").select("id", { count: "exact", head: true }).eq("user_id", u.id).eq("entry_date", today).is("deleted_at", null);
    if ((count ?? 0) > 0) continue;
    const { data: core } = await sb.from("user_core_memory").select("user_name").eq("user_id", u.id).maybeSingle();
    const name = core?.user_name || "Hermano";
    sent += await pushToUser(sb, u.id, { title: "J.A.R.V.I.S.", body: `${name}, ¿cómo fue hoy?`, url: "/diary?write=1", tag: "diary" });
    await sb.from("users").update({ diary_reminded_on: today }).eq("id", u.id);
  }
  return json({ ok: true, sent });
});
