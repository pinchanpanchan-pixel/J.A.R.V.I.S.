"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { CloudOff, RefreshCw, CheckCircle2, AlertTriangle, ChevronUp } from "lucide-react";
import { useSync } from "@/components/providers/SyncProvider";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { OfflineRecorder } from "./OfflineRecorder";

/** Centro de mensajes: avisos del sistema (sin conexión, sincronizando…). */
export function MessageCenter() {
  const online = useOnlineStatus();
  const { status } = useSync();
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    if (online) setCollapsed(false);
  }, [online]);
  // Solo avisa de la sincronización si tarda (evita parpadeos en cada cambio).
  const pending = status?.pending ?? 0;
  const [slowSync, setSlowSync] = useState(false);
  useEffect(() => {
    if (pending === 0) {
      setSlowSync(false);
      return;
    }
    const t = setTimeout(() => setSlowSync(true), 2500);
    return () => clearTimeout(t);
  }, [pending]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex flex-col items-center gap-2 px-4 pt-[max(env(safe-area-inset-top),12px)]">
      <AnimatePresence>
        {!online && collapsed && (
          <motion.button
            key="offline-pill"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            onClick={() => setCollapsed(false)}
            className="pointer-events-auto flex items-center gap-2 rounded-full border border-amber-300/30 bg-navy-800/95 px-4 py-2 text-xs text-amber-200 backdrop-blur"
          >
            <CloudOff className="h-3.5 w-3.5" /> Offline · guardando en local
            {status?.pending ? ` · ${status.pending}` : ""}
          </motion.button>
        )}
        {!online && !collapsed && (
          <motion.div
            key="offline"
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -30, opacity: 0 }}
            className="pointer-events-auto w-full max-w-[420px] rounded-3xl border border-white/10 bg-navy-800/95 p-4 shadow-card backdrop-blur-xl"
            role="status"
          >
            <div className="flex items-start gap-3">
              <CloudOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
              <div className="flex-1">
                <p className="text-sm font-medium text-white">Sin internet, hermano, pero lo estoy guardando todo en local.</p>
                <p className="mt-0.5 text-xs text-white/60">
                  {status?.pending ? `${status.pending} ${status.pending === 1 ? "cambio esperando" : "cambios esperando"} para subir.` : "Cuando vuelva la conexión lo subo todo en orden."}
                </p>
              </div>
              <button
                onClick={() => setCollapsed(true)}
                className="rounded-full p-1 text-white/50 hover:bg-white/10 hover:text-white"
                aria-label="Minimizar aviso"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
            </div>
            <OfflineRecorder />
          </motion.div>
        )}
        {online && status && status.pending > 0 && slowSync && (
          <motion.div
            key="syncing"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-navy-800/90 px-4 py-2 text-xs text-white/80 backdrop-blur"
          >
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-arc" />
            Sincronizando {status.pending} {status.pending === 1 ? "cambio" : "cambios"}…
          </motion.div>
        )}
        {online && status && status.failed > 0 && (
          <motion.div
            key="failed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-auto flex items-center gap-2 rounded-full border border-red-400/30 bg-navy-800/90 px-4 py-2 text-xs text-red-200"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            {status.failed} {status.failed === 1 ? "cambio rechazado" : "cambios rechazados"} por el servidor (guardados en local).
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SyncBadge() {
  const { status } = useSync();
  if (!status) return null;
  const ok = status.online && status.pending === 0;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-white/50">
      {ok ? <CheckCircle2 className="h-3 w-3 text-arc" /> : <RefreshCw className="h-3 w-3" />}
      {!status.syncEnabled ? "Solo este dispositivo" : ok ? "Sincronizado" : status.online ? "Sincronizando" : "Offline"}
    </span>
  );
}
