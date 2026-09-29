"use client";
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, FileArchive, Loader2, Upload, XCircle } from "lucide-react";
import { useSync } from "@/components/providers/SyncProvider";
import { useTable } from "@/hooks/useTable";
import { chatNameFromFile, groupByDay, parseWhatsApp } from "@/lib/whatsapp/parser";

const MAX_BYTES = 200 * 1024 * 1024;

/** Ajustes → Importa tu pasado: sube el .zip exportado de WhatsApp y lo convierte en memorias. */
export function WhatsAppImport({ locked }: { locked: boolean }) {
  const { engine } = useSync();
  const { rows } = useTable("whatsapp_imports", { sort: (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) });
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [running, setRunning] = useState(false);

  const importFile = async (file: File) => {
    if (!engine || running) return;
    setRunning(true);
    const row = await engine.insert("whatsapp_imports", {
      file_name: file.name,
      chat_name: chatNameFromFile(file.name),
      participants: [],
      status: "parsing",
      progress: 1,
      total_messages: 0,
      imported_messages: 0,
      media_count: 0,
      first_message_at: null,
      last_message_at: null,
      error: null,
    });
    const fail = (error: string) => engine.update("whatsapp_imports", row.id, { status: "error", error });
    try {
      if (file.size > MAX_BYTES) return void (await fail("El archivo supera 200 MB."));
      let text = "";
      let mediaFiles: string[] = [];
      if (/\.zip$/i.test(file.name)) {
        const JSZip = (await import("jszip")).default;
        const zip = await JSZip.loadAsync(file);
        const txt = Object.values(zip.files).find((f) => !f.dir && /(^|\/)(_chat|.*whatsapp.*)\.txt$/i.test(f.name)) ?? Object.values(zip.files).find((f) => !f.dir && /\.txt$/i.test(f.name));
        if (!txt) return void (await fail("No encuentro el .txt del chat dentro del zip."));
        text = await txt.async("string");
        mediaFiles = Object.values(zip.files)
          .filter((f) => !f.dir && !/\.txt$/i.test(f.name))
          .map((f) => f.name.split("/").pop() ?? f.name);
      } else {
        text = await file.text();
      }
      await engine.update("whatsapp_imports", row.id, { progress: 10 });
      const chat = parseWhatsApp(text);
      if (!chat.messages.length) return void (await fail("El archivo no parece una exportación de WhatsApp."));
      const chatName = chatNameFromFile(file.name);
      const blocks = groupByDay(chat, chatName);
      await engine.update("whatsapp_imports", row.id, {
        status: "saving",
        progress: 15,
        participants: chat.participants,
        total_messages: chat.messages.length,
        media_count: mediaFiles.length || chat.messages.filter((m) => m.media).length,
        first_message_at: chat.messages[0].date.toISOString(),
        last_message_at: chat.messages[chat.messages.length - 1].date.toISOString(),
      });
      let imported = 0;
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        await engine.insert("memory_blocks", {
          title: b.title,
          content: b.content,
          tags: ["whatsapp", chatName.toLowerCase()],
          source: "whatsapp",
          original_date: b.firstAt.toISOString(),
          metadata: { chat: chatName, participants: chat.participants, media: b.media, messages: b.messages, import_id: row.id },
        });
        imported += b.messages;
        if (i % 5 === 0 || i === blocks.length - 1) {
          await engine.update("whatsapp_imports", row.id, { progress: 15 + Math.round(((i + 1) / blocks.length) * 85), imported_messages: imported });
        }
      }
      await engine.update("whatsapp_imports", row.id, { status: "done", progress: 100, imported_messages: imported });
    } catch (e) {
      await fail(e instanceof Error ? e.message : "Error leyendo el archivo.");
    } finally {
      setRunning(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className={`flex flex-col gap-3 ${locked ? "pointer-events-none opacity-50" : ""}`}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files[0];
          if (f) void importFile(f);
        }}
        onClick={() => input.current?.click()}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-3xl border-2 border-dashed p-6 text-center transition ${drag ? "border-arc bg-arc/10" : "border-white/15 hover:border-white/30"}`}
      >
        {running ? <Loader2 className="h-7 w-7 animate-spin text-arc" /> : <Upload className="h-7 w-7 text-white/60" />}
        <p className="text-sm font-medium">{running ? "Leyendo tus recuerdos…" : "Sube WhatsApp.zip"}</p>
        <p className="text-xs text-white/45">o arrástralo aquí (.zip o .txt)</p>
        <input ref={input} type="file" accept=".zip,.txt,application/zip,text/plain" className="hidden" onChange={(e) => e.target.files?.[0] && void importFile(e.target.files[0])} aria-label="Archivo de WhatsApp" />
      </div>
      {rows.slice(0, 5).map((r) => (
        <div key={r.id} className="rounded-2xl bg-white/[0.04] p-3">
          <div className="flex items-center gap-2 text-sm">
            {r.status === "done" ? <CheckCircle2 className="h-4 w-4 text-arc" /> : r.status === "error" ? <XCircle className="h-4 w-4 text-red-300" /> : <FileArchive className="h-4 w-4 text-white/60" />}
            <span className="flex-1 truncate font-medium">{r.chat_name ?? r.file_name}</span>
            <span className="text-xs text-white/50" data-testid="import-progress">
              {r.progress}%
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <motion.div className={`h-full ${r.status === "error" ? "bg-red-400" : "bg-arc"}`} animate={{ width: `${r.progress}%` }} />
          </div>
          <p className="mt-1.5 text-[11px] text-white/40">
            {r.status === "error"
              ? r.error
              : `${r.imported_messages}/${r.total_messages} mensajes · ${r.participants.join(", ")}${r.media_count ? ` · ${r.media_count} adjuntos` : ""}`}
          </p>
        </div>
      ))}
    </div>
  );
}
