"use client";

import { useState, useEffect, useRef } from "react";
import { Motion } from "@capacitor/motion";
import { Capacitor } from "@capacitor/core";

interface LivellaBollaProps {
  onCapture: (text: string) => void;
  onClose: () => void;
}

export default function LivellaBolla({ onCapture, onClose }: LivellaBollaProps) {
  const [beta, setBeta] = useState<number>(0);
  const [gamma, setGamma] = useState<number>(0);
  
  // Offsets per la calibrazione
  const [offsetBeta, setOffsetBeta] = useState<number>(0);
  const [offsetGamma, setOffsetGamma] = useState<number>(0);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isSupported, setIsSupported] = useState<boolean>(true);

  // Calcolo angoli effettivi (calibrati)
  const effBeta = parseFloat((beta - offsetBeta).toFixed(1));
  const effGamma = parseFloat((gamma - offsetGamma).toFixed(1));

  // Verifica se la livella è "in bolla" (tolleranza 0.8 gradi)
  const isAligned = Math.abs(effBeta) <= 0.8 && Math.abs(effGamma) <= 0.8;

  // Riferimento per vibrare una sola volta quando entra in bolla
  const lastAlignedRef = useRef(false);

  useEffect(() => {
    let nativeListener: any = null;

    async function setupMotion() {
      // Se siamo su una piattaforma nativa (Capacitor)
      if (Capacitor.isNativePlatform()) {
        try {
          setHasPermission(true);
          nativeListener = await Motion.addListener("orientation", (event) => {
            if (event.beta !== null) setBeta(event.beta);
            if (event.gamma !== null) setGamma(event.gamma);
          });
        } catch (err) {
          console.error("Errore inizializzazione Motion nativo:", err);
          setupWebMotion();
        }
      } else {
        setupWebMotion();
      }
    }

    function setupWebMotion() {
      if (typeof window === "undefined" || !window.DeviceOrientationEvent) {
        setIsSupported(false);
        setHasPermission(false);
        return;
      }

      // Su iOS 13+ è richiesta la richiesta esplicita di permessi
      const needsPermission = typeof (DeviceOrientationEvent as any).requestPermission === "function";
      if (!needsPermission) {
        setHasPermission(true);
        window.addEventListener("deviceorientation", handleOrientation);
      } else {
        setHasPermission(null); // in attesa che l'utente clicchi il pulsante di sblocco
      }
    }

    setupMotion();

    return () => {
      if (nativeListener) {
        nativeListener.remove();
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("deviceorientation", handleOrientation);
      }
    };
  }, []);

  // Effetto vibrazione quando entra in bolla
  useEffect(() => {
    if (isAligned && !lastAlignedRef.current) {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(60); // vibrazione breve su cellulare
      }
    }
    lastAlignedRef.current = isAligned;
  }, [isAligned]);

  function handleOrientation(event: DeviceOrientationEvent) {
    if (event.beta !== null) setBeta(event.beta);
    if (event.gamma !== null) setGamma(event.gamma);
  }

  // Sblocco sensori esplicito per iOS
  async function requestPermission() {
    if (
      typeof window !== "undefined" &&
      typeof (DeviceOrientationEvent as any).requestPermission === "function"
    ) {
      try {
        const state = await (DeviceOrientationEvent as any).requestPermission();
        if (state === "granted") {
          setHasPermission(true);
          window.addEventListener("deviceorientation", handleOrientation);
        } else {
          setHasPermission(false);
          alert("Permesso sensori negato. Abilita l'accesso nelle impostazioni del browser.");
        }
      } catch (err) {
        console.error("Errore richiesta permessi iOS:", err);
        setHasPermission(false);
      }
    }
  }

  // Calibra (Azzera la livella impostando la posizione corrente come offset)
  function handleCalibrate() {
    setOffsetBeta(beta);
    setOffsetGamma(gamma);
  }

  // Resetta la calibrazione a zero assoluto
  function handleResetCalibration() {
    setOffsetBeta(0);
    setOffsetGamma(0);
  }

  // Conferma e invia il testo formattato al form
  function handleConfirm() {
    const text = `📐 Livella a Bolla: Inclinazione Beta = ${effBeta > 0 ? "+" : ""}${effBeta}°, Gamma = ${effGamma > 0 ? "+" : ""}${effGamma}°`;
    onCapture(text);
  }

  // Calcola lo spostamento della bolla sul mirino grafico
  // Limitiamo lo spostamento per non far uscire la bolla dal mirino
  const maxDisplacement = 70; // pixel
  const sensitivity = 3.5;    // pixel per grado
  
  const moveX = Math.max(-maxDisplacement, Math.min(maxDisplacement, effGamma * sensitivity));
  const moveY = Math.max(-maxDisplacement, Math.min(maxDisplacement, effBeta * sensitivity));

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-between p-6"
      style={{ background: "rgba(10, 15, 30, 0.95)", backdropFilter: "blur(8px)" }}
    >
      {/* Intestazione */}
      <div className="w-full max-w-md flex items-center justify-between py-2 border-b border-white/10">
        <div>
          <h3 className="text-base font-bold text-white">🟢 Livella a Bolla Digitale</h3>
          <p className="text-xs text-white/50">Appoggia il telefono su una superficie per misurare</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white/70 hover:bg-white/10 transition-colors"
        >
          Chiudi
        </button>
      </div>

      {/* Grafica Centrale Livella */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 my-6 w-full">
        {!isSupported ? (
          <div className="text-center p-6 bg-white/5 border border-white/10 rounded-2xl max-w-xs">
            <p className="text-sm text-yellow-500 font-bold mb-2">⚠️ Giroscopio non supportato</p>
            <p className="text-xs text-white/60">Questo dispositivo non possiede i sensori fisici necessari o il browser non li espone.</p>
          </div>
        ) : hasPermission === null ? (
          <div className="text-center p-6 bg-white/5 border border-white/10 rounded-2xl max-w-xs flex flex-col gap-4">
            <p className="text-sm text-white/80">iOS richiede lo sblocco esplicito dei sensori di movimento.</p>
            <button
              type="button"
              onClick={requestPermission}
              className="px-5 py-3 rounded-xl text-sm font-bold text-white transition-all"
              style={{
                background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
              }}
            >
              Attiva Sensori Fisici
            </button>
          </div>
        ) : hasPermission === false ? (
          <div className="text-center p-6 bg-white/5 border border-white/10 rounded-2xl max-w-xs">
            <p className="text-sm text-red-400 font-bold mb-2">⚠️ Permesso Negato</p>
            <p className="text-xs text-white/60">Non è possibile utilizzare la livella senza autorizzazione ai sensori.</p>
          </div>
        ) : (
          <>
            {/* Il Mirino Circolare */}
            <div
              className="relative w-48 h-48 rounded-full border-2 flex items-center justify-center transition-all duration-300"
              style={{
                borderColor: isAligned ? "hsl(142, 60%, 50%)" : "rgba(255, 255, 255, 0.15)",
                background: isAligned ? "hsl(142, 60%, 50% / 0.05)" : "transparent",
                boxShadow: isAligned ? "0 0 30px hsl(142, 60%, 50% / 0.25)" : "none",
              }}
            >
              {/* Linee a croce (mirino) */}
              <div className="absolute w-full h-[1px] bg-white/10" />
              <div className="absolute h-full w-[1px] bg-white/10" />

              {/* Cerchio centrale di tolleranza */}
              <div
                className="absolute w-10 h-10 rounded-full border border-dashed transition-all"
                style={{
                  borderColor: isAligned ? "hsl(142, 60%, 50%)" : "rgba(255, 255, 255, 0.3)",
                }}
              />

              {/* La Bolla Galleggiante */}
              <div
                className="absolute w-8 h-8 rounded-full transition-transform duration-75 ease-out shadow-lg"
                style={{
                  transform: `translate(${moveX}px, ${moveY}px)`,
                  background: isAligned
                    ? "radial-gradient(circle at 30% 30%, hsl(142, 80%, 50%), hsl(142, 100%, 35%))"
                    : "radial-gradient(circle at 30% 30%, hsl(200, 100%, 65%), hsl(200, 100%, 45%))",
                  boxShadow: isAligned
                    ? "0 0 15px hsl(142, 100%, 50% / 0.8), inset -2px -2px 6px rgba(0,0,0,0.4)"
                    : "0 4px 10px rgba(0,0,0,0.5), inset -2px -2px 6px rgba(0,0,0,0.4)",
                }}
              />
            </div>

            {/* Display Valori Angoli */}
            <div className="flex gap-8 text-center bg-white/5 px-6 py-3 rounded-2xl border border-white/5 shadow-inner">
              <div>
                <span className="block text-[10px] uppercase tracking-wider text-white/40">Beccheggio (Y)</span>
                <span
                  className="text-2xl font-bold font-mono transition-colors"
                  style={{ color: isAligned ? "hsl(142, 60%, 55%)" : "white" }}
                >
                  {effBeta > 0 ? "+" : ""}
                  {effBeta}°
                </span>
              </div>
              <div className="w-[1px] bg-white/10" />
              <div>
                <span className="block text-[10px] uppercase tracking-wider text-white/40">Rollio (X)</span>
                <span
                  className="text-2xl font-bold font-mono transition-colors"
                  style={{ color: isAligned ? "hsl(142, 60%, 55%)" : "white" }}
                >
                  {effGamma > 0 ? "+" : ""}
                  {effGamma}°
                </span>
              </div>
            </div>

            {isAligned && (
              <p className="text-xs font-bold text-emerald-400 animate-pulse">✓ IN BOLLA</p>
            )}
          </>
        )}
      </div>

      {/* Controlli inferiori */}
      <div className="w-full max-w-md flex flex-col gap-4 bg-white/5 border border-white/10 rounded-2xl p-4">
        {isSupported && hasPermission && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCalibrate}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold border border-white/10 text-white/80 hover:bg-white/5 transition-all"
            >
              🎯 Calibra (Azzera)
            </button>
            {(offsetBeta !== 0 || offsetGamma !== 0) && (
              <button
                type="button"
                onClick={handleResetCalibration}
                className="px-3 py-2.5 rounded-xl text-xs font-semibold border border-red-500/30 text-red-400 hover:bg-red-500/5 transition-all"
                title="Resetta calibrazione"
              >
                ✕
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={handleConfirm}
          disabled={!isSupported || !hasPermission}
          className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all shadow-lg disabled:opacity-50"
          style={{
            background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
            boxShadow: "0 4px 15px hsl(220 90% 56% / 0.25)",
          }}
        >
          📥 Registra come Nota
        </button>
      </div>
    </div>
  );
}
