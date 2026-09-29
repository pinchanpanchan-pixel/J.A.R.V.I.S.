// GENERADO por scripts/sync_edge_shared.mjs — no editar a mano.
/**
 * Evaluador de expresiones cron de 5 campos (min hora día-mes mes día-semana).
 * Soporta *, números, listas (1,2), rangos (1-5) y pasos (*\/15). Usado por las
 * automatizaciones del hogar en el cliente y en la Edge Function.
 */
function fieldMatches(field: string, value: number, min: number, max: number): boolean {
  return field.split(",").some((part) => {
    const [rangePart, stepStr] = part.split("/");
    const step = stepStr ? Number(stepStr) : 1;
    let lo = min;
    let hi = max;
    if (rangePart !== "*") {
      const [a, b] = rangePart.split("-").map(Number);
      lo = a;
      hi = b ?? (stepStr ? max : a);
    }
    if (Number.isNaN(lo) || Number.isNaN(hi) || step <= 0) return false;
    return value >= lo && value <= hi && (value - lo) % step === 0;
  });
}

export function isValidCron(expr: string): boolean {
  const f = expr.trim().split(/\s+/);
  return f.length === 5 && f.every((x) => /^(\*|\d+(-\d+)?)(\/\d+)?(,(\*|\d+(-\d+)?)(\/\d+)?)*$/.test(x));
}

/** Partes de la fecha en una zona horaria concreta. */
export function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    minute: "numeric",
    hour: "numeric",
    day: "numeric",
    month: "numeric",
    weekday: "short",
    year: "numeric",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return {
    minute: Number(get("minute")),
    hour: Number(get("hour")) % 24,
    day: Number(get("day")),
    month: Number(get("month")),
    year: Number(get("year")),
    dow,
  };
}

export function cronMatches(expr: string, date: Date, timeZone = "UTC"): boolean {
  if (!isValidCron(expr)) return false;
  const [m, h, dom, mon, dow] = expr.trim().split(/\s+/);
  const p = zonedParts(date, timeZone);
  return (
    fieldMatches(m, p.minute, 0, 59) &&
    fieldMatches(h, p.hour, 0, 23) &&
    fieldMatches(dom, p.day, 1, 31) &&
    fieldMatches(mon, p.month, 1, 12) &&
    fieldMatches(dow, p.dow, 0, 6)
  );
}

/** Clave única por minuto (evita ejecutar dos veces la misma automatización). */
export function minuteKey(date: Date, timeZone = "UTC"): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
