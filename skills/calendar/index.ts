import type { Skill } from "../types";

/** Agenda: «¿qué tengo hoy?», «mi agenda de mañana». */
export const calendar: Skill = {
  id: "calendar",
  name: "Agenda",
  description: "Tus eventos de calendario.",
  triggerKeywords: ["que tengo hoy", "que tengo manana", "mi agenda", "mis reuniones"],
  requires: "connectors",
  match(t) {
    if (!/\b(que tengo|mi agenda|mis (reuniones|eventos|citas)|tengo algo)\b/.test(t)) return null;
    return { day: /\bpasado manana\b/.test(t) ? 2 : /\bmanana\b/.test(t) ? 1 : 0 };
  },
  async execute(ctx, raw, m) {
    const r = await ctx.connector<{ events: Array<{ title: string; start: string; location: string | null }>; sample: boolean }>("google_calendar", {
      action: "events",
      day: m.day,
      timezone: ctx.timezone,
    });
    if (r.sample) return { reply: "Aún no tengo tu calendario conectado, hermano. Hazlo en Ajustes → Conexiones y te lo digo al momento." };
    if (!r.events.length) return { reply: m.day === 0 ? "Hoy lo tienes libre, hermano." : "Ese día no tienes nada." };
    const extra = r.events.map((e) => `${e.start} — ${e.title}${e.location ? ` (${e.location})` : ""}`).join("\n");
    return { reply: await ctx.askBrain(raw, `Eventos del calendario:\n${extra}`) };
  },
};
