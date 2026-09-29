"use client";
import { useCallback } from "react";
import { useSync } from "@/components/providers/SyncProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { stableId } from "@/lib/ids";
import { isMockMode } from "@/lib/env";
import type { ConnectorMeta } from "@/connectors/types";
import type { ResolvedPlace } from "@/lib/geo";
import type { UserCoreMemoryRow, UserLocationRow, UserRow, VoicePrefsRow } from "@/types/db";

/** Escrituras de perfil/ajustes (todas pasan por el motor de sincronización). */
export function useProfileActions() {
  const { engine } = useSync();
  const { user } = useAuth();
  const uid = user?.id;

  const updateProfile = useCallback(
    async (patch: Partial<UserRow>) => {
      if (engine && uid) await engine.upsert("users", uid, patch);
    },
    [engine, uid],
  );

  const updateCore = useCallback(
    async (patch: Partial<UserCoreMemoryRow>) => {
      if (engine && uid) await engine.upsert("user_core_memory", uid, patch);
    },
    [engine, uid],
  );

  const updateVoice = useCallback(
    async (patch: Partial<VoicePrefsRow>) => {
      if (engine && uid) await engine.upsert("voice_prefs", uid, patch);
    },
    [engine, uid],
  );

  const setConnector = useCallback(
    async (meta: ConnectorMeta, enabled: boolean) => {
      if (!engine || !uid) return;
      await engine.upsert("connectors_tokens", stableId(uid, "connector", meta.id), {
        provider: meta.id,
        kind: meta.kind,
        enabled,
        status: enabled ? (isMockMode ? "mock" : "pending") : "disconnected",
        scopes: meta.scopes ?? [],
        metadata: { auth: meta.auth },
      });
    },
    [engine, uid],
  );

  const saveLocation = useCallback(
    async (place: ResolvedPlace, method: UserLocationRow["method"], extra: Partial<UserLocationRow> = {}) => {
      if (!engine || !uid) return;
      await engine.upsert("user_locations", stableId(uid, "primary-location"), {
        method,
        lat: place.lat,
        lng: place.lng,
        formatted_address: place.formatted_address,
        country: place.country,
        state: place.state,
        city: place.city,
        timezone: place.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        is_primary: true,
        address_line: extra.address_line ?? null,
      });
    },
    [engine, uid],
  );

  return { updateProfile, updateCore, updateVoice, setConnector, saveLocation };
}
