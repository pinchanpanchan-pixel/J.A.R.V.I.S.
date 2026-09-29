import { NextResponse } from "next/server";
import { isMockMode, publicEnv } from "@/lib/env";
import { secret } from "@/lib/serverEnv";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { founderSlotsLeft, paypalConfigured, stripeClient } from "@/lib/payments/server";

export const dynamic = "force-dynamic";

/** Qué pasarelas están disponibles (sin revelar secretos) y plazas Founder restantes. */
export async function GET() {
  const stripe = !!stripeClient() && !!secret("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
  return NextResponse.json({
    mock: isMockMode || (!stripe && !paypalConfigured()),
    stripe: stripe ? { publishableKey: publicEnv.stripePublishableKey } : null,
    paypal: paypalConfigured() ? { clientId: secret("PAYPAL_CLIENT_ID") } : null,
    founderSlotsLeft: await founderSlotsLeft(getSupabaseAdmin()),
  });
}
