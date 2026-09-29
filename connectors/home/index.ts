import type { HomeAdapter } from "./types";
import { goveeAdapter } from "./govee";
import { hueAdapter } from "./hue";
import { homekitAdapter } from "./homekit";
import { alexaAdapter, googleHomeAdapter, tuyaAdapter } from "./simulated";

export const HOME_ADAPTERS: Record<string, HomeAdapter> = {
  govee: goveeAdapter,
  hue: hueAdapter,
  homekit: homekitAdapter,
  alexa: alexaAdapter,
  google_home: googleHomeAdapter,
  tuya: tuyaAdapter,
};

export const homeAdapter = (provider: string): HomeAdapter | null => HOME_ADAPTERS[provider] ?? null;
