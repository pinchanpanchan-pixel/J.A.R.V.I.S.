import type { TableName } from "@/types/db";
import type { KVFactory } from "./kv";
import { RemoteError, type AnyRow, type Remote } from "./remote";

/**
 * "Nube" simulada para MODO SIMULADO. Vive en IndexedDB del navegador y emite
 * los cambios por BroadcastChannel, así que dos pestañas/ventanas con la misma
 * cuenta se comportan como dos dispositivos sincronizados en tiempo real.
 * Replica las reglas del servidor: last-write-wins y server_updated_at.
 */
export const MOCK_CHANNEL = "jarvis-mock-realtime";

type Msg = { table: TableName; row: AnyRow };

export class MockRemote implements Remote {
  readonly kind = "mock" as const;
  private channel: BroadcastChannel | null = null;
  private localListeners = new Set<(m: Msg) => void>();
  private lastServerTs = 0;

  constructor(
    private readonly kvFactory: KVFactory,
    private readonly opts: { latencyMs?: number; failNext?: () => boolean } = {},
  ) {
    if (typeof BroadcastChannel !== "undefined") {
      this.channel = new BroadcastChannel(MOCK_CHANNEL);
    }
  }

  private store(table: TableName) {
    return this.kvFactory(`mockcloud-${table}`);
  }

  private async delay() {
    const ms = this.opts.latencyMs ?? 0;
    if (ms > 0) await new Promise((r) => setTimeout(r, ms));
  }

  private serverNow(): string {
    const t = Math.max(Date.now(), this.lastServerTs + 1);
    this.lastServerTs = t;
    return new Date(t).toISOString();
  }

  async pull(table: TableName, userId: string, since: string | null): Promise<AnyRow[]> {
    await this.delay();
    const rows = (await this.store(table).entries<AnyRow>()).map(([, r]) => r);
    return rows
      .filter((r) => r.user_id === userId)
      .filter((r) => !since || Date.parse(r.server_updated_at as string) > Date.parse(since))
      .sort((a, b) => Date.parse(a.server_updated_at as string) - Date.parse(b.server_updated_at as string));
  }

  async push(table: TableName, row: AnyRow): Promise<void> {
    await this.delay();
    if (this.opts.failNext?.()) throw new RemoteError("simulated network failure", true);
    await this.write(table, row, false);
  }

  /** Escritura "de backend" (service_role): puede tocar columnas protegidas. */
  async pushAsBackend(table: TableName, row: AnyRow): Promise<AnyRow> {
    return (await this.write(table, row, true))!;
  }

  async getRow(table: TableName, id: string): Promise<AnyRow | null> {
    return this.store(table).get<AnyRow>(id);
  }

  async listAll(table: TableName): Promise<AnyRow[]> {
    return (await this.store(table).entries<AnyRow>()).map(([, r]) => r);
  }

  private async write(table: TableName, incoming: AnyRow, backend: boolean): Promise<AnyRow | null> {
    // users.user_id es una columna generada (= id) en Postgres; el cliente no la envía.
    const row = table === "users" ? { ...incoming, user_id: incoming.id } : incoming;
    const store = this.store(table);
    const existing = await store.get<AnyRow>(row.id);
    if (existing && existing.user_id !== row.user_id) {
      throw new RemoteError("row-level security violation", false);
    }
    let updatedAt = row.updated_at;
    if (existing) {
      if (backend) {
        if (Date.parse(updatedAt) <= Date.parse(existing.updated_at)) {
          updatedAt = new Date(Math.max(Date.now(), Date.parse(existing.updated_at) + 1)).toISOString();
        }
      } else if (Date.parse(updatedAt) < Date.parse(existing.updated_at)) {
        return null; // escritura antigua: gana la versión más nueva (igual que el trigger SQL)
      }
    }
    const stored: AnyRow = { ...(existing ?? {}), ...row, updated_at: updatedAt, server_updated_at: this.serverNow() };
    await store.set(row.id, stored);
    this.broadcast({ table, row: stored });
    return stored;
  }

  private broadcast(msg: Msg) {
    this.channel?.postMessage(msg);
    this.localListeners.forEach((fn) => fn(msg));
  }

  subscribe(
    userId: string,
    tables: TableName[],
    onChange: (table: TableName, row: AnyRow) => void,
    onStatus?: (connected: boolean) => void,
  ): () => void {
    const wanted = new Set(tables);
    const handler = (msg: Msg) => {
      if (wanted.has(msg.table) && msg.row.user_id === userId) onChange(msg.table, msg.row);
    };
    const bcHandler = (e: MessageEvent<Msg>) => handler(e.data);
    this.channel?.addEventListener("message", bcHandler);
    this.localListeners.add(handler);
    queueMicrotask(() => onStatus?.(true));
    return () => {
      this.channel?.removeEventListener("message", bcHandler);
      this.localListeners.delete(handler);
    };
  }
}
