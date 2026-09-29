/** Búsqueda full-text local (sin acentos, por términos, con pesos). Funciona offline. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}#\s]/gu, " ");
}

const STOP = new Set("el la los las un una unos unas de del y o a en que por para con sin mi tu su lo le se al es".split(" "));

export function terms(q: string): string[] {
  return normalize(q)
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

export interface Searchable {
  title?: string | null;
  content?: string | null;
  tags?: string[] | null;
}

export function scoreItem(item: Searchable, qTerms: string[]): number {
  if (qTerms.length === 0) return 1;
  const title = normalize(item.title ?? "");
  const content = normalize(item.content ?? "");
  const tags = (item.tags ?? []).map(normalize);
  let score = 0;
  for (const t of qTerms) {
    let hit = 0;
    if (tags.some((g) => g === t || g === `#${t}`)) hit += 5;
    if (title.includes(t)) hit += 3;
    if (content.includes(t)) hit += 1 + Math.min(3, content.split(t).length - 2) * 0.25;
    if (hit === 0) return 0; // todos los términos deben aparecer (AND)
    score += hit;
  }
  return score;
}

export function searchItems<T extends Searchable>(items: T[], query: string, limit = 200): T[] {
  const q = terms(query);
  if (q.length === 0) return items.slice(0, limit);
  return items
    .map((it) => ({ it, s: scoreItem(it, q) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.it);
}
