import { dayKey, type Skill } from "../types";

/** Resúmenes: «¿qué hicimos ayer?», «resume mi día». Junta memoria, notas, diario, conversación y agenda. */
export const recap: Skill = {
  id: "recap",
  name: "Resúmenes",
  description: "Qué hiciste ayer / resumen del día.",
  triggerKeywords: ["que hicimos ayer", "que hice ayer", "resume mi dia", "resumen de hoy", "como ha ido el dia"],
  requires: "sync",
  match(t) {
    if (/\b(que (hicimos|hice|paso) ayer|resumen de ayer|resume(me)? (lo de )?ayer)\b/.test(t)) return { offset: -1 };
    if (/\b(resume(me)? (mi|el) dia|resumen (de hoy|del dia)|como (ha ido|va) (mi|el) dia|what did we do yesterday|summarize my day)\b/.test(t))
      return { offset: /yesterday/.test(t) ? -1 : 0 };
    return null;
  },
  async execute(ctx, raw, m) {
    const offset = Number(m.offset);
    const target = new Date(ctx.now().getTime() + offset * 86400000);
    const key = dayKey(target, ctx.timezone);
    const onDay = (iso: string | null | undefined) => !!iso && dayKey(new Date(iso), ctx.timezone) === key;
    const [blocks, notes, diary, chats] = await Promise.all([
      ctx.engine.list("memory_blocks"),
      ctx.engine.list("quick_notes"),
      ctx.engine.list("diary_entries"),
      ctx.engine.list("chat_messages"),
    ]);
    const lines: string[] = [];
    blocks.filter((b) => onDay(b.original_date ?? b.created_at)).forEach((b) => lines.push(`[memoria] ${b.title}: ${b.content}`.slice(0, 400)));
    notes.filter((n) => onDay(n.created_at)).forEach((n) => lines.push(`[nota] ${n.content}`.slice(0, 300)));
    diary.filter((d) => d.entry_date === key).forEach((d) => lines.push(`[diario] ${d.summary ?? ""} (emociones: ${d.emotions.join(", ")})`));
    chats
      .filter((c) => c.role === "user" && onDay(c.created_at))
      .slice(-15)
      .forEach((c) => lines.push(`[dijiste] ${c.content}`.slice(0, 200)));
    try {
      const cal = await ctx.connector<{ events: Array<{ title: string; start: string }>; sample: boolean }>("google_calendar", { action: "events", day: offset, timezone: ctx.timezone });
      if (!cal.sample) cal.events.forEach((e) => lines.push(`[agenda] ${e.title} ${e.start.slice(11, 16)}`));
    } catch {
      /* sin agenda */
    }
    if (lines.length === 0) return { reply: offset === -1 ? "De ayer no tengo nada guardado, hermano. ¿Me lo cuentas?" : "Hoy todavía no me has contado nada, hermano." };
    return { reply: await ctx.askBrain(raw, `Registros del ${key}:\n${lines.slice(0, 80).join("\n")}`) };
  },
};
