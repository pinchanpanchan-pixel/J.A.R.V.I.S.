import type { Skill } from "../types";

/** Nota rápida: «crea nota rápida», «apunta que…», «anota…». Sin título, se guarda al instante. */
export const quickNote: Skill = {
  id: "quickNote",
  name: "Nota rápida",
  description: "Guarda una nota al instante.",
  triggerKeywords: ["crea nota rapida", "nota rapida", "apunta", "anota", "toma nota"],
  match(t, raw) {
    const m = raw.match(/^\s*(?:crea(?:r)?\s+(?:una\s+)?nota\s+r[aá]pida|nota\s+r[aá]pida|ap[uú]ntame|apunta|an[oó]tame|anota|toma\s+nota(?:\s+de)?)\s*(?:que\s+|:\s*)?(.*)$/i);
    return m ? { content: m[1].trim() } : null;
  },
  async execute(ctx, _raw, m) {
    const content = String(m.content ?? "");
    if (!content) {
      ctx.openQuickNote();
      return { reply: "Dime, hermano. Te escucho." };
    }
    await ctx.engine.insert("quick_notes", { content, category: "quick_notes", pinned: false, source: "voice" });
    return { reply: "Apuntado, hermano." };
  },
};
