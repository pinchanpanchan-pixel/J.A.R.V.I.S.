"use client";
import { GlassSelect } from "@/components/ui/GlassSelect";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Toggle } from "@/components/ui/Toggle";
import { useSync } from "@/components/providers/SyncProvider";
import { useProfile } from "@/hooks/useProfile";
import { deleteCode, listCodes, saveCode } from "@/lib/payments/client";
import { normalizeCode, validateNewCode } from "@/lib/payments/discounts";
import type { DiscountCodeRow } from "@/types/db";

/** Panel del propietario: «Códigos de descuento» con CRUD completo. */
export function DiscountCodesAdmin() {
  const { mockCloud } = useSync();
  const { profile } = useProfile();
  const [codes, setCodes] = useState<DiscountCodeRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", percent_off: "20", max_uses: "", valid_until: "", duration: "forever" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setCodes(await listCodes(mockCloud));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No he podido cargar los códigos.");
    }
  }, [mockCloud]);
  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    const row = {
      code: normalizeCode(form.code),
      percent_off: Number(form.percent_off),
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      valid_until: form.valid_until ? new Date(`${form.valid_until}T23:59:59`).toISOString() : null,
    };
    const invalid = validateNewCode(row);
    if (invalid) return setError(invalid);
    if (codes?.some((c) => c.code === row.code)) return setError("Ese código ya existe.");
    setSaving(true);
    try {
      await saveCode(
        mockCloud,
        {
          ...row,
          duration: row.percent_off === 100 ? "lifetime" : (form.duration as DiscountCodeRow["duration"]),
          grants_plan: row.percent_off === 100 ? "pro_lifetime" : null,
          grants_period: row.percent_off === 100 ? "lifetime" : null,
          is_active: true,
        },
        profile?.email ?? "",
      );
      setOpen(false);
      setForm({ code: "", percent_off: "20", max_uses: "", valid_until: "", duration: "forever" });
      setError(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar.");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (c: DiscountCodeRow, v: boolean) => {
    await saveCode(mockCloud, { id: c.id, code: c.code, is_active: v }, profile?.email ?? "");
    await load();
  };
  const remove = async (c: DiscountCodeRow) => {
    if (!window.confirm(`¿Borrar el código ${c.code}?`)) return;
    await deleteCode(mockCloud, c);
    await load();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <button onClick={() => setOpen(true)} className="jv-btn-primary flex-1 py-2.5 text-sm">
          <Plus className="h-4 w-4" /> Crear código
        </button>
        <button onClick={() => void load()} className="jv-btn-ghost px-3" aria-label="Recargar códigos">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
      {error && !open && <p className="text-xs text-red-300">{error}</p>}
      {!codes ? (
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-white/50" />
      ) : (
        <ul className="flex flex-col divide-y divide-white/[0.06]" aria-label="Códigos de descuento">
          {codes.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-2.5" data-testid={`code-${c.code}`}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold">{c.code}</span>
                  <span className="rounded-full bg-arc/15 px-2 py-0.5 text-[11px] font-semibold text-arc">−{c.percent_off}%</span>
                </div>
                <div className="mt-0.5 text-[11px] text-white/45">
                  Usos {c.used_count}/{c.max_uses ?? "∞"} · {c.valid_until ? `hasta ${new Date(c.valid_until).toLocaleDateString("es-ES")}` : "sin caducidad"}
                  {c.duration === "once" ? " · solo primer pago" : ""}
                </div>
              </div>
              <Toggle checked={c.is_active} onChange={(v) => void toggle(c, v)} label={`Activar ${c.code}`} />
              <button onClick={() => void remove(c)} aria-label={`Borrar ${c.code}`} className="p-1 text-white/35 hover:text-red-300">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="Nuevo código">
        <div className="flex flex-col gap-3">
          <input className="jv-input font-mono uppercase" placeholder="CÓDIGO (p. ej. VIP40)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} aria-label="Código" />
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-white/70">Descuento (%)</span>
            <input className="jv-input w-28" type="number" min={10} max={100} value={form.percent_off} onChange={(e) => setForm({ ...form, percent_off: e.target.value })} aria-label="Porcentaje" />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-white/70">Usos máximos (vacío = ilimitado)</span>
            <input className="jv-input w-28" type="number" min={1} value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} aria-label="Usos máximos" />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-white/70">Válido hasta</span>
            <input className="jv-input w-44 [color-scheme:dark]" type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} aria-label="Válido hasta" />
          </label>
          {Number(form.percent_off) < 100 && (
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-white/70">Duración</span>
              <div className="w-48">
                <GlassSelect
                  size="sm"
                  ariaLabel="Duración"
                  value={form.duration}
                  onChange={(v) => setForm({ ...form, duration: v })}
                  options={[
                    { value: "forever", label: "Siempre" },
                    { value: "once", label: "Solo el primer pago" },
                  ]}
                />
              </div>
            </div>
          )}
          {Number(form.percent_off) === 100 && <p className="text-xs text-gold">Un código del 100 % da acceso Pro de por vida sin pasar por el pago.</p>}
          {error && <p className="text-xs text-red-300">{error}</p>}
          <button onClick={() => void create()} disabled={saving} className="jv-btn-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Crear
          </button>
        </div>
      </Sheet>
    </div>
  );
}
