"use client";

import { useEffect } from "react";

/**
 * Error boundary per il gruppo (dashboard).
 * IMPORTANTE: questo componente non deve coprire la sidebar —
 * usa h-full e non h-screen per restare dentro il <main>.
 */
export default function DashboardErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard errore catturato:", error);
  }, [error]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-8">
      <div
        className="max-w-lg w-full p-7 rounded-2xl"
        style={{
          background: "hsl(220 26% 14%)",
          border: "1px solid hsl(0 84% 60% / 0.3)",
        }}
      >
        <h2 className="text-xl font-bold mb-3 text-red-400 flex items-center gap-2">
          🚨 Errore di rendering
        </h2>
        <p className="mb-5 text-sm" style={{ color: "hsl(215 20% 65%)" }}>
          Si è verificato un errore imprevisto in questa pagina.
        </p>

        <div
          className="mb-6 text-xs font-mono p-4 rounded-xl overflow-auto"
          style={{ background: "hsl(220 32% 10%)", color: "hsl(0 84% 75%)" }}
        >
          <div className="mb-3">
            <strong className="text-white">Digest:</strong>
            <span className="block mt-1">{error.digest ?? "—"}</span>
          </div>
          <div>
            <strong className="text-white">Messaggio:</strong>
            <span className="block mt-1 break-all opacity-80">{error.message}</span>
          </div>
        </div>

        <button
          onClick={() => reset()}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200"
          style={{
            background: "hsl(220 90% 56%)",
            boxShadow: "0 4px 16px hsl(220 90% 56% / 0.3)",
          }}
        >
          Riprova a caricare
        </button>
      </div>
    </div>
  );
}
