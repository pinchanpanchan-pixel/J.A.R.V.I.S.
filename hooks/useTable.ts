"use client";
import { useCallback, useEffect, useState } from "react";
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
  const { sort } = opts;

  const load = useCallback(async () => {
    if (!engine || !ready) return;
    const list = await engine.list(table);
    setRows(sort ? [...list].sort(sort) : list);
    setLoading(false);
  }, [engine, ready, table, sort]);

  useEffect(() => {
    if (!engine || !ready) return;
    void load();
    return engine.onTable(table, () => void load());
  }, [engine, ready, table, load]);

  return { rows, loading };
}

/** Una fila por id (p.ej. perfil: users/<userId>). */
export function useRow<T extends TableName>(table: T, id: string | null | undefined): RowOf<T> | null {
  const { engine, ready } = useSync();
  const [row, setRow] = useState<RowOf<T> | null>(null);
  useEffect(() => {
    if (!engine || !ready || !id) {
      setRow(null);
      return;
    }
    const load = async () => setRow(await engine.get(table, id));
    void load();
    return engine.onTable(table, () => void load());
  }, [engine, ready, table, id]);
  return row;
}

export const byCreatedDesc = <R extends { created_at: string }>(a: R, b: R) =>
  Date.parse(b.created_at) - Date.parse(a.created_at);
