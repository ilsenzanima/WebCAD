"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useOfflineStore } from "@/lib/stores/offline-store";

export interface LoadMetrics {
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

// Variabili globali persistenti tra i render dei componenti per tracciare l'inizio della navigazione client-side
let navigationStartTime = 0;
let lastClickedUrl = "";
const errorLogHistory: string[] = [];
let errorListeners: ((err: string) => void)[] = [];

let lastMetrics: LoadMetrics | null = null;
let metricsListeners: ((m: LoadMetrics) => void)[] = [];

export function getLastMetrics(): LoadMetrics | null {
  return lastMetrics;
}

export function subscribeToMetrics(listener: (m: LoadMetrics) => void) {
  metricsListeners.push(listener);
  return () => {
    metricsListeners = metricsListeners.filter((l) => l !== listener);
  };
}

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

export function getRecentErrors(): string[] {
  return errorLogHistory;
}

export function clearRecentErrors() {
  errorLogHistory.length = 0;
}

export function subscribeToErrors(listener: (err: string) => void) {
  errorListeners.push(listener);
  return () => {
    errorListeners = errorListeners.filter((l) => l !== listener);
  };
}

function PageLoadLoggerInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isInitialRender = useRef(true);
  
  useEffect(() => {
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

            const calculatedMetrics: LoadMetrics = {
              duration: total,
              type: "SSR",
              pathname,
              details: { redirect, dns, tcp, server, download, dom }
            };
            lastMetrics = calculatedMetrics;
            metricsListeners.forEach(l => l(calculatedMetrics));

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
            const calculatedMetrics: LoadMetrics = { duration: total, type: "SSR", pathname };
            lastMetrics = calculatedMetrics;
            metricsListeners.forEach(l => l(calculatedMetrics));
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

      const calculatedMetrics: LoadMetrics = { duration, type: "Client", pathname };
      lastMetrics = calculatedMetrics;
      metricsListeners.forEach(l => l(calculatedMetrics));

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

  return null;
}

export default function PageLoadLogger() {
  return (
    <Suspense fallback={null}>
      <PageLoadLoggerInner />
    </Suspense>
  );
}
