"use client";
import { apiFetch } from "@/lib/api";
import { publicEnv } from "@/lib/env";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export type PushResult = "enabled" | "local_only" | "denied" | "unsupported";

/**
 * Activa notificaciones. iOS: solo con la PWA instalada en la pantalla de inicio (iOS 16.4+).
 * Sin VAPID configurado: notificaciones locales mientras la app esté abierta.
 */
export async function enablePush(): Promise<PushResult> {
  if (typeof Notification === "undefined" || !("serviceWorker" in navigator)) return "unsupported";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return "denied";
  if (!publicEnv.vapidPublicKey) return "local_only";
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicEnv.vapidPublicKey) as BufferSource }));
  const res = await apiFetch("/api/push/subscribe", { method: "POST", body: JSON.stringify(sub.toJSON()) });
  return res.ok ? "enabled" : "local_only";
}
