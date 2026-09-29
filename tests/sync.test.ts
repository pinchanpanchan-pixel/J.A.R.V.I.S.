import { describe, it, expect } from "vitest";
import { SyncEngine } from "@/lib/sync/engine";
import { memoryKVFactory } from "@/lib/sync/kv";
import { MockRemote } from "@/lib/sync/mockRemote";

const USER = "11111111-1111-4111-8111-111111111111";
const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));

function setup() {
  const cloud = new MockRemote(memoryKVFactory());
  const iphone = new SyncEngine({ kvFactory: memoryKVFactory(), remote: cloud });
  const mac = new SyncEngine({ kvFactory: memoryKVFactory(), remote: cloud });
  return { cloud, iphone, mac };
}

describe("SyncEngine", () => {
  it("una nota guardada en el iPhone aparece en el Mac en tiempo real", async () => {
    const { iphone, mac } = setup();
    await iphone.start(USER);
    await mac.start(USER);
    const note = await iphone.insert("quick_notes", { content: "comprar leche", category: "quick_notes" });
    await iphone.flush();
    await tick();
    const onMac = await mac.list("quick_notes");
    expect(onMac.map((n) => n.id)).toContain(note.id);
    expect(onMac[0].content).toBe("comprar leche");
  });

  it("offline: guarda en cola y sube en orden al volver la conexión", async () => {
    const { iphone, mac, cloud } = setup();
    await iphone.start(USER);
    iphone.setOnline(false);
    const a = await iphone.insert("quick_notes", { content: "1" });
    await iphone.update("quick_notes", a.id, { content: "2" });
    await iphone.insert("memory_blocks", { title: "t", content: "c", tags: [], source: "manual" });
    expect(iphone.status.pending).toBe(3);
    expect(await cloud.listAll("quick_notes")).toHaveLength(0);

    iphone.setOnline(true);
    await iphone.flush();
    expect(iphone.status.pending).toBe(0);
    const cloudNote = await cloud.getRow("quick_notes", a.id);
    expect(cloudNote?.content).toBe("2");

    await mac.start(USER); // dispositivo nuevo: descarga todo
    expect((await mac.list("quick_notes"))[0].content).toBe("2");
    expect(await mac.list("memory_blocks")).toHaveLength(1);
  });

  it("un fallo de red conserva la operación y reintenta sin perder datos", async () => {
    let fail = true;
    const cloud = new MockRemote(memoryKVFactory(), { failNext: () => fail });
    const dev = new SyncEngine({ kvFactory: memoryKVFactory(), remote: cloud });
    await dev.start(USER);
    await dev.insert("quick_notes", { content: "x" });
    await dev.flush();
    expect(dev.status.pending).toBe(1);
    fail = false;
    await dev.flush();
    expect(dev.status.pending).toBe(0);
    expect(await cloud.listAll("quick_notes")).toHaveLength(1);
  });

  it("last-write-wins: una escritura antigua no pisa la nueva", async () => {
    const { iphone, mac, cloud } = setup();
    await iphone.start(USER);
    await mac.start(USER);
    const n = await iphone.insert("quick_notes", { content: "v1" });
    await iphone.flush();
    await tick();
    mac.setOnline(false);
    await mac.update("quick_notes", n.id, { content: "mac-offline" });
    await tick(10);
    await iphone.update("quick_notes", n.id, { content: "iphone-nuevo" });
    await iphone.flush();
    mac.setOnline(true);
    await mac.flush();
    await mac.pullAll();
    await tick();
    expect((await cloud.getRow("quick_notes", n.id))?.content).toBe("iphone-nuevo");
    expect((await mac.get("quick_notes", n.id))?.content).toBe("iphone-nuevo");
  });

  it("borrado lógico se sincroniza", async () => {
    const { iphone, mac } = setup();
    await iphone.start(USER);
    await mac.start(USER);
    const n = await iphone.insert("quick_notes", { content: "borrar" });
    await iphone.flush();
    await tick();
    await mac.remove("quick_notes", n.id);
    await mac.flush();
    await tick();
    expect(await iphone.list("quick_notes")).toHaveLength(0);
  });

  it("plan Free: los datos quedan en cola y se suben al mejorar el plan", async () => {
    const cloud = new MockRemote(memoryKVFactory());
    const dev = new SyncEngine({ kvFactory: memoryKVFactory(), remote: cloud, syncEnabled: false });
    await dev.start(USER);
    await dev.insert("quick_notes", { content: "local" });
    await dev.upsert("voice_prefs", USER, { voice_key: "deep_calm" });
    await dev.flush();
    expect(await cloud.listAll("quick_notes")).toHaveLength(0);
    expect(await cloud.listAll("voice_prefs")).toHaveLength(1); // siempre sincronizada
    dev.setSyncEnabled(true);
    await dev.flush();
    expect(await cloud.listAll("quick_notes")).toHaveLength(1);
  });

  it("no envía columnas protegidas del perfil", async () => {
    const { iphone, cloud } = setup();
    await iphone.start(USER);
    await iphone.upsert("users", USER, { is_owner: true, subscription: "pro", floating_mode_enabled: true } as never);
    await iphone.flush();
    const row = await cloud.getRow("users", USER);
    expect(row?.floating_mode_enabled).toBe(true);
    expect(row?.is_owner).toBeUndefined();
    expect(row?.subscription).toBeUndefined();
    expect(iphone.status.failed).toBe(0);
  });

  it("actualizar el perfil existente no se rechaza (user_id generado)", async () => {
    const { iphone, cloud } = setup();
    await cloud.pushAsBackend("users", { id: USER, user_id: USER, email: "a@b.c", is_owner: true, subscription: "pro_lifetime", updated_at: new Date().toISOString() } as never);
    await iphone.start(USER);
    await iphone.update("users", USER, { onboarding_step: 3 } as never);
    await iphone.flush();
    expect(iphone.status.failed).toBe(0);
    const row = await cloud.getRow("users", USER);
    expect(row?.onboarding_step).toBe(3);
    expect(row?.is_owner).toBe(true);
  });
});

describe("candado entre pestañas", () => {
  it("si otra pestaña tiene el candado, no sube (y no duplica)", async () => {
    const cloud = new MockRemote(memoryKVFactory());
    let pushes = 0;
    const orig = cloud.push.bind(cloud);
    cloud.push = async (t, r) => {
      pushes++;
      return orig(t, r);
    };
    let held = true;
    const dev = new SyncEngine({
      kvFactory: memoryKVFactory(),
      remote: cloud,
      withLock: async (_n, fn) => {
        if (held) return false;
        await fn();
        return true;
      },
    });
    await dev.start(USER);
    await dev.insert("quick_notes", { content: "x" });
    await dev.flush();
    expect(pushes).toBe(0);
    expect(dev.status.pending).toBe(1);
    held = false;
    await dev.flush();
    expect(pushes).toBe(1);
    expect(dev.status.pending).toBe(0);
  });
});
