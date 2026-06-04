"use client";

import { useOfflineStore } from "@/lib/stores/offline-store";
import { useState } from "react";

export default function OfflineModeToggle() {
  const { offlineMode, setOfflineMode, isOnline, isSyncing, offlineQueue } = useOfflineStore();
  const [localSyncing, setLocalSyncing] = useState(false);

  const handleToggle = async () => {
    if (isSyncing || localSyncing) return;
    
    const nextMode = !offlineMode;
    
    // Se passiamo a online ed abbiamo la rete fisica, eseguiamo la sync
    if (!nextMode && isOnline) {
      setLocalSyncing(true);
      try {
        await setOfflineMode(false);
      } catch (err) {
        console.error("Errore durante il passaggio online:", err);
      } finally {
        setLocalSyncing(false);
      }
    } else {
      await setOfflineMode(nextMode);
    }
  };

  const activeSyncing = isSyncing || localSyncing;
  const isOfflineActive = offlineMode || !isOnline;

  return (
    <div className="px-3 py-2 w-full flex flex-col gap-1.5 font-sans">
      <div 
        onClick={handleToggle}
        className={`relative w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer select-none transition-all duration-200 border group ${
          activeSyncing 
            ? "pointer-events-none opacity-85" 
            : ""
        }`}
        style={{
          background: isOfflineActive 
            ? "hsl(32 95% 10% / 0.3)" 
            : "hsl(142 70% 10% / 0.3)",
          borderColor: isOfflineActive 
            ? "hsl(32 95% 44% / 0.25)" 
            : "hsl(142 70% 45% / 0.25)",
          boxShadow: isOfflineActive 
            ? "0 4px 12px -2px hsl(32 95% 44% / 0.05)" 
            : "0 4px 12px -2px hsl(142 70% 45% / 0.05)",
        }}
        title={
          activeSyncing 
            ? "Sincronizzazione in corso..." 
            : isOfflineActive 
            ? "Fai clic per passare in modalità Online e sincronizzare" 
            : "Fai clic per passare in modalità Offline e lavorare senza rete"
        }
      >
        {/* Etichetta Stato */}
        <div className="flex items-center gap-2">
          {activeSyncing ? (
            <div className="w-3.5 h-3.5 border-2 border-t-transparent border-amber-500 rounded-full animate-spin flex-shrink-0" />
          ) : (
            <div 
              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                isOfflineActive ? "animate-pulse" : ""
              }`}
              style={{
                background: isOfflineActive ? "hsl(32 95% 55%)" : "hsl(142 70% 50%)"
              }}
            />
          )}
          <span 
            className="text-xs font-bold transition-colors group-hover:text-white"
            style={{
              color: isOfflineActive ? "hsl(32 95% 75%)" : "hsl(142 70% 75%)"
            }}
          >
            {activeSyncing 
              ? "Sincronizzazione..." 
              : isOfflineActive 
              ? "Modalità Offline" 
              : "Stato: Online"}
          </span>
        </div>

        {/* Switch grafico */}
        <div 
          className="w-8 h-4.5 rounded-full p-0.5 transition-colors relative flex items-center"
          style={{
            background: isOfflineActive ? "hsl(32 90% 40%)" : "hsl(142 60% 30%)"
          }}
        >
          <div 
            className="w-3.5 h-3.5 rounded-full bg-white transition-transform duration-200 shadow-sm"
            style={{
              transform: isOfflineActive ? "translateX(14px)" : "translateX(0px)"
            }}
          />
        </div>
      </div>

      {/* Info coda se presenti modifiche offline */}
      {offlineQueue.length > 0 && (
        <div className="px-2 flex items-center justify-between text-[10px] text-white/50 leading-none">
          <span>{offlineQueue.length} modifiche pendenti</span>
          {isOfflineActive && isOnline && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleToggle();
              }}
              className="text-sky-400 font-extrabold hover:text-sky-300 transition-colors uppercase tracking-wider cursor-pointer bg-transparent border-none p-0 text-[9px]"
            >
              Sync Ora ⚡
            </button>
          )}
        </div>
      )}
    </div>
  );
}
