import type { HomeAdapter } from "./types";

/**
 * HomeKit: una web no puede acceder a HomeKit. Se usa un Atajo de iOS llamado
 * «JARVIS Hogar» que recibe la orden como texto. La app nativa lo sustituirá.
 */
export const homekitAdapter: HomeAdapter = {
  meta: { id: "homekit", name: "HomeKit" },
  isReal: () => false,
  async listDevices() {
    return [];
  },
  async setState(_ctx, device, patch) {
    const input = JSON.stringify({ device: device.external_id, ...patch });
    return { ok: true, openUrl: `shortcuts://run-shortcut?name=${encodeURIComponent("JARVIS Hogar")}&input=text&text=${encodeURIComponent(input)}` };
  },
};
