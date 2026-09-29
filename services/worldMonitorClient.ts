"use client";
import type { SyncEngine } from "@/lib/sync/engine";
import { stableId } from "@/lib/ids";
import { dayKey } from "@/skills/types";
import type { UserLocationRow, WorldMonitorSettingsRow } from "@/types/db";
import { buildUsgsUrl, evaluateQuakes, evaluateWeather, type NewAlert, type UsgsFeature, type WeatherSnapshot } from "./worldMonitorService";

/** Id estable por usuario+alerta: dos dispositivos que detectan el mismo sismo crean UNA sola alerta. */
export const alertId = (userId: string, a: Pick<NewAlert, "kind" | "external_id">) => stableId(userId, "alert", a.kind, a.external_id ?? "");

export async function saveAlerts(engine: SyncEngine, userId: string, alerts: NewAlert[]): Promise<number> {
  let created = 0;
  for (const a of alerts) {
    const id = alertId(userId, a);
    if (await engine.get("world_alerts", id)) continue;
    await engine.insert("world_alerts", { id, ...a, acknowledged: false });
    created++;
  }
  return created;
}

/** Una pasada de vigilancia (sismos + clima). Devuelve las alertas nuevas. */
export async function checkWorld(
  engine: SyncEngine,
  userId: string,
  userName: string,
  settings: WorldMonitorSettingsRow,
  loc: UserLocationRow,
  opts: { weather: boolean },
): Promise<NewAlert[]> {
  const found: NewAlert[] = [];
  const seen = new Set(settings.seen_event_ids ?? []);
  if (settings.quake_enabled) {
    // Ventana: última comprobación (mín. 1 h atrás para no perder nada tras estar cerrado)
    const since = new Date(Math.min(Date.now() - 3600_000, settings.last_checked_at ? Date.parse(settings.last_checked_at) - 300_000 : Date.now() - 3600_000));
    const res = await fetch(buildUsgsUrl(loc, settings, since), { cache: "no-store" });
    if (res.ok) {
      const j = (await res.json()) as { features?: UsgsFeature[] };
      found.push(...evaluateQuakes(j.features ?? [], loc, settings, seen, userName));
      (j.features ?? []).forEach((f) => seen.add(f.id));
    }
  }
  if (opts.weather && (settings.weather_enabled || settings.air_quality_enabled)) {
    const w = (await fetch(`/api/world/weather?lat=${loc.lat}&lng=${loc.lng}`).then((r) => r.json()).catch(() => ({ available: false }))) as WeatherSnapshot;
    found.push(...evaluateWeather(w, settings, dayKey(new Date(), loc.timezone ?? "UTC"), userName));
  }
  await saveAlerts(engine, userId, found);
  await engine.upsert("world_monitor_settings", settings.id, {
    seen_event_ids: Array.from(seen).slice(-200),
    last_checked_at: new Date().toISOString(),
  });
  return found;
}
