import { parseHomeCommand } from "@/services/homeController";
import { runHomeCommand } from "@/services/homeClient";
import type { Skill } from "../types";

/** Hogar: «apaga todas las luces», «pon luz roja al 50 %», «enciende el aire», «apaga todo a las 11pm». */
export const homeControl: Skill = {
  id: "homeControl",
  name: "Hogar",
  description: "Controla luces, aire y enchufes.",
  triggerKeywords: ["apaga", "enciende", "luz", "luces", "aire", "temperatura", "turn off all lights"],
  requires: "smartHome",
  match(t, raw) {
    const en = t.match(/^turn (off|on) (all )?(the )?lights?$/);
    const text = en ? `${en[1] === "off" ? "apaga" : "enciende"} todas las luces` : raw;
    return parseHomeCommand(text).kind !== "unknown" ? { text } : null;
  },
  async execute(ctx, _raw, m) {
    const r = await runHomeCommand(ctx.engine, String(m.text), ctx.timezone);
    return r.handled ? { reply: r.reply } : null;
  },
};
