"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, CreditCard, Crown, Loader2, Lock } from "lucide-react";
import type { PaymentRequest, Stripe, StripeCardElement } from "@stripe/stripe-js";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { DiscountInput, type AppliedDiscount } from "@/components/DiscountInput";
import { useProfile } from "@/hooks/useProfile";
import { useSync } from "@/components/providers/SyncProvider";
import { PRICES, PLAN_LABELS } from "@/lib/plans";
import { formatUsd, quote } from "@/lib/payments/discounts";
import { getPaymentsConfig, type PaymentsConfig } from "@/lib/payments/client";
import { mockPay } from "@/lib/mock/payments";
import { apiJson } from "@/lib/api";
import type { DiscountCodeRow, Period } from "@/types/db";

export const PRO_BENEFITS = [
  "Memoria infinita: lo sabe todo de ti",
  "Sincronización en todos tus dispositivos",
  "Las 4 voces premium",
  "Todas tus apps y tu hogar inteligente",
  "Diario privado cifrado",
  "WorldMonitor: te avisa si pasa algo cerca",
  "Modo flotante, atajos y multi-IA",
];

type PaidPlan = "pro_lite" | "pro" | "founder";
type Method = "apple_pay" | "google_pay" | "paypal" | "card";
const METHOD_LABEL: Record<Method, string> = { apple_pay: "Apple Pay", google_pay: "Google Pay", paypal: "PayPal", card: "tarjeta" };

function AppleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
      <path d="M16.4 12.7c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-2.7-1-2.7-4.1zM13.9 5.1c.7-.9 1.2-2 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4z" />
    </svg>
  );
}

/** ¿Hay Apple Pay en este dispositivo? (Safari en iPhone/iPad/Mac con tarjeta configurada) */
function nativeApplePay(): boolean {
  try {
    const s = (window as unknown as { ApplePaySession?: { canMakePayments(): boolean } }).ApplePaySession;
    return !!s && s.canMakePayments();
  } catch {
    return false;
  }
}

const asCode = (d: AppliedDiscount | null) => (d ? ({ percent_off: d.percentOff, duration: d.duration ?? "forever" } as DiscountCodeRow) : null);

/**
 * «Desbloquea a tu hermano completo». Botones apilados: Apple Pay (negro, principal si el
 * dispositivo lo admite), PayPal (amarillo), tarjeta (Stripe Elements) y Google Pay si existe.
 * Códigos de descuento: 100 % activa sin pasarela; <100 % se aplica al cobro.
 */
