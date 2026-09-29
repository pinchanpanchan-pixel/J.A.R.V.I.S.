"use client";
import { Suspense, type ReactNode } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { BottomNav } from "@/components/BottomNav";
import { QuickNoteFab } from "@/components/QuickNote";
import { OnboardingCard } from "@/components/OnboardingCard";
import { FloatingDot } from "@/components/FloatingDot";
import { useProfile } from "@/hooks/useProfile";
import { VoiceProvider } from "@/components/providers/VoiceProvider";

function Shell({ children }: { children: ReactNode }) {
  const { profile } = useProfile();
  const onboarding = !!profile && !profile.onboarding_completed;
  return (
    <>
      {/* La app queda visible (desenfocada) detrás de la tarjeta de onboarding */}
      <div aria-hidden={onboarding} className={onboarding ? "pointer-events-none select-none" : undefined}>
        <main className="mx-auto min-h-[100dvh] max-w-xl px-4 pb-[calc(env(safe-area-inset-bottom)+96px)] pt-[max(env(safe-area-inset-top),16px)]">
          {children}
        </main>
        <Suspense>
          <QuickNoteFab />
        </Suspense>
        <BottomNav />
        {!onboarding && <FloatingDot />}
      </div>
      {onboarding && <OnboardingCard />}
    </>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <VoiceProvider>
        <Shell>{children}</Shell>
      </VoiceProvider>
    </RequireAuth>
  );
}
