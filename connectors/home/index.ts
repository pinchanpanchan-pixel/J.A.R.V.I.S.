import type { HomeAdapter } from "./types";
import { goveeAdapter } from "./govee";
import { hueAdapter } from "./hue";
import { tuyaAdapter } from "./tuya";
import { alexaAdapter, googleHomeAdapter } from "./simulated";

export const HOME_ADAPTERS: Record<string, HomeAdapter> = {
  govee: goveeAdapter,
  hue: hueAdapter,
  alexa: alexaAdapter,
  google_home: googleHomeAdapter,
  tuya: tuyaAdapter,
};

export const homeAdapter = (provider: string): HomeAdapter | null => HOME_ADAPTERS[provider] ?? null;
