import { normalize, terms } from "@/lib/search";
import { localDate } from "@/lib/dates";
import type { DiaryEntryRow, MemoryBlockRow, QuickNoteRow } from "@/types/db";

/**
 * Qué recuerda J.A.R.V.I.S. antes de responder: busca en bloques de memoria, notas rápidas
 * y diario (resumen, momentos clave, pensamientos y emociones; el texto completo va cifrado).
 * A diferencia del buscador de Memorias (que exige todas las palabras), aquí basta con que
 * coincidan algunas: las preguntas habladas son largas y con palabras que no están en la nota.
 */
interface Item {
  label: string;
  text: string;
  tags: string[];
  date: string;
  pinned?: boolean;
}

const tokenize = (s: string) => normalize(s).split(/\s+/).filter(Boolean);

function hits(qTerms: string[], item: Item): number {
  const words = new Set(tokenize(`${item.label} ${item.text}`));
  const tags = new Set(item.tags.map((t) => normalize(t).replace(/^#/, "").trim()));
  let score = 0;
  for (const t of qTerms) {
    const stem = t.length >= 6 ? t.slice(0, t.length - 2) : t; // cumpleaños ~ cumpleaño, médica ~ médico
    if (tags.has(t)) score += 3;
    else if (words.has(t)) score += 2;
    else if (t.length >= 5 && [...words].some((w) => w.startsWith(stem))) score += 1;
  }
  return score;
}

export function recallMemories(
  data: { blocks: MemoryBlockRow[]; notes: QuickNoteRow[]; diary: DiaryEntryRow[] },
  query: string,
  now = new Date(),
  limit = 10,
): string[] {
  const items: Item[] = [
    ...data.blocks.map((b) => ({ label: `memoria · ${b.title}`, text: b.content, tags: b.tags ?? [], date: (b.original_date ?? b.created_at).slice(0, 10) })),
    ...data.notes.map((n) => ({ label: "nota", text: n.content, tags: [n.category], date: n.created_at.slice(0, 10), pinned: n.pinned })),
    ...data.diary.map((d) => ({
      label: `diario ${d.entry_date}`,
      text: [d.summary, ...(d.key_events ?? []), ...(d.thoughts ?? [])].filter(Boolean).join(". "),
      tags: [...(d.emotions ?? []), ...(d.tags ?? [])],
      date: d.entry_date,
    })),
  ];
  const q = terms(query);
  const t = normalize(query);
  // Referencias a días concretos: «ayer», «hoy», «esta semana», «el diario».
  const day = (offset: number) => localDate(new Date(now.getTime() + offset * 86400000));
  const wanted = new Set<string>();
  if (/\bayer\b|yesterday/.test(t)) wanted.add(day(-1));
  if (/\bhoy\b|today/.test(t)) wanted.add(day(0));
  if (/\bsemana\b|week/.test(t)) for (let i = 0; i < 7; i++) wanted.add(day(-i));
  const aboutDiary = /\bdiario\b|como me (he )?sentido|mi animo|emociones/.test(t);

  const scored = items
    .map((it) => {
      let s = hits(q, it);
      if (wanted.has(it.date)) s += 4;
      if (aboutDiary && it.label.startsWith("diario")) s += 2;
      if (it.pinned) s += 0.5;
      return { it, s: s > 0 ? s + (Date.parse(it.date) || 0) / 1e14 : 0 }; // desempate: lo más reciente
    })
    .filter((x) => x.s >= 1)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit);
  return scored.map(({ it }) => `[${it.label}${it.label.startsWith("diario") ? "" : ` · ${it.date}`}] ${it.text}`.slice(0, 600));
}
