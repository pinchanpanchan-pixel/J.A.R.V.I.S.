/**
 * Parser de exportaciones de WhatsApp (_chat.txt / "Chat de WhatsApp con X.txt").
 * Soporta iOS «[29/09/26, 13:45:12] Nombre: texto» y Android «29/09/26, 13:45 - Nombre: texto»,
 * 12 h (AM/PM, «a. m.») y 24 h, fechas dd/mm y mm/dd (se detecta), mensajes multilínea,
 * adjuntos («<attached: …>», «<adjunto: …>», «IMG-… (archivo adjunto)») y multimedia omitida.
 */
export interface WaMessage {
  date: Date;
  author: string | null; // null = mensaje del sistema
  text: string;
  media: string | null;
}

export interface WaChat {
  messages: WaMessage[];
  participants: string[];
  dateOrder: "dmy" | "mdy";
}

const IOS = /^‎?\[(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]\.?\s?m\.?)?\]\s(.*)$/i;
const ANDROID = /^‎?(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]\.?\s?m\.?)?\s[-–]\s(.*)$/i;
const MEDIA_PATTERNS = [
  /<(?:attached|adjunto|archivo adjunto):\s*([^>]+)>/i,
  /^([\w-]+\.(?:jpe?g|png|webp|heic|gif|mp4|mov|3gp|opus|ogg|m4a|mp3|pdf|docx?|xlsx?|vcf|webm))\s*\((?:archivo adjunto|file attached)\)/i,
];
const OMITTED = /^<(multimedia omitido|media omitted|imagen omitida|image omitted|video omitido|audio omitido|sticker omitido)>$/i;

interface RawLine {
  a: number;
  b: number;
  y: number;
  h: number;
  m: number;
  s: number;
  ampm: string | undefined;
  rest: string;
}

function matchLine(line: string): RawLine | null {
  const m = line.match(IOS) ?? line.match(ANDROID);
  if (!m) return null;
  return { a: +m[1], b: +m[2], y: +m[3], h: +m[4], m: +m[5], s: m[6] ? +m[6] : 0, ampm: m[7], rest: m[8] };
}

export function parseWhatsApp(raw: string): WaChat {
  const lines = raw.replace(/\r\n?/g, "\n").replace(/ | /g, " ").split("\n");
  const parsed: Array<{ r: RawLine | null; line: string }> = lines.map((line) => ({ r: matchLine(line), line }));

  // dd/mm o mm/dd: si algún primer número > 12 es día-mes; si el segundo > 12, mes-día.
  let order: "dmy" | "mdy" = "dmy";
  for (const { r } of parsed) {
    if (!r) continue;
    if (r.a > 12) {
      order = "dmy";
      break;
    }
    if (r.b > 12) {
      order = "mdy";
      break;
    }
  }

  const messages: WaMessage[] = [];
  for (const { r, line } of parsed) {
    if (!r) {
      // Continuación de un mensaje multilínea
      const last = messages[messages.length - 1];
      if (last && line.trim()) last.text += `\n${line.replace(/^‎/, "")}`;
      continue;
    }
    const day = order === "dmy" ? r.a : r.b;
    const month = order === "dmy" ? r.b : r.a;
    const year = r.y < 100 ? 2000 + r.y : r.y;
    let hour = r.h;
    if (r.ampm) {
      const pm = /^p/i.test(r.ampm);
      if (pm && hour < 12) hour += 12;
      if (!pm && hour === 12) hour = 0;
    }
    const date = new Date(year, month - 1, day, hour, r.m, r.s);
    const sep = r.rest.indexOf(": ");
    const author = sep > 0 && sep < 60 ? r.rest.slice(0, sep).replace(/^‎/, "").trim() : null;
    let text = (author ? r.rest.slice(sep + 2) : r.rest).replace(/^‎/, "").trim();
    let media: string | null = null;
    for (const re of MEDIA_PATTERNS) {
      const mm = text.match(re);
      if (mm) {
        media = mm[1].trim();
        text = text.replace(re, "").trim();
        break;
      }
    }
    if (OMITTED.test(text)) {
      media = "(omitido)";
      text = "";
    }
    messages.push({ date, author, text, media });
  }

  const participants = Array.from(new Set(messages.map((m) => m.author).filter((a): a is string => !!a)));
  return { messages, participants, dateOrder: order };
}

/** Nombre del chat a partir del nombre de archivo. */
export function chatNameFromFile(fileName: string): string {
  const base = fileName.replace(/\.(zip|txt)$/i, "").replace(/^_chat$/i, "");
  const m = base.match(/(?:WhatsApp Chat (?:with|-)|Chat de WhatsApp con|Conversación de WhatsApp con)\s*(.+)$/i);
  return (m ? m[1] : base).trim() || "WhatsApp";
}

export interface WaDayBlock {
  day: string; // YYYY-MM-DD
  title: string;
  content: string;
  firstAt: Date;
  messages: number;
  media: string[];
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Agrupa por día (y trocea días muy largos) para guardarlos como bloques de memoria. */
export function groupByDay(chat: WaChat, chatName: string, maxChars = 6000): WaDayBlock[] {
  const byDay = new Map<string, WaMessage[]>();
  for (const m of chat.messages) {
    if (!m.author && !m.text) continue;
    const key = `${m.date.getFullYear()}-${pad(m.date.getMonth() + 1)}-${pad(m.date.getDate())}`;
    byDay.set(key, [...(byDay.get(key) ?? []), m]);
  }
  const out: WaDayBlock[] = [];
  for (const [day, msgs] of byDay) {
    const label = msgs[0].date.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
    let chunk: string[] = [];
    let size = 0;
    let part = 1;
    let chunkFirst = msgs[0];
    let media: string[] = [];
    let count = 0;
    const flush = () => {
      if (!chunk.length) return;
      out.push({
        day,
        title: `WhatsApp · ${chatName} · ${label}${part > 1 || size > maxChars ? ` (${part})` : ""}`,
        content: chunk.join("\n"),
        firstAt: chunkFirst.date,
        messages: count,
        media,
      });
      part++;
      chunk = [];
      size = 0;
      media = [];
      count = 0;
    };
    for (const m of msgs) {
      const line = `${pad(m.date.getHours())}:${pad(m.date.getMinutes())} ${m.author ?? "·"}: ${m.text}${m.media ? ` [${m.media}]` : ""}`.trim();
      if (size + line.length > maxChars && chunk.length) {
        flush();
        chunkFirst = m;
      }
      chunk.push(line);
      size += line.length + 1;
      count++;
      if (m.media && m.media !== "(omitido)") media.push(m.media);
    }
    flush();
  }
  return out.sort((a, b) => a.firstAt.getTime() - b.firstAt.getTime());
}
