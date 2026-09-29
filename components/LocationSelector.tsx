"use client";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Crosshair, Link2, Loader2, MapPin, PenLine } from "lucide-react";
import { Segmented } from "@/components/ui/Segmented";
import { isShortMapsLink, parseMapsLink, type ResolvedPlace } from "@/lib/geo";
import { guessTimezone, sortedCountries } from "@/lib/geoRegions";
import type { UserLocationRow } from "@/types/db";

type Method = UserLocationRow["method"];

async function reverse(lat: number, lng: number): Promise<ResolvedPlace> {
  const res = await fetch(`/api/geo/reverse?lat=${lat}&lng=${lng}`);
  const j = await res.json();
  if (!res.ok) throw new Error(j.error ?? "reverse_failed");
  return j.place as ResolvedPlace;
}

function geoErrorMessage(e: GeolocationPositionError | Error): string {
  if ("code" in e) {
    if (e.code === 1) return "Me has denegado el permiso de ubicación. Actívalo en Ajustes o usa otra opción.";
    if (e.code === 3) return "La ubicación está tardando demasiado. Prueba otra vez o usa otra opción.";
  }
  return "No he podido detectar tu ubicación. Usa la opción manual o un enlace de Maps.";
}

/**
 * Ubicación avanzada (obligatoria para WorldMonitor):
 *  A) Detectar automáticamente (GPS + geocodificación inversa)
 *  B) Cascada manual País → Estado/Departamento → Ciudad/Municipio → Dirección
 *  C) Pegar enlace de Google Maps
 */
