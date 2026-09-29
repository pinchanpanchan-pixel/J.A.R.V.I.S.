import type { Skill } from "../types";

/** Diario: abrir, escribir hoy, y «¿cómo me he sentido esta semana?». */
export const diary: Skill = {
  id: "diary",
  name: "Diario",
  description: "Tu diario privado.",
  triggerKeywords: ["abre el diario", "mi diario", "como me he sentido", "open diary"],
  requires: "diary",
  match(t) {
    if (/\b(abre|abrir|ir a|open)( el| mi)? diar(io|y)\b/.test(t) || /^(quiero )?escribir en (el|mi) diario/.test(t)) return { mode: "open" };
    if (/\bcomo me he (sentido|encontrado)\b/.test(t)) return { mode: "mood" };
    return null;
  },
  async execute(ctx, raw, m) {
    if (m.mode === "open") return { reply: "Aquí tienes tu diario, hermano.", navigate: "/diary" };
    const since = new Date(ctx.now().getTime() - 7 * 86400000).toISOString().slice(0, 10);
    const entries = (await ctx.engine.list("diary_entries")).filter((e) => e.entry_date >= since);
    if (!entries.length) return { reply: "Esta semana no me has contado nada en el diario, hermano." };
    const extra = entries.map((e) => `${e.entry_date}: ${e.summary ?? ""} | emociones: ${e.emotions.join(", ")} | ánimo ${e.sentiment ?? "?"}`).join("\n");
    return { reply: await ctx.askBrain(raw, `Diario de los últimos 7 días (resúmenes):\n${extra}`) };
  },
};
