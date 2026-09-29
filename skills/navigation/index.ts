import type { Skill } from "../types";

const TARGETS: Array<[RegExp, string, string]> = [
  [/\b(notas rapidas|bloc de notas|mis notas|notes block)\b/, "/memories?tab=notes", "Tus notas rápidas."],
  [/\b(memorias?|recuerdos|memory)\b/, "/memories", "Tu memoria, hermano."],
  [/\b(hogar|casa|dispositivos)\b/, "/home", "Tu casa."],
  [/\b(ajustes|configuracion|settings)\b/, "/settings", "Ajustes."],
];

/** Navegación: «abre mis notas», «ve a ajustes». */
export const navigation: Skill = {
  id: "navigation",
  name: "Navegación",
  description: "Abre secciones de la app.",
  triggerKeywords: ["abre", "ve a", "llevame a", "open"],
  match(t) {
    if (!/^(abre(me)?|abrir|ve a|vamos a|llevame a|ensename|open)\b/.test(t)) return null;
    const hit = TARGETS.find(([re]) => re.test(t));
    return hit ? { path: hit[1], reply: hit[2] } : null;
  },
  async execute(_ctx, _raw, m) {
    return { reply: String(m.reply), navigate: String(m.path) };
  },
};
