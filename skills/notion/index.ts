import type { Skill } from "../types";

/** Notion: «busca en Notion …». */
export const notion: Skill = {
  id: "notion",
  name: "Notion",
  description: "Busca en tus páginas de Notion.",
  triggerKeywords: ["busca en notion", "en notion"],
  requires: "connectors",
  match(t) {
    const m = t.match(/\bbusca(?:me)? en notion (.+)$/) ?? t.match(/\bnotion\b.*\bsobre (.+)$/);
    return m ? { query: m[1] } : null;
  },
  async execute(ctx, _raw, m) {
    const r = await ctx.connector<{ pages: Array<{ title: string }>; sample: boolean }>("notion", { action: "search", query: m.query });
    if (r.sample) return { reply: "Conecta Notion en Ajustes y busco donde haga falta, hermano." };
    if (!r.pages.length) return { reply: `Nada en Notion sobre «${m.query}».` };
    return { reply: `En Notion tienes: ${r.pages.map((p) => p.title).slice(0, 5).join(", ")}.` };
  },
};
