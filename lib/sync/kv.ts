/**
 * Almacenamiento clave-valor local. En el navegador usa localForage (IndexedDB).
 * Cada "namespace" es una base IndexedDB independiente `jarvis-<ns>` con store `kv`
 * (una DB por store evita los problemas de localForage con varios stores por DB,
 * y permite al Service Worker leer la cola directamente).
 */
export interface KV {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  keys(): Promise<string[]>;
  entries<T>(): Promise<Array<[string, T]>>;
  clear(): Promise<void>;
}

export type KVFactory = (namespace: string) => KV;

export const IDB_STORE_NAME = "kv";
export const idbName = (namespace: string) => `jarvis-${namespace}`;

export function memoryKV(): KV {
  const m = new Map<string, unknown>();
  return {
    async get<T>(k: string) {
      return (m.has(k) ? structuredClone(m.get(k)) : null) as T | null;
    },
    async set<T>(k: string, v: T) {
      m.set(k, structuredClone(v));
    },
    async remove(k) {
      m.delete(k);
    },
    async keys() {
      return Array.from(m.keys()).sort();
    },
    async entries<T>() {
      return Array.from(m.entries())
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, structuredClone(v)] as [string, T]);
    },
    async clear() {
      m.clear();
    },
  };
}

/** Factoría en memoria compartida por nombre (tests / SSR). */
export function memoryKVFactory(): KVFactory {
  const stores = new Map<string, KV>();
  return (ns) => {
    if (!stores.has(ns)) stores.set(ns, memoryKV());
    return stores.get(ns)!;
  };
}

let browserFactory: KVFactory | null = null;

export async function getBrowserKVFactory(): Promise<KVFactory> {
  if (browserFactory) return browserFactory;
  const localforage = (await import("localforage")).default;
  const instances = new Map<string, KV>();
  browserFactory = (ns) => {
    const existing = instances.get(ns);
    if (existing) return existing;
    const lf = localforage.createInstance({
      name: idbName(ns),
      storeName: IDB_STORE_NAME,
      driver: [localforage.INDEXEDDB, localforage.LOCALSTORAGE],
    });
    const kv: KV = {
      get: (k) => lf.getItem(k),
      set: async (k, v) => {
        await lf.setItem(k, v);
      },
      remove: (k) => lf.removeItem(k),
      keys: async () => (await lf.keys()).sort(),
      entries: async <T,>() => {
        const out: Array<[string, T]> = [];
        await lf.iterate<T, void>((value, key) => {
          out.push([key, value]);
        });
        return out.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
      },
      clear: () => lf.clear(),
    };
    instances.set(ns, kv);
    return kv;
  };
  return browserFactory;
}
