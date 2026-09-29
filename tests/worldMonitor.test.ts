import { describe, it, expect } from "vitest";
import { buildUsgsUrl, evaluateQuakes, evaluateWeather, type UsgsFeature } from "@/services/worldMonitorService";

const madrid = { lat: 40.4168, lng: -3.7038 };
const q = (id: string, mag: number, lat: number, lng: number): UsgsFeature => ({
  id,
  properties: { mag, place: "test", time: Date.now(), url: "https://x", tsunami: 0, alert: null },
  geometry: { coordinates: [lng, lat, 10] },
});
const settings = { radius_km: 500, min_magnitude: 4.5 };

describe("WorldMonitor", () => {
  it("URL de USGS con radio, magnitud y hora", () => {
    const u = new URL(buildUsgsUrl(madrid, settings, new Date("2026-09-29T10:00:00Z")));
    expect(u.origin + u.pathname).toBe("https://earthquake.usgs.gov/fdsnws/event/1/query");
    expect(u.searchParams.get("format")).toBe("geojson");
    expect(u.searchParams.get("maxradiuskm")).toBe("500");
    expect(u.searchParams.get("minmagnitude")).toBe("4.5");
    expect(u.searchParams.get("starttime")).toBe("2026-09-29T10:00:00");
  });
  it("filtra por magnitud, radio y vistos; texto de voz exacto", () => {
    const granada = q("granada", 5.2, 37.18, -3.6); // ~360 km
    const alerts = evaluateQuakes([granada, q("lejos", 7, 35.7, 139.7), q("pequeno", 3.1, 40.5, -3.7), q("visto", 6, 40.4, -3.7)], madrid, settings, new Set(["visto"]), "hermano");
    expect(alerts).toHaveLength(1);
    expect(alerts[0].external_id).toBe("granada");
    expect(alerts[0].body).toMatch(/^Ey hermano, hay un sismo de magnitud 5,2 a 3\d\d km de ti, ¿estás bien\?$/);
    expect(alerts[0].severity).toBe("warning");
  });
  it("sismo fuerte o muy cercano = crítico", () => {
    expect(evaluateQuakes([q("a", 6.4, 38, -3)], madrid, settings, new Set())[0].severity).toBe("critical");
    expect(evaluateQuakes([q("b", 4.6, 40.6, -3.7)], madrid, settings, new Set())[0].severity).toBe("critical");
  });
  it("clima severo y calidad del aire", () => {
    const s = { weather_enabled: true, air_quality_enabled: true, aqi_threshold: 4 };
    const a = evaluateWeather({ available: true, temp: 25, windMs: 3, weatherId: 211, aqi: 5 }, s, "2026-09-29");
    expect(a.map((x) => x.kind).sort()).toEqual(["air_quality", "weather"]);
    expect(evaluateWeather({ available: true, temp: 22, windMs: 2, weatherId: 800, aqi: 2 }, s, "d")).toEqual([]);
    expect(evaluateWeather({ available: false }, s, "d")).toEqual([]);
  });
});
