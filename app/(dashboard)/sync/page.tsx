"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useOfflineStore, type SyncOperation } from "@/lib/stores/offline-store";
import { getRecentErrors, subscribeToErrors, clearRecentErrors } from "@/app/providers/PageLoadLogger";

export default function SyncPage() {
  const router = useRouter();
  const {
    offlineQueue,
    isOnline,
    offlineMode,
    isSyncing,
    syncOfflineData,
    clearQueue,
    setOfflineMode,
    syncHistory,
    clearSyncHistory,
  } = useOfflineStore();

  const [errors, setErrors] = useState<string[]>([]);
  const [syncingManual, setSyncingManual] = useState(false);
  const [expandedOpId, setExpandedOpId] = useState<string | null>(null);

  // Sottoscrizione ai log degli errori del PageLoadLogger
  useEffect(() => {
    setErrors([...getRecentErrors()]);
    const unsubscribe = subscribeToErrors((newError) => {
      setErrors((prev) => [newError, ...prev].slice(0, 15));
    });
    return unsubscribe;
  }, []);

  const handleForceSync = async () => {
    setSyncingManual(true);
    try {
      await syncOfflineData();
    } catch (err) {
      console.error("Errore durante il sync manuale:", err);
    } finally {
      setSyncingManual(false);
    }
  };

  const handleClearQueue = () => {
    const confermata = window.confirm(
      "ATTENZIONE: Sei sicuro di voler svuotare la coda delle modifiche offline?\n\nQuesta azione eliminerà definitivamente tutte le modifiche pendenti non ancora salvate sul server. Questa operazione non può essere annullata."
    );
    if (confermata) {
      clearQueue();
    }
  };

  const handleClearErrors = () => {
    clearRecentErrors();
    setErrors([]);
  };

  const formatTimestamp = (ts: number) => {
    return new Date(ts).toLocaleString("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 animate-fade-in">
      {/* ── Intestazione Page ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-3xl">⇅</span>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
            Sincronizzazione Dati
          </h1>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: "hsl(215 20% 65%)" }}>
          Monitora lo stato di connessione e gestisci la coda dei dati salvati localmente sul dispositivo prima dell&apos;allineamento sul server cloud.
        </p>
      </div>

      {/* ── Pannello Connettività (Stato di Rete) ── */}
      <div
        className="rounded-3xl p-6 md:p-8 space-y-6"
        style={{
          background: "linear-gradient(135deg, hsl(220 26% 14%), hsl(220 28% 10%))",
          border: "1px solid hsl(220 20% 18%)",
          boxShadow: "0 20px 40px -15px rgba(0,0,0,0.5)",
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-white/40">
              Stato Connessione Corrente
            </h2>
            <div className="flex items-center gap-3">
              <span
                className={`w-3.5 h-3.5 rounded-full ${
                  offlineMode
                    ? "bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.5)]"
                    : isOnline
                    ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)] animate-pulse"
                    : "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]"
                }`}
              />
              <span className="text-lg font-bold text-white leading-none">
                {offlineMode
                  ? "Offline Forzato (Manuale)"
                  : isOnline
                  ? "Online (Connesso al Cloud)"
                  : "Offline (Nessuna Rete)"}
              </span>
            </div>
          </div>

          <div
            className="flex items-center justify-between sm:justify-start gap-4 p-3.5 rounded-2xl"
            style={{ background: "hsl(220 32% 8%)", border: "1px solid hsl(220 20% 14%)" }}
          >
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-white">Lavora Offline</p>
              <p className="text-[10px]" style={{ color: "hsl(215 15% 45%)" }}>
                Forza l&apos;uso della cache locale
              </p>
            </div>
            <button
              onClick={() => setOfflineMode(!offlineMode)}
              className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none"
              style={{
                background: offlineMode ? "hsl(220 90% 56%)" : "hsl(220 20% 20%)",
              }}
              aria-label="Toggle modalità offline"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  offlineMode ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* ── Sezione Coda Offline ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white/50">
              Operazioni in Coda
            </h2>
            <span
              className="px-2 py-0.5 text-xs font-bold rounded-full"
              style={{
                background: offlineQueue.length > 0 ? "rgba(245, 158, 11, 0.15)" : "rgba(16, 185, 129, 0.15)",
                color: offlineQueue.length > 0 ? "hsl(32 95% 70%)" : "hsl(142 70% 70%)",
                border: `1px solid ${offlineQueue.length > 0 ? "rgba(245, 158, 11, 0.3)" : "rgba(16, 185, 129, 0.3)"}`,
              }}
            >
              {offlineQueue.length} {offlineQueue.length === 1 ? "elemento" : "elementi"}
            </span>
          </div>

          <div className="flex gap-2">
            {offlineQueue.length > 0 && (
              <>
                <button
                  onClick={handleClearQueue}
                  className="px-3.5 py-2 text-xs font-semibold rounded-xl text-red-400 hover:bg-red-500/10 border border-red-500/30 transition-all cursor-pointer"
                >
                  🗑️ Svuota Coda
                </button>
                <button
                  onClick={handleForceSync}
                  disabled={isSyncing || syncingManual || (!isOnline && !offlineMode)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-all cursor-pointer shadow-lg shadow-blue-900/30"
                >
                  {isSyncing || syncingManual ? "🔄 Sincronizzazione..." : "🔄 Forza Sync"}
                </button>
              </>
            )}
          </div>
        </div>

        {offlineQueue.length === 0 ? (
          <div
            className="rounded-2xl p-8 text-center space-y-2 border border-dashed flex flex-col items-center justify-center"
            style={{
              background: "hsl(220 26% 12% / 0.5)",
              borderColor: "hsl(220 20% 16%)",
            }}
          >
            <span className="text-3xl block">✓</span>
            <h3 className="text-sm font-semibold text-white">Tutti i dati sono allineati</h3>
            <p className="text-xs" style={{ color: "hsl(215 15% 45%)" }}>
              Nessuna operazione in coda. L&apos;applicazione è completamente sincronizzata con il server cloud.
            </p>
            <button
              onClick={async () => {
                setSyncingManual(true);
                router.refresh();
                setTimeout(() => setSyncingManual(false), 1200);
              }}
              disabled={syncingManual || !isOnline || offlineMode}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-white/5 hover:bg-white/10 text-white/90 border border-white/10 transition-all cursor-pointer disabled:opacity-50"
            >
              {syncingManual ? "🔄 Aggiornamento..." : "🔄 Ricarica Dati dal Server"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {offlineQueue.map((op) => (
              <div
                key={op.id}
                className="rounded-2xl p-4 space-y-3 transition-all"
                style={{
                  background: "hsl(220 26% 12%)",
                  border: "1px solid hsl(220 20% 16%)",
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        {op.action}
                      </span>
                      <span className="text-[10px] text-white/40">
                        {formatTimestamp(op.timestamp)}
                      </span>
                    </div>
                    <p className="text-xs text-white/70 truncate max-w-[280px] sm:max-w-[500px]">
                      Payload ID: <span className="font-mono text-white/50">{op.payload.id || op.payload.tempId || op.payload.noteId || "N/A"}</span>
                    </p>
                  </div>

                  <button
                    onClick={() => setExpandedOpId(expandedOpId === op.id ? null : op.id)}
                    className="px-2.5 py-1 text-[11px] font-medium rounded-lg hover:bg-white/5 text-white/60 transition-colors"
                  >
                    {expandedOpId === op.id ? "Nascondi" : "Dettagli"}
                  </button>
                </div>

                {expandedOpId === op.id && (
                  <pre
                    className="p-3.5 rounded-xl text-[10px] font-mono overflow-x-auto text-white/80 border leading-relaxed"
                    style={{
                      background: "hsl(220 32% 8%)",
                      borderColor: "hsl(220 20% 12%)",
                    }}
                  >
                    {JSON.stringify(op.payload, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Sezione Cronologia Sincronizzazioni ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white/50">
              Cronologia Sincronizzazioni Recenti
            </h2>
            {syncHistory && syncHistory.length > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-white/10 text-white/70 border border-white/20">
                {syncHistory.length}
              </span>
            )}
          </div>

          {syncHistory && syncHistory.length > 0 && (
            <button
              onClick={clearSyncHistory}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl text-white/40 hover:text-red-400 transition-colors cursor-pointer"
            >
              Pulisci Cronologia
            </button>
          )}
        </div>

        {!syncHistory || syncHistory.length === 0 ? (
          <div
            className="rounded-2xl p-6 text-center text-xs italic border border-dashed"
            style={{
              background: "hsl(220 26% 12% / 0.3)",
              borderColor: "hsl(220 20% 14%)",
              color: "hsl(215 15% 45%)",
            }}
          >
            Nessuna operazione registrata nella cronologia di sincronizzazione.
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {syncHistory.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl p-4 space-y-2.5 transition-all"
                style={{
                  background: "hsl(220 26% 12%)",
                  border: "1px solid hsl(220 20% 16%)",
                }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        item.status === "success"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-red-500/10 text-red-400 border-red-500/20"
                      }`}
                    >
                      {item.status === "success" ? "SUCCESSO" : "ERRORE"}
                    </span>
                    <span className="text-xs font-semibold text-white/95">
                      {item.payloadSummary}
                    </span>
                  </div>
                  <span className="text-[10px] text-white/40 sm:text-right">
                    {formatTimestamp(item.timestamp)}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 text-[10px] text-white/50">
                  <span>Azione:</span>
                  <span className="font-mono bg-white/5 px-1.5 py-0.5 rounded text-white/70">
                    {item.action}
                  </span>
                </div>

                {item.status === "error" && item.errorDetails && (
                  <div
                    className="p-3 rounded-xl text-[10px] font-mono whitespace-pre-wrap leading-tight break-all border"
                    style={{
                      background: "hsl(350 89% 10% / 0.15)",
                      borderColor: "hsl(350 89% 60% / 0.1)",
                      color: "hsl(350 89% 75%)",
                    }}
                  >
                    <div className="font-semibold text-red-400 mb-1">Dettaglio Errore:</div>
                    {item.errorDetails}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Sezione Log Diagnostici Errori ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white/50">
            Log Errori Diagnostici
          </h2>

          {errors.length > 0 && (
            <button
              onClick={handleClearErrors}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl text-white/40 hover:text-red-400 transition-colors cursor-pointer"
            >
              Pulisci Log
            </button>
          )}
        </div>

        {errors.length === 0 ? (
          <div
            className="rounded-2xl p-6 text-center text-xs italic border border-dashed"
            style={{
              background: "hsl(220 26% 12% / 0.3)",
              borderColor: "hsl(220 20% 14%)",
              color: "hsl(215 15% 45%)",
            }}
          >
            Nessun errore riscontrato durante la sessione corrente.
          </div>
        ) : (
          <div
            className="rounded-2xl p-4 space-y-2 border overflow-y-auto max-h-[300px]"
            style={{
              background: "hsl(220 32% 8%)",
              borderColor: "hsl(220 20% 14%)",
            }}
          >
            {errors.map((err, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-xl text-[10px] font-mono whitespace-pre-wrap leading-tight break-all border transition-all"
                style={{
                  background: "hsl(350 89% 10% / 0.25)",
                  borderColor: "hsl(350 89% 60% / 0.12)",
                  color: "hsl(350 89% 80%)",
                }}
              >
                {err}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
