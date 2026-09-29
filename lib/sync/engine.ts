import {
  CLIENT_STRIPPED_COLUMNS,
  READ_ONLY_TABLES,
  SYNCED_TABLES,
  type RowOf,
  type TableName,
} from "@/types/db";
import { nowIso, uuid } from "@/lib/ids";
import type { KV, KVFactory } from "./kv";
import { Outbox, type OutboxOp } from "./outbox";
import { RemoteError, type AnyRow, type Remote } from "./remote";

/**
 * Motor de sincronización offline-first.
 *
 *  escritura -> caché local (IndexedDB) -> outbox "pending" -> (online) push en orden -> Supabase
 *  Supabase Realtime -> applyRemote (last-write-wins por updated_at) -> caché -> UI
 *
 * Nunca se pierde nada: si no hay red, la operación queda en la cola; si el servidor
 * la rechaza de forma definitiva se guarda en la "dead letter".
 */

/** Tablas que se sincronizan siempre, incluso en plan Free (perfil y ajustes básicos). */
export const ALWAYS_SYNCED: ReadonlySet<TableName> = new Set([
  "users",
  "user_core_memory",
  "voice_prefs",
  "subscriptions",
]);

export interface SyncStatus {
  online: boolean;
  realtime: boolean;
  syncing: boolean;
  pending: number;
  failed: number;
  lastSyncedAt: string | null;
  lastError: string | null;
  syncEnabled: boolean;
}

type Listener = () => void;

export interface EngineOptions {
  kvFactory: KVFactory;
  remote: Remote;
  /** Estado de conexión inicial (navegador: navigator.onLine). */
  online?: boolean;
  /** Plan con sincronización entre dispositivos. */
  syncEnabled?: boolean;
  /**
   * Candado entre pestañas del mismo navegador (comparten la cola en IndexedDB).
   * Devuelve false si otra pestaña ya está subiendo la cola.
   */
  withLock?: (name: string, fn: () => Promise<void>) => Promise<boolean>;
}

/** Web Locks API (Chrome, Edge, Firefox, Safari 15.4+). Sin soporte: ejecuta directamente. */
export function webLocks(): EngineOptions["withLock"] {
  if (typeof navigator === "undefined" || !("locks" in navigator)) return undefined;
  return async (name, fn) =>
    navigator.locks.request(name, { ifAvailable: true }, async (lock) => {
      if (!lock) return false;
      await fn();
      return true;
    });
}

export class SyncEngine {
  readonly remote: Remote;
  private readonly kvFactory: KVFactory;
  private readonly outbox: Outbox;
  private readonly meta: KV;
  private readonly dead: KV;
  private readonly tableListeners = new Map<TableName, Set<Listener>>();
  private readonly statusListeners = new Set<Listener>();
  private unsubscribeRealtime: (() => void) | null = null;
  private flushing: Promise<void> | null = null;
  private flushAgain = false;
  private readonly withLock: NonNullable<EngineOptions["withLock"]>;
  private cacheMemo = new Map<TableName, AnyRow[]>();
  private cacheVersion = new Map<TableName, number>();

  userId: string | null = null;
  status: SyncStatus;

  constructor(opts: EngineOptions) {
    this.kvFactory = opts.kvFactory;
    this.remote = opts.remote;
    this.meta = opts.kvFactory("meta");
    this.dead = opts.kvFactory("deadletter");
    this.outbox = new Outbox(opts.kvFactory("outbox"), this.dead);
    this.withLock = opts.withLock ?? (async (_n, fn) => (await fn(), true));
    this.status = {
      online: opts.online ?? true,
      realtime: false,
      syncing: false,
      pending: 0,
      failed: 0,
      lastSyncedAt: null,
      lastError: null,
      syncEnabled: opts.syncEnabled ?? true,
    };
  }

  // -------------------------------------------------------------------
  // Ciclo de vida
  // -------------------------------------------------------------------

