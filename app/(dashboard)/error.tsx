"use client";

import { useEffect } from "react";

export default function DashboardErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log in console per debug locale se disponibile
    console.error("Dashboard errore catturato:", error);
  }, [error]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center p-8 bg-gray-950 text-white">
      <div 
        className="max-w-3xl w-full p-8 rounded-2xl" 
        style={{ background: "hsl(220 26% 14%)", border: "1px solid hsl(0 84% 60% / 0.3)" }}
      >
        <h2 className="text-2xl font-bold mb-4 text-red-500 flex items-center gap-3">
          <span>🚨</span> Errore del Server Component
        </h2>
        <p className="mb-6 text-sm" style={{ color: "hsl(215 20% 65%)" }}>
          Next.js ha intercettato un errore imprevisto durante il rendering.
          Ecco i dettagli per diagnosticare il problema:
        </p>
        
        <div 
          className="mb-8 text-sm font-mono p-5 rounded-xl overflow-auto" 
          style={{ background: "hsl(220 32% 10%)", color: "hsl(0 84% 75%)" }}
        >
          <div className="mb-4">
            <strong className="text-white">Messaggio:</strong> 
            <span className="block mt-1 font-semibold break-all">{error.message}</span>
          </div>
          
          <div className="mb-4">
            <strong className="text-white">Digest:</strong> 
            <span className="block mt-1">{error.digest || "Nessun digest"}</span>
          </div>
          
          {error.stack && (
            <div>
              <strong className="text-white">Stack Trace:</strong> 
              <pre className="mt-2 text-xs opacity-80 whitespace-pre-wrap">{error.stack}</pre>
            </div>
          )}
        </div>
        
        <button
          onClick={() => reset()}
          className="px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all duration-200"
          style={{ background: "hsl(220 90% 56%)", boxShadow: "0 4px 16px hsl(220 90% 56% / 0.3)" }}
        >
          Riprova a caricare
        </button>
      </div>
    </div>
  );
}
