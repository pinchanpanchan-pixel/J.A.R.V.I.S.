import type { Skill } from "../types";

/** Importar el pasado: «importa mis chats de WhatsApp». */
export const importPast: Skill = {
  id: "importPast",
  name: "Importa tu pasado",
  description: "Importa chats de WhatsApp.",
  triggerKeywords: ["importa whatsapp", "importar chats", "importa tu pasado"],
  requires: "importPast",
  match(t) {
    return /\bimporta(r)?\b.*\b(whatsapp|chats?|pasado)\b/.test(t) ? {} : null;
  },
  async execute() {
    return { reply: "Sube el .zip que exporta WhatsApp y me lo leo entero, hermano.", navigate: "/settings#importar" };
  },
};
