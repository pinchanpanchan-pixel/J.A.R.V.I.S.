import { describe, it, expect, vi } from "vitest";
import { briefFallback, fetchForecast, forecastFacts, parseOpenMeteo } from "@/services/weather";
import { weather } from "@/skills/weather";
import { normalizeText } from "@/skills/types";
import { slotFor } from "@/components/providers/ProactiveProvider";

const day = { date: "2026-10-01", max: 19, min: 9, feelsMin: 7, feelsMax: 18, rainProb: 70, rainHours: ["16:00", "17:00"], windMax: 20, uvMax: 4, code: 61, nowTemp: 11 };

describe("parte del tiempo", () => {
  it("frío por la mañana + lluvia = chaqueta de abrigo y paraguas", () => {
    const f = forecastFacts(day);
    expect(f).toMatchObject({ jacket: "warm", umbrella: true, sky: "con lluvia" });
    const t = briefFallback(f, "Pancho", true);
    expect(t).toContain("Buenos días, Pancho");
    expect(t).toContain("máxima de 19 y mínima de 9");
    expect(t).toContain("70 %");
    expect(t).toContain("16:00");
  });

  it("día de calor sin lluvia = sin chaqueta", () => {
    const f = forecastFacts({ ...day, max: 31, min: 21, feelsMin: 22, feelsMax: 33, rainProb: 0, rainHours: [], code: 0 });
    expect(f).toMatchObject({ jacket: "no", umbrella: false, sky: "despejado" });
    expect(briefFallback(f, "Pancho")).toContain("No te hace falta chaqueta");
  });

  it("lee la respuesta de Open-Meteo (hoy y mañana) y las horas de lluvia", async () => {
    const json = {
      current: { temperature_2m: 12.3 },
      daily: {
        time: ["2026-10-01", "2026-10-02"],
        temperature_2m_max: [19, 22],
        temperature_2m_min: [9, 12],
        apparent_temperature_max: [18, 22],
        apparent_temperature_min: [7, 11],
        precipitation_probability_max: [70, 5],
        wind_speed_10m_max: [20, 10],
        uv_index_max: [4, 6],
        weather_code: [61, 1],
      },
      hourly: { time: ["2026-10-01T06:00", "2026-10-01T16:00", "2026-10-02T16:00"], precipitation_probability: [90, 60, 10] },
    };
    expect(parseOpenMeteo(json, 0)?.rainHours).toEqual(["16:00"]); // a las 6 aún no cuenta
    const f = vi.fn(async () => new Response(JSON.stringify(json)));
    const tomorrow = await fetchForecast(40.4, -3.7, 1, f as never);
    expect(tomorrow).toMatchObject({ date: "2026-10-02", max: 22, nowTemp: null, jacket: "light" });
    expect(String((f.mock.calls[0] as unknown[])[0])).toContain("latitude=40.4");
  });

  it("la skill entiende las preguntas habituales", () => {
    const m = (s: string) => weather.match(normalizeText(s), s);
    expect(m("¿Qué tiempo hace?")).toEqual({ day: 0 });
    expect(m("¿Va a llover mañana?")).toEqual({ day: 1 });
    expect(m("¿Necesito chaqueta?")).toEqual({ day: 0 });
    expect(m("pon música")).toBeNull();
  });

  it("franjas del saludo", () => {
    expect([slotFor(7), slotFor(15), slotFor(22), slotFor(2)]).toEqual(["morning", "afternoon", "night", "night"]);
  });
});
