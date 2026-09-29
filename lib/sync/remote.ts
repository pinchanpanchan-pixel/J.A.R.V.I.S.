import type { TableName } from "@/types/db";

export type AnyRow = { id: string; user_id: string; updated_at: string; deleted_at?: string | null } & Record<
  string,
  unknown
>;

export class RemoteError extends Error {
  constructor(
    message: string,
    /** true = fallo de red/servidor, reintentar; false = rechazo definitivo (validación, RLS) */
    public retryable: boolean,
  ) {
    super(message);
    this.name = "RemoteError";
  }
}

/** "La nube": Supabase real o el simulador local. */
export interface Remote {
  readonly kind: "supabase" | "mock";
  /** Filas del usuario modificadas desde `since` (incluye borradas lógicamente). */
  pull(table: TableName, userId: string, since: string | null): Promise<AnyRow[]>;
  /** Inserta o actualiza (upsert por id). Lanza RemoteError. */
  push(table: TableName, row: AnyRow): Promise<void>;
  /** Tiempo real. Devuelve función para cancelar. */
  subscribe(
    userId: string,
    tables: TableName[],
    onChange: (table: TableName, row: AnyRow) => void,
    onStatus?: (connected: boolean) => void,
  ): () => void;
}
