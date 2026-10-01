import type { DeviceState, DeviceType } from "@/types/db";
import type { ConnectorMeta } from "../types";

export interface RemoteDevice {
  external_id: string;
  name: string;
  room: string | null;
  type: DeviceType;
  state: DeviceState;
  online: boolean;
  /** Datos del fabricante necesarios para controlarlo (p.ej. modelo Govee). */
  meta?: Record<string, unknown>;
}

export interface HomeAdapterContext {
  /** Token/clave ya DESCIFRADO (solo en servidor). null = sin credenciales (simulado). */
  token: string | null;
  metadata: Record<string, unknown>;
}

export interface HomeCommandResult {
  ok: boolean;
  /** Si el cliente debe abrir algo (p. ej. un Atajo de iOS). */
  openUrl?: string;
  error?: string;
}

/** Adaptador de un fabricante de hogar inteligente. */
export interface HomeAdapter {
  meta: Pick<ConnectorMeta, "id" | "name">;
  /** true si puede operar de verdad con las credenciales dadas. */
  isReal(ctx: HomeAdapterContext): boolean;
  listDevices(ctx: HomeAdapterContext): Promise<RemoteDevice[]>;
  setState(ctx: HomeAdapterContext, device: { external_id: string; meta?: Record<string, unknown> }, patch: DeviceState): Promise<HomeCommandResult>;
}
