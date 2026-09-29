export default function OfflinePage() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center px-6 text-center">
      <div>
        <div className="mx-auto mb-6 h-16 w-16 rounded-full bg-[radial-gradient(circle_at_35%_30%,#9DF5E3,#64FFDA_40%,#0F2440_75%)]" />
        <h1 className="text-xl font-semibold">Sin conexión, hermano.</h1>
        <p className="mt-2 text-sm text-white/60">Sigo aquí. Lo que hagas se guarda en local y lo subo en cuanto vuelva la red.</p>
      </div>
    </main>
  );
}
