import { searchItems } from "@/lib/search";
import type { Skill } from "../types";

/** Contactos: «¿cuál es el teléfono de Laura?». Busca en los contactos importados (Atajos de iOS) y la memoria. */
export const contacts: Skill = {
  id: "contacts",
  name: "Contactos",
  description: "Teléfonos y datos de tus contactos.",
  triggerKeywords: ["telefono de", "numero de", "email de", "cumpleanos de"],
  match(t) {
    const m = t.match(/\b(?:telefono|numero|movil|email|correo|cumpleanos|direccion) de ([a-zñ ]{2,40})$/);
    return m ? { name: m[1].trim() } : null;
  },
  async execute(ctx, raw, m) {
    const hits = searchItems(await ctx.engine.list("memory_blocks"), String(m.name), 5);
    if (!hits.length) return { reply: `No tengo a ${m.name} guardado, hermano. Importa tus contactos con el Atajo de iOS o cuéntamelo.` };
    return { reply: await ctx.askBrain(raw, hits.map((h) => `${h.title}: ${h.content}`).join("\n")) };
  },
};
