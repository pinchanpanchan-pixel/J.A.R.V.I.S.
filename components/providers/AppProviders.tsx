"use client";
import type { ReactNode } from "react";
import { AuthProvider } from "./AuthProvider";
import { SyncProvider } from "./SyncProvider";
import { OfflineAudioSync } from "./OfflineAudioSync";
import { MessageCenter } from "@/components/MessageCenter";
import { ServiceWorkerRegistrar } from "./ServiceWorkerRegistrar";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <SyncProvider>
        <ServiceWorkerRegistrar />
        <OfflineAudioSync />
        <MessageCenter />
        {children}
      </SyncProvider>
    </AuthProvider>
  );
}
