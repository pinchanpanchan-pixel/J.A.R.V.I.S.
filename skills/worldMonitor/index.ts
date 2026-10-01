import { stableId } from "@/lib/ids";
import { haversineKm } from "@/lib/geo";
import { buildUsgsUrl, type UsgsFeature, type WeatherSnapshot } from "@/services/worldMonitorService";
import type { Skill } from "../types";

/**
 * WorldMonitor (skill de voz): «¿ha habido algún terremoto?», «¿cómo está el aire?».
 * (El tiempo lo responde la skill «weather», con Open-Meteo y sin clave.)
 * La vigilancia proactiva (alertas) la hace components/providers/WorldMonitorProvider + Edge Function.
 */
export const worldMonitor: Skill = {
  id: "worldMonitor",
  name: "WorldMonitor",
  description: "Sismos, clima y calidad del aire cerca de ti.",
  triggerKeywords: ["terremoto", "sismo", "temblor", "que tiempo hace", "calidad del aire"],
  requires: "worldMonitor",
  match(t) {
    if (/\b(terremotos?|sismos?|temblor(es)?)\b/.test(t)) return { mode: "quakes" };
    if (/\b(calidad del aire|contaminacion|como esta el aire)\b/.test(t)) return { mode: "air" };
    return null;
  },
  async execute(ctx, _raw, m) {
    const loc = await ctx.engine.get("user_locations", stableId(ctx.userId, "primary-location"));
    if (!loc) return { reply: "Necesito saber dónde estás, hermano. Configúralo en Ajustes → Ubicación.", navigate: "/settings" };
    if (m.mode === "quakes") {
      const settings = await ctx.engine.get("world_monitor_settings", ctx.userId);
      const radius = settings?.radius_km ?? 500;
      const res = await fetch(buildUsgsUrl(loc, { radius_km: radius, min_magnitude: 2.5 }, new Date(Date.now() - 7 * 86400000))).catch(() => null);
      if (!res?.ok) return { reply: "Ahora mismo no puedo consultar el servicio sísmico, hermano." };
      const feats = ((await res.json()) as { features?: UsgsFeature[] }).features ?? [];
      if (!feats.length) return { reply: `Tranquilo: ningún sismo en ${radius} km a la redonda esta semana.` };
      const top = [...feats].sort((a, b) => (b.properties.mag ?? 0) - (a.properties.mag ?? 0))[0];
      const km = Math.round(haversineKm(loc, { lat: top.geometry.coordinates[1], lng: top.geometry.coordinates[0] }));
      return { reply: `Esta semana hubo ${feats.length} sismos cerca. El mayor, de magnitud ${(top.properties.mag ?? 0).toFixed(1).replace(".", ",")} a ${km} km. Nada de lo que preocuparse ahora mismo.` };
    }
    const w = (await fetch(`/api/world/weather?lat=${loc.lat}&lng=${loc.lng}`).then((r) => r.json()).catch(() => ({ available: false }))) as WeatherSnapshot;
    if (!w.available) return { reply: "Para el tiempo necesito la clave de OpenWeather, hermano. Pídesela al propietario." };
    if (m.mode === "air") {
      const label = ["", "buena", "aceptable", "moderada", "mala", "muy mala"][w.aqi ?? 0] ?? "desconocida";
      return { reply: `La calidad del aire ahora es ${label}.` };
    }
    return { reply: `Ahora mismo ${Math.round(w.temp ?? 0)} grados y ${w.description ?? "tiempo normal"}.` };
  },
};
