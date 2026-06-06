"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { APP_VERSION } from "@/lib/version";

const CURRENT_VERSION = APP_VERSION;

interface VersionData {
  version: string;
  buildTime: string;
  notes: string;
}

export default function UpdateNotifier() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [remoteVersion, setRemoteVersion] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [isDismissed, setIsDismissed] = useState(true); // Default to dismissed to avoid flash
  const [localVersion, setLocalVersion] = useState(CURRENT_VERSION);

  useEffect(() => {
    const checkUpdate = async () => {
      try {
        let currentVer = CURRENT_VERSION;
        const isCapacitor = typeof window !== "undefined" && (window as any).Capacitor;
        if (isCapacitor) {
          try {
            const { App } = await import("@capacitor/app");
            const info = await App.getInfo();
            if (info && info.version) {
              currentVer = info.version;
            }
          } catch (err) {
            console.warn("Impossibile recuperare versione nativa:", err);
          }
        }
        setLocalVersion(currentVer);

        const res = await fetch("/version.json", { cache: "no-store" });
        if (!res.ok) return;
        const data: VersionData = await res.json();
        
        if (data.version && isNewerVersion(data.version, currentVer)) {
          const dismissed = localStorage.getItem(`dismissed_version_${data.version}`);
          if (!dismissed) {
            setRemoteVersion(data.version);
            setReleaseNotes(data.notes);
            setUpdateAvailable(true);
            setIsDismissed(false);
          }
        }
      } catch (err) {
        console.warn("Errore verifica aggiornamenti:", err);
      }
    };

    checkUpdate();
    // Controlla ogni 3 minuti
    const interval = setInterval(checkUpdate, 3 * 60 * 1000);
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

  function handleDismiss() {
    localStorage.setItem(`dismissed_version_${remoteVersion}`, "true");
    setIsDismissed(true);
  }

  function handleReload() {
    window.location.reload();
  }

  if (isDismissed || !updateAvailable) return null;

  return (
    <div className="fixed top-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[9999] animate-fade-in">
      <div 
        className="p-4 rounded-2xl border shadow-2xl flex flex-col gap-3 transition-all duration-300"
        style={{
          background: "hsl(220 35% 12% / 0.95)",
          backdropFilter: "blur(12px)",
          borderColor: "hsl(16 100% 58% / 0.3)",
          boxShadow: "0 10px 40px hsl(16 100% 58% / 0.15), inset 0 1px 1px hsl(220 100% 80% / 0.1)"
        }}
      >
        {/* Intestazione */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="text-xl flex-shrink-0 animate-bounce">🚀</span>
            <div>
              <h4 className="text-sm font-bold text-white leading-tight">Nuovo Rilascio Disponibile!</h4>
              <p className="text-[11px]" style={{ color: "hsl(215 20% 65%)" }}>
                Versione {remoteVersion} (corrente: {localVersion})
              </p>
            </div>
          </div>
          <button 
            onClick={handleDismiss}
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-white/50 hover:text-white/80 hover:bg-white/5 transition-all"
          >
            ✕
          </button>
        </div>

        {/* Note di rilascio */}
        {releaseNotes && (
          <div className="px-3 py-2 rounded-xl bg-white/5 border border-white/5 max-h-24 overflow-y-auto">
            <p className="text-[11px] leading-relaxed text-white/70 italic">
              "{releaseNotes}"
            </p>
          </div>
        )}

        {/* Pulsanti Azione */}
        <div className="flex gap-2.5 mt-1">
          <button 
            onClick={handleReload}
            className="flex-1 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-md active:scale-95 cursor-pointer"
            style={{
              background: "linear-gradient(135deg, hsl(16 100% 58%), hsl(0 84% 60%))",
              boxShadow: "0 2px 8px hsl(16 100% 58% / 0.2)"
            }}
          >
            ⚡ Aggiorna Browser
          </button>
          
          <Link 
            href="/download"
            onClick={() => setIsDismissed(true)}
            className="flex-1 py-2 rounded-xl text-xs font-bold text-center text-white/90 border border-white/10 hover:bg-white/5 hover:text-white transition-all active:scale-95 flex items-center justify-center cursor-pointer"
          >
            📥 Scarica APK
          </Link>
        </div>
      </div>
    </div>
  );
}
