"use client";
import { useEffect } from "react";

/** Registra el Service Worker (caché offline, Background Sync, push). */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return; // next-pwa se desactiva en dev
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
  }, []);
  return null;
}