  async start(userId: string): Promise<void> {
    if (this.userId === userId) return;
    this.stop();
    this.userId = userId;
    this.cacheMemo.clear();
    await this.refreshCounts();
    this.status.lastSyncedAt = await this.meta.get<string>(`lastSync:${userId}`);
    this.emitStatus();
    this.unsubscribeRealtime = this.remote.subscribe(
      userId,
      SYNCED_TABLES,
      (table, row) => {
        void this.applyRemote(table, row);
      },
      (connected) => {
        const wasConnected = this.status.realtime;
        this.status.realtime = connected;
        this.emitStatus();
        // Al reconectar, recupera lo que se haya perdido mientras tanto.
        if (connected && !wasConnected) void this.pullAll();
      },
    );
    if (this.status.online) {
      await this.flush();
      await this.pullAll();
    }
  }

  stop(): void {
    this.unsubscribeRealtime?.();
    this.unsubscribeRealtime = null;
    this.userId = null;
    this.status.realtime = false;
  }

  setOnline(online: boolean): void {
    if (this.status.online === online) return;
    this.status.online = online;
    this.emitStatus();
    if (online) {
      void this.flush().then(() => this.pullAll());
    }
  }

  setSyncEnabled(enabled: boolean): void {
    if (this.status.syncEnabled === enabled) return;
    this.status.syncEnabled = enabled;
    this.emitStatus();
    if (enabled && this.status.online) void this.flush().then(() => this.pullAll());
  }

  private tableSyncs(table: TableName): boolean {
    return this.status.syncEnabled || ALWAYS_SYNCED.has(table);
  }

  // -------------------------------------------------------------------
  // Lectura
  // -------------------------------------------------------------------

  private cache(table: TableName): KV {
    return this.kvFactory(`t-${table}`);
  }

  private cacheKey(id: string): string {
    return `${this.requireUser()}:${id}`;
  }

  private requireUser(): string {
    if (!this.userId) throw new Error("SyncEngine: no hay usuario activo");
    return this.userId;
  }

  /** Filas vivas (no borradas) del usuario actual. */
  async list<T extends TableName>(table: T): Promise<RowOf<T>[]> {
    if (!this.userId) return [];
    const memo = this.cacheMemo.get(table);
    if (memo) return memo as unknown as RowOf<T>[];
    const prefix = `${this.userId}:`;
    const version = this.cacheVersion.get(table) ?? 0;
    const rows = (await this.cache(table).entries<AnyRow>())
      .filter(([k, r]) => k.startsWith(prefix) && !r.deleted_at)
      .map(([, r]) => r);
    // Solo memoiza si nadie escribió mientras leíamos.
    if ((this.cacheVersion.get(table) ?? 0) === version) this.cacheMemo.set(table, rows);
    return rows as unknown as RowOf<T>[];
  }

  async get<T extends TableName>(table: T, id: string): Promise<RowOf<T> | null> {
    if (!this.userId) return null;
    const row = await this.cache(table).get<AnyRow>(this.cacheKey(id));
    return row && !row.deleted_at ? (row as unknown as RowOf<T>) : null;
  }

  // -------------------------------------------------------------------
  // Escritura (siempre local primero)
  // -------------------------------------------------------------------

  async insert<T extends TableName>(table: T, data: Partial<RowOf<T>>): Promise<RowOf<T>> {
    const userId = this.requireUser();
    const now = nowIso();
    const id = (data as AnyRow).id ?? uuid();
    const existing = await this.cache(table).get<AnyRow>(this.cacheKey(id));
    const row = {
      ...data,
      id,
      user_id: userId,
      created_at: (data as AnyRow).created_at ?? now,
      updated_at: nextTimestamp(existing?.updated_at),
      deleted_at: null,
    } as unknown as AnyRow;
    const merged = existing ? { ...existing, ...row, created_at: existing.created_at } : row;
    await this.writeLocal(table, merged, true);
    return merged as unknown as RowOf<T>;
  }

