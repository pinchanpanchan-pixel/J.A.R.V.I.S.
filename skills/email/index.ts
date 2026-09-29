import type { Skill } from "../types";

/** Correo: «¿tengo correos?», «léeme los emails». */
export const email: Skill = {
  id: "email",
  name: "Correo",
  description: "Resumen de correos sin leer.",
  triggerKeywords: ["correos", "emails", "mails", "bandeja de entrada"],
  requires: "connectors",
  match(t) {
    return /\b(correos?|e-?mails?|mails?|bandeja de entrada)\b/.test(t) && /\b(tengo|hay|leeme|lee|resume|nuevos?|sin leer)\b/.test(t) ? {} : null;
  },
  async execute(ctx, raw) {
    const r = await ctx.connector<{ emails: Array<{ from: string; subject: string }>; sample: boolean }>("gmail", { action: "unread" });
    if (r.sample) return { reply: "Conecta Gmail en Ajustes → Conexiones y te leo lo importante, hermano." };
    if (!r.emails.length) return { reply: "Bandeja limpia, hermano. Nada nuevo." };
    return { reply: await ctx.askBrain(raw, `Correos sin leer:\n${r.emails.map((e) => `- ${e.from}: ${e.subject}`).join("\n")}`) };
  },
};
