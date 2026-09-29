// GENERADO por scripts/sync_edge_shared.mjs — no editar a mano.
import type { DeviceState, DeviceType, SmartHomeDeviceRow } from "./types.ts";

/**
 * homeController — entiende órdenes del hogar en lenguaje natural y las enruta al
 * adaptador de cada fabricante (connectors/home). Lógica de parseo pura y testeable.
 *   «apaga todas las luces» · «pon luz roja al 50 %» · «enciende el aire»
 *   «pon el aire a 22» · «apaga la luz del salón» · «apaga todo a las 11pm» (automatización)
 */
export interface HomeTarget {
  all: boolean;
  types: DeviceType[] | null;
  room: string | null;
  names: string[];
}

export interface HomeIntent {
  kind: "control" | "automation" | "unknown";
  target: HomeTarget;
  patch: DeviceState;
  cron?: string;
  /** Descripción legible de la hora programada. */
  when?: string;
  /** Orden sin la parte temporal (lo que ejecutará la automatización). */
  command: string;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[¿?¡!.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const COLORS: Record<string, string> = {
  rojo: "#FF3B30", roja: "#FF3B30", verde: "#34D399", azul: "#38BDF8", amarillo: "#F5C451", amarilla: "#F5C451",
  naranja: "#FF9F0A", morado: "#A78BFA", morada: "#A78BFA", lila: "#C4B5FD", violeta: "#8B5CF6", rosa: "#F472B6",
  blanco: "#FFFFFF", blanca: "#FFFFFF", calido: "#FFE8C2", calida: "#FFE8C2", frio: "#DDEBFF", fria: "#DDEBFF", cian: "#64FFDA",
};

const NUMBER_WORDS: Record<string, number> = {
  uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
  veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100,
};

const ON = /\b(enciende|encienda|prende|prendeme|activa|conecta|pon(?:me)?|sube)\b/;
const OFF = /\b(apaga|apagame|apague|desactiva|desconecta|quita)\b/;

/** «a las 11pm», «a las 23:30», «a las once de la noche», «a las 7 de la manana» -> {h, m} */
export function parseTime(t: string): { h: number; m: number } | null {
  const m = t.match(/\ba las? (\d{1,2}|[a-z]+)(?::(\d{2})| y (media|cuarto))?\s*(am|pm|de la manana|de la tarde|de la noche|de la madrugada)?/);
  if (!m) return null;
  let h = /^\d+$/.test(m[1]) ? Number(m[1]) : NUMBER_WORDS[m[1]];
  if (h === undefined || h > 23) return null;
  let min = m[2] ? Number(m[2]) : m[3] === "media" ? 30 : m[3] === "cuarto" ? 15 : 0;
  const suffix = m[4] ?? "";
  if ((suffix === "pm" || suffix.includes("tarde") || suffix.includes("noche")) && h < 12) h += 12;
  if ((suffix === "am" || suffix.includes("madrugada") || suffix.includes("manana")) && h === 12) h = 0;
  if (min > 59) min = 0;
  return { h, m: min };
}

function parseBrightness(t: string): number | undefined {
  const pct = t.match(/\b(?:al?|a un|en)?\s*(\d{1,3})\s*(?:%|por ?ciento)/);
  if (pct) return Math.max(1, Math.min(100, Number(pct[1])));
  const word = t.match(/\bal? (\w+) por ?ciento/);
  if (word && NUMBER_WORDS[word[1]]) return NUMBER_WORDS[word[1]];
  if (/\b(a la mitad|al medio)\b/.test(t)) return 50;
  if (/\bal maximo\b/.test(t)) return 100;
  if (/\bal minimo\b/.test(t)) return 5;
  return undefined;
}

export function parseHomeCommand(input: string, rooms: string[] = [], deviceNames: string[] = []): HomeIntent {
  const t = norm(input);
  const target: HomeTarget = { all: false, types: null, room: null, names: [] };
  const patch: DeviceState = {};

  // --- Objetivo
  if (/\b(todo|toda la casa|todos los dispositivos)\b/.test(t) && !/\btodas? las? luz|luces\b/.test(t)) target.all = true;
  if (/\bluz|luces|lampara|lamparas|bombilla|tira led\b/.test(t)) target.types = ["light"];
  if (/\baire|aire acondicionado|clima|climatizador|calefaccion\b/.test(t)) target.types = ["ac"];
  if (/\benchufe|enchufes\b/.test(t)) target.types = ["plug"];
  if (/\bmusica|altavoz|echo\b/.test(t) && !target.types) target.types = ["speaker"];
  for (const r of rooms) if (t.includes(norm(r))) target.room = r;
  for (const n of deviceNames) {
    const nn = norm(n);
    if (nn.length > 2 && t.includes(nn)) target.names.push(n);
  }
  if (target.names.length) target.types = null;

  // --- Acción
  const color = Object.keys(COLORS).find((c) => new RegExp(`\\b(luz|color|en|de)? ?${c}\\b`).test(t) && /\b(luz|luces|color|pon|lampara|tira)\b/.test(t));
  const brightness = parseBrightness(t);
  const temp = t.match(/\b(?:a|en)\s*(\d{2})\s*(?:grados|º|°)?/);
  if (OFF.test(t)) patch.on = false;
  else if (ON.test(t) || color || brightness !== undefined) patch.on = true;
  if (color) patch.color = COLORS[color];
  if (brightness !== undefined) patch.brightness = brightness;
  if (target.types?.includes("ac") && temp && Number(temp[1]) >= 16 && Number(temp[1]) <= 30) {
    patch.temperature = Number(temp[1]);
    patch.on = true;
  }
  if (/\bsube (la )?temperatura\b/.test(t)) patch.temperatureDelta = 1;
  if (/\bbaja (la )?temperatura\b/.test(t)) patch.temperatureDelta = -1;
  if (/\bmas (brillo|luz)\b/.test(t)) patch.brightnessDelta = 20;
  if (/\bmenos (brillo|luz)\b/.test(t)) patch.brightnessDelta = -20;

  const hasAction = Object.keys(patch).length > 0;
  const hasTarget = target.all || !!target.types || !!target.room || target.names.length > 0;
  if (!hasAction || !hasTarget) return { kind: "unknown", target, patch, command: input };

  // --- ¿Programado?
  const time = parseTime(t);
  const command = input.replace(/\s*(todos los dias |cada dia |cada noche )?a las? .*$/i, "").trim();
  if (time) {
    const hh = String(time.h).padStart(2, "0");
    const mm = String(time.m).padStart(2, "0");
    return { kind: "automation", target, patch, cron: `${time.m} ${time.h} * * *`, when: `${hh}:${mm}`, command };
  }
  return { kind: "control", target, patch, command };
}

/** Dispositivos afectados por una orden. */
export function selectDevices(devices: SmartHomeDeviceRow[], target: HomeTarget): SmartHomeDeviceRow[] {
  return devices.filter((d) => {
    if (target.names.length) return target.names.some((n) => norm(n) === norm(d.name));
    if (target.room && norm(d.room ?? "") !== norm(target.room)) return false;
    if (target.types && !target.types.includes(d.type)) return false;
    if (target.all) return d.type !== "sensor";
    return !!target.types || !!target.room;
  });
}

/** Nuevo estado de un dispositivo tras aplicar la orden (incluye deltas). */
export function applyPatch(d: SmartHomeDeviceRow, patch: DeviceState): DeviceState {
  const next: DeviceState = { ...d.state };
  for (const [k, v] of Object.entries(patch)) {
    if (k === "temperatureDelta") next.temperature = Math.max(16, Math.min(30, Number(d.state.temperature ?? 23) + Number(v)));
    else if (k === "brightnessDelta") next.brightness = Math.max(1, Math.min(100, Number(d.state.brightness ?? 60) + Number(v)));
    else if (k === "color" && d.type !== "light") continue;
    else if (k === "brightness" && d.type !== "light") continue;
    else if (k === "temperature" && d.type !== "ac") continue;
    else next[k] = v;
  }
  if (patch.temperatureDelta || patch.brightnessDelta) next.on = true;
  return next;
}

export function describeIntent(intent: HomeIntent, count: number): string {
  const what = intent.patch.on === false ? "apagado" : intent.patch.color ? "cambiado de color" : intent.patch.brightness !== undefined ? `puesto al ${intent.patch.brightness} %` : intent.patch.temperature ? `puesto a ${intent.patch.temperature} grados` : "encendido";
  if (count === 0) return "No encuentro ese dispositivo, hermano. Revisa la pestaña Hogar.";
  return `Hecho, hermano: ${count === 1 ? "lo he" : `${count} dispositivos`} ${count === 1 ? "" : "he "}${what}.`.replace("  ", " ");
}
