/**
 * Parte del tiempo con Open-Meteo (gratis, sin clave, CORS abierto): previsión del día,
 * máxima y mínima, lluvia, viento y una recomendación de ropa (¿chaqueta?).
 * La parte «pura» (forecastFacts / briefFallback) es testeable sin red.
 */

export interface DayForecast {
  date: string;
  max: number;
  min: number;
  feelsMin: number;
  feelsMax: number;
  rainProb: number; // % máx. del día
  rainHours: string[]; // franjas con ≥ 40 % ("14:00")
  windMax: number; // km/h
  uvMax: number;
  code: number; // WMO
  nowTemp: number | null;
}

export interface WeatherFacts extends DayForecast {
  sky: string;
  jacket: "no" | "light" | "warm";
  umbrella: boolean;
  outfit: string;
}

const SKY: Array<[number[], string]> = [
  [[0], "despejado"],
  [[1, 2], "con algunas nubes"],
  [[3], "nublado"],
  [[45, 48], "con niebla"],
  [[51, 53, 55, 56, 57], "con llovizna"],
  [[61, 63, 65, 66, 67, 80, 81, 82], "con lluvia"],
  [[71, 73, 75, 77, 85, 86], "con nieve"],
  [[95, 96, 99], "con tormentas"],
];
export const skyText = (code: number) => SKY.find(([codes]) => codes.includes(code))?.[1] ?? "variable";

/** Recomendación de ropa a partir de la sensación térmica, la lluvia y el viento. */
export function forecastFacts(d: DayForecast): WeatherFacts {
  const cold = Math.min(d.min, d.feelsMin);
  const windy = d.windMax >= 30;
  const jacket: WeatherFacts["jacket"] = cold < 10 || (cold < 13 && windy) ? "warm" : cold < 17 || windy || d.rainProb >= 50 ? "light" : "no";
  const umbrella = d.rainProb >= 40;
  const top = d.feelsMax >= 26 ? "algo fresco, manga corta" : d.feelsMax >= 20 ? "manga corta o una camiseta fina" : d.feelsMax >= 14 ? "manga larga" : "jersey";
  const outer = jacket === "warm" ? "abrigo o chaqueta gorda" : jacket === "light" ? "una chaqueta ligera" : "";
  const outfit = [top, outer && `y ${outer}`, umbrella ? "y paraguas" : ""].filter(Boolean).join(" ");
  return { ...d, sky: skyText(d.code), jacket, umbrella, outfit };
}

/** Texto de respaldo (si el cerebro no responde): breve y hablado. */
export function briefFallback(f: WeatherFacts, userName: string, greet = false): string {
  const rain = f.rainProb >= 40 ? `Hay un ${f.rainProb} % de probabilidad de lluvia${f.rainHours.length ? `, sobre todo a partir de las ${f.rainHours[0]}` : ""}.` : f.rainProb >= 15 ? `Poca probabilidad de lluvia, un ${f.rainProb} %.` : "No va a llover.";
  const jacket = f.jacket === "warm" ? "Abrígate bien." : f.jacket === "light" ? "Llévate una chaqueta ligera." : "No te hace falta chaqueta.";
  return `${greet ? `Buenos días, ${userName}. ` : ""}Hoy estará ${f.sky}, con máxima de ${Math.round(f.max)} y mínima de ${Math.round(f.min)} grados. ${rain} ${jacket} Yo iría con ${f.outfit}.`;
}

/** Datos para el cerebro (para que lo cuente con naturalidad y pueda seguir la conversación). */
export function factsForBrain(f: WeatherFacts, place: string | null): string {
  return [
    `Parte del tiempo de hoy${place ? ` en ${place}` : ""} (${f.date}):`,
    `- Cielo: ${f.sky}${f.nowTemp !== null ? `; ahora ${Math.round(f.nowTemp)} °C` : ""}`,
    `- Máxima ${Math.round(f.max)} °C, mínima ${Math.round(f.min)} °C (sensación ${Math.round(f.feelsMin)}–${Math.round(f.feelsMax)} °C)`,
    `- Lluvia: ${f.rainProb} % máx.${f.rainHours.length ? `; más probable a las ${f.rainHours.slice(0, 4).join(", ")}` : ""}`,
    `- Viento máx. ${Math.round(f.windMax)} km/h; índice UV ${Math.round(f.uvMax)}`,
    `- Chaqueta: ${f.jacket === "warm" ? "sí, de abrigo" : f.jacket === "light" ? "una ligera" : "no hace falta"}; paraguas: ${f.umbrella ? "sí" : "no"}`,
    `- Ropa sugerida: ${f.outfit}`,
  ].join("\n");
}

interface OpenMeteo {
  current?: { temperature_2m?: number };
  daily?: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    apparent_temperature_max: number[];
    apparent_temperature_min: number[];
    precipitation_probability_max: Array<number | null>;
    wind_speed_10m_max: number[];
    uv_index_max: Array<number | null>;
    weather_code: number[];
  };
  hourly?: { time: string[]; precipitation_probability: Array<number | null> };
}

export function parseOpenMeteo(j: OpenMeteo, dayIndex = 0): DayForecast | null {
  const d = j.daily;
  if (!d?.time?.[dayIndex]) return null;
  const date = d.time[dayIndex];
  const rainHours = (j.hourly?.time ?? [])
    .map((t, i) => ({ t, p: j.hourly?.precipitation_probability[i] ?? 0 }))
    .filter((h) => h.t.startsWith(date) && (h.p ?? 0) >= 40 && Number(h.t.slice(11, 13)) >= 7)
    .map((h) => h.t.slice(11, 16));
  return {
    date,
    max: d.temperature_2m_max[dayIndex],
    min: d.temperature_2m_min[dayIndex],
    feelsMax: d.apparent_temperature_max[dayIndex],
    feelsMin: d.apparent_temperature_min[dayIndex],
    rainProb: Math.round(d.precipitation_probability_max[dayIndex] ?? 0),
    rainHours,
    windMax: d.wind_speed_10m_max[dayIndex],
    uvMax: d.uv_index_max[dayIndex] ?? 0,
    code: d.weather_code[dayIndex],
    nowTemp: dayIndex === 0 ? (j.current?.temperature_2m ?? null) : null,
  };
}

/** Previsión de hoy (0) o mañana (1) para unas coordenadas. */
export async function fetchForecast(lat: number, lng: number, dayIndex = 0, fetchImpl: typeof fetch = fetch): Promise<WeatherFacts | null> {
  const q = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current: "temperature_2m",
    daily: "temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_probability_max,wind_speed_10m_max,uv_index_max,weather_code",
    hourly: "precipitation_probability",
    timezone: "auto",
    forecast_days: "2",
  });
  try {
    const res = await fetchImpl(`https://api.open-meteo.com/v1/forecast?${q}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const day = parseOpenMeteo((await res.json()) as OpenMeteo, dayIndex);
    return day ? forecastFacts(day) : null;
  } catch {
    return null;
  }
}
