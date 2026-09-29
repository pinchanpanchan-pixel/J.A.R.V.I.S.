"use client";
import { Suspense, useMemo, useState } from "react";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Calendar, Lock, PenLine, Search, X } from "lucide-react";
import { DiaryTimeline, EMOTION_EMOJI } from "@/components/DiaryTimeline";
import { Sheet } from "@/components/ui/Sheet";
import { useTable } from "@/hooks/useTable";
import { useProfile } from "@/hooks/useProfile";
import { useSync } from "@/components/providers/SyncProvider";
import { apiJson } from "@/lib/api";
import { isMockMode } from "@/lib/env";
import { DictateButton } from "@/components/DictateButton";
import type { DiaryAnalysis } from "@/lib/diary/analysis";
import { searchItems } from "@/lib/search";
import { localDate } from "@/lib/dates";

function DiaryInner() {
  const { features, userName, profile } = useProfile();
  const { engine } = useSync();
  const { rows } = useTable("diary_entries");
  const [query, setQuery] = useState("");
  const [emotion, setEmotion] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<"text" | "voice">("text");
  const params = useSearchParams();
  useEffect(() => {
    if (params.get("write") === "1") setWriting(true);
  }, [params]);

  const emotions = useMemo(() => Array.from(new Set(rows.flatMap((r) => r.emotions))).slice(0, 12), [rows]);
  const filtered = useMemo(() => {
    let list = rows;
    if (emotion) list = list.filter((r) => r.emotions.includes(emotion));
    if (date) list = list.filter((r) => r.entry_date === date);
    return searchItems(list.map((r) => ({ ...r, title: r.summary ?? "", content: r.key_events.join(" ") })), query);
  }, [rows, emotion, date, query]);

  const save = async () => {
    if (!engine || !text.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const keys = isMockMode ? (await engine.list("ai_provider_keys")).map((k) => ({ id: k.id, provider: k.provider, key_ciphertext: k.key_ciphertext, enabled: k.enabled })) : undefined;
      const { analysis, ciphertext } = await apiJson<{ analysis: DiaryAnalysis; ciphertext: string }>("/api/diary/analyze", {
        method: "POST",
        body: JSON.stringify({ text: text.trim(), userName, keys }),
      });
      await engine.insert("diary_entries", {
        entry_date: localDate(),
        content_ciphertext: ciphertext,
        summary: analysis.summary,
        sentiment: analysis.sentiment,
        emotions: analysis.emotions,
        key_events: analysis.key_events,
        thoughts: analysis.thoughts,
        tags: analysis.tags,
        input_mode: inputMode,
        audio_path: null,
      });
      setText("");
      setWriting(false);
    } catch {
      setError("Necesito conexión para cifrar tu diario. Tu texto sigue aquí.");
    } finally {
      setSaving(false);
    }
  };

  if (!features.diary) {
    return (
      <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-3 px-6 text-center">
        <Lock className="h-8 w-8 text-gold" />
        <h1 className="text-xl font-semibold">Tu diario privado</h1>
        <p className="text-sm text-white/60">Cada día te pregunto cómo te fue, lo guardo cifrado y detecto cómo te sientes. Disponible en Pro Lite y Pro.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Diario</h1>
          <p className="text-xs text-white/45">
            <Lock className="mr-1 inline h-3 w-3" />
            Privado y cifrado · te pregunto a las {profile?.diary_reminder_time ?? "22:30"}
          </p>
        </div>
        <button onClick={() => setWriting(true)} className="jv-btn-primary px-4 py-2.5 text-sm">
          <PenLine className="h-4 w-4" /> Hoy
        </button>
      </header>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input className="jv-input pl-11" placeholder="Buscar en tu diario…" value={query} onChange={(e) => setQuery(e.target.value)} type="search" />
        </div>
        <label className="relative flex w-14 cursor-pointer items-center justify-center rounded-2xl border border-white/10 bg-white/5" aria-label="Filtrar por fecha">
          <Calendar className={`h-5 w-5 ${date ? "text-arc" : "text-white/50"}`} />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="absolute inset-0 opacity-0 [color-scheme:dark]" />
        </label>
      </div>

      {(emotions.length > 0 || date) && (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {date && (
            <button onClick={() => setDate("")} className="flex shrink-0 items-center gap-1 rounded-full bg-arc px-3 py-1.5 text-xs font-semibold text-navy-900">
              {date} <X className="h-3 w-3" />
            </button>
          )}
          {emotions.map((m) => (
            <button
              key={m}
              onClick={() => setEmotion(emotion === m ? null : m)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${emotion === m ? "bg-arc font-semibold text-navy-900" : "bg-white/[0.06] text-white/70"}`}
            >
              {EMOTION_EMOJI[m] ?? "•"} {m}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-white/40">{rows.length ? "Nada con esos filtros." : `Aún no hay entradas. Cuéntame cómo fue hoy, ${userName}.`}</p>
      ) : (
        <DiaryTimeline entries={filtered} />
      )}

      <Sheet open={writing} onClose={() => setWriting(false)} title={`Hermano, ¿cómo fue hoy?`}>
        <textarea className="jv-input min-h-[200px] resize-y" placeholder="Cuéntamelo todo. Solo lo vamos a saber tú y yo." value={text} onChange={(e) => setText(e.target.value)} autoFocus />
        <div className="mt-2 flex items-center justify-between">
          <DictateButton
            onText={(t) => {
              setInputMode("voice");
              setText((prev) => (prev ? `${prev} ${t}` : t));
            }}
          />
          <span className="text-[11px] text-white/35">Analizo emociones y momentos clave, y lo cifro.</span>
        </div>
        {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
        <button onClick={() => void save()} disabled={saving || !text.trim()} className="jv-btn-primary mt-3 w-full">
          <Lock className="h-4 w-4" /> Guardar cifrado
        </button>
      </Sheet>
    </div>
  );
}

export default function DiaryPage() {
  return (
    <Suspense>
      <DiaryInner />
    </Suspense>
  );
}
