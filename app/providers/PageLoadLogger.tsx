"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useOfflineStore } from "@/lib/stores/offline-store";

// Variabili globali persistenti tra i render dei componenti per tracciare l'inizio della navigazione client-side
let navigationStartTime = 0;
let lastClickedUrl = "";
const errorLogHistory: string[] = [];
let errorListeners: ((err: string) => void)[] = [];

if (typeof window !== "undefined") {
  // 1. Intercettiamo i click sui tag <a> per registrare l'istante esatto del click dell'utente
  window.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest("a");
    if (anchor && anchor.href && anchor.getAttribute("target") !== "_blank") {
      const url = new URL(anchor.href, window.location.origin);
      // Solo navigazione nello stesso dominio
      if (url.origin === window.location.origin) {
        navigationStartTime = performance.now();
        lastClickedUrl = url.pathname + url.search;
      }
    }
  }, { capture: true });

  // 2. Intercettiamo le modifiche alla history (pushState/replaceState) usate da Next.js router
  const originalPushState = window.history.pushState;
  window.history.pushState = function(...args) {
    if (!navigationStartTime) {
      navigationStartTime = performance.now();
      lastClickedUrl = typeof args[2] === "string" ? args[2] : "";
    }
    return originalPushState.apply(this, args);
  };

  const originalReplaceState = window.history.replaceState;
  window.history.replaceState = function(...args) {
    if (!navigationStartTime) {
      navigationStartTime = performance.now();
      lastClickedUrl = typeof args[2] === "string" ? args[2] : "";
    }
    return originalReplaceState.apply(this, args);
  };

  // 3. Intercettiamo globalmente console.error per catturare gli errori del database, di rete, o del client
  const originalConsoleError = console.error;
  console.error = function(...args) {
    const message = args
      .map(arg => {
        if (arg instanceof Error) return arg.message;
        if (typeof arg === "object") {
          try {
            // Riconosce oggetti di errore di Supabase
            if (arg.message) return arg.message;
            return JSON.stringify(arg);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(" ");

    // Ignora errori di rumore (es. warning di estensioni)
    if (!message.includes("chrome-extension") && !message.includes("react-devtools")) {
      const formattedError = `[${new Date().toLocaleTimeString("it-IT")}] ${message}`;
      errorLogHistory.unshift(formattedError);
      // Mantieni solo gli ultimi 15 errori
      if (errorLogHistory.length > 15) errorLogHistory.pop();
      
      // Notifica i listener attivi
      errorListeners.forEach(listener => listener(formattedError));
    }

    originalConsoleError.apply(console, args);
  };
}

interface LoadMetrics {
  duration: number;
  type: "Client" | "SSR";
  pathname: string;
  details?: {
    redirect: number;
    dns: number;
    tcp: number;
    server: number;
    download: number;
    dom: number;
  };
}

function PageLoadLoggerInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isInitialRender = useRef(true);
  
  const [metrics, setMetrics] = useState<LoadMetrics | null>(null);
  const [hovered, setHovered] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  
  // Connessione allo store offline per tracciare lo stato di sync e la coda
  const { offlineQueue, isOnline, offlineMode, isSyncing } = useOfflineStore();

  useEffect(() => {
    // Inizializza gli errori già catturati all'avvio
    setErrors([...errorLogHistory]);

    // Registra listener per ricevere nuovi errori in tempo reale
    const listener = (newError: string) => {
      setErrors(prev => [newError, ...prev].slice(0, 15));
    };
    errorListeners.push(listener);

    // Gestore per errori ed eccezioni non catturate
    const handleUnhandledError = (event: ErrorEvent) => {
      console.error(`Errore non gestito: ${event.message} in ${event.filename}:${event.lineno}`);
    };
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      console.error(`Promessa rifiutata non gestita: ${reason instanceof Error ? reason.message : String(reason)}`);
    };

    window.addEventListener("error", handleUnhandledError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      errorListeners = errorListeners.filter(l => l !== listener);
      window.removeEventListener("error", handleUnhandledError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    // A. CARICAMENTO INIZIALE (HARD LOAD / SSR)
    if (isInitialRender.current) {
      isInitialRender.current = false;

      const logHardLoad = () => {
        setTimeout(() => {
          const [entry] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
          if (entry) {
            const redirect = entry.redirectEnd - entry.redirectStart;
            const dns = entry.domainLookupEnd - entry.domainLookupStart;
            const tcp = entry.connectEnd - entry.connectStart;
            const server = entry.responseStart - entry.requestStart; // TTFB
            const download = entry.responseEnd - entry.responseStart;
            const dom = entry.loadEventEnd - entry.responseEnd;
            const total = entry.duration;

            setMetrics({
              duration: total,
              type: "SSR",
              pathname,
              details: { redirect, dns, tcp, server, download, dom }
            });

            console.log(
              `%c[Performance]%c Caricamento Iniziale: %c${pathname}%c in %c${total.toFixed(0)}ms%c\n` +
              `  - Redirect: ${redirect.toFixed(0)}ms\n` +
              `  - Risoluzione DNS: ${dns.toFixed(0)}ms\n` +
              `  - Connessione TCP: ${tcp.toFixed(0)}ms\n` +
              `  - Tempo di Risposta Server (SSR/TTFB): %c${server.toFixed(0)}ms%c\n` +
              `  - Download Risorsa HTML: ${download.toFixed(0)}ms\n` +
              `  - Rendering DOM & Risorse Client: ${dom.toFixed(0)}ms`,
              "color: #22c55e; font-weight: bold;",
              "color: inherit;",
              "color: #3b82f6; font-weight: bold;",
              "color: inherit;",
              "color: #10b981; font-weight: bold;",
              "color: inherit;",
              "color: #ec4899; font-weight: bold;",
              "color: inherit;"
            );
          } else {
            const total = performance.now();
            setMetrics({ duration: total, type: "SSR", pathname });
          }
        }, 300);
      };

      if (document.readyState === "complete") {
        logHardLoad();
      } else {
        window.addEventListener("load", logHardLoad, { once: true });
      }
      return;
    }

    // B. NAVIGAZIONE CLIENT-SIDE (SOFT LOAD)
    if (navigationStartTime > 0) {
      const end = performance.now();
      const duration = end - navigationStartTime;

      setMetrics({ duration, type: "Client", pathname });

      console.log(
        `%c[Performance]%c Navigazione Client-Side: %c${pathname}%c in %c${duration.toFixed(0)}ms%c`,
        "color: #3b82f6; font-weight: bold;",
        "color: inherit;",
        "color: #ec4899; font-weight: bold;",
        "color: inherit;",
        "color: #10b981; font-weight: bold;",
        "color: inherit;"
      );

      navigationStartTime = 0;
      lastClickedUrl = "";
    }
  }, [pathname, searchParams]);

  if (!metrics) return null;

  // Calcolo colori in base alle performance
  const isSlow = metrics.duration > 800;
  const isModerate = metrics.duration > 300 && metrics.duration <= 800;
  
  let accentColor = "hsl(142 70% 70%)"; // Verde
  let borderColor = "hsl(142 70% 45% / 0.4)";
  let shadowColor = "hsl(142 70% 45% / 0.15)";
  
  if (isSlow) {
    accentColor = "hsl(350 89% 72%)"; // Rosso
    borderColor = "hsl(350 89% 60% / 0.4)";
    shadowColor = "hsl(350 89% 60% / 0.2)";
  } else if (isModerate) {
    accentColor = "hsl(32 95% 70%)"; // Arancio
    borderColor = "hsl(32 95% 44% / 0.4)";
    shadowColor = "hsl(32 95% 44% / 0.2)";
  }

  // Se ci sono errori in coda o recenti, diamo un segnale visivo di allerta
  const hasErrors = errors.length > 0;

  return (
    <div
      className="fixed bottom-4 left-4 z-50 font-sans pointer-events-auto transition-all duration-300 overflow-hidden flex flex-col"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "hsl(220 26% 10% / 0.95)",
        border: `1px solid ${hasErrors && hovered ? "hsl(350 89% 60% / 0.5)" : borderColor}`,
        borderRadius: "20px",
        padding: hovered ? "16px" : "8px 14px",
        boxShadow: hovered 
          ? "0 20px 40px -15px rgba(0,0,0,0.8)" 
          : `0 10px 30px -10px ${shadowColor}`,
        color: "hsl(210 40% 90%)",
        backdropFilter: "blur(16px)",
        width: hovered ? "360px" : "auto",
        maxHeight: hovered ? "380px" : "40px",
        transitionProperty: "all",
      }}
    >
      {/* Intestazione Compatta (Sempre Visibile) */}
      <div className="flex items-center justify-between gap-4 select-none cursor-pointer">
        <div className="flex items-center gap-2">
          <span 
            className="text-sm animate-pulse-subtle"
            style={{ color: hasErrors ? "hsl(350 89% 72%)" : accentColor }}
          >
            {hasErrors ? "⚠️" : "⚡"}
          </span>
          <div className="flex flex-col justify-center">
            <span className="text-xs font-bold leading-none flex items-center gap-1.5">
              <span style={{ color: accentColor }}>{metrics.duration.toFixed(0)} ms</span>
              <span 
                className="px-1.5 py-0.5 rounded text-[8px] font-extrabold leading-none"
                style={{
                  background: metrics.type === "Client" ? "rgba(59, 130, 246, 0.15)" : "rgba(34, 197, 94, 0.15)",
                  color: metrics.type === "Client" ? "hsl(210 100% 75%)" : "hsl(142 70% 75%)",
                  border: `1px solid ${metrics.type === "Client" ? "rgba(59, 130, 246, 0.25)" : "rgba(34, 197, 94, 0.25)"}`
                }}
              >
                {metrics.type}
              </span>
            </span>
          </div>
        </div>

        {/* Indicatori rapidi sul lato destro (solo compatti) */}
        {!hovered && (
          <div className="flex items-center gap-2 text-[10px]">
            {offlineQueue.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                ⇅ {offlineQueue.length}
              </span>
            )}
            {hasErrors && (
              <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 font-bold animate-pulse">
                ERR: {errors.length}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Pannello Diagnostico Espanso (Visibile on Hover) */}
      {hovered && (
        <div className="mt-4 space-y-4 overflow-y-auto pr-1 select-text scrollbar-thin max-h-[300px]">
          {/* Riga Info Generali Pagina */}
          <div className="text-[10px] space-y-0.5 bg-white/5 p-2 rounded-xl border border-white/5">
            <div className="flex justify-between">
              <span className="text-white/40">Percorso:</span>
              <span className="text-white/90 font-mono truncate max-w-[250px]">{pathname}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Rete:</span>
              <span className={isOnline ? "text-emerald-400 font-bold" : "text-amber-500 font-bold"}>
                {offlineMode ? "Offline (Manuale)" : isOnline ? "Online (Connesso)" : "Offline (Senza Rete)"}
              </span>
            </div>
            {offlineQueue.length > 0 && (
              <div className="flex justify-between items-center mt-1 pt-1 border-t border-white/5">
                <span className="text-white/40">Coda Offline:</span>
                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold">
                  {offlineQueue.length} op. pendenti {isSyncing && " (Syncing...)"}
                </span>
              </div>
            )}
          </div>

          {/* Dettagli caricamento (solo per SSR) */}
          {metrics.details && (
            <div className="space-y-1">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">
                Analisi Latenza SSR
              </h4>
              <div className="grid grid-cols-2 gap-2 text-[9px]">
                <div className="bg-white/[0.02] p-1.5 rounded-lg border border-white/5">
                  <p className="text-white/40">DNS & TCP</p>
                  <p className="font-mono text-white font-bold">{(metrics.details.dns + metrics.details.tcp).toFixed(0)} ms</p>
                </div>
                <div className="bg-white/[0.02] p-1.5 rounded-lg border border-white/5">
                  <p className="text-white/40 text-blue-400">Server (TTFB)</p>
                  <p className="font-mono text-blue-400 font-bold">{metrics.details.server.toFixed(0)} ms</p>
                </div>
                <div className="bg-white/[0.02] p-1.5 rounded-lg border border-white/5">
                  <p className="text-white/40">HTML Transf.</p>
                  <p className="font-mono text-white font-bold">{metrics.details.download.toFixed(0)} ms</p>
                </div>
                <div className="bg-white/[0.02] p-1.5 rounded-lg border border-white/5">
                  <p className="text-white/40 text-emerald-400">Client Render</p>
                  <p className="font-mono text-emerald-400 font-bold">{metrics.details.dom.toFixed(0)} ms</p>
                </div>
              </div>
            </div>
          )}

          {/* Diagnostica Errori Recenti */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                Log Errori Recenti
              </h4>
              {hasErrors && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    errorLogHistory.length = 0;
                    setErrors([]);
                  }}
                  className="text-[9px] hover:text-red-400 text-white/40 transition-colors cursor-pointer"
                >
                  Pulisci
                </button>
              )}
            </div>

            {hasErrors ? (
              <div className="space-y-1 max-h-[140px] overflow-y-auto scrollbar-thin">
                {errors.map((err, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg text-[9px] font-mono whitespace-pre-wrap leading-tight break-all border"
                    style={{
                      background: "hsl(350 89% 10% / 0.3)",
                      borderColor: "hsl(350 89% 60% / 0.15)",
                      color: "hsl(350 89% 80%)"
                    }}
                  >
                    {err}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 text-center rounded-xl bg-white/[0.01] border border-white/5 text-[9px] text-white/30 italic">
                Nessun errore registrato in questa sessione.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PageLoadLogger() {
  return (
    <Suspense fallback={null}>
      <PageLoadLoggerInner />
    </Suspense>
  );
}
