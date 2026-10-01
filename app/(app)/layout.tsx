"use client";
import { Suspense, type ReactNode } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { BottomNav } from "@/components/BottomNav";
import { QuickNoteSheet } from "@/components/QuickNote";
import { OnboardingCard } from "@/components/OnboardingCard";
import { FloatingDot } from "@/components/FloatingDot";
import { DiaryPrompt } from "@/components/DiaryPrompt";
import { useProfile } from "@/hooks/useProfile";
import { VoiceProvider } from "@/components/providers/VoiceProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AutomationRunner } from "@/components/providers/AutomationRunner";
import { WorldMonitorProvider } from "@/components/providers/WorldMonitorProvider";
import { ProactiveProvider } from "@/components/providers/ProactiveProvider";
import { StyleController } from "@/components/providers/StyleController";
import { TooltipLayer } from "@/components/TooltipLayer";

function Shell({ children }: { children: ReactNode }) {
  const { profile } = useProfile();
  const onboarding = !!profile && !profile.onboarding_completed;
  return (
    <>
      {/* La app queda visible (desenfocada) detrás de la tarjeta de onboarding */}
      <div aria-hidden={onboarding} className={onboarding ? "pointer-events-none select-none" : undefined}>
        <main className="mx-auto min-h-[100dvh] max-w-xl px-4 pb-[calc(env(safe-area-inset-bottom)+96px)] pt-[max(env(safe-area-inset-top),16px)]">
          <ErrorBoundary label="pantalla">{children}</ErrorBoundary>
        </main>
        <Suspense>
          <QuickNoteSheet />
        </Suspense>
        <BottomNav />
        {!onboarding && <FloatingDot />}
        {!onboarding && <DiaryPrompt />}
        <TooltipLayer />
      </div>
      {onboarding && <OnboardingCard />}
    </>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <VoiceProvider>
        <AutomationRunner />
        <WorldMonitorProvider />
        <ProactiveProvider />
        <StyleController />
        <Shell>{children}</Shell>
      </VoiceProvider>
    </RequireAuth>
  );
}
