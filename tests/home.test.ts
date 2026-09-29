import { describe, it, expect } from "vitest";
import { parseHomeCommand, selectDevices, applyPatch, parseTime } from "@/services/homeController";
import { cronMatches, isValidCron, minuteKey } from "@/lib/cron";
import type { SmartHomeDeviceRow } from "@/types/db";

const dev = (name: string, type: SmartHomeDeviceRow["type"], room: string, state = {}): SmartHomeDeviceRow =>
  ({ id: name, user_id: "u", provider: "govee", external_id: name, name, room, type, state: { on: true, ...state }, online: true, created_at: "", updated_at: "" }) as SmartHomeDeviceRow;
const devices = [dev("Tira LED", "light", "Salón"), dev("Lámpara", "light", "Dormitorio"), dev("Aire acondicionado", "ac", "Dormitorio", { temperature: 23 }), dev("Cafetera", "plug", "Cocina")];
const rooms = ["Salón", "Dormitorio", "Cocina"];
const names = devices.map((d) => d.name);

describe("homeController", () => {
  it("apaga todas las luces", () => {
    const i = parseHomeCommand("Apaga todas las luces", rooms, names);
    expect(i.kind).toBe("control");
    expect(i.patch).toEqual({ on: false });
    expect(selectDevices(devices, i.target).map((d) => d.name)).toEqual(["Tira LED", "Lámpara"]);
  });
  it("pon luz roja al 50 %", () => {
    const i = parseHomeCommand("pon luz roja al 50%", rooms, names);
    expect(i.patch).toMatchObject({ on: true, color: "#FF3B30", brightness: 50 });
  });
  it("pon luz roja en 50 por ciento", () => {
    expect(parseHomeCommand("pon luz roja en 50 por ciento").patch.brightness).toBe(50);
  });
  it("enciende el aire", () => {
    const i = parseHomeCommand("enciende el aire", rooms, names);
    expect(i.patch).toEqual({ on: true });
    expect(selectDevices(devices, i.target).map((d) => d.name)).toEqual(["Aire acondicionado"]);
  });
  it("pon el aire a 21 grados", () => {
    const i = parseHomeCommand("pon el aire a 21 grados", rooms, names);
    expect(i.patch).toMatchObject({ on: true, temperature: 21 });
  });
  it("apaga la luz del dormitorio", () => {
    const i = parseHomeCommand("apaga la luz del dormitorio", rooms, names);
    expect(selectDevices(devices, i.target).map((d) => d.name)).toEqual(["Lámpara"]);
  });
  it("enciende la cafetera (por nombre)", () => {
    const i = parseHomeCommand("enciende la cafetera", rooms, names);
    expect(selectDevices(devices, i.target).map((d) => d.name)).toEqual(["Cafetera"]);
  });
  it("apaga todo a las 11pm -> automatización diaria", () => {
    const i = parseHomeCommand("apaga todo a las 11pm", rooms, names);
    expect(i.kind).toBe("automation");
    expect(i.cron).toBe("0 23 * * *");
    expect(i.command).toBe("apaga todo");
    expect(selectDevices(devices, i.target)).toHaveLength(4);
  });
  it("horas en palabras", () => {
    expect(parseTime("a las once de la noche")).toEqual({ h: 23, m: 0 });
    expect(parseTime("a las 7 y media de la manana")).toEqual({ h: 7, m: 30 });
    expect(parseTime("a las 23:45")).toEqual({ h: 23, m: 45 });
  });
  it("no es una orden del hogar", () => {
    expect(parseHomeCommand("qué tiempo hace hoy").kind).toBe("unknown");
  });
  it("aplica deltas y respeta el tipo", () => {
    expect(applyPatch(devices[2], { temperatureDelta: -1 }).temperature).toBe(22);
    expect(applyPatch(devices[3], { on: false, color: "#fff" })).toEqual({ on: false });
  });
});

describe("cron", () => {
  it("valida y evalúa en zona horaria", () => {
    expect(isValidCron("0 23 * * *")).toBe(true);
    expect(isValidCron("61 x * *")).toBe(false);
    // 21:00 UTC = 23:00 en Madrid (verano)
    const d = new Date("2026-07-01T21:00:00Z");
    expect(cronMatches("0 23 * * *", d, "Europe/Madrid")).toBe(true);
    expect(cronMatches("0 23 * * *", d, "UTC")).toBe(false);
    expect(cronMatches("*/15 * * * 1-5", new Date("2026-07-01T10:30:00Z"))).toBe(true); // miércoles
    expect(minuteKey(d, "Europe/Madrid")).toBe("2026-7-1T23:0");
  });
});
