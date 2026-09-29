import type { DeviceState, DeviceType } from "@/types/db";

/** Dispositivos de demostración (modo simulado o sin claves del fabricante). */
export const MOCK_DEVICES: Array<{ provider: string; external_id: string; name: string; room: string; type: DeviceType; state: DeviceState }> = [
  { provider: "govee", external_id: "govee-strip-salon", name: "Tira LED", room: "Salón", type: "light", state: { on: true, brightness: 70, color: "#64FFDA" } },
  { provider: "hue", external_id: "hue-salon-techo", name: "Luz techo", room: "Salón", type: "light", state: { on: false, brightness: 100, color: "#FFE8C2" } },
  { provider: "hue", external_id: "hue-dormitorio", name: "Lámpara", room: "Dormitorio", type: "light", state: { on: false, brightness: 40, color: "#FFB86B" } },
  { provider: "tuya", external_id: "tuya-aire-dormitorio", name: "Aire acondicionado", room: "Dormitorio", type: "ac", state: { on: false, temperature: 23, mode: "cool" } },
  { provider: "tuya", external_id: "tuya-enchufe-cocina", name: "Cafetera", room: "Cocina", type: "plug", state: { on: false } },
  { provider: "alexa", external_id: "alexa-echo-salon", name: "Echo", room: "Salón", type: "speaker", state: { on: true, volume: 30 } },
];