export function PaymentCard({ onContinueFree, onPaid }: { onContinueFree?: () => void; onPaid?: () => void }) {
  const { user, profile } = useProfile();
  const { mockCloud } = useSync();
  const [cfg, setCfg] = useState<PaymentsConfig | null>(null);
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const [plan, setPlan] = useState<PaidPlan>("pro");
  const [discount, setDiscount] = useState<AppliedDiscount | null>(null);
  const [wallets, setWallets] = useState<{ applePay: boolean; googlePay: boolean }>({ applePay: false, googlePay: false });
  const [status, setStatus] = useState<"idle" | "paying" | "activating" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [cardOpen, setCardOpen] = useState(false);
  const [mockMethod, setMockMethod] = useState<Method | null>(null);
  const stripeRef = useRef<Stripe | null>(null);
  const prRef = useRef<PaymentRequest | null>(null);
  const cardRef = useRef<StripeCardElement | null>(null);
  const cardMount = useRef<HTMLDivElement>(null);
  const paypalMount = useRef<HTMLDivElement>(null);
  const initialPlan = useRef(profile?.subscription);

  const effPeriod: Period = plan === "founder" ? "lifetime" : period;
  const q = useMemo(() => quote(plan, effPeriod, asCode(discount)), [plan, effPeriod, discount]);
  const state = useRef({ plan, period: effPeriod, code: discount?.code ?? null, q });
  state.current = { plan, period: effPeriod, code: discount?.code ?? null, q };
  const founderLeft = cfg?.founderSlotsLeft ?? 500;

  useEffect(() => {
    void getPaymentsConfig(mockCloud)
      .then(setCfg)
      .catch(() => setCfg({ mock: true, stripe: null, paypal: null, founderSlotsLeft: 500 }));
  }, [mockCloud]);

  // Cuando el webhook activa el plan, el perfil sincronizado cambia: hecho.
  useEffect(() => {
    if (status === "activating" && profile && profile.subscription !== "free" && profile.subscription !== initialPlan.current) {
      setStatus("done");
      setTimeout(() => onPaid?.(), 900);
    }
  }, [status, profile, onPaid]);

  const finished = useCallback(() => setStatus("activating"), []);

  const createIntent = useCallback(async () => {
    const s = state.current;
    return apiJson<{ clientSecret: string }>("/api/payments/stripe/intent", { method: "POST", body: JSON.stringify({ plan: s.plan, period: s.period, code: s.code }) });
  }, []);

  // ---- Stripe: Apple Pay / Google Pay (PaymentRequest) + tarjeta
  useEffect(() => {
    if (!cfg) return;
    if (!cfg.stripe || cfg.mock) {
      const apple = nativeApplePay();
      setWallets({ applePay: apple, googlePay: !apple && "PaymentRequest" in window });
      return;
    }
    let cancelled = false;
    void (async () => {
      const { loadStripe } = await import("@stripe/stripe-js");
      const stripe = await loadStripe(cfg.stripe!.publishableKey);
      if (!stripe || cancelled) return;
      stripeRef.current = stripe;
      const pr = stripe.paymentRequest({ country: "US", currency: "usd", total: { label: "J.A.R.V.I.S.", amount: state.current.q.firstChargeCents } });
      const can = await pr.canMakePayment();
      if (cancelled) return;
      setWallets({ applePay: !!can?.applePay, googlePay: !!can?.googlePay });
      pr.on("paymentmethod", async (ev) => {
        try {
          const { clientSecret } = await createIntent();
          const first = await stripe.confirmCardPayment(clientSecret, { payment_method: ev.paymentMethod.id }, { handleActions: false });
          if (first.error) {
            ev.complete("fail");
            setError(first.error.message ?? "El pago no se ha completado.");
            setStatus("error");
            return;
          }
          ev.complete("success");
          if (first.paymentIntent?.status === "requires_action") {
            const second = await stripe.confirmCardPayment(clientSecret);
            if (second.error) throw new Error(second.error.message);
          }
          finished();
        } catch (e) {
          ev.complete("fail");
          setError(e instanceof Error ? e.message : "Error en el pago");
          setStatus("error");
        }
      });
      prRef.current = pr;
    })();
    return () => {
      cancelled = true;
    };
  }, [cfg, createIntent, finished]);

  useEffect(() => {
    prRef.current?.update({ total: { label: `J.A.R.V.I.S. ${q.label}`, amount: q.firstChargeCents } });
  }, [q]);

  // ---- PayPal
  useEffect(() => {
    if (!cfg?.paypal || cfg.mock || !paypalMount.current) return;
    let cancelled = false;
    void (async () => {
      const { loadScript } = await import("@paypal/paypal-js");
      const paypal = await loadScript({ clientId: cfg.paypal!.clientId, currency: "USD", intent: "capture" });
      if (!paypal?.Buttons || cancelled || !paypalMount.current) return;
      paypalMount.current.innerHTML = "";
      await paypal
        .Buttons({
          style: { color: "gold", shape: "pill", label: "paypal", height: 52 },
          createOrder: async () => {
            const s = state.current;
            return (await apiJson<{ orderId: string }>("/api/payments/paypal/order", { method: "POST", body: JSON.stringify({ plan: s.plan, period: s.period, code: s.code }) })).orderId;
          },
          onApprove: async (data) => {
            setStatus("paying");
            await apiJson("/api/payments/paypal/capture", { method: "POST", body: JSON.stringify({ orderId: data.orderID }) });
            finished();
          },
          onError: () => {
            setError("PayPal no ha podido completar el pago.");
            setStatus("error");
          },
        })
        .render(paypalMount.current);
    })();
    return () => {
      cancelled = true;
    };
  }, [cfg, finished]);

  // ---- Tarjeta (Stripe Elements)
  useEffect(() => {
    if (!cardOpen || !stripeRef.current) return;
    const t = setTimeout(() => {
      if (!cardMount.current) return;
      const el = stripeRef.current!.elements().create("card", {
        hidePostalCode: true,
        style: { base: { color: "#fff", fontSize: "16px", "::placeholder": { color: "rgba(255,255,255,.4)" } }, invalid: { color: "#fca5a5" } },
      });
      el.mount(cardMount.current);
      cardRef.current = el;
    }, 200);
    return () => {
      clearTimeout(t);
      cardRef.current?.destroy();
      cardRef.current = null;
    };
  }, [cardOpen]);

  const payCard = async () => {
    const stripe = stripeRef.current;
    if (!stripe || !cardRef.current) return;
    setStatus("paying");
    setError(null);
    try {
      const { clientSecret } = await createIntent();
      const r = await stripe.confirmCardPayment(clientSecret, { payment_method: { card: cardRef.current } });
      if (r.error) throw new Error(r.error.message);
      setCardOpen(false);
      finished();
    } catch (e) {
      setError(e instanceof Error ? e.message : "El pago no se ha completado.");
      setStatus("error");
    }
  };

  const pay = (m: Method) => {
    setError(null);
    if (cfg?.mock) return setMockMethod(m);
    if (m === "card") return setCardOpen(true);
    if (m === "apple_pay" || m === "google_pay") prRef.current?.show(); // síncrono dentro del toque
  };

  const confirmMock = async () => {
    if (!mockCloud || !user || !mockMethod) return;
    setStatus("paying");
    await new Promise((r) => setTimeout(r, 700));
    await mockPay(mockCloud, user.id, plan, effPeriod, q.firstChargeCents, discount?.code ?? null, mockMethod === "paypal" ? "paypal" : "stripe");
    setMockMethod(null);
    finished();
  };

  const options = PRICES.filter((p) => p.period === period || p.plan === "founder");
  const busy = status === "paying" || status === "activating";

  if (status === "done") {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center" role="status">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-arc text-navy-900">
          <Check className="h-7 w-7" />
        </div>
        <p className="text-lg font-semibold">Bienvenido, hermano.</p>
        <p className="text-sm text-white/60">Ya lo tienes todo desbloqueado.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-1.5">
        {PRO_BENEFITS.map((b) => (
          <li key={b} className="flex items-start gap-2 text-sm text-white/80">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-arc" /> {b}
          </li>
        ))}
      </ul>
      <Segmented
        id="period"
        value={period}
        onChange={setPeriod}
        options={[
          { value: "monthly", label: "Mensual" },
          { value: "yearly", label: "Anual · 2 meses gratis" },
        ]}
      />
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Plan">
        {options.map((p) => {
          const active = plan === p.plan;
          const soldOut = p.plan === "founder" && founderLeft <= 0;
          const pq = quote(p.plan, p.period, asCode(discount));
          return (
            <button
              key={`${p.plan}-${p.period}`}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={soldOut}
              onClick={() => setPlan(p.plan)}
              className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition disabled:opacity-40 ${active ? "border-arc bg-arc/10" : "border-white/10 bg-white/[0.04]"}`}
            >
              <span className="flex flex-col">
                <span className="flex items-center gap-2 font-semibold">
                  {p.plan === "founder" && <Crown className="h-4 w-4 text-gold" />}
                  {PLAN_LABELS[p.plan]}
                  {p.plan === "pro" && <span className="rounded-full bg-arc px-2 py-0.5 text-[10px] font-bold text-navy-900">RECOMENDADO</span>}
                </span>
                {p.plan === "founder" && <span className="text-[11px] text-gold/80">{soldOut ? "Agotado" : `Solo quedan ${founderLeft} de 500`}</span>}
              </span>
              <span className="text-right text-sm">
                {discount && pq.firstChargeCents < pq.baseCents ? (
                  <>
                    <span className="mr-1 text-white/35 line-through">{formatUsd(pq.baseCents)}</span>
                    <span className="font-semibold text-arc">{formatUsd(pq.firstChargeCents)}</span>
                  </>
                ) : (
                  <span className="text-white/75">{p.label}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Botones de pago apilados: Apple Pay → PayPal → tarjeta (+ Google Pay) */}
      <div className="flex flex-col gap-2.5">
        {wallets.applePay && (
          <button type="button" onClick={() => pay("apple_pay")} disabled={busy} className="jv-btn h-[54px] bg-black text-[17px] text-white ring-1 ring-white/20 hover:bg-black/85" aria-label="Pagar con Apple Pay">
            <AppleLogo /> Pay
          </button>
        )}
        {cfg?.paypal && !cfg.mock ? (
          <div ref={paypalMount} className="min-h-[52px]" />
        ) : (
          <button type="button" onClick={() => pay("paypal")} disabled={busy || !cfg} className="jv-btn h-[54px] bg-[#FFC439] text-[17px] font-bold italic text-[#003087] hover:bg-[#f2ba36]" aria-label="Pagar con PayPal">
            Pay<span className="text-[#009cde]">Pal</span>
          </button>
        )}
        <button type="button" onClick={() => pay("card")} disabled={busy || !cfg} className="jv-btn-ghost h-[54px]">
          <CreditCard className="h-5 w-5" /> Pagar con tarjeta
        </button>
        {wallets.googlePay && (
          <button type="button" onClick={() => pay("google_pay")} disabled={busy} className="jv-btn h-[54px] bg-white text-black hover:bg-white/90" aria-label="Pagar con Google Pay">
            <span className="font-semibold">G</span> Pay
          </button>
        )}
      </div>

      <p className="text-center text-xs text-white/45">
        {q.recurringCents !== null && q.recurringCents !== q.firstChargeCents
          ? `Hoy ${formatUsd(q.firstChargeCents)}, después ${formatUsd(q.recurringCents)}/${q.period === "yearly" ? "año" : "mes"}.`
          : `Total: ${formatUsd(q.firstChargeCents)}${q.period === "lifetime" ? " una vez" : q.period === "yearly" ? "/año" : "/mes"}.`}{" "}
        Cancela cuando quieras.
      </p>
      {status === "activating" && (
        <p className="flex items-center justify-center gap-2 text-sm text-arc" role="status">
          <Loader2 className="h-4 w-4 animate-spin" /> Activando tu plan…
        </p>
      )}
      {error && <p className="text-center text-sm text-red-300">{error}</p>}

      <DiscountInput onApplied={setDiscount} onUnlocked={() => onPaid?.()} />

      {onContinueFree && (
        <button type="button" onClick={onContinueFree} className="text-center text-sm text-white/45 underline-offset-4 hover:underline">
          Seguir con el plan Free
        </button>
      )}
      <p className="flex items-center justify-center gap-1 text-[11px] text-white/30">
        <Lock className="h-3 w-3" /> Pagos seguros con Stripe y PayPal
      </p>

      <Sheet open={cardOpen} onClose={() => setCardOpen(false)} title={`Pagar ${formatUsd(q.firstChargeCents)}`}>
        <div ref={cardMount} className="jv-input min-h-[52px] py-4" />
        <button onClick={() => void payCard()} disabled={busy} className="jv-btn-primary mt-3 w-full">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Pagar
        </button>
      </Sheet>

      <Sheet open={!!mockMethod} onClose={() => setMockMethod(null)} title="Pago simulado">
        <p className="text-sm text-white/70">
          Modo simulado: no se cobra nada. Simular pago de <b className="text-white">{formatUsd(q.firstChargeCents)}</b> con {mockMethod ? METHOD_LABEL[mockMethod] : ""} para {PLAN_LABELS[plan]}.
        </p>
        <button onClick={() => void confirmMock()} disabled={busy} className="jv-btn-primary mt-4 w-full">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Confirmar pago simulado
        </button>
      </Sheet>
    </div>
  );
}
