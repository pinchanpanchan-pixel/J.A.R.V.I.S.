import type { Skill } from "../types";

/** Música (Spotify): «pon mi música», «pausa», «siguiente canción». */
export const music: Skill = {
  id: "music",
  name: "Música",
  description: "Controla Spotify.",
  triggerKeywords: ["pon mi musica", "pon musica", "pausa la musica", "siguiente cancion", "play my music"],
  requires: "connectors",
  match(t) {
    if (/\b(pon|reproduce|play)( mi| la| algo de)? (musica|music|spotify)\b/.test(t) || /\bplay my music\b/.test(t)) return { action: "play" };
    if (/\b(pausa|para|deten|quita)( la)? musica\b/.test(t)) return { action: "pause" };
    if (/\b(siguiente|pasa la|salta(te)? la) cancion\b/.test(t)) return { action: "next" };
    if (/\bcancion anterior\b/.test(t)) return { action: "previous" };
    return null;
  },
  async execute(ctx, _raw, m) {
    const r = await ctx.connector<{ ok: boolean; sample: boolean; error?: string }>("spotify", { action: m.action });
    if (r.sample) return { reply: "Te pondría música, hermano, pero primero conecta Spotify en Ajustes → Conexiones." };
    if (r.error === "no_active_device") return { reply: "Abre Spotify en algún dispositivo y vuelvo a intentarlo." };
    if (!r.ok) return { reply: "Spotify no me hace caso ahora mismo." };
    return { reply: m.action === "pause" ? "Pausado." : m.action === "play" ? "Dale, hermano. Música." : "Hecho." };
  },
};
