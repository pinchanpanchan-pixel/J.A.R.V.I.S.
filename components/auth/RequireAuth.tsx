"use client";
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSync } from "@/components/providers/SyncProvider";

export function FullScreenLoader() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center">
      <div className="h-14 w-14 animate-pulse rounded-full bg-[radial-gradient(circle_at_35%_30%,#9DF5E3,#64FFDA_40%,#0F2440_75%)] shadow-[0_0_40px_rgba(100,255,218,.4)]" />
    </div>
  );
}

/** Protege rutas: sin sesión -> /login. Espera a que la sincronización arranque. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { ready } = useSync();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);
  if (loading || !user || !ready) return <FullScreenLoader />;
  return <>{children}</>;
}
