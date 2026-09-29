import type { Skill } from "../types";

/** Memoria visual: «mira esta foto», «analiza una foto», «haz una foto». */
export const visualMemory: Skill = {
  id: "visualMemory",
  name: "Memoria visual",
  description: "Analiza fotos y las recuerda.",
  triggerKeywords: ["mira esta foto", "analiza una foto", "haz una foto", "recuerda esta imagen"],
  requires: "vision",
  match(t) {
    return /\b(mira|analiza|guarda|recuerda|haz)( esta| una| la)? (foto|imagen|captura)\b/.test(t) ? {} : null;
  },
  async execute() {
    return { reply: "Enséñamela, hermano.", navigate: "/memories?photo=1" };
  },
};
