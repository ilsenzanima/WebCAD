"use client";

import { useState } from "react";
import Link from "next/link";
import { APP_VERSION } from "@/lib/version";

interface StepItemProps {
  number: number;
  title: string;
  description: string;
}

function StepItem({ number, title, description }: StepItemProps) {
  return (
    <div
      className="flex gap-4 p-4 rounded-xl transition-all hover:bg-white/5"
      style={{
        background: "hsl(220 32% 10% / 0.4)",
        border: "1px solid hsl(220 20% 20% / 0.5)",
      }}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
        style={{
          background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
          color: "white",
          boxShadow: "0 4px 10px hsl(220 90% 56% / 0.2)",
        }}
      >
        {number}
      </div>
      <div>
        <h4 className="text-sm font-semibold text-white mb-1">{title}</h4>
        <p className="text-xs text-white/60 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

export default function DownloadPage() {
  return (
    <div
      className="min-h-screen flex flex-col justify-between p-6 text-white"
      style={{
        background: "radial-gradient(circle at top, hsl(220 35% 12%), hsl(220 35% 6%))",
      }}
    >
      {/* Header */}
      <div className="w-full max-w-2xl mx-auto flex items-center justify-between py-4 border-b border-white/5">
        <Link
          href="/dashboard"
          className="text-xs font-semibold text-white/60 hover:text-white transition-colors"
        >
          ← Torna alla Dashboard
        </Link>
        <span
          className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
          style={{
            background: "hsl(220 90% 56% / 0.15)",
            border: "1px solid hsl(220 90% 56% / 0.3)",
            color: "hsl(220 90% 70%)",
          }}
        >
          Versione Alpha v{APP_VERSION}
        </span>
      </div>

      {/* Main Content */}
      <div className="flex-1 w-full max-w-xl mx-auto flex flex-col items-center justify-center py-12 text-center space-y-8 animate-fade-in">
        <div className="space-y-3">
          <div className="text-4xl">🤖</div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Scarica WebCAD Cantiere
          </h1>
          <p className="text-sm text-white/60 max-w-md mx-auto">
            Il tuo multitool digitale da cantiere. Rileva misure, scatta foto quotate e controlla le inclinazioni in tempo reale direttamente dal tuo smartphone.
          </p>
        </div>

        <div className="w-full space-y-8">
          {/* Download Button Card */}
          <div
            className="w-full p-6 rounded-2xl border space-y-6"
            style={{
              background: "hsl(220 26% 14%)",
              borderColor: "hsl(220 20% 20%)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
            }}
          >
            <div className="space-y-1.5">
              <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider">File di installazione pronto</span>
              <h3 className="text-base font-bold">Android Application Package (.apk)</h3>
            </div>

            <a
              href={`https://web-cad-lac.vercel.app/downloads/webcad-v${APP_VERSION}.apk`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                const isCapacitor = typeof window !== "undefined" && (window as any).Capacitor;
                if (isCapacitor) {
                  e.preventDefault();
                  window.open(`https://web-cad-lac.vercel.app/downloads/webcad-v${APP_VERSION}.apk`, "_system");
                }
              }}
              className="inline-flex items-center justify-center w-full py-4 px-6 rounded-xl font-bold text-sm text-white transition-all shadow-lg hover:brightness-110 active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
                boxShadow: "0 6px 20px hsl(220 90% 56% / 0.3)",
              }}
            >
              📥 Scarica APK v{APP_VERSION}
            </a>
            <p className="text-[10px] text-white/40">Dimensione: ~4.5 MB | Compatibile con Android 8.0 o superiore</p>
          </div>

          {/* Guida Installazione */}
          <div className="w-full text-left space-y-4">
            <h3 className="text-base font-bold text-white pl-1">📖 Come installare su Android</h3>
            <div className="space-y-3">
              <StepItem
                number={1}
                title="Scarica l'APK"
                description="Clicca sul pulsante sopra per scaricare il file d'installazione direttamente sulla memoria del tuo smartphone."
              />
              <StepItem
                number={2}
                title="Abilita le Origini Sconosciute"
                description="Se richiesto dal sistema durante l'apertura del file, autorizza l'installazione da 'Fonti Sconosciute' o dalle impostazioni del browser (Google Chrome, Edge o Firefox)."
              />
              <StepItem
                number={3}
                title="Installa ed Avvia"
                description="Apri il file appena scaricato, premi 'Installa' ed avvia l'app. Accedi con le tue credenziali WebCAD per iniziare subito a prendere misure sul campo."
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="w-full max-w-2xl mx-auto text-center py-4 border-t border-white/5 text-[10px] text-white/40">
        © 2026 WebCAD Antincendio. Tutti i diritti riservati. Sviluppato per operatività in cantiere.
      </div>
    </div>
  );
}
