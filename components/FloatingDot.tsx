"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useMotionValue } from "framer-motion";
import { ExternalLink, Mic, NotebookPen, X } from "lucide-react";
import { LiquidDot } from "@/components/LiquidDot";
import { openQuickNote } from "@/components/QuickNote";
import { useProfile } from "@/hooks/useProfile";
import { emit, JARVIS_EVENTS } from "@/lib/events";

const POS_KEY = "jarvis.floatPos";
const NOTIF_TAG = "jarvis-listening";

type DocPiP = { requestWindow(opts: { width: number; height: number }): Promise<Window>; window: Window | null };
const docPiP = (): DocPiP | null =>
  typeof window !== "undefined" && "documentPictureInPicture" in window ? (window as unknown as { documentPictureInPicture: DocPiP }).documentPictureInPicture : null;

const isAndroid = () => typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

/** Notificación persistente «J.A.R.V.I.S. escuchando» en Android (con acciones). */
async function setAndroidNotification(on: boolean) {
  if (!isAndroid() || !("serviceWorker" in navigator) || typeof Notification === "undefined") return;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return;
  if (!on) {
    (await reg.getNotifications({ tag: NOTIF_TAG })).forEach((n) => n.close());
    return;
  }
  if (Notification.permission === "default") await Notification.requestPermission();
  if (Notification.permission !== "granted") return;
  await reg.showNotification("J.A.R.V.I.S. escuchando", {
    tag: NOTIF_TAG,
    body: "Toca para hablar conmigo, hermano.",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    requireInteraction: true,
    silent: true,
    data: { url: "/" },
    actions: [
      { action: "talk", title: "Hablar" },
      { action: "note", title: "Nota rápida" },
    ],
  } as NotificationOptions);
}

/**
 * Modo flotante: punto líquido arrastrable de 80 px siempre visible.
 *  - Document Picture-in-Picture (Chrome/Edge escritorio): ventana siempre encima de otras apps.
 *  - Si no está disponible (iOS/Safari): burbuja dentro de la app.
 *  - Android: además, notificación persistente con acciones.
 */
export function FloatingDot() {
  const { profile, features, assistantName } = useProfile();
  const enabled = !!profile?.floating_mode_enabled && features.floatingMode;
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [pipWin, setPipWin] = useState<Window | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const dragged = useRef(false);

  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem(POS_KEY) ?? "null");
      if (p) {
        x.set(Math.min(p.x, window.innerWidth - 90));
        y.set(Math.min(p.y, window.innerHeight - 180));
        return;
      }
    } catch {
      /* posición por defecto */
    }
    x.set(window.innerWidth - 100);
    y.set(window.innerHeight * 0.55);
  }, [x, y]);

  useEffect(() => {
    void setAndroidNotification(enabled);
  }, [enabled]);

  const talk = useCallback(() => {
    router.push("/");
    setTimeout(() => emit(JARVIS_EVENTS.talk), 50);
  }, [router]);

  // Mensajes del Service Worker (acciones de la notificación)
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type !== "NAVIGATE") return;
      const url = new URL(e.data.url, window.location.origin);
      if (url.searchParams.get("action") === "talk") talk();
      if (url.searchParams.get("action") === "note") openQuickNote();
    };
    navigator.serviceWorker?.addEventListener("message", onMsg);
    return () => navigator.serviceWorker?.removeEventListener("message", onMsg);
  }, [talk]);

  const openPiP = async () => {
    const api = docPiP();
    if (!api) return;
    const w = await api.requestWindow({ width: 180, height: 180 });
    // Copia estilos para que Tailwind funcione dentro de la ventana PiP
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach((n) => w.document.head.appendChild(n.cloneNode(true)));
    w.document.body.style.cssText = "margin:0;background:#0A192F;display:flex;align-items:center;justify-content:center;height:100vh;overflow:hidden";
    w.addEventListener("pagehide", () => setPipWin(null));
    setPipWin(w);
    setExpanded(false);
  };

  useEffect(() => {
    if (!enabled && pipWin) pipWin.close();
  }, [enabled, pipWin]);

  if (!enabled) return null;

  if (pipWin) {
    return createPortal(
      <button
        onClick={() => {
          window.focus();
          talk();
        }}
        className="flex h-full w-full items-center justify-center bg-transparent"
        aria-label={`Hablar con ${assistantName}`}
      >
        <LiquidDot mode="idle" size={96} />
      </button>,
      pipWin.document.body,
    );
  }

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0.1}
      style={{ x, y }}
      onDragStart={() => (dragged.current = true)}
      onDragEnd={() => {
        const pos = { x: Math.max(0, Math.min(x.get(), window.innerWidth - 80)), y: Math.max(0, Math.min(y.get(), window.innerHeight - 160)) };
        x.set(pos.x);
        y.set(pos.y);
        localStorage.setItem(POS_KEY, JSON.stringify(pos));
        setTimeout(() => (dragged.current = false), 50);
      }}
      className="fixed left-0 top-0 z-40 touch-none"
    >
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            key="card"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            className="w-56 origin-top-left rounded-3xl border border-white/10 bg-navy-800/95 p-3 shadow-card backdrop-blur-xl"
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-white/80">{assistantName}</span>
              <button onClick={() => setExpanded(false)} aria-label="Cerrar" className="rounded-full p-1 text-white/50 hover:bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>
            <button onClick={talk} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-alert py-3 font-semibold text-white">
              <Mic className="h-5 w-5" /> Hablar
            </button>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button onClick={() => openQuickNote()} className="jv-btn-ghost py-2 text-xs">
                <NotebookPen className="h-4 w-4" /> Nota
              </button>
              <button onClick={() => void openPiP()} disabled={!docPiP()} className="jv-btn-ghost py-2 text-xs" title={docPiP() ? "Sacar a una ventana siempre visible" : "Tu navegador no permite ventanas flotantes"}>
                <ExternalLink className="h-4 w-4" /> Fuera
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.button
            key="dot"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            onClick={() => !dragged.current && setExpanded(true)}
            aria-label={`${assistantName} flotante`}
            className="flex h-20 w-20 items-center justify-center rounded-full"
          >
            <LiquidDot mode="idle" size={56} />
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
