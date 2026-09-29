"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Pin, Plus, Search, Trash2, X } from "lucide-react";
import { MemoryCard, formatWhen } from "@/components/MemoryCard";
import { PhotoCapture } from "@/components/PhotoCapture";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { byCreatedDesc, useTable } from "@/hooks/useTable";
import { useSync } from "@/components/providers/SyncProvider";
import { useProfile } from "@/hooks/useProfile";
import { searchItems } from "@/lib/search";
import type { MemoryBlockRow } from "@/types/db";

type Tab = "blocks" | "notes";

function parseTags(s: string): string[] {
  return Array.from(new Set(s.split(/[,\s]+/).map((t) => t.replace(/^#/, "").trim().toLowerCase()).filter(Boolean))).slice(0, 12);
}

function Editor({ block, onClose, limitReached }: { block: MemoryBlockRow | "new" | null; onClose: () => void; limitReached: boolean }) {
  const { engine } = useSync();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  useEffect(() => {
    if (block && block !== "new") {
      setTitle(block.title);
      setContent(block.content);
      setTags(block.tags.join(", "));
    } else {
      setTitle("");
      setContent("");
      setTags("");
    }
  }, [block]);

  const save = async () => {
    if (!engine || (!title.trim() && !content.trim())) return;
    const data = { title: title.trim(), content: content.trim(), tags: parseTags(tags) };
    if (block === "new") await engine.insert("memory_blocks", { ...data, source: "manual", metadata: {}, original_date: null });
    else if (block) await engine.update("memory_blocks", block.id, data);
    onClose();
  };
  const remove = async () => {
    if (engine && block && block !== "new") await engine.remove("memory_blocks", block.id);
    onClose();
  };

  return (
    <Sheet open={!!block} onClose={onClose} title={block === "new" ? "Nuevo bloque" : "Bloque de memoria"}>
      {block === "new" && limitReached ? (
        <p className="rounded-2xl bg-gold/10 p-4 text-sm text-gold">Has llegado a los 50 bloques del plan Free. Con Pro, memoria infinita, hermano.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <input className="jv-input text-base font-semibold" placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea className="jv-input min-h-[160px] resize-y" placeholder="Lo que quieras que recuerde…" value={content} onChange={(e) => setContent(e.target.value)} />
          <input className="jv-input" placeholder="Etiquetas: familia, trabajo…" value={tags} onChange={(e) => setTags(e.target.value)} />
          {block && block !== "new" && <p className="text-[11px] text-white/35">Creado {formatWhen(block.created_at)} · origen: {block.source}</p>}
          <div className="flex gap-2">
            {block !== "new" && (
              <button onClick={() => void remove()} className="jv-btn-ghost text-red-300" aria-label="Borrar">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button onClick={() => void save()} className="jv-btn-primary flex-1">
              Guardar
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function MemoriesInner() {
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>(params.get("tab") === "notes" ? "notes" : "blocks");
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [editing, setEditing] = useState<MemoryBlockRow | "new" | null>(null);
  const { engine } = useSync();
  const { features } = useProfile();
  const { rows: blocks } = useTable("memory_blocks", { sort: byCreatedDesc });
  const { rows: notes } = useTable("quick_notes", { sort: byCreatedDesc });

  useEffect(() => {
    if (params.get("tab") === "notes") setTab("notes");
  }, [params]);

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    blocks.forEach((b) => b.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 16)
      .map(([t]) => t);
  }, [blocks]);

  const filteredBlocks = useMemo(() => searchItems(tag ? blocks.filter((b) => b.tags.includes(tag)) : blocks, query), [blocks, query, tag]);
  const filteredNotes = useMemo(() => {
    const sorted = [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned));
    return searchItems(sorted.map((n) => ({ ...n, title: "", tags: [] })), query);
  }, [notes, query]);
  const limitReached = features.maxMemoryBlocks !== null && blocks.length >= features.maxMemoryBlocks;

  return (
    <div className="flex flex-col gap-4 pt-2">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Memorias</h1>
        {tab === "blocks" && (
          <div className="flex gap-2">
            <PhotoCapture autoOpen={params.get("photo") === "1"} />
          <button onClick={() => setEditing("new")} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-arc" aria-label="Nuevo bloque">
            <Plus className="h-5 w-5" />
          </button>
          </div>
        )}
      </header>
      <Segmented<Tab>
        id="mem-tab"
        value={tab}
        onChange={(t) => {
          setTab(t);
          setQuery("");
          setTag(null);
        }}
        options={[
          { value: "blocks", label: `Bloques · ${blocks.length}` },
          { value: "notes", label: `Notas rápidas · ${notes.length}` },
        ]}
      />
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
        <input className="jv-input pl-11" placeholder="Buscar en tu memoria…" value={query} onChange={(e) => setQuery(e.target.value)} type="search" />
      </div>

      {tab === "blocks" && allTags.length > 0 && (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {tag && (
            <button onClick={() => setTag(null)} className="flex shrink-0 items-center gap-1 rounded-full bg-arc px-3 py-1.5 text-xs font-semibold text-navy-900">
              #{tag} <X className="h-3 w-3" />
            </button>
          )}
          {allTags
            .filter((t) => t !== tag)
            .map((t) => (
              <button key={t} onClick={() => setTag(t)} className="shrink-0 rounded-full bg-white/[0.06] px-3 py-1.5 text-xs text-white/70">
                #{t}
              </button>
            ))}
        </div>
      )}

      {tab === "blocks" && features.maxMemoryBlocks !== null && (
        <p className="text-[11px] text-white/40">
          {blocks.length}/{features.maxMemoryBlocks} bloques en tu plan.
        </p>
      )}

      <AnimatePresence mode="popLayout">
        {tab === "blocks" ? (
          filteredBlocks.length === 0 ? (
            <p key="empty-b" className="py-16 text-center text-sm text-white/40">
              {query || tag ? "Nada por aquí con eso, hermano." : "Aún no hay recuerdos. Cuéntame algo o crea un bloque."}
            </p>
          ) : (
            <div key="blocks" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {filteredBlocks.map((b) => (
                <MemoryCard key={b.id} block={b} onClick={() => setEditing(b)} onTag={setTag} />
              ))}
            </div>
          )
        ) : filteredNotes.length === 0 ? (
          <p key="empty-n" className="py-16 text-center text-sm text-white/40">
            {query ? "Ninguna nota con esa búsqueda." : "Sin notas rápidas. Usa el botón de abajo a la derecha."}
          </p>
        ) : (
          <ul key="notes" className="flex flex-col gap-2">
            {filteredNotes.map((n) => (
              <motion.li layout key={n.id} className="jv-card flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="selectable whitespace-pre-line text-[14.5px] text-white/90">{n.content}</p>
                  <p className="mt-1 text-[11px] text-white/35">{formatWhen(n.created_at)}</p>
                </div>
                <button onClick={() => void engine?.update("quick_notes", n.id, { pinned: !n.pinned })} aria-label="Fijar" className={n.pinned ? "text-arc" : "text-white/30"}>
                  <Pin className="h-4 w-4" />
                </button>
                <button onClick={() => void engine?.remove("quick_notes", n.id)} aria-label="Borrar nota" className="text-white/30 hover:text-red-300">
                  <Trash2 className="h-4 w-4" />
                </button>
              </motion.li>
            ))}
          </ul>
        )}
      </AnimatePresence>

      <Editor block={editing} onClose={() => setEditing(null)} limitReached={limitReached} />
    </div>
  );
}

export default function MemoriesPage() {
  return (
    <Suspense>
      <MemoriesInner />
    </Suspense>
  );
}
