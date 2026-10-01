import { stableId } from "@/lib/ids";
import { briefFallback, factsForBrain, fetchForecast } from "@/services/weather";
import { isMockMode } from "@/lib/env";
import type { Skill } from "../types";

/**
 * Tiempo (Open-Meteo, sin clave): «¿qué tiempo hace?», «¿va a llover mañana?», «¿necesito chaqueta?».
 * El cerebro lo cuenta con naturalidad y, como queda en la conversación, puedes seguir preguntando.
 */
export const weather: Skill = {
  id: "weather",
  name: "Tiempo",
  description: "Previsión, máxima y mínima, lluvia y qué ponerte.",
  triggerKeywords: ["que tiempo hace", "va a llover", "necesito chaqueta", "que me pongo", "parte del tiempo"],
  match(t) {
    const tomorrow = /\bmanana\b|\btomorrow\b/.test(t);
    if (/\b(que tiempo (hace|hara|va a hacer)|el tiempo (de|para) (hoy|manana)|parte del tiempo|prevision|va a llover|llovera|lluvia|hace (frio|calor)|hara (frio|calor)|temperatura|(necesito|me llevo|llevo) (chaqueta|abrigo|paraguas)|que me pongo|weather)\b/.test(t))
      return { day: tomorrow ? 1 : 0 };
    return null;
  },
  async execute(ctx, raw, m) {
    const loc = await ctx.engine.get("user_locations", stableId(ctx.userId, "primary-location"));
    if (!loc) return { reply: "Necesito saber dónde estás, hermano. Configúralo en Ajustes → Ubicación.", navigate: "/settings" };
    const f = await fetchForecast(loc.lat, loc.lng, Number(m.day) || 0);
    if (!f) return { reply: "Ahora mismo no me llega la previsión, hermano. Pruébame en un rato." };
    const place = loc.city ?? loc.formatted_address ?? null;
    // En modo simulado el cerebro no lee los datos: se da el parte tal cual.
    if (isMockMode) return { reply: briefFallback(f, ctx.userName) };
    const reply = await ctx.askBrain(raw, `${factsForBrain(f, place)}\nResponde a lo que pregunta en 2-3 frases habladas, sin listas.`);
    // Si el cerebro no está disponible (sin red, saturado o sin cupo), el parte se da igual.
    const brainDown = !reply || /no me llega la conexion|circuitos saturados|cupo gratuito/i.test(reply.normalize("NFD").replace(/\p{Diacritic}/gu, ""));
    return { reply: brainDown ? briefFallback(f, ctx.userName) : reply };
  },
};
