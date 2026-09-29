// WorldMonitor en segundo plano (pg_cron cada 2 min): sismos USGS por usuario → world_alerts + push.
import { admin, authorized, json } from "../_shared/admin.ts";
import { pushToUser } from "../_shared/push.ts";
import { buildUsgsUrl, evaluateQuakes, type UsgsFeature } from "../_shared/core/worldMonitorService.ts";
import { stableId } from "../_shared/core/ids.ts";

Deno.serve(async (req) => {
  if (!authorized(req)) return json({ error: "unauthorized" }, 401);
  const sb = admin();
  const { data: rows, error } = await sb
    .from("world_monitor_settings")
    .select("*, users!inner(subscription, is_owner)")
    .eq("quake_enabled", true)
    .is("deleted_at", null);
  if (error) return json({ error: error.message }, 500);

  const cache = new Map<string, UsgsFeature[]>();
  let created = 0;
  for (const s of rows ?? []) {
    const u = (s as { users: { subscription: string; is_owner: boolean } }).users;
    if (u.subscription === "free" && !u.is_owner) continue; // WorldMonitor es de pago
    const last = s.last_checked_at ? Date.parse(s.last_checked_at) : 0;
    if (Date.now() - last < (s.check_interval_minutes ?? 2) * 60_000 - 15_000) continue;

    const { data: loc } = await sb.from("user_locations").select("lat, lng").eq("user_id", s.user_id).eq("is_primary", true).is("deleted_at", null).maybeSingle();
    if (!loc) continue;
    const { data: profile } = await sb.from("user_core_memory").select("user_name").eq("user_id", s.user_id).maybeSingle();

    const since = new Date(Math.min(Date.now() - 3600_000, last ? last - 300_000 : Date.now() - 3600_000));
    const url = buildUsgsUrl(loc, s, since);
    // Misma consulta para usuarios cercanos con los mismos filtros: una sola llamada
    const key = `${loc.lat.toFixed(1)},${loc.lng.toFixed(1)},${s.radius_km},${s.min_magnitude}`;
    if (!cache.has(key)) {
      const res = await fetch(url).catch(() => null);
      cache.set(key, res?.ok ? ((await res.json()).features ?? []) : []);
    }
    const features = cache.get(key)!;
    const seen = new Set<string>(s.seen_event_ids ?? []);
    const alerts = evaluateQuakes(features, loc, s, seen, profile?.user_name || "hermano");
    for (const a of alerts) {
      const id = stableId(s.user_id, "alert", a.kind, a.external_id ?? "");
      const { error: e } = await sb.from("world_alerts").upsert({ id, user_id: s.user_id, ...a, acknowledged: false }, { onConflict: "id", ignoreDuplicates: true });
      if (!e) {
        created++;
        await pushToUser(sb, s.user_id, { title: a.title, body: a.body, url: "/", tag: `alert-${id}`, urgent: a.severity === "critical" });
      }
    }
    features.forEach((f) => seen.add(f.id));
    await sb
      .from("world_monitor_settings")
      .update({ seen_event_ids: Array.from(seen).slice(-200), last_checked_at: new Date().toISOString() })
      .eq("id", s.id);
  }
  return json({ ok: true, users: rows?.length ?? 0, created });
});
