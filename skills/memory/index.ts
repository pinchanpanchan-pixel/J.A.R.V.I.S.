import { searchItems } from "@/lib/search";
import type { Skill } from "../types";

/** Memoria: «recuerda que…» guarda; «¿qué sabes de…?» / «busca en mi memoria…» busca. */
export const memory: Skill = {
  id: "memory",
  name: "Bloques de memoria",
  description: "Guarda y busca recuerdos.",
  triggerKeywords: ["recuerda que", "no olvides que", "que sabes de", "busca en mi memoria", "te acuerdas de"],
  match(t, raw) {
    const save = raw.match(/^\s*(?:recuerda|no olvides|acu[eé]rdate de)\s+que\s+(.+)$/i);
    if (save) return { mode: "save", text: save[1].trim() };
    const find = t.match(/^(?:que sabes (?:de|sobre)|busca en mi memoria|buscame en la memoria|te acuerdas de)\s+(.+)$/);
    if (find) return { mode: "find", query: find[1].trim() };
    return null;
  },
  async execute(ctx, _raw, m) {
    if (m.mode === "save") {
      const text = String(m.text);
      const blocks = await ctx.engine.list("memory_blocks");
      const max = ctx.features.maxMemoryBlocks;
      if (max !== null && blocks.length >= max) return { reply: `Tengo la memoria llena (${max} recuerdos en tu plan). Con Pro me acuerdo de todo, hermano.` };
      await ctx.engine.insert("memory_blocks", {
        title: text.length > 60 ? `${text.slice(0, 57)}…` : text,
        content: text,
        tags: [],
        source: "voice",
        metadata: {},
        original_date: null,
      });
      // Hecho esencial: también a la memoria central (va en el prompt del cerebro)
      const core = await ctx.engine.get("user_core_memory", ctx.userId);
      const facts = [...(core?.facts ?? []), { fact: text, at: ctx.now().toISOString() }].slice(-100);
      await ctx.engine.upsert("user_core_memory", ctx.userId, { facts });
      return { reply: "Guardado. No se me olvida, hermano." };
    }
    const found = searchItems(await ctx.engine.list("memory_blocks"), String(m.query), 8);
    if (!found.length) return { reply: `No tengo nada sobre «${m.query}», hermano. Cuéntamelo y lo guardo.` };
    const extra = found.map((b) => `- ${b.title}: ${b.content}`.slice(0, 600)).join("\n");
    return { reply: await ctx.askBrain(`¿Qué sé sobre ${m.query}?`, `Recuerdos encontrados:\n${extra}`) };
  },
};
