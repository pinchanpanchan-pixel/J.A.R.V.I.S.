import { NextResponse } from "next/server";
import { isValidLatLng } from "@/lib/geo";
import { secret } from "@/lib/serverEnv";
import type { WeatherSnapshot } from "@/services/worldMonitorService";

export const dynamic = "force-dynamic";

/** Clima + calidad del aire + avisos oficiales (OpenWeather). Sin clave: available=false. */
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const lat = Number(p.get("lat"));
  const lng = Number(p.get("lng"));
  if (!isValidLatLng(lat, lng)) return NextResponse.json({ error: "invalid_coords" }, { status: 400 });
  const key = secret("OPENWEATHER_API_KEY");
  if (!key) return NextResponse.json({ available: false } satisfies WeatherSnapshot);

  const base = "https://api.openweathermap.org/data";
  const opts = { signal: AbortSignal.timeout(8000), next: { revalidate: 600 } } as RequestInit;
  const [w, air, one] = await Promise.all([
    fetch(`${base}/2.5/weather?lat=${lat}&lon=${lng}&units=metric&lang=es&appid=${key}`, opts).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch(`${base}/2.5/air_pollution?lat=${lat}&lon=${lng}&appid=${key}`, opts).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    // Avisos oficiales: requiere One Call 3.0 (si la cuenta no lo tiene, se ignora)
    fetch(`${base}/3.0/onecall?lat=${lat}&lon=${lng}&exclude=minutely,hourly,daily,current&lang=es&appid=${key}`, opts).then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);
  const snap: WeatherSnapshot = {
    available: !!w,
    temp: w?.main?.temp,
    description: w?.weather?.[0]?.description,
    weatherId: w?.weather?.[0]?.id,
    windMs: w?.wind?.speed,
    aqi: air?.list?.[0]?.main?.aqi,
    alerts: (one?.alerts ?? []).map((a: { event: string; description: string; start: number; end: number; sender_name?: string }) => ({
      event: a.event,
      description: a.description,
      start: a.start,
      end: a.end,
      sender: a.sender_name,
    })),
  };
  return NextResponse.json(snap);
}
