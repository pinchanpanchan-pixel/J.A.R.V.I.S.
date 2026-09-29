"use client";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { SyncEngine, type SyncStatus } from "@/lib/sync/engine";
import { getBrowserKVFactory, type KVFactory } from "@/lib/sync/kv";
import { MockRemote } from "@/lib/sync/mockRemote";
import { SupabaseRemote } from "@/lib/sync/supabaseRemote";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isMockMode, publicEnv } from "@/lib/env";
import { featuresFor } from "@/lib/plans";
import { mockBootstrapUser } from "@/lib/mock/backend";
import { CLIENT_STRIPPED_COLUMNS, type UserRow } from "@/types/db";
import { useAuth } from "./AuthProvider";

interface SyncContextValue {
  engine: SyncEngine | null;
  status: SyncStatus | null;
  ready: boolean;
  kvFactory: KVFactory | null;
  mockCloud: MockRemote | null;
}

const SyncContext = createContext<SyncContextValue>({
  engine: null,
  status: null,
  ready: false,
  kvFactory: null,
  mockCloud: null,
});

export const BACKGROUND_SYNC_TAG = "jarvis-outbox";

/** Pide al Service Worker que suba la cola aunque la app se cierre (Background Sync API). */
async function registerBackgroundSync() {
  try {
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    const sync = (reg as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } }).sync;
    await sync?.register(BACKGROUND_SYNC_TAG);
  } catch {
    /* Safari iOS no soporta Background Sync: se sube al volver a abrir la app */
  }
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const { user, getAccessToken } = useAuth();
  const [engine, setEngine] = useState<SyncEngine | null>(null);
  const [kvFactory, setKvFactory] = useState<KVFactory | null>(null);
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [ready, setReady] = useState(false);
  const mockCloudRef = useRef<MockRemote | null>(null);

  // Crea el motor una sola vez.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const factory = await getBrowserKVFactory();
      const remote = isMockMode
        ? (mockCloudRef.current = new MockRemote(factory, { latencyMs: 120 }))
        : new SupabaseRemote(getSupabaseBrowser()!);
      const eng = new SyncEngine({ kvFactory: factory, remote, online: navigator.onLine });
      if (cancelled) return;
      setKvFactory(() => factory);
      setEngine(eng);
      setStatus(eng.status);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Conexión / desconexión + mensajes del Service Worker.
  useEffect(() => {
    if (!engine) return;
    const unsubStatus = engine.onStatus(() => setStatus(engine.status));
    const on = () => engine.setOnline(true);
    const off = () => engine.setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const onSwMessage = (e: MessageEvent) => {
      if (e.data?.type === "FLUSH_OUTBOX") void engine.flush();
    };
    navigator.serviceWorker?.addEventListener("message", onSwMessage);
    const onVisible = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        void engine.flush().then(() => engine.pullAll());
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    const interval = window.setInterval(() => {
      if (engine.status.pending > 0) void engine.flush();
    }, 15_000);
    return () => {
      unsubStatus();
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      navigator.serviceWorker?.removeEventListener("message", onSwMessage);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(interval);
    };
  }, [engine]);

  // Arranca/para al cambiar de usuario.
  useEffect(() => {
    if (!engine) return;
    let cancelled = false;
    setReady(false);
    if (!user) {
      engine.stop();
      return;
    }
    (async () => {
      if (isMockMode && mockCloudRef.current) {
        await mockBootstrapUser(mockCloudRef.current, user).catch(() => undefined);
      } else {
        await fetch("/api/auth/ensure-profile", { method: "POST" }).catch(() => undefined);
      }
      await engine.start(user.id);
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [engine, user]);

  // Activa la sincronización total según el plan, y guarda config para el Service Worker.
  useEffect(() => {
    if (!engine || !user || !kvFactory || !ready) return;
    const apply = async () => {
      const profile = await engine.get("users", user.id);
      const p = profile as UserRow | null;
      engine.setSyncEnabled(featuresFor(p?.subscription, p?.is_owner).sync);
      if (!isMockMode) {
        await kvFactory("meta").set("sw:config", {
          supabaseUrl: publicEnv.supabaseUrl,
          anonKey: publicEnv.supabaseAnonKey,
          accessToken: await getAccessToken(),
          userId: user.id,
          strip: CLIENT_STRIPPED_COLUMNS,
        });
      }
    };
    void apply();
    const unsub = engine.onTable("users", () => void apply());
    const unsubStatus = engine.onStatus(() => {
      if (engine.status.pending > 0) void registerBackgroundSync();
    });
    return () => {
      unsub();
      unsubStatus();
    };
  }, [engine, user, kvFactory, getAccessToken, ready]);

  const value = useMemo(
    () => ({ engine, status, ready, kvFactory, mockCloud: mockCloudRef.current }),
    [engine, status, ready, kvFactory],
  );
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  return useContext(SyncContext);
}
