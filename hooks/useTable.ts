"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RowOf, TableName } from "@/types/db";
import { useSync } from "@/components/providers/SyncProvider";

/** Filas vivas de una tabla, reactivas a cambios locales y de otros dispositivos. */
export function useTable<T extends TableName>(
  table: T,
  opts: { sort?: (a: RowOf<T>, b: RowOf<T>) => number } = {},
): { rows: RowOf<T>[]; loading: boolean } {
  const { engine, ready } = useSync();
  const [rows, setRows] = useState<RowOf<T>[]>([]);
  const [loading, setLoading] = useState(true);
  // La función de orden se guarda en una ref: si se pasa en línea (nueva en cada render)
  // no debe volver a disparar la carga (evita bucles de renderizado).
  const sortRef = useRef(opts.sort);
  sortRef.current = opts.sort;

  const load = useCallback(async () => {
    if (!engine || !ready) return;
    const list = await engine.list(table);
    const sort = sortRef.current;
    setRows(sort ? [...list].sort(sort) : list);
    setLoading(false);
  }, [engine, ready, table]);

  useEffect(() => {
    if (!engine || !ready) return;
    void load();
    return engine.onTable(table, () => void load());
  }, [engine, ready, table, load]);

  return { rows, loading };
}

// Última versión conocida de cada fila: al montar otra pantalla el valor está disponible
// desde el primer render (evita parpadeos, p.ej. ver el plan Free un instante).
const rowCache = new Map<string, unknown>();

/** Una fila por id (p.ej. perfil: users/<userId>). */
export function useRow<T extends TableName>(table: T, id: string | null | undefined): RowOf<T> | null {
  const { engine, ready } = useSync();
  const key = id ? `${table}:${id}` : "";
  const [row, setRow] = useState<RowOf<T> | null>(() => (key ? ((rowCache.get(key) as RowOf<T>) ?? null) : null));
  useEffect(() => {
    if (!engine || !ready || !id) {
      setRow(null);
      return;
    }
    const cacheKey = `${table}:${id}`;
    if (rowCache.has(cacheKey)) setRow(rowCache.get(cacheKey) as RowOf<T>);
    const load = async () => {
      const r = await engine.get(table, id);
      if (r) rowCache.set(cacheKey, r);
      else rowCache.delete(cacheKey);
      setRow(r);
    };
    void load();
    return engine.onTable(table, () => void load());
  }, [engine, ready, table, id]);
  return row;
}

export const byCreatedDesc = <R extends { created_at: string }>(a: R, b: R) =>
  Date.parse(b.created_at) - Date.parse(a.created_at);