  async update<T extends TableName>(table: T, id: string, patch: Partial<RowOf<T>>): Promise<RowOf<T> | null> {
    const existing = await this.cache(table).get<AnyRow>(this.cacheKey(id));
    if (!existing) return null;
    const row = { ...existing, ...patch, id, user_id: existing.user_id, updated_at: nextTimestamp(existing.updated_at) };
    await this.writeLocal(table, row as AnyRow, true);
    return row as unknown as RowOf<T>;
  }

  /** Crea o actualiza una fila con id conocido (filas únicas por usuario). */
  async upsert<T extends TableName>(table: T, id: string, patch: Partial<RowOf<T>>): Promise<RowOf<T>> {
    const existing = await this.cache(table).get<AnyRow>(this.cacheKey(id));
    if (existing) return (await this.update(table, id, patch))!;
    return this.insert(table, { ...patch, id } as Partial<RowOf<T>>);
  }

  /** Borrado lógico (se sincroniza como una actualización). */
  async remove(table: TableName, id: string): Promise<void> {
    await this.update(table, id, { deleted_at: nowIso() } as never);
  }

  private invalidate(table: TableName) {
    this.cacheMemo.delete(table);
    this.cacheVersion.set(table, (this.cacheVersion.get(table) ?? 0) + 1);
  }

  private async writeLocal(table: TableName, row: AnyRow, enqueue: boolean): Promise<void> {
    await this.cache(table).set(`${row.user_id}:${row.id}`, row);
    this.invalidate(table);
    this.emitTable(table); // la UI se actualiza al instante
    if (enqueue && !READ_ONLY_TABLES.has(table)) {
      await this.outbox.enqueue({ table, rowId: row.id, userId: row.user_id, row });
      void this.flush(); // sube ya; el contador se actualiza en paralelo
      await this.refreshCounts();
      this.emitStatus();
    }
  }

  // -------------------------------------------------------------------
  // Remoto -> local
  // -------------------------------------------------------------------

  /** Aplica un cambio llegado de otro dispositivo (Realtime o pull). Last-write-wins. */
  async applyRemote(table: TableName, row: AnyRow): Promise<boolean> {
    if (!this.userId || row.user_id !== this.userId) return false;
    const key = this.cacheKey(row.id);
    const current = await this.cache(table).get<AnyRow>(key);
    if (current) {
      if (Date.parse(current.updated_at) > Date.parse(row.updated_at)) return false;
      // Si hay una escritura local pendiente más reciente, la local gana.
      if (
        Date.parse(current.updated_at) === Date.parse(row.updated_at) &&
        (await this.outbox.hasPendingFor(table, row.id))
      ) {
        return false;
      }
      // Mantén los campos que el servidor no devuelve (p.ej. columnas protegidas omitidas).
      await this.cache(table).set(key, { ...current, ...row });
    } else {
      await this.cache(table).set(key, row);
    }
    this.invalidate(table);
    this.emitTable(table);
    return true;
  }

  async pullAll(): Promise<void> {
    const userId = this.userId;
    if (!userId || !this.status.online) return;
    try {
      for (const table of SYNCED_TABLES) {
        if (!this.tableSyncs(table)) continue;
        const cursorKey = `cursor:${userId}:${table}`;
        const since = await this.meta.get<string>(cursorKey);
        const rows = await this.remote.pull(table, userId, since);
        let max = since;
        for (const row of rows) {
          await this.applyRemote(table, row);
          const cursor = serverCursor(row);
          if (!max || Date.parse(cursor) > Date.parse(max)) max = cursor;
        }
        if (max) await this.meta.set(cursorKey, max);
      }
      this.status.lastSyncedAt = nowIso();
      this.status.lastError = null;
      await this.meta.set(`lastSync:${userId}`, this.status.lastSyncedAt);
    } catch (e) {
      this.status.lastError = errorMessage(e);
    }
    this.emitStatus();
  }

