"use client";

/** Último recurso de Next.js: cualquier error no capturado muestra esto en vez de la pantalla en blanco. */
export default function GlobalRouteError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="h-14 w-14 rounded-full bg-[radial-gradient(circle_at_35%_30%,#C9FFF1,#64FFDA_45%,#137a72)]" />
      <p className="text-sm text-white/80">Algo se me ha cruzado, hermano.</p>
      <button onClick={reset} className="jv-btn-primary px-5 py-2.5 text-sm">
        Reintentar
      </button>
    </main>
  );
}
