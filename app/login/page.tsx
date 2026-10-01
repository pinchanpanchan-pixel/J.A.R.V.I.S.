"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.8z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.4 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
    </svg>
  );
}

const RESEND_SECONDS = 60;

/** Mensajes de Supabase Auth en cristiano. */
function friendly(err: unknown, step: "email" | "code"): string {
  const m = err instanceof Error ? err.message.toLowerCase() : "";
  if (step === "code") return /expired|caduc/.test(m) ? "Ese código ha caducado. Pide otro." : "Código incorrecto. Revísalo o pide otro.";
  if (/rate|seconds|too many/.test(m)) return "Has pedido muchos códigos seguidos. Espera un minuto y vuelve a probar.";
  return "No he podido enviarte el código. ¿Está bien escrito el email?";
}

export default function LoginPage() {
  const { user, loading, mock, signInWithGoogle, sendEmailCode, verifyEmailCode } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [mockCode, setMockCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [user, loading, router]);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Ese email no me cuadra, hermano.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await sendEmailCode(email);
      setMockCode(r.mockCode ?? null);
      setCode("");
      setStep("code");
      setWait(RESEND_SECONDS);
      setTimeout(() => codeRef.current?.focus(), 250);
    } catch (err) {
      setError(friendly(err, "email"));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value: string) => {
    if (value.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await verifyEmailCode(email, value);
      router.replace("/");
    } catch (err) {
      setError(friendly(err, "code"));
      setCode("");
      codeRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError(null);
    try {
      await signInWithGoogle();
    } catch {
      setError("Google no está disponible ahora mismo. Entra con tu email.");
    }
  };

  return (
    <main className="flex min-h-[100dvh] items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-[420px] rounded-card border border-white/[0.08] bg-navy-800/95 p-7 shadow-card"
      >
        <div className="mx-auto mb-6 h-16 w-16 rounded-full bg-[radial-gradient(circle_at_35%_30%,#9DF5E3,#64FFDA_40%,#0F2440_75%)] shadow-[0_0_40px_rgba(100,255,218,.45)]" />

        <AnimatePresence mode="wait" initial={false}>
          {step === "email" ? (
            <motion.div key="email" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h1 className="text-center text-2xl font-semibold tracking-tight text-white">Ey, hermano.</h1>
              <p className="mt-1 text-center text-sm text-white/60">Entra y seguimos donde lo dejamos.</p>

              <button onClick={() => void google()} className="jv-btn-ghost mt-7 w-full">
                <GoogleIcon /> Continuar con Google
              </button>

              <div className="my-6 flex items-center gap-3 text-xs text-white/30">
                <div className="h-px flex-1 bg-white/10" /> o con tu email <div className="h-px flex-1 bg-white/10" />
              </div>

              <form onSubmit={send} className="flex flex-col gap-3">
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  className="jv-input"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-label="Email"
                />
                <button type="submit" disabled={busy} className="jv-btn-primary">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  Enviarme un código
                </button>
              </form>
              <p className="mt-3 text-center text-[11.5px] text-white/35">Te llega un código de 6 dígitos y entras aquí mismo, sin salir de la app.</p>
            </motion.div>
          ) : (
            <motion.div key="code" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setError(null);
                }}
                className="-ml-2 mb-2 flex items-center gap-1 rounded-full px-2 py-1 text-sm text-white/50 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" /> Cambiar email
              </button>
              <h1 className="text-center text-2xl font-semibold tracking-tight text-white">Mira tu correo</h1>
              <p className="mt-1 text-center text-sm text-white/60">
                He mandado un código de 6 dígitos a <b className="text-white/85">{email.trim().toLowerCase()}</b>.
              </p>

              <CodeBoxes
                value={code}
                inputRef={codeRef}
                disabled={busy}
                onChange={(v) => {
                  setCode(v);
                  if (v.length === 6) void verify(v);
                }}
              />

              <div className="mt-4 flex min-h-[20px] items-center justify-center text-sm">
                {busy ? (
                  <span className="flex items-center gap-2 text-white/60">
                    <Loader2 className="h-4 w-4 animate-spin" /> Comprobando…
                  </span>
                ) : wait > 0 ? (
                  <span className="text-white/35">Reenviar en {wait} s</span>
                ) : (
                  <button type="button" onClick={() => void send()} className="text-arc underline-offset-4 hover:underline">
                    Reenviar código
                  </button>
                )}
              </div>
              <p className="mt-3 text-center text-[11.5px] text-white/35">¿No llega? Mira en spam o promociones. El correo también trae un enlace que funciona igual.</p>
              {mockCode && (
                <p className="mt-4 rounded-2xl bg-white/[0.04] px-4 py-3 text-center text-xs text-white/55" data-testid="mock-code">
                  Modo simulado (no hay correo): tu código es <b className="tracking-widest text-white">{mockCode}</b>
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <p role="alert" className="mt-4 text-center text-sm text-red-300">
            {error}
          </p>
        )}

        {mock && step === "email" && (
          <p className="mt-6 text-center text-[11px] leading-relaxed text-white/35">
            Modo simulado: sin claves reales. Todo se guarda en este navegador. Abre otra pestaña con el mismo email para ver la sincronización en tiempo real.
          </p>
        )}
      </motion.div>
    </main>
  );
}

/**
 * 6 casillas. Por debajo hay UN solo input (numérico, `one-time-code`): así el iPhone
 * ofrece el código del correo encima del teclado y pegar funciona a la primera.
 */
function CodeBoxes({
  value,
  onChange,
  inputRef,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="relative mx-auto mt-6 w-full max-w-[320px]" onClick={() => inputRef.current?.focus()}>
      <div className="grid grid-cols-6 gap-2" aria-hidden>
        {Array.from({ length: 6 }, (_, i) => {
          const active = focused && i === Math.min(value.length, 5);
          return (
            <div
              key={i}
              className={`flex aspect-[4/5] items-center justify-center rounded-2xl border text-2xl font-semibold tabular-nums transition ${
                active ? "border-arc bg-arc/10 shadow-[0_0_0_3px_rgba(100,255,218,0.15)]" : value[i] ? "border-white/20 bg-white/[0.07]" : "border-white/10 bg-white/[0.04]"
              }`}
            >
              {value[i] ?? ""}
            </div>
          );
        })}
      </div>
      <input
        ref={inputRef}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={6}
        aria-label="Código de 6 dígitos"
        className="absolute inset-0 h-full w-full cursor-text opacity-0"
      />
    </div>
  );
}
