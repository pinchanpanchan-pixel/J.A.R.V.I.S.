import type { TableName } from "@/types/db";
import type { AnyRow } from "./remote";
import type { KV } from "./kv";

/**
 * Cola de escrituras pendientes (outbox). Todo se escribe aquí primero con estado
 * "pending" y se sube en orden estricto cuando hay conexión. Formato compartido con
 * el Service Worker (worker/index.js) para Background Sync.
 */
export type OutboxStatus = "pending" | "syncing" | "failed";

export interface OutboxOp {
  key: string; // clave ordenable (seq con ceros a la izquierda)
  table: TableName;
  rowId: string;
  userId: string;
  row: AnyRow;
  status: OutboxStatus;
  attempts: number;
  lastError: string | null;
  createdAt: string;
}

let lastSeq = 0;
export function nextSeqKey(): string {
  // Monótono incluso con varias escrituras en el mismo milisegundo.
  const seq = Math.max(Date.now() * 1000, lastSeq + 1);
  lastSeq = seq;
  return String(seq).padStart(20, "0");
}

export class Outbox {
  constructor(
    private readonly kv: KV,
    private readonly deadLetter: KV,
  ) {}

  async enqueue(op: Omit<OutboxOp, "key" | "status" | "attempts" | "lastError" | "createdAt">): Promise<OutboxOp> {
    const full: OutboxOp = {
      ...op,
      key: nextSeqKey(),
      status: "pending",
      attempts: 0,
      lastError: null,
      createdAt: new Date().toISOString(),
    };
    await this.kv.set(full.key, full);
    return full;
  }

  /** Operaciones en orden de llegada. */
  async all(): Promise<OutboxOp[]> {
    return (await this.kv.entries<OutboxOp>()).map(([, v]) => v);
  }

  async forUser(userId: string): Promise<OutboxOp[]> {
    return (await this.all()).filter((op) => op.userId === userId);
  }

  async update(op: OutboxOp): Promise<void> {
    await this.kv.set(op.key, op);
  }

  async remove(key: string): Promise<void> {
    await this.kv.remove(key);
  }

  /** Mueve una operación rechazada definitivamente a la "dead letter" para no perderla. */
  async bury(op: OutboxOp, error: string): Promise<void> {
    await this.deadLetter.set(op.key, { ...op, status: "failed", lastError: error });
    await this.kv.remove(op.key);
  }

  async hasPendingFor(table: TableName, rowId: string): Promise<boolean> {
    return (await this.all()).some((op) => op.table === table && op.rowId === rowId);
  }

  async count(userId?: string): Promise<number> {
    const ops = await this.all();
    return userId ? ops.filter((o) => o.userId === userId).length : ops.length;
  }
}
