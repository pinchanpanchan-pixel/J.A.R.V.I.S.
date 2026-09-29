"use client";
import { useState } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { SyncBadge } from "@/components/MessageCenter";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSync } from "@/components/providers/SyncProvider";
import { useProfile } from "@/hooks/useProfile";
import { byCreatedDesc, useTable } from "@/hooks/useTable";
import { PLAN_LABELS } from "@/lib/plans";

/** Fase 1: panel base para verificar auth + sincronización. La Fase 2 lo sustituye por la UI final. */
function Home() {
  const { signOut } = useAuth();
  const { engine, status } = useSync();
  const { profile, isOwner, assistantName } = useProfile();
  const { rows: notes } = useTable("quick_notes", { sort: byCreatedDesc });
  const [text, setText] = useState("");

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !engine) return;
    await engine.insert("quick_notes", { content: text.trim(), category: "quick_notes", pinned: false, source: "manual" });
    setText("");
  };

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-xl flex-col gap-4 px-4 pb-10 pt-20">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{assistantName}</h1>
          <p className="text-xs text-white/50">{profile?.email}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {isOwner ? (
            <span className="rounded-full bg-gold/15 px-3 py-1 text-[11px] font-semibold text-gold">OWNER · Lifetime</span>
          ) : (
            <span className="rounded-full bg-white/10 px-3 py-1 text-[11px]">{PLAN_LABELS[profile?.subscription ?? "free"]}</span>
          )}
          <SyncBadge />
        </div>
      </header>

      <form onSubmit={add} className="flex gap-2">
        <input className="jv-input" placeholder="Nota rápida…" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="jv-btn-primary shrink-0">Guardar</button>
      </form>

      <ul className="flex flex-col gap-2">
        {notes.map((n) => (
          <li key={n.id} className="jv-card flex items-center justify-between p-4 text-sm">
            <span className="selectable">{n.content}</span>
            <button className="text-xs text-white/40 hover:text-red-300" onClick={() => void engine?.remove("quick_notes", n.id)}>
              Borrar
            </button>
          </li>
        ))}
      </ul>

      <pre className="jv-card overflow-auto p-3 text-[11px] text-white/50">{JSON.stringify(status, null, 2)}</pre>
      <button className="jv-btn-ghost" onClick={() => void signOut()}>
        Cerrar sesión
      </button>
    </main>
  );
}

export default function Page() {
  return (
    <RequireAuth>
      <Home />
    </RequireAuth>
  );
}
