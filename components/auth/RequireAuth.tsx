"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSync } from "@/components/providers/SyncProvider";

export function FullScreenLoader({ short = false }: { short?: boolean }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4" role="status" aria-live="polite">
      <motion.div
        initial={{ scale: short ? 0.95 : 0.8, opacity: 0 }}
        animate={{ scale: [1, 1.05, 1], opacity: 1 }}
        transition={{ duration: short ? 1.2 : 3, repeat: Infinity, ease: "easeInOut" }}
        className="h-14 w-14 rounded-full bg-[radial-gradient(circle_at_35%_30%,#9DF5E3,#64FFDA_40%,#0F2440_75%)] shadow-[0_0_40px_rgba(100,255,218,.4)]"
      />
      <p className="text-sm text-white/45">Cargando…</p>
    </div>
  );
}

/**
 * Protege rutas: sin sesión -> /login. La pantalla de carga SOLO aparece la primera vez;
 * después (renovación de sesión, volver de otra pestaña) la app sigue en pantalla, sin
 * perder la posición.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { ready } = useSync();
  const router = useRouter();
  const shownFor = useRef<string | null>(null);
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);
  if (user && ready) shownFor.current = user.id;
  const alreadyShown = !!user && shownFor.current === user.id;
  if (!alreadyShown && (loading || !user || !ready)) return <FullScreenLoader />;
  return <>{children}</>;
}
