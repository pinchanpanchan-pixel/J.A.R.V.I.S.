"use client";
import { GlassSelect } from "@/components/ui/GlassSelect";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ExternalLink, Info, Loader2, Search, X } from "lucide-react";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { Sheet } from "@/components/ui/Sheet";
import { useConnectors, type ConnectorView } from "@/hooks/useConnectors";
import { connectorById } from "@/connectors/registry";
import type { ConnectorMeta } from "@/connectors/types";

const STATUS_TEXT: Record<string, string> = {
  connected: "Conectado",
  denied: "Has cancelado el inicio de sesión.",
  invalid_state: "La conexión ha caducado. Vuelve a intentarlo.",
  exchange_failed: "No he podido terminar de conectar. Vuelve a intentarlo.",
  save_failed: "No he podido guardar la conexión. Vuelve a intentarlo.",
  unauthorized: "Tu sesión ha caducado. Entra otra vez y repite.",
  hue_bridge: "Hue: no encuentro tu puente. Comprueba que está encendido y conectado a internet.",
};

/**
 * Rejilla de apps (o de hogar): buscador, logos reales y estado «Conectado como …».
 * Al tocar una app se abre su ficha con lo que J.A.R.V.I.S. puede hacer y su acción real
 * (iniciar sesión, poner la clave, añadir el Atajo de iOS…).
 */
