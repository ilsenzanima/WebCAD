"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useOfflineStore } from "@/lib/stores/offline-store";

const NetworkSyncContext = createContext<{ isOnline: boolean }>({ isOnline: true });

export const useNetworkStatus = () => useContext(NetworkSyncContext);

export default function NetworkSyncProvider({ children }: { children: React.ReactNode }) {
  const { isOnline, setOnlineStatus, syncOfflineData, offlineQueue, isSyncing } = useOfflineStore();
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);

  useEffect(() => {
    // Gestione connettività di rete
    const handleOnline = () => {
      setOnlineStatus(true);
      // Avvia la sincronizzazione automatica quando torna online
      syncOfflineData().then(() => {
        setShowSyncSuccess(true);
        setTimeout(() => setShowSyncSuccess(false), 3000);
      });
    };

    const handleOffline = () => {
      setOnlineStatus(false);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      // Imposta lo stato iniziale
      setOnlineStatus(window.navigator.onLine);
      
      // Se all'avvio siamo online ed abbiamo operazioni in coda, sincronizziamo
      if (window.navigator.onLine && offlineQueue.length > 0) {
        syncOfflineData();
      }
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      }
    };
  }, [setOnlineStatus, syncOfflineData, offlineQueue.length]);

  return (
    <NetworkSyncContext.Provider value={{ isOnline }}>
      {children}

      {/* Indicatori Visivi di Connettività Premium ed Eleganti */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 font-sans">
        {/* Banner Offline */}
        {!isOnline && (
          <div
            className="flex items-center gap-2.5 px-4 py-3 rounded-2xl text-xs font-semibold shadow-2xl animate-bounce border"
            style={{
              background: "hsl(220 26% 12% / 0.95)",
              borderColor: "hsl(32 95% 44% / 0.4)",
              color: "hsl(32 95% 70%)",
              backdropFilter: "blur(12px)",
              boxShadow: "0 10px 30px -10px hsl(32 95% 44% / 0.2)",
            }}
          >
            <span className="text-sm">⚠️</span>
            <div>
              <p className="font-bold">Modalità Offline</p>
              <p className="opacity-80 text-[10px] font-normal mt-0.5">Le modifiche saranno salvate in locale</p>
            </div>
            {offlineQueue.length > 0 && (
              <span 
                className="ml-2 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 border border-amber-500/30"
              >
                {offlineQueue.length} in coda
              </span>
            )}
          </div>
        )}

        {/* Banner Sincronizzazione in Corso */}
        {isSyncing && (
          <div
            className="flex items-center gap-2.5 px-4 py-3 rounded-2xl text-xs font-semibold shadow-2xl border"
            style={{
              background: "hsl(220 26% 12% / 0.95)",
              borderColor: "hsl(220 90% 56% / 0.4)",
              color: "hsl(220 90% 75%)",
              backdropFilter: "blur(12px)",
              boxShadow: "0 10px 30px -10px hsl(220 90% 56% / 0.2)",
            }}
          >
            <div className="w-3.5 h-3.5 border-2 border-t-transparent border-blue-500 rounded-full animate-spin" />
            <div>
              <p className="font-bold">Sincronizzazione</p>
              <p className="opacity-80 text-[10px] font-normal mt-0.5">Invio dei dati a Supabase...</p>
            </div>
          </div>
        )}

        {/* Notifica Successo Sincronizzazione */}
        {showSyncSuccess && (
          <div
            className="flex items-center gap-2.5 px-4 py-3 rounded-2xl text-xs font-semibold shadow-2xl border transition-all duration-300 transform scale-100"
            style={{
              background: "hsl(220 26% 12% / 0.95)",
              borderColor: "hsl(142 70% 45% / 0.4)",
              color: "hsl(142 70% 70%)",
              backdropFilter: "blur(12px)",
              boxShadow: "0 10px 30px -10px hsl(142 70% 45% / 0.2)",
            }}
          >
            <span className="text-sm">✓</span>
            <div>
              <p className="font-bold">Dati Sincronizzati</p>
              <p className="opacity-80 text-[10px] font-normal mt-0.5">Tutti i cantieri sono salvati online.</p>
            </div>
          </div>
        )}
      </div>
    </NetworkSyncContext.Provider>
  );
}
