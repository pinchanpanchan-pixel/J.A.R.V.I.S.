import type { Skill, SkillContext, SkillResult } from "./types";
import { normalizeText } from "./types";
import { quickNote } from "./quickNote";
import { memory } from "./memory";
import { recap } from "./recap";
import { diary } from "./diary";
import { homeControl } from "./homeControl";
import { music } from "./music";
import { calendar } from "./calendar";
import { email } from "./email";
import { contacts } from "./contacts";
import { notion } from "./notion";
import { navigation } from "./navigation";
import { visualMemory } from "./visualMemory";
import { importPast } from "./importPast";
import { worldMonitor } from "./worldMonitor";
import { matchShortcut, type EffectiveShortcut } from "@/lib/shortcuts";

/** Orden = prioridad. Las tres primeras son las del plan Free. */
export const SKILLS: Skill[] = [quickNote, memory, navigation, recap, diary, homeControl, music, calendar, email, contacts, notion, visualMemory, importPast, worldMonitor];
export const FREE_SKILL_IDS = new Set(SKILLS.slice(0, 3).map((s) => s.id));

const UPSELL: Record<string, string> = {
  sync: "Eso lo hago con Pro, hermano: necesito tu historial sincronizado.",
  diary: "El diario privado viene con Pro Lite y Pro, hermano.",
  smartHome: "Controlar tu casa es de Pro Lite o Pro, hermano.",
  connectors: "Para eso necesito conectar tus apps, y eso es de Pro Lite o Pro.",
  vision: "La memoria visual es de Pro, hermano.",
  importPast: "Importar tu pasado es de Pro, hermano.",
  worldMonitor: "WorldMonitor es de Pro Lite o Pro. Te cuida aunque no mires.",
};

/** Traduce un atajo a la skill que corresponde. */
async function runShortcut(s: EffectiveShortcut, ctx: SkillContext): Promise<SkillResult | null> {
  const p = s.params as Record<string, string>;
  switch (s.action) {
    case "open_quick_notes":
      return { reply: "Tus notas rápidas.", navigate: "/memories?tab=notes" };
    case "open_memories":
      return { reply: "Tu memoria, hermano.", navigate: "/memories" };
    case "create_quick_note":
      ctx.openQuickNote();
      return { reply: "Dime, te escucho." };
    case "open_diary":
      return { reply: "Tu diario.", navigate: "/diary" };
    case "recap_yesterday":
      return runSkill("qué hicimos ayer", ctx, recap);
    case "summarize_day":
      return runSkill("resume mi día", ctx, recap);
    case "lights_off":
      return runSkill("apaga todas las luces", ctx, homeControl);
    case "play_music":
      return runSkill("pon mi música", ctx, music);
    case "home_command":
      return runSkill(p.command ?? "", ctx, homeControl);
    case "navigate":
      return { reply: "Voy.", navigate: p.path ?? "/" };
    case "say":
      return { reply: p.text ?? "" };
    case "ask":
      return { reply: await ctx.askBrain(p.prompt ?? s.trigger, "") };
    default:
      return null;
  }
}

async function runSkill(text: string, ctx: SkillContext, only?: Skill): Promise<SkillResult | null> {
  const t = normalizeText(text);
  for (const skill of only ? [only] : SKILLS) {
    const m = skill.match(t, text);
    if (!m) continue;
    // Plan Free: solo las skills incluidas (maxSkills = 3)
    const limited = ctx.features.maxSkills !== null && !FREE_SKILL_IDS.has(skill.id);
    if (limited) return { reply: UPSELL[skill.requires ?? "connectors"] ?? "Eso es de Pro, hermano." };
    if (skill.requires && !ctx.features[skill.requires]) return { reply: UPSELL[skill.requires] ?? "Eso es de Pro, hermano." };
    const r = await skill.execute(ctx, text, m);
    if (r) return r;
  }
  return null;
}

/** Router: atajo → skill → (null) cerebro. */
export async function routeUtterance(text: string, ctx: SkillContext, shortcuts: EffectiveShortcut[]): Promise<SkillResult | null> {
  const sc = ctx.features.shortcuts ? matchShortcut(text, shortcuts) : null;
  if (sc) {
    const r = await runShortcut(sc, ctx);
    if (r) return r;
  }
  return runSkill(text, ctx);
}
