"use client";
import { motion } from "framer-motion";
import { Camera, Mic, MessageCircle, NotebookPen, PenLine, BookHeart, FileDown, Bot } from "lucide-react";
import type { MemoryBlockRow, MemorySource } from "@/types/db";

export const SOURCE_META: Record<MemorySource, { label: string; icon: typeof Mic }> = {
  voice: { label: "Voz", icon: Mic },
  whatsapp: { label: "WhatsApp", icon: MessageCircle },
  manual: { label: "Manual", icon: PenLine },
  vision: { label: "Foto", icon: Camera },
  quick_note: { label: "Nota", icon: NotebookPen },
  diary: { label: "Diario", icon: BookHeart },
  import: { label: "Importado", icon: FileDown },
  chat: { label: "Conversación", icon: Bot },
};

export function formatWhen(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days === 0) return `Hoy, ${d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;
  if (days === 1) return "Ayer";
  if (days < 7) return d.toLocaleDateString("es-ES", { weekday: "long" });
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined });
}

/** Tarjeta de bloque de memoria (estilo Notion). */
export function MemoryCard({ block, onClick, onTag }: { block: MemoryBlockRow; onClick: () => void; onTag?: (t: string) => void }) {
  const src = SOURCE_META[block.source] ?? SOURCE_META.manual;
  const Icon = src.icon;
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="jv-card cursor-pointer p-4 transition hover:border-white/15 hover:bg-navy-700/80"
    >
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-white/40">
        <Icon className="h-3.5 w-3.5" />
        {src.label} · {formatWhen(block.original_date ?? block.created_at)}
      </div>
      {typeof block.metadata?.thumbnail === "string" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={block.metadata.thumbnail as string} alt="" className="mb-2 h-32 w-full rounded-2xl object-cover" />
      )}
      {block.title && <h3 className="line-clamp-1 text-[15px] font-semibold text-white">{block.title}</h3>}
      <p className="mt-1 line-clamp-3 whitespace-pre-line text-[13.5px] leading-relaxed text-white/65">{block.content}</p>
      {block.tags.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {block.tags.slice(0, 5).map((t) => (
            <button
              key={t}
              onClick={(e) => {
                e.stopPropagation();
                onTag?.(t);
              }}
              className="rounded-full bg-arc/10 px-2 py-0.5 text-[11px] text-arc hover:bg-arc/20"
            >
              #{t}
            </button>
          ))}
        </div>
      )}
    </motion.article>
  );
}
