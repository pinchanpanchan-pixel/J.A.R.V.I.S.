import { describe, it, expect } from "vitest";
import { recallMemories } from "@/lib/brain/recall";
import type { DiaryEntryRow, MemoryBlockRow, QuickNoteRow } from "@/types/db";

const base = { user_id: "u", updated_at: "2026-09-01T00:00:00Z" };
const block = (id: string, title: string, content: string, tags: string[] = []) =>
  ({ ...base, id, title, content, tags, source: "manual", original_date: null, metadata: {}, created_at: "2026-09-01T10:00:00Z" }) as MemoryBlockRow;
const note = (id: string, content: string, created_at = "2026-09-20T10:00:00Z") => ({ ...base, id, content, category: "quick_notes", pinned: false, source: "manual", created_at }) as QuickNoteRow;
const diary = (entry_date: string, summary: string, emotions: string[] = []) =>
  ({ ...base, id: entry_date, entry_date, summary, emotions, key_events: [], thoughts: [], tags: [], content_ciphertext: null, sentiment: 0, input_mode: "text", audio_path: null, created_at: `${entry_date}T21:00:00Z` }) as DiaryEntryRow;

describe("memoria del cerebro", () => {
  const data = {
    blocks: [block("b1", "Cumpleaños de mamá", "El cumpleaños de mi madre es el 14 de marzo", ["familia"]), block("b2", "Wifi", "La clave del wifi es pato123")],
    notes: [note("n1", "Comprar pilas para el mando"), note("n2", "Llamar a la médica el lunes")],
    diary: [diary("2026-09-30", "Día duro en el trabajo, discusión con el jefe", ["estrés"]), diary("2026-09-10", "Fin de semana en la playa", ["calma"])],
  };

  it("encuentra un bloque aunque la pregunta tenga más palabras", () => {
    const r = recallMemories(data, "¿Cuándo es el cumpleaños de mi madre?", new Date("2026-10-01T09:00:00"));
    expect(r[0]).toContain("14 de marzo");
  });

  it("incluye notas rápidas", () => {
    expect(recallMemories(data, "¿qué tenía que comprar?", new Date("2026-10-01T09:00:00")).join(" ")).toContain("pilas");
  });

  it("«ayer» trae la entrada del diario de ayer", () => {
    const r = recallMemories(data, "¿qué tal me fue ayer?", new Date("2026-10-01T09:00:00"));
    expect(r[0]).toContain("discusión con el jefe");
  });

  it("si nada tiene que ver, no inventa recuerdos", () => {
    expect(recallMemories(data, "cuéntame un chiste", new Date("2026-10-01T09:00:00"))).toEqual([]);
  });
});
