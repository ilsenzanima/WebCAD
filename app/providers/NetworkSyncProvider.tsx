"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useOfflineStore } from "@/lib/stores/offline-store";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NetworkSyncContext = createContext<{ isOnline: boolean }>({ isOnline: true });

export const useNetworkStatus = () => useContext(NetworkSyncContext);
export default function NetworkSyncProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isOnline, offlineMode, setOnlineStatus, syncOfflineData, offlineQueue, isSyncing } = useOfflineStore();
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);
  // Previene il mismatch di idratazione React #418:
  // i banner condizionali (offline/syncing) vengono renderizzati solo lato client dopo il mount
  const [clientMounted, setClientMounted] = useState(false);
  useEffect(() => {
    // Idratazione manuale lato client per evitare hydration mismatch
    useOfflineStore.persist.rehydrate();
    setClientMounted(true);
  }, []);

  // Gestione pulsante indietro nativo per Capacitor (Android / iOS)
  useEffect(() => {
    if (typeof window === "undefined") return;

    let backButtonListener: any = null;

    const setupBackButton = async () => {
      const isCapacitor = (window as any).Capacitor;
      if (!isCapacitor) return;

      try {
        const { App } = await import("@capacitor/app");
        backButtonListener = await App.addListener("backButton", () => {
          const path = window.location.pathname;
          // Se siamo nella dashboard principale, sul login o sulla root, chiudiamo l'applicazione
          if (path === "/projects" || path === "/" || path === "/login") {
            App.exitApp();
          } else {
            // Altrimenti torniamo indietro nella history del browser
            window.history.back();
          }
        });
      } catch (err) {
        console.warn("Impossibile registrare il listener del tasto indietro nativo:", err);
      }
    };

    setupBackButton();

    return () => {
      if (backButtonListener) {
        backButtonListener.remove();
      }
    };
  }, []);

  // Sottoscrizione Supabase Realtime per sincronizzazione in tempo reale bidirezionale
  useEffect(() => {
    if (typeof window === "undefined" || !isOnline) return;

    const supabase = createClient();
    let errorCount = 0;

    const channel = supabase
      .channel("realtime-sync-channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects" },
        () => {
          router.refresh();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "levels" },
        () => {
          router.refresh();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "field_notes" },
        () => {
          router.refresh();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "field_note_items" },
        () => {
          router.refresh();
        }
      );

    channel.subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        errorCount++;
        console.warn(`⚠️ [Supabase Realtime] Errore di connessione (${errorCount}/3).`);
        if (errorCount >= 3) {
          console.error("🔴 [Supabase Realtime] Disattivazione automatica realtime a causa di troppi errori di connessione WebSocket.");
          supabase.removeChannel(channel);
        }
      } else if (status === "SUBSCRIBED") {
        errorCount = 0;
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOnline, router]);


  useEffect(() => {
    // Gestione connettività di rete
    const handleOnline = () => {
      setOnlineStatus(true);
      // Avvia la sincronizzazione automatica quando torna online, se non siamo in offlineMode manuale
      if (!useOfflineStore.getState().offlineMode) {
        syncOfflineData().then(() => {
          setShowSyncSuccess(true);
          router.refresh();
          setTimeout(() => setShowSyncSuccess(false), 3000);
        });
      }
    };

    const handleOffline = () => {
      setOnlineStatus(false);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      // Imposta lo stato iniziale
      setOnlineStatus(window.navigator.onLine);
      
      // Se all'avvio siamo online ed abbiamo operazioni in coda, e non siamo in offlineMode manuale, sincronizziamo
      if (window.navigator.onLine && !useOfflineStore.getState().offlineMode) {
        if (offlineQueue.length > 0) {
          syncOfflineData().then(() => {
            router.refresh();
          });
        } else {
          router.refresh(); // Forza l'aggiornamento dei dati all'avvio su cellulare per evitare cache rigide
        }
      }
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      }
    };
  }, [setOnlineStatus, syncOfflineData, offlineQueue.length, router]);

  return (
    <NetworkSyncContext.Provider value={{ isOnline }}>
      {children}

      {/* Indicatori Visivi di Connettività Premium ed Eleganti */}
      {/* Renderizzati solo dopo il mount client-side per evitare hydration mismatch (React #418) */}
      {clientMounted && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 font-sans">
          {/* Banner Offline */}
          {(offlineMode || !isOnline) && (
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
                <p className="font-bold">{!isOnline ? "Modalità Offline (Senza Rete)" : "Modalità Offline Attiva"}</p>
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
      )}
    </NetworkSyncContext.Provider>
  );
}
