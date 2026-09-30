"use client";
import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Si una parte de la app falla, se muestra un aviso en esa zona y se puede reintentar,
 * en vez de tumbar la app entera con «Application error».
 */
export class ErrorBoundary extends Component<{ children: ReactNode; label?: string }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[J.A.R.V.I.S.]", this.props.label ?? "zona", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="mx-auto my-10 flex max-w-sm flex-col items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-center">
        <p className="text-sm text-white/80">Algo se me ha cruzado, hermano. Ya lo tengo controlado.</p>
        <button onClick={() => this.setState({ error: null })} className="jv-btn-primary px-5 py-2.5 text-sm">
          Reintentar
        </button>
      </div>
    );
  }
}
