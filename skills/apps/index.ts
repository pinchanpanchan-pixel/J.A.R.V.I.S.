import { connectorById } from "@/connectors/registry";
import type { Skill, SkillContext } from "../types";

/**
 * Las apps conectadas en la v2: Todoist, Strava, Outlook, archivos (Drive, Docs, Sheets,
 * Slides, OneDrive, Canva), YouTube y Google Maps (estas dos sin cuenta).
 */
type Found = { connected: boolean; files: Array<{ name: string; url: string; modified: string | null }> };

const NEEDS = (id: string) => `Para eso conecta ${connectorById(id)?.name ?? id} en Ajustes → Conexiones, hermano.`;
const UPSELL = "Para eso necesito conectar tus apps, y eso es de Pro Lite o Pro.";

const FILE_KIND: Array<[RegExp, string[]]> = [
  [/\b(hoja|hojas de calculo|excel|tabla)\b/, ["google_sheets", "onedrive"]],
  [/\b(presentacion|diapositivas|slides)\b/, ["google_slides", "onedrive"]],
  [/\b(diseno|disenos|canva)\b/, ["canva"]],
  [/\b(documento|doc|docs|texto)\b/, ["google_docs", "onedrive"]],
  [/\b(archivo|fichero|pdf)\b/, ["google_drive", "onedrive"]],
];

const clean = (s: string) => s.replace(/[¿?¡!.]+$/g, "").trim();

export const apps: Skill = {
  id: "apps",
  name: "Apps conectadas",
  description: "Tareas, entrenos, Outlook, archivos, YouTube y rutas.",
  triggerKeywords: ["mis tareas", "nueva tarea", "mi ultimo entreno", "outlook", "busca el documento", "ponme en youtube", "llevame a"],
  match(t, raw) {
    const m = (re: RegExp) => re.exec(t);
    let x: RegExpExecArray | null;
    if ((x = m(/^(?:anade|crea|nueva|apunta(?:me)?) (?:una )?tarea:? (.+)$/))) return { kind: "todo_add", text: clean(raw.split(/tarea:?/i).slice(1).join("tarea").trim() || x[1]) };
    if (m(/\b(mis tareas|que tareas tengo|tareas de hoy|que tengo pendiente|todoist)\b/)) return { kind: "todo_list" };
    if (m(/\b(ultimo entreno|ultimos entrenos|mis entrenos|strava|cuanto he corrido|mi ultima carrera|ultima salida en bici)\b/)) return { kind: "strava" };
    if (m(/\b(outlook|hotmail)\b/)) return { kind: "outlook" };
    if ((x = m(/^(?:llevame|como llego|ruta|indicaciones|navega|vamos) (?:a|hasta|hacia) (?:la |el |los |las )?(.+)$/))) return { kind: "maps", place: clean(raw.replace(/^.*?\b(?:a|hasta|hacia)\s+/i, "")) || x[1] };
    if ((x = m(/\b(?:pon(?:me)?|busca(?:me)?|reproduce)\b (.+?) en youtube\b/)) || (x = m(/\byoutube:? (.+)$/))) return { kind: "youtube", query: x[1] };
    if ((x = m(/\b(?:busca(?:me)?|encuentra(?:me)?|donde (?:esta|tengo)) (?:el |la |mi |un |una |los |las )?(documento|doc|hoja(?: de calculo)?|excel|presentacion|diapositivas|diseno|archivo|fichero|pdf)s? (?:de |del |sobre |llamad[oa] |que se llama )?(.+)$/)))
      return { kind: "files", what: x[1], query: x[2] };
    return null;
  },
  async execute(ctx: SkillContext, raw, m) {
    const kind = String(m.kind);
    if (kind === "maps") {
      const place = String(m.place);
      return { reply: `Te abro la ruta a ${place} en Google Maps.`, openUrl: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place)}` };
    }
    if (kind === "youtube") {
      const r = await ctx.connector<{ url: string; title: string | null }>("youtube", { action: "find", query: String(m.query) }).catch(() => ({
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(String(m.query))}`,
        title: null,
      }));
      return { reply: r.title ? `Te pongo «${r.title}».` : `Te busco «${m.query}» en YouTube.`, openUrl: r.url };
    }
    if (!ctx.features.connectors) return { reply: UPSELL };

    if (kind === "todo_add") {
      const r = await ctx.connector<{ connected: boolean; ok: boolean }>("todoist", { action: "add", content: String(m.text) });
      if (!r.connected) return { reply: NEEDS("todoist") };
      return { reply: r.ok ? `Apuntado en Todoist: «${m.text}».` : "Todoist no me ha dejado guardarla. Prueba en un rato." };
    }
    if (kind === "todo_list") {
      const r = await ctx.connector<{ connected: boolean; tasks: Array<{ content: string; due: string | null; overdue: boolean }> }>("todoist", { action: "tasks" });
      if (!r.connected) return { reply: NEEDS("todoist") };
      if (!r.tasks.length) return { reply: "Hoy no tienes tareas en Todoist. Día libre, hermano." };
      const lines = r.tasks.map((t) => `- ${t.content}${t.overdue ? " (atrasada)" : ""}`).join("\n");
      return { reply: await ctx.askBrain(raw, `Tareas de hoy en Todoist:\n${lines}\nCuéntaselas en 1-3 frases, primero las atrasadas.`) };
    }
    if (kind === "strava") {
      const r = await ctx.connector<{ connected: boolean; activities: Array<{ name: string; type: string; km: number; minutes: number; date: string }> }>("strava", { action: "recent" });
      if (!r.connected) return { reply: NEEDS("strava") };
      if (!r.activities.length) return { reply: "No veo entrenos recientes en Strava. ¿Salimos a sumar uno?" };
      const lines = r.activities.map((a) => `- ${a.date.slice(0, 10)} ${a.type} «${a.name}»: ${a.km} km en ${a.minutes} min`).join("\n");
      return { reply: await ctx.askBrain(raw, `Últimos entrenos en Strava:\n${lines}\nResponde con ánimo de hermano mayor, en 2 frases.`) };
    }
    if (kind === "outlook") {
      const r = await ctx.connector<{ connected: boolean; emails: Array<{ from: string; subject: string }> }>("outlook", { action: "unread" });
      if (!r.connected) return { reply: NEEDS("outlook") };
      if (!r.emails.length) return { reply: "Outlook limpio, hermano. Nada sin leer." };
      return { reply: await ctx.askBrain(raw, `Correos sin leer en Outlook:\n${r.emails.map((e) => `- ${e.from}: ${e.subject}`).join("\n")}\nResume lo importante en 2 frases.`) };
    }
    if (kind === "files") {
      const what = String(m.what);
      const providers = FILE_KIND.find(([re]) => re.test(what))?.[1] ?? ["google_drive", "onedrive"];
      const results = await Promise.all(providers.map((p) => ctx.connector<Found>(p, { action: "search", query: String(m.query) }).catch(() => ({ connected: false, files: [] }) as Found)));
      if (!results.some((r) => r.connected)) return { reply: NEEDS(providers[0]) };
      const files = results.flatMap((r) => r.files);
      if (!files.length) return { reply: `No encuentro nada sobre «${m.query}», hermano.` };
      const top = files[0];
      return { reply: files.length === 1 ? `Lo tengo: «${top.name}». Te lo abro.` : `He encontrado ${files.length}. Te abro el más reciente: «${top.name}».`, openUrl: top.url };
    }
    return null;
  },
};
