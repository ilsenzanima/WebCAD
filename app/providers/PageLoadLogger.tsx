"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Variabili globali persistenti tra i render dei componenti per tracciare l'inizio della navigazione client-side
let navigationStartTime = 0;
let lastClickedUrl = "";

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

  useEffect(() => {
    // A. CARICAMENTO INIZIALE (HARD LOAD / SSR)
    if (isInitialRender.current) {
      isInitialRender.current = false;

      const logHardLoad = () => {
        // Un piccolo delay per garantire che l'evento load sia completamente registrato dalle API di performance
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

            const currentMetrics: LoadMetrics = {
              duration: total,
              type: "SSR",
              pathname,
              details: { redirect, dns, tcp, server, download, dom }
            };

            setMetrics(currentMetrics);

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
            setMetrics({
              duration: total,
              type: "SSR",
              pathname
            });
            console.log(
              `%c[Performance]%c Caricamento Iniziale: %c${pathname}%c in %c${total.toFixed(0)}ms%c`,
              "color: #22c55e; font-weight: bold;",
              "color: inherit;",
              "color: #3b82f6; font-weight: bold;",
              "color: inherit;",
              "color: #10b981; font-weight: bold;",
              "color: inherit;"
            );
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

      setMetrics({
        duration,
        type: "Client",
        pathname
      });

      console.log(
        `%c[Performance]%c Navigazione Client-Side: %c${pathname}%c in %c${duration.toFixed(0)}ms%c`,
        "color: #3b82f6; font-weight: bold;",
        "color: inherit;",
        "color: #ec4899; font-weight: bold;",
        "color: inherit;",
        "color: #10b981; font-weight: bold;",
        "color: inherit;"
      );

      // Resettiamo il tempo per evitare falsi positivi nei render successivi dello stesso percorso
      navigationStartTime = 0;
      lastClickedUrl = "";
    }
  }, [pathname, searchParams]);

  if (!metrics) return null;

  // Stili condizionali in base alla lentezza
  const isSlow = metrics.duration > 800;
  const isModerate = metrics.duration > 300 && metrics.duration <= 800;
  
  let color = "hsl(142 70% 70%)"; // Green
  let borderColor = "hsl(142 70% 45% / 0.4)";
  let shadowColor = "hsl(142 70% 45% / 0.15)";
  
  if (isSlow) {
    color = "hsl(350 89% 72%)"; // Red
    borderColor = "hsl(350 89% 60% / 0.4)";
    shadowColor = "hsl(350 89% 60% / 0.2)";
  } else if (isModerate) {
    color = "hsl(32 95% 70%)"; // Orange/Amber
    borderColor = "hsl(32 95% 44% / 0.4)";
    shadowColor = "hsl(32 95% 44% / 0.2)";
  }

  return (
    <div
      className="fixed bottom-4 left-4 z-50 font-sans pointer-events-auto transition-all duration-300"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "hsl(220 26% 12% / 0.9)",
        border: `1px solid ${borderColor}`,
        borderRadius: "16px",
        padding: hovered ? "12px 16px" : "8px 12px",
        boxShadow: `0 10px 30px -10px ${shadowColor}`,
        color,
        backdropFilter: "blur(12px)",
        maxWidth: "320px",
      }}
    >
      <div className="flex items-center gap-2 cursor-pointer select-none">
        <span className="text-sm">⚡</span>
        <div className="flex flex-col">
          <span className="text-xs font-bold whitespace-nowrap">
            {metrics.duration.toFixed(0)} ms
            <span 
              className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold"
              style={{
                background: metrics.type === "Client" ? "rgba(59, 130, 246, 0.15)" : "rgba(34, 197, 94, 0.15)",
                color: metrics.type === "Client" ? "hsl(210 100% 75%)" : "hsl(142 70% 75%)",
                border: `1px solid ${metrics.type === "Client" ? "rgba(59, 130, 246, 0.2)" : "rgba(34, 197, 94, 0.2)"}`
              }}
            >
              {metrics.type}
            </span>
          </span>
          {hovered && (
            <span className="text-[10px] text-white/50 truncate mt-0.5" style={{ maxWidth: "200px" }}>
              {pathname}
            </span>
          )}
        </div>
      </div>

      {hovered && metrics.details && (
        <div className="mt-3 pt-2.5 border-t border-white/10 text-[10px] space-y-1 text-white/70">
          <div className="flex justify-between gap-4">
            <span>Risoluzione DNS:</span>
            <span className="font-mono">{metrics.details.dns.toFixed(0)} ms</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Connessione TCP:</span>
            <span className="font-mono">{metrics.details.tcp.toFixed(0)} ms</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="font-semibold text-blue-400">Server (SSR/TTFB):</span>
            <span className="font-mono font-bold text-blue-400">{metrics.details.server.toFixed(0)} ms</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Download HTML:</span>
            <span className="font-mono">{metrics.details.download.toFixed(0)} ms</span>
          </div>
          <div className="flex justify-between gap-4 text-emerald-400">
            <span>Rendering Client:</span>
            <span className="font-mono">{metrics.details.dom.toFixed(0)} ms</span>
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