  // -------------------------------------------------------------------
  // Local -> remoto (cola en orden)
  // -------------------------------------------------------------------

  flush(): Promise<void> {
    if (this.flushing) {
      this.flushAgain = true;
      return this.flushing;
    }
    this.flushing = (async () => {
      do {
        this.flushAgain = false;
        const ran = await this.withLock("jarvis-outbox-flush", () => this.flushOnce());
        if (!ran) {
          // Otra pestaña está subiendo la cola: solo refresca el contador.
          await this.refreshCounts();
          this.emitStatus();
        }
      } while (this.flushAgain && this.status.online);
    })().finally(() => {
      this.flushing = null;
    });
    return this.flushing;
  }

  private async flushOnce(): Promise<void> {
    const userId = this.userId;
    if (!userId || !this.status.online) return;
    const ops = await this.outbox.forUser(userId);
    if (ops.length === 0) return;
    this.status.syncing = true;
    this.emitStatus();
    try {
      for (const op of ops) {
        if (!this.status.online) break;
        if (!this.tableSyncs(op.table)) continue; // Free: se queda en cola hasta que mejore el plan
        const ok = await this.pushOp(op);
        if (!ok) break; // error reintentable: conserva el orden, reintenta luego
      }
    } finally {
      this.status.syncing = false;
      await this.refreshCounts();
      this.emitStatus();
    }
  }

  private async pushOp(op: OutboxOp): Promise<boolean> {
    try {
      await this.remote.push(op.table, stripForServer(op.table, op.row));
      await this.outbox.remove(op.key);
      return true;
    } catch (e) {
      const msg = errorMessage(e);
      const retryable = e instanceof RemoteError ? e.retryable : true;
      if (retryable && op.attempts < 50) {
        await this.outbox.update({ ...op, attempts: op.attempts + 1, lastError: msg, status: "pending" });
        this.status.lastError = msg;
        return false;
      }
      await this.outbox.bury(op, msg);
      this.status.lastError = msg;
      return true;
    }
  }

  // -------------------------------------------------------------------
  // Suscripciones de UI
  // -------------------------------------------------------------------

  onTable(table: TableName, fn: Listener): () => void {
    let set = this.tableListeners.get(table);
    if (!set) this.tableListeners.set(table, (set = new Set()));
    set.add(fn);
    return () => set!.delete(fn);
  }

  onStatus(fn: Listener): () => void {
    this.statusListeners.add(fn);
    return () => this.statusListeners.delete(fn);
  }

  private emitTable(table: TableName) {
    this.tableListeners.get(table)?.forEach((fn) => fn());
  }

  private emitStatus() {
    this.status = { ...this.status };
    this.statusListeners.forEach((fn) => fn());
  }

  private async refreshCounts() {
    this.status.pending = this.userId ? await this.outbox.count(this.userId) : 0;
    this.status.failed = this.userId ? await this.outbox.deadCount(this.userId) : 0;
  }

  async pendingOps(): Promise<OutboxOp[]> {
    return this.userId ? this.outbox.forUser(this.userId) : [];
  }
}

/** Quita columnas protegidas/generadas antes de enviar al servidor. */
export function stripForServer(table: TableName, row: AnyRow): AnyRow {
  const cols = CLIENT_STRIPPED_COLUMNS[table];
  if (!cols) return row;
  const copy: Record<string, unknown> = { ...row };
  for (const c of cols) delete copy[c];
  return copy as AnyRow;
}

/** Cursor de sincronización: marca del servidor (o del cliente si no existe). */
export function serverCursor(row: AnyRow): string {
  return (row.server_updated_at as string | undefined) ?? row.updated_at;
}

/** Garantiza que el nuevo updated_at sea estrictamente mayor que el anterior. */
function nextTimestamp(prev: string | undefined): string {
  const now = Date.now();
  const p = prev ? Date.parse(prev) : 0;
  return new Date(Math.max(now, p + 1)).toISOString();
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