export function LocationSelector({
  onSave,
  initial,
}: {
  onSave: (place: ResolvedPlace, method: Method, addressLine?: string) => Promise<void> | void;
  initial?: UserLocationRow | null;
}) {
  const [method, setMethod] = useState<Method>(initial?.method ?? "auto");
  const [result, setResult] = useState<{ place: ResolvedPlace; method: Method; addressLine?: string; approximate?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // --- A) Automático
  const detect = () => {
    setError(null);
    setResult(null);
    if (!("geolocation" in navigator)) {
      setError("Tu dispositivo no permite detectar la ubicación.");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const place = await reverse(pos.coords.latitude, pos.coords.longitude);
          place.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          setResult({ place, method: "auto" });
        } catch (e) {
          setError(geoErrorMessage(e as Error));
        } finally {
          setBusy(false);
        }
      },
      (e) => {
        setBusy(false);
        setError(geoErrorMessage(e));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  };

  // --- B) Manual
  const countries = useMemo(() => sortedCountries("es"), []);
  const [country, setCountry] = useState("");
  const [states, setStates] = useState<string[] | null>(null);
  const [state, setState] = useState("");
  const [cities, setCities] = useState<string[] | null>(null);
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    setStates(null);
    setState("");
    setCities(null);
    setCity("");
    if (!country) return;
    let cancelled = false;
    fetch(`/api/geo/regions?country=${country}`)
      .then((r) => r.json())
      .then((j) => !cancelled && setStates(j.items ?? []))
      .catch(() => !cancelled && setStates([]));
    return () => {
      cancelled = true;
    };
  }, [country]);

  useEffect(() => {
    setCities(null);
    setCity("");
    if (!country || !state) return;
    let cancelled = false;
    fetch(`/api/geo/regions?country=${country}&state=${encodeURIComponent(state)}`)
      .then((r) => r.json())
      .then((j) => !cancelled && setCities(j.items ?? []))
      .catch(() => !cancelled && setCities([]));
    return () => {
      cancelled = true;
    };
  }, [country, state]);

  const geocodeManual = async () => {
    setError(null);
    setResult(null);
    if (!country || !city.trim()) {
      setError("Elige al menos país y ciudad, hermano.");
      return;
    }
    setBusy(true);
    try {
      const qs = new URLSearchParams({ country, state, city: city.trim(), address: address.trim() });
      const res = await fetch(`/api/geo/search?${qs}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setResult({ place: j.place, method: "manual", addressLine: address.trim() || undefined, approximate: j.approximate });
    } catch {
      setError("No encuentro esa dirección. Revisa la ciudad o prueba con un enlace de Maps.");
    } finally {
      setBusy(false);
    }
  };

  // --- C) Enlace de Google Maps
  const [link, setLink] = useState("");
  const parseLink = async () => {
    setError(null);
    setResult(null);
    const text = link.trim();
    if (!text) return;
    setBusy(true);
    try {
      let coords = parseMapsLink(text);
      if (!coords && isShortMapsLink(text)) {
        const res = await fetch(`/api/geo/expand?url=${encodeURIComponent(text)}`);
        const j = await res.json();
        if (res.ok) coords = j.coords;
      }
      if (!coords) throw new Error("no_coords");
      const place = await reverse(coords.lat, coords.lng);
      place.timezone = place.timezone ?? guessTimezone(null, coords.lat, coords.lng) ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
      setResult({ place, method: "maps_link" });
    } catch {
      setError("No saco coordenadas de ese enlace. En Maps: Compartir → Copiar enlace, y pégalo aquí.");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!result) return;
    setBusy(true);
    try {
      await onSave(result.place, result.method, result.addressLine);
      setSaved(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Segmented<Method>
        id="loc-method"
        value={method}
        onChange={(m) => {
          setMethod(m);
          setError(null);
          setResult(null);
          setSaved(false);
        }}
        options={[
          { value: "auto", label: "Automático" },
          { value: "manual", label: "Manual" },
          { value: "maps_link", label: "Enlace Maps" },
        ]}
      />

      <AnimatePresence mode="wait">
        <motion.div key={method} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
          {method === "auto" && (
            <button type="button" onClick={detect} disabled={busy} className="jv-btn-primary w-full py-5 text-base">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Crosshair className="h-5 w-5" />}
              Detectar automáticamente
            </button>
          )}

          {method === "manual" && (
            <div className="flex flex-col gap-2.5">
              <select className="jv-input" value={country} onChange={(e) => setCountry(e.target.value)} aria-label="País">
                <option value="">País</option>
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
              {country &&
                (states === null ? (
                  <div className="jv-input text-white/40">Cargando…</div>
                ) : states.length > 0 ? (
                  <select className="jv-input" value={state} onChange={(e) => setState(e.target.value)} aria-label="Estado o departamento">
                    <option value="">Estado / Departamento</option>
                    {states.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input className="jv-input" placeholder="Estado / Departamento" value={state} onChange={(e) => setState(e.target.value)} />
                ))}
              {country &&
                (state && cities && cities.length > 0 ? (
                  <select className="jv-input" value={city} onChange={(e) => setCity(e.target.value)} aria-label="Ciudad o municipio">
                    <option value="">Ciudad / Municipio</option>
                    {cities.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input className="jv-input" placeholder="Ciudad / Municipio" value={city} onChange={(e) => setCity(e.target.value)} />
                ))}
              <input className="jv-input" placeholder="Dirección exacta (opcional)" value={address} onChange={(e) => setAddress(e.target.value)} />
              <button type="button" onClick={geocodeManual} disabled={busy} className="jv-btn-ghost">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />} Buscar dirección
              </button>
            </div>
          )}

          {method === "maps_link" && (
            <div className="flex flex-col gap-2.5">
              <input
                className="jv-input"
                placeholder="Pega link de Google Maps"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                onPaste={(e) => {
                  const t = e.clipboardData.getData("text");
                  if (t) setTimeout(() => setLink(t), 0);
                }}
                inputMode="url"
              />
              <button type="button" onClick={parseLink} disabled={busy || !link.trim()} className="jv-btn-ghost">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Leer enlace
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {error && <p className="rounded-2xl bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}

      {result && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-arc/30 bg-arc/10 p-4">
          <div className="flex gap-3">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-arc" />
            <div className="min-w-0 text-sm">
              <div className="font-medium text-white">
                {[result.place.city, result.place.state, result.place.country].filter(Boolean).join(", ") || "Ubicación encontrada"}
              </div>
              {result.place.formatted_address && <div className="mt-0.5 line-clamp-2 text-xs text-white/60">{result.place.formatted_address}</div>}
              <div className="mt-1 text-[11px] text-white/40">
                {result.place.lat.toFixed(4)}, {result.place.lng.toFixed(4)}
                {result.place.timezone ? ` · ${result.place.timezone}` : ""}
                {result.approximate ? " · aproximada" : ""}
              </div>
            </div>
          </div>
          <button type="button" onClick={save} disabled={busy || saved} className="jv-btn-primary mt-3 w-full">
            {saved ? "Guardada ✓" : "Guardar ubicación"}
          </button>
        </motion.div>
      )}

      {!result && initial && (
        <p className="text-center text-xs text-white/45">
          Actual: {[initial.city, initial.state, initial.country].filter(Boolean).join(", ") || `${initial.lat.toFixed(3)}, ${initial.lng.toFixed(3)}`}
        </p>
      )}
    </div>
  );
}
