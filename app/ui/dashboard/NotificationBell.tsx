"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOfflineStore } from "@/lib/stores/offline-store";
import {
  getRecentErrors,
  subscribeToErrors,
  clearRecentErrors,
  getLastMetrics,
  subscribeToMetrics,
  type LoadMetrics,
} from "@/app/providers/PageLoadLogger";
import { APP_VERSION } from "@/lib/version";

interface NotificationBellProps {
  mode: "desktop" | "mobile";
}

export default function NotificationBell({ mode }: NotificationBellProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"notifications" | "logs">("notifications");
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [remoteVersion, setRemoteVersion] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<LoadMetrics | null>(null);

  const { offlineQueue, isOnline, offlineMode, isSyncing } = useOfflineStore();
  const bellRef = useRef<HTMLDivElement>(null);

  // 1. Verifica aggiornamenti vedi SidebarProfile
  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const res = await fetch("/version.json", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data.version && isNewerVersion(data.version, APP_VERSION)) {
          setRemoteVersion(data.version);
          setUpdateAvailable(true);
        }
      } catch (err) {
        console.error("Errore verifica aggiornamenti in campana:", err);
      }
    };

    checkUpdate();
    const interval = setInterval(checkUpdate, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  function isNewerVersion(remote: string, local: string) {
    const r = remote.split(".").map(Number);
    const l = local.split(".").map(Number);
    for (let i = 0; i < 3; i++) {
      if (r[i] > (l[i] || 0)) return true;
      if (r[i] < (l[i] || 0)) return false;
    }
    return false;
  }

  // 2. Sottoscrizione a errori e metriche di PageLoadLogger
  useEffect(() => {
    setErrors([...getRecentErrors()]);
    setMetrics(getLastMetrics());

    const unsubscribeErrors = subscribeToErrors((newError) => {
      setErrors((prev) => [newError, ...prev].slice(0, 15));
    });

    const unsubscribeMetrics = subscribeToMetrics((newMetrics) => {
      setMetrics(newMetrics);
    });

    return () => {
      unsubscribeErrors();
      unsubscribeMetrics();
    };
  }, []);

  // Chiudi il popover al click all'esterno
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Chiudi il popover al cambio rotta
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const handleClearErrors = (e: React.MouseEvent) => {
    e.stopPropagation();
    clearRecentErrors();
    setErrors([]);
  };

  // Notifiche totali attive
  const hasUpdates = updateAvailable;
  const hasQueueIssues = offlineQueue.length > 0;
  const hasErrors = errors.length > 0;
  
  const notificationCount = (hasUpdates ? 1 : 0) + (hasQueueIssues ? 1 : 0);
  const totalWarningCount = notificationCount + (hasErrors ? 1 : 0);

  // Calcolo colori performance
  let metricsColor = "hsl(142 70% 70%)";
  let metricsBg = "rgba(16, 185, 129, 0.15)";
  let metricsBorder = "rgba(16, 185, 129, 0.25)";

  if (metrics) {
    if (metrics.duration > 800) {
      metricsColor = "hsl(350 89% 72%)";
      metricsBg = "rgba(239, 68, 68, 0.15)";
      metricsBorder = "rgba(239, 68, 68, 0.25)";
    } else if (metrics.duration > 300) {
      metricsColor = "hsl(32 95% 70%)";
      metricsBg = "rgba(245, 158, 11, 0.15)";
      metricsBorder = "rgba(245, 158, 11, 0.25)";
    }
  }

  return (
    <div ref={bellRef} className="relative z-50">
      {/* ── Icona Campana Interattiva ── */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all relative cursor-pointer ${
          isOpen
            ? "bg-white/10 text-white"
            : totalWarningCount > 0
            ? "bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25"
            : "bg-white/5 text-white/50 hover:bg-white/10"
        }`}
        title="Visualizza notifiche e diagnostica"
      >
        <span className={totalWarningCount > 0 ? "animate-bounce-subtle" : ""}>
          {totalWarningCount > 0 ? "🔔" : "🔕"}
        </span>
        {totalWarningCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-extrabold text-white flex items-center justify-center border-2 border-[hsl(220_32%_10%)] animate-pulse">
            {totalWarningCount}
          </span>
        )}
      </button>

      {/* ── Popover Diagnostico Vetro Scuro ── */}
      {isOpen && (
        <div
          className={`absolute z-[9999] rounded-2xl border p-4 space-y-4 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-xl animate-fade-in ${
            mode === "desktop"
              ? "bottom-11 left-0 mb-2 w-80 sm:w-96"
              : "top-11 right-0 mt-2 w-80 sm:w-96"
          }`}
          style={{
            background: "hsl(220 28% 6%)",
            borderColor: "hsl(220 20% 20%)",
          }}
        >
          {/* Header Popover con Tabs */}
          <div className="flex border-b border-white/5 pb-2">
            <button
              onClick={() => setActiveTab("notifications")}
              className={`flex-1 text-center pb-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                activeTab === "notifications"
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-white/40 hover:text-white/70"
              }`}
            >
              Notifiche ({notificationCount})
            </button>
            <button
              onClick={() => setActiveTab("logs")}
              className={`flex-1 text-center pb-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                activeTab === "logs"
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-white/40 hover:text-white/70"
              }`}
            >
              Log & Perf {hasErrors && "⚠️"}
            </button>
          </div>

          {/* Contenuto Tab 1: Notifiche */}
          {activeTab === "notifications" && (
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {/* Notifica Aggiornamento */}
              {updateAvailable && (
                <Link
                  href="/settings"
                  className="flex items-start gap-3 p-3 rounded-xl hover:bg-orange-500/10 border border-orange-500/10 hover:border-orange-500/30 transition-all text-left"
                >
                  <span className="text-lg">📥</span>
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-orange-400 leading-tight">
                      Aggiornamento Disponibile!
                    </p>
                    <p className="text-[10px] text-white/60">
                      È disponibile la versione v{remoteVersion} (attuale: v{APP_VERSION}). Clicca per aggiornare.
                    </p>
                  </div>
                </Link>
              )}

              {/* Notifica Coda Sincronizzazione / Blocchi */}
              {offlineQueue.length > 0 && (
                <Link
                  href="/sync"
                  className="flex items-start gap-3 p-3 rounded-xl hover:bg-amber-500/10 border border-amber-500/10 hover:border-amber-500/30 transition-all text-left"
                >
                  <span className="text-lg">⇅</span>
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-amber-400 leading-tight">
                      Coda Sincronizzazione Attiva
                    </p>
                    <p className="text-[10px] text-white/60">
                      Ci sono {offlineQueue.length} operazioni pendenti in locale. Clicca per esaminare e forzare il sync.
                    </p>
                  </div>
                </Link>
              )}

              {/* Nessuna Notifica */}
              {!updateAvailable && offlineQueue.length === 0 && (
                <div className="p-8 text-center space-y-2 text-white/30">
                  <span className="text-2xl block">✓</span>
                  <p className="text-xs font-semibold">Nessuna nuova notifica</p>
                  <p className="text-[10px] text-white/40">
                    Il sistema è allineato ed aggiornato all&apos;ultima versione.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Contenuto Tab 2: Log & Performance */}
          {activeTab === "logs" && (
            <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
              {/* Sezione Performance Caricamento Pagina */}
              {metrics ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                      Tempo Ultimo Caricamento
                    </h4>
                  </div>
                  <div
                    className="p-3 rounded-xl border flex flex-col gap-1.5"
                    style={{
                      background: metricsBg,
                      borderColor: metricsBorder,
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold" style={{ color: metricsColor }}>
                        {metrics.duration.toFixed(0)} ms
                      </span>
                      <span
                        className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase leading-none"
                        style={{
                          background: metrics.type === "Client" ? "rgba(59, 130, 246, 0.2)" : "rgba(34, 197, 94, 0.2)",
                          color: metrics.type === "Client" ? "hsl(210 100% 75%)" : "hsl(142 70% 75%)",
                          border: `1px solid ${metrics.type === "Client" ? "rgba(59, 130, 246, 0.3)" : "rgba(34, 197, 94, 0.3)"}`,
                        }}
                      >
                        {metrics.type}
                      </span>
                    </div>
                    <p className="text-[9px] font-mono truncate text-white/60">
                      Riferimento: <span className="text-white/80">{metrics.pathname}</span>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-[10px] text-white/30 italic text-center p-2">
                  Nessuna metrica di caricamento registrata.
                </div>
              )}

              {/* Sezione Log Errori Recenti */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                    Log Errori Recenti ({errors.length})
                  </h4>
                  {hasErrors && (
                    <button
                      onClick={handleClearErrors}
                      className="text-[9px] hover:text-red-400 text-white/40 transition-colors cursor-pointer"
                    >
                      Pulisci
                    </button>
                  )}
                </div>

                {hasErrors ? (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-thin">
                    {errors.map((err, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg text-[9px] font-mono whitespace-pre-wrap leading-tight break-all border"
                        style={{
                          background: "hsl(350 89% 10% / 0.3)",
                          borderColor: "hsl(350 89% 60% / 0.15)",
                          color: "hsl(350 89% 80%)",
                        }}
                      >
                        {err}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center rounded-xl bg-white/[0.01] border border-white/5 text-[9px] text-white/30 italic">
                    Nessun errore rilevato in questa sessione.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
