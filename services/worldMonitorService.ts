import { haversineKm, type LatLng } from "@/lib/geo";
import type { WorldAlertRow, WorldMonitorSettingsRow } from "@/types/db";

/**
 * WorldMonitor — vigila el mundo para proteger al usuario.
 *  A) Sismos: API de USGS (https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson)
 *  B) Clima severo y calidad del aire: OpenWeather (vía /api/world/weather, la clave va en servidor).
 * Funciones puras compartidas por el cliente y la Edge Function.
 */
export const USGS_ENDPOINT = "https://earthquake.usgs.gov/fdsnws/event/1/query";

export interface UsgsFeature {
  id: string;
  properties: { mag: number | null; place: string | null; time: number; url: string; tsunami: number; alert: string | null; title?: string };
  geometry: { coordinates: [number, number, number] };
}

export type NewAlert = Pick<WorldAlertRow, "kind" | "severity" | "external_id" | "title" | "body" | "data">;

export function buildUsgsUrl(loc: LatLng, s: Pick<WorldMonitorSettingsRow, "radius_km" | "min_magnitude">, since: Date): string {
  const q = new URLSearchParams({
    format: "geojson",
    latitude: loc.lat.toFixed(4),
    longitude: loc.lng.toFixed(4),
    maxradiuskm: String(Math.min(20000, Math.max(1, s.radius_km))),
    minmagnitude: String(s.min_magnitude),
    starttime: since.toISOString().slice(0, 19),
    orderby: "time",
    limit: "20",
  });
  return `${USGS_ENDPOINT}?${q}`;
}

/** Filtra sismos nuevos que cumplen magnitud y radio, y los convierte en alertas. */
export function evaluateQuakes(
  features: UsgsFeature[],
  loc: LatLng,
  s: Pick<WorldMonitorSettingsRow, "radius_km" | "min_magnitude">,
  seen: Set<string>,
  userName = "hermano",
): NewAlert[] {
  const out: NewAlert[] = [];
  for (const f of features) {
    const mag = f.properties.mag ?? 0;
    if (seen.has(f.id) || mag < s.min_magnitude) continue;
    const [lng, lat, depth] = f.geometry.coordinates;
    const km = Math.round(haversineKm(loc, { lat, lng }));
    if (km > s.radius_km) continue;
    const magTxt = mag.toFixed(1).replace(".", ",");
    out.push({
      kind: "earthquake",
      severity: mag >= 6 || km < 100 ? "critical" : "warning",
      external_id: f.id,
      title: `Sismo de magnitud ${magTxt}`,
      body: `Ey ${userName}, hay un sismo de magnitud ${magTxt} a ${km} km de ti, ¿estás bien?`,
      data: { mag, km, depth, place: f.properties.place, time: f.properties.time, url: f.properties.url, tsunami: !!f.properties.tsunami, lat, lng },
    });
  }
  return out.sort((a, b) => Number((b.data as { mag: number }).mag) - Number((a.data as { mag: number }).mag));
}

export interface WeatherSnapshot {
  available: boolean;
  temp?: number;
  description?: string;
  windMs?: number;
  weatherId?: number;
  aqi?: number; // 1 (bueno) .. 5 (muy malo)
  alerts?: Array<{ event: string; description: string; start: number; end: number; sender?: string }>;
}

const AQI_LABEL = ["", "buena", "aceptable", "moderada", "mala", "muy mala"];

/** Alertas de clima severo y aire a partir de una lectura de OpenWeather. */
export function evaluateWeather(w: WeatherSnapshot, s: Pick<WorldMonitorSettingsRow, "weather_enabled" | "air_quality_enabled" | "aqi_threshold">, day: string, userName = "hermano"): NewAlert[] {
  if (!w.available) return [];
  const out: NewAlert[] = [];
  if (s.weather_enabled) {
    for (const a of w.alerts ?? []) {
      out.push({
        kind: "weather",
        severity: /extreme|red|roja|hurricane|huracan|tornado/i.test(a.event) ? "critical" : "warning",
        external_id: `${a.event}-${a.start}`,
        title: a.event,
        body: `Ojo, ${userName}: aviso de ${a.event.toLowerCase()} en tu zona. Ten cuidado.`,
        data: { ...a },
      });
    }
    const severe =
      (w.weatherId !== undefined && w.weatherId >= 200 && w.weatherId < 233 && "tormenta eléctrica") ||
      ((w.windMs ?? 0) >= 20 && "viento muy fuerte") ||
      ((w.temp ?? 20) >= 40 && "calor extremo") ||
      ((w.temp ?? 20) <= -10 && "frío extremo");
    if (severe && !(w.alerts ?? []).length) {
      out.push({
        kind: "weather",
        severity: "warning",
        external_id: `${severe}-${day}`,
        title: `Tiempo: ${severe}`,
        body: `Ojo, ${userName}: hay ${severe} ahora mismo donde estás.`,
        data: { temp: w.temp, windMs: w.windMs, description: w.description },
      });
    }
  }
  if (s.air_quality_enabled && w.aqi && w.aqi >= s.aqi_threshold) {
    out.push({
      kind: "air_quality",
      severity: w.aqi >= 5 ? "critical" : "warning",
      external_id: `aqi-${w.aqi}-${day}`,
      title: `Calidad del aire ${AQI_LABEL[w.aqi]}`,
      body: `${userName}, la calidad del aire es ${AQI_LABEL[w.aqi]} ahora mismo. Mejor evita hacer ejercicio fuera.`,
      data: { aqi: w.aqi },
    });
  }
  return out;
}

/** Qué hacer (modal de sugerencias). */
export const SAFETY_TIPS: Record<WorldAlertRow["kind"], string[]> = {
  earthquake: [
    "Agáchate, cúbrete y agárrate bajo una mesa firme.",
    "Aléjate de ventanas, espejos y muebles que puedan caer.",
    "No uses ascensores. Si estás fuera, aléjate de edificios y cables.",
    "Tras el temblor, revisa gas y electricidad. Espera réplicas.",
    "Si estás en la costa y el temblor fue fuerte, sube a zona alta: puede haber tsunami.",
  ],
  weather: [
    "Quédate en interior y lejos de ventanas.",
    "Evita conducir si no es imprescindible.",
    "Ten el móvil cargado y una linterna a mano.",
    "Sigue las indicaciones de protección civil de tu zona.",
  ],
  air_quality: [
    "Evita el ejercicio intenso al aire libre.",
    "Cierra ventanas y usa purificador si tienes.",
    "Si tienes asma o problemas respiratorios, ten tu medicación a mano.",
    "Si sales, una mascarilla FFP2 ayuda.",
  ],
};
