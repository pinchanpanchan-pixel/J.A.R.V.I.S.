/* eslint-disable no-restricted-globals */
/**
 * Código propio del Service Worker de J.A.R.V.I.S. (se fusiona con el SW de next-pwa).
 *  - Background Sync: sube la cola offline aunque la app esté cerrada.
 *  - Push: recordatorio del diario y alertas de WorldMonitor.
 */

const SYNC_TAG = "jarvis-outbox";

function idbOpen(name) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      // No existe: no la creamos desde aquí.
      req.transaction.abort();
    };
  });
}

function idbAll(db) {
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains("kv")) return resolve([]);
    const tx = db.transaction("kv", "readonly");
    const store = tx.objectStore("kv");
    const out = [];
    const cursorReq = store.openCursor();
    cursorReq.onsuccess = () => {
      const c = cursorReq.result;
      if (!c) return resolve(out);
      out.push([c.key, c.value]);
      c.continue();
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
}

function idbGet(db, key) {
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains("kv")) return resolve(null);
    const req = db.transaction("kv", "readonly").objectStore("kv").get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

function idbDelete(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("kv", "readwrite");
    tx.objectStore("kv").delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Sube la cola directamente contra la API REST de Supabase (sin la app abierta). */
async function flushOutboxFromWorker() {
  let metaDb, outboxDb;
  try {
    metaDb = await idbOpen("jarvis-meta");
    const config = await idbGet(metaDb, "sw:config");
    if (!config || !config.accessToken) return;
    outboxDb = await idbOpen("jarvis-outbox");
    const ops = (await idbAll(outboxDb)).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    for (const [key, op] of ops) {
      if (op.userId !== config.userId) continue;
      const row = Object.assign({}, op.row);
      delete row.server_updated_at;
      delete row.search;
      for (const col of (config.strip && config.strip[op.table]) || []) delete row[col];
      const res = await fetch(`${config.supabaseUrl}/rest/v1/${op.table}?on_conflict=id`, {
        method: "POST",
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify(row),
      });
      if (!res.ok) {
        // 5xx / 401: se reintenta en el próximo sync. Se para para conservar el orden.
        throw new Error(`sync failed ${res.status}`);
      }
      await idbDelete(outboxDb, key);
    }
  } finally {
    metaDb && metaDb.close();
    outboxDb && outboxDb.close();
  }
}

self.addEventListener("sync", (event) => {
  if (event.tag !== SYNC_TAG) return;
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (clients.length > 0) {
        clients.forEach((c) => c.postMessage({ type: "FLUSH_OUTBOX" }));
        return;
      }
      await flushOutboxFromWorker();
    })(),
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "J.A.R.V.I.S.", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "J.A.R.V.I.S.";
  const options = {
    body: data.body || "Ey hermano.",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || "jarvis",
    renotify: true,
    requireInteraction: !!data.urgent,
    vibrate: data.urgent ? [300, 100, 300, 100, 600] : [120],
    data: { url: data.url || "/" },
    actions: data.actions || [],
  };
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      clients.forEach((c) => c.postMessage({ type: "PUSH", payload: data }));
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  const target = event.action ? `${url}${url.includes("?") ? "&" : "?"}action=${event.action}` : url;
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of clients) {
        if ("focus" in c) {
          c.postMessage({ type: "NAVIGATE", url: target });
          return c.focus();
        }
      }
      return self.clients.openWindow(target);
    })(),
  );
});