export function ConnectorGrid({
  connectors,
  onSkip,
  locked = false,
  maxEnabled = null,
  returnTo,
  inOnboarding = false,
}: {
  connectors: ConnectorMeta[];
  onSkip?: () => void;
  locked?: boolean;
  maxEnabled?: number | null;
  /** A dónde volver tras iniciar sesión (por defecto, la página actual). */
  returnTo?: string;
  inOnboarding?: boolean;
}) {
  const { view, connect, disconnect } = useConnectors();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<ConnectorMeta | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const views = useMemo(() => new Map(connectors.map((c) => [c.id, view(c)])), [connectors, view]);
  const connected = connectors.filter((c) => views.get(c.id)?.state === "connected");
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const q = norm(query.trim());
  const shown = q ? connectors.filter((c) => norm([c.name, c.description, ...(c.keywords ?? [])].join(" ")).includes(q)) : connectors;

  // Vuelta del inicio de sesión: ?connector=spotify&status=connected
  useEffect(() => {
    const u = new URL(window.location.href);
    const id = u.searchParams.get("connector");
    const status = u.searchParams.get("status");
    if (!id || !status || !connectors.some((c) => c.id === id)) return;
    const name = connectorById(id)?.name ?? id;
    setToast(status === "connected" ? `Conectado con ${name}` : (STATUS_TEXT[status] ?? "No se ha podido conectar."));
    u.searchParams.delete("connector");
    u.searchParams.delete("status");
    window.history.replaceState(null, "", u.pathname + u.search + u.hash);
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [connectors]);

  const disconnectAll = async () => {
    setConfirmAll(false);
    for (const c of connected) await disconnect(c);
  };

  return (
    <div className="flex flex-col gap-3">
      {connectors.length > 6 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input className="jv-input pl-11" placeholder="Buscar app…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar app" type="search" />
        </div>
      )}
      {(onSkip || connected.length > 0) && (
        <div className="flex gap-2">
          {connected.length > 0 && !inOnboarding && (
            <button type="button" disabled={locked} onClick={() => setConfirmAll(true)} className="jv-btn-ghost flex-1 py-2.5 text-sm">
              Desconectar todo
            </button>
          )}
          {onSkip && (
            <button type="button" onClick={onSkip} className="jv-btn-ghost flex-1 py-2.5 text-sm text-white/70">
              Saltar
            </button>
          )}
        </div>
      )}
      {maxEnabled !== null && (
        <p className="text-center text-[11px] text-white/45">
          Tu plan permite {maxEnabled} {maxEnabled === 1 ? "conexión" : "conexiones"} ({connected.length}/{maxEnabled}).
        </p>
      )}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {shown.map((c) => {
          const v = views.get(c.id)!;
          return (
            <motion.button
              key={c.id}
              type="button"
              whileTap={{ scale: 0.97 }}
              disabled={locked}
              onClick={() => setOpen(c)}
              className={`flex flex-col items-start gap-2.5 rounded-2xl border p-3.5 text-left transition disabled:opacity-50 ${
                v.state === "connected" ? "border-arc/40 bg-arc/[0.08]" : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"
              } ${v.state === "unavailable" ? "opacity-60" : ""}`}
              aria-label={`${c.name}${v.state === "connected" ? " (conectado)" : ""}`}
              data-testid={`connector-${c.id}`}
            >
              <div className="flex w-full items-center justify-between">
                <BrandLogo meta={c} size={38} />
                {v.state === "connected" && (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-arc text-navy-900">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold leading-tight">{c.name}</div>
                {v.state === "connected" && v.account && <div className="mt-0.5 truncate text-[11px] text-arc/80">{v.account}</div>}
              </div>
            </motion.button>
          );
        })}
      </div>
      {shown.length === 0 && <p className="py-6 text-center text-sm text-white/40">No encuentro «{query}». Prueba con otro nombre.</p>}

      <AnimatePresence>
        {toast && (
          <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="status" className="rounded-2xl bg-arc/10 px-4 py-2.5 text-center text-sm text-arc">
            {toast}
          </motion.p>
        )}
      </AnimatePresence>

      <ConnectorSheet
        meta={open}
        view={open ? (views.get(open.id) ?? null) : null}
        onClose={() => setOpen(null)}
        returnTo={returnTo}
        inOnboarding={inOnboarding}
        limitReached={maxEnabled !== null && connected.length >= maxEnabled}
        connect={connect}
        disconnect={disconnect}
      />

      <Sheet open={confirmAll} onClose={() => setConfirmAll(false)} title="¿Desconectar todo?">
        <p className="text-sm text-white/70">
          Voy a cerrar sesión en {connected.length} {connected.length === 1 ? "app" : "apps"} ({connected.map((c) => c.name).join(", ")}). Podrás volver a conectarlas cuando quieras.
        </p>
        <div className="mt-5 flex gap-2">
          <button onClick={() => setConfirmAll(false)} className="jv-btn-ghost flex-1">
            Cancelar
          </button>
          <button onClick={() => void disconnectAll()} className="jv-btn flex-1 bg-red-500/90 text-white hover:bg-red-500">
            Desconectar todo
          </button>
        </div>
      </Sheet>
    </div>
  );
}

function ConnectorSheet({
  meta,
  view,
  onClose,
  returnTo,
  inOnboarding,
  limitReached,
  connect,
  disconnect,
}: {
  meta: ConnectorMeta | null;
  view: ConnectorView | null;
  onClose: () => void;
  returnTo?: string;
  inOnboarding: boolean;
  limitReached: boolean;
  connect: ReturnType<typeof useConnectors>["connect"];
  disconnect: ReturnType<typeof useConnectors>["disconnect"];
}) {
  const router = useRouter();
  const { isConfigured, saveKey, addIosShortcut } = useConnectors();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  useEffect(() => {
    setMsg(null);
    setBusy(false);
    setFields(Object.fromEntries((meta?.keyFields ?? []).map((f) => [f.id, f.options?.[0]?.value ?? ""])));
  }, [meta?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!meta || !view) return null;
  const ready = isConfigured(meta);
  const here = () => returnTo ?? `${window.location.pathname}${window.location.search}${window.location.hash}`;

  const doConnect = async () => {
    if (limitReached) return setMsg("Has llegado al máximo de conexiones de tu plan.");
    setBusy(true);
    setMsg(null);
    const r = await connect(meta, here());
    if (r === "redirect") return; // nos vamos al proveedor
    setBusy(false);
    if (r === "not_configured") setMsg(`La conexión con ${meta.name} estará disponible muy pronto.`);
    else if (r === "error") setMsg("No he podido abrir el inicio de sesión. Prueba otra vez.");
  };

  const doKey = async () => {
    setBusy(true);
    setMsg(null);
    const r = await saveKey(meta, fields);
    setBusy(false);
    if (r.ok) setMsg(`Conectado: ${r.devices ?? 0} ${r.devices === 1 ? "dispositivo" : "dispositivos"}.`);
    else setMsg(r.error === "invalid_key" ? "Esa clave no funciona. Revísala y vuelve a probar." : "No he podido conectar. Prueba otra vez.");
  };

  const doShortcut = async () => {
    setBusy(true);
    const r = await addIosShortcut();
    setBusy(false);
    if (r === "not_published") setMsg("He copiado tu código, pero el Atajo aún no está publicado. Llegará muy pronto.");
    else if (r === "error") setMsg("No he podido preparar el Atajo. Prueba otra vez.");
  };

  const connected = view.state === "connected";

  return (
    <Sheet open onClose={onClose} title={meta.name}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <BrandLogo meta={meta} size={52} />
          <div className="min-w-0">
            <div className="text-[17px] font-semibold">{meta.name}</div>
            {connected ? (
              <div className="truncate text-sm text-arc">{view.account ? `Conectado como ${view.account}` : "Conectado"}</div>
            ) : view.state === "unavailable" ? (
              <div className="text-sm text-white/45">No disponible todavía</div>
            ) : null}
          </div>
        </div>

        <p className="text-[14.5px] leading-relaxed text-white/75">{meta.description}</p>
        {meta.note && (
          <p className="flex gap-2 rounded-2xl bg-white/[0.04] px-3.5 py-3 text-[13px] leading-relaxed text-white/60">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-white/40" /> {meta.note}
          </p>
        )}

        {/* --- Acciones según el tipo de conexión --- */}
        {meta.auth === "oauth" &&
          (connected ? (
            <button onClick={() => void disconnect(meta).then(onClose)} className="jv-btn-ghost text-red-300">
              Desconectar
            </button>
          ) : (
            <>
              {meta.account === "google" && <p className="text-xs text-white/45">Con tu cuenta de Google. Solo te pido permiso para {meta.name}.</p>}
              {meta.account === "microsoft" && <p className="text-xs text-white/45">Con tu cuenta de Microsoft (Outlook, Hotmail o trabajo).</p>}
              <button onClick={() => void doConnect()} disabled={busy || ready === false} className="jv-btn-primary">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />} Iniciar sesión con {meta.name}
              </button>
              {ready === false && <p className="text-center text-xs text-white/45">Esta conexión estará disponible muy pronto.</p>}
            </>
          ))}

        {meta.auth === "api_key" && (
          <div className="flex flex-col gap-2.5">
            {connected && <p className="text-xs text-white/45">Para cambiar la clave, escribe la nueva y vuelve a conectar.</p>}
            {(meta.keyFields ?? []).map((f) =>
              f.options ? (
                <GlassSelect
                  key={f.id}
                  ariaLabel={f.label}
                  value={fields[f.id] ?? null}
                  onChange={(v) => setFields((p) => ({ ...p, [f.id]: v }))}
                  options={f.options.map((o) => ({ value: o.value, label: `${f.label}: ${o.label}` }))}
                />
              ) : (
                <input
                  key={f.id}
                  className="jv-input"
                  type={f.secret ? "password" : "text"}
                  autoComplete="off"
                  placeholder={f.placeholder ?? f.label}
                  aria-label={f.label}
                  value={fields[f.id] ?? ""}
                  onChange={(e) => setFields((p) => ({ ...p, [f.id]: e.target.value }))}
                />
              ),
            )}
            {meta.keyHelp && <p className="text-xs leading-relaxed text-white/45">{meta.keyHelp}</p>}
            <button onClick={() => void doKey()} disabled={busy || (meta.keyFields ?? []).some((f) => !fields[f.id]?.trim())} className="jv-btn-primary">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {connected ? "Guardar nueva clave" : "Conectar"}
            </button>
            {connected && (
              <button onClick={() => void disconnect(meta).then(onClose)} className="jv-btn-ghost text-red-300">
                Desconectar
              </button>
            )}
          </div>
        )}

        {meta.auth === "ios_shortcut" && (
          <div className="flex flex-col gap-2.5">
            <button onClick={() => void doShortcut()} disabled={busy} className="jv-btn-primary">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Añadir atajo
            </button>
            <ol className="flex list-decimal flex-col gap-1 pl-5 text-[13px] text-white/55">
              <li>Toca «Añadir atajo» en tu iPhone.</li>
              <li>Cuando te pida el código, pégalo (ya lo he copiado).</li>
              <li>Listo: tus {meta.name.toLowerCase()} llegan a J.A.R.V.I.S. solos.</li>
            </ol>
            <p className="text-[11.5px] text-white/35">Un solo atajo sirve para Calendario, Recordatorios, Notas y Contactos.</p>
          </div>
        )}

        {meta.auth === "import" &&
          (inOnboarding ? (
            <p className="rounded-2xl bg-white/[0.04] px-3.5 py-3 text-[13px] text-white/60">
              Esto no necesita iniciar sesión: cuando termines la configuración lo tienes en {meta.id === "photos" ? "Memorias → Fotos" : "Ajustes → Importa tu pasado"}.
            </p>
          ) : (
            <button
              onClick={() => {
                onClose();
                router.push(meta.id === "photos" ? "/memories?photo=1" : "/settings?s=importar");
              }}
              className="jv-btn-primary"
            >
              {meta.id === "photos" ? "Elegir fotos" : "Importar un chat"}
            </button>
          ))}

        {meta.auth === "link" && <p className="rounded-2xl bg-arc/[0.06] px-3.5 py-3 text-[13px] text-white/70">Ya está listo: no hace falta iniciar sesión.</p>}

        {msg && (
          <p role="status" className="flex items-center justify-center gap-1.5 text-center text-sm text-white/70">
            {msg.startsWith("Conectado") ? <Check className="h-4 w-4 text-arc" /> : <X className="h-4 w-4 text-amber-200/70" />} {msg}
          </p>
        )}
      </div>
    </Sheet>
  );
}
