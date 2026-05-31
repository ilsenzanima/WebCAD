"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import LogoutButton from "./LogoutButton";

const CURRENT_VERSION = "0.3.0";

interface SidebarProfileProps {
  userName: string;
  email: string;
  initials: string;
}

export default function SidebarProfile({ userName, email, initials }: SidebarProfileProps) {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [remoteVersion, setRemoteVersion] = useState("");

  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const res = await fetch("/version.json", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        
        if (data.version && isNewerVersion(data.version, CURRENT_VERSION)) {
          setRemoteVersion(data.version);
          setUpdateAvailable(true);
        }
      } catch (err) {
        console.error("Errore verifica aggiornamenti:", err);
      }
    };

    checkUpdate();
    // Controlla ogni 5 minuti
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

  return (
    <div className="p-3 space-y-2" style={{ borderTop: "1px solid hsl(220 20% 16%)" }}>
      {/* Profilo Utente */}
      <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl transition-all">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 relative"
            style={{ background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))" }}
          >
            {initials}
            
            {/* Bollino notifica aggiornamento sopra l'avatar */}
            {updateAvailable && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-orange-500 rounded-full border-2 border-[hsl(220_32%_10%)] flex items-center justify-center animate-pulse" title="Aggiornamento disponibile!">
                <span className="w-1.5 h-1.5 bg-white rounded-full" />
              </span>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="text-white text-xs font-semibold truncate flex items-center gap-1.5">
              {userName}
            </div>
            <div className="text-[10px] truncate" style={{ color: "hsl(215 15% 45%)" }}>
              {email}
            </div>
          </div>
        </div>

        {/* Campana Notifiche / Aggiornamento */}
        {updateAvailable ? (
          <Link
            href="/settings"
            className="w-8 h-8 rounded-xl flex items-center justify-center bg-orange-500/10 border border-orange-500/25 text-orange-400 hover:bg-orange-500/20 transition-all text-xs relative animate-pulse"
            title={`Nuovo Aggiornamento v${remoteVersion} disponibile! Clicca per scaricare.`}
          >
            🔔
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-400 rounded-full" />
          </Link>
        ) : (
          <div 
            className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/5 text-white/40 text-xs"
            title="Nessuna nuova notifica"
          >
            🔕
          </div>
        )}
      </div>
    </div>
  );
}
