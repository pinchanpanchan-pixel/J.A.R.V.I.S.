"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, Loader2 } from "lucide-react";
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

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
      <path d="M16.4 12.7c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-2.7-1-2.7-4.1zM13.9 5.1c.7-.9 1.2-2 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4z" />
    </svg>
  );
}

export default function LoginPage() {
  const { user, loading, mock, signInWithApple, signInWithGoogle, signInWithEmail } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [user, loading, router]);

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Ese email no me cuadra, hermano.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await signInWithEmail(email);
      setSent(r.sent);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No he podido enviarte el enlace.");
    } finally {
      setBusy(false);
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
        <h1 className="text-center text-2xl font-semibold tracking-tight text-white">Ey, hermano.</h1>
        <p className="mt-1 text-center text-sm text-white/60">Entra y seguimos donde lo dejamos.</p>

        <div className="mt-7 flex flex-col gap-3">
          <button onClick={() => void signInWithApple()} className="jv-btn bg-white text-black hover:bg-white/90">
            <AppleIcon /> Continuar con Apple
          </button>
          <button onClick={() => void signInWithGoogle()} className="jv-btn-ghost">
            <GoogleIcon /> Continuar con Google
          </button>
        </div>

        <div className="my-6 flex items-center gap-3 text-xs text-white/30">
          <div className="h-px flex-1 bg-white/10" /> o con tu email <div className="h-px flex-1 bg-white/10" />
        </div>

        {sent ? (
          <p className="rounded-2xl bg-arc/10 p-4 text-center text-sm text-arc">
            Te he mandado un enlace a {email}. Ábrelo y entras directo.
          </p>
        ) : (
          <form onSubmit={submitEmail} className="flex flex-col gap-3">
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              className="jv-input"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type="submit" disabled={busy} className="jv-btn-primary">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              {mock ? "Entrar" : "Enviarme enlace"}
            </button>
            {error && <p className="text-center text-xs text-red-300">{error}</p>}
          </form>
        )}

        {mock && (
          <p className="mt-6 text-center text-[11px] leading-relaxed text-white/35">
            Modo simulado: sin claves reales. Todo se guarda en este navegador. Abre otra pestaña con el mismo email para ver la
            sincronización en tiempo real.
          </p>
        )}
      </motion.div>
    </main>
  );
}
