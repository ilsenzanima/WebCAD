"use client";

import { useState, useEffect, useRef } from "react";
import { Motion } from "@capacitor/motion";
import { Capacitor } from "@capacitor/core";

interface LivellaBollaProps {
  onCapture: (text: string, photoBase64?: string | null) => void;
  onClose: () => void;
}

export default function LivellaBolla({ onCapture, onClose }: LivellaBollaProps) {
  const [beta, setBeta] = useState<number>(0);
  const [gamma, setGamma] = useState<number>(0);
  
  // Stati per la fotocamera posteriore in background
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [useCamera, setUseCamera] = useState<boolean>(true);
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);

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

  // Sincronizzazione Stream Video Fotocamera Posteriore
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    setIsVideoPlaying(false);

    async function startCamera() {
      if (!useCamera || typeof navigator === "undefined" || !navigator.mediaDevices) return;
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        activeStream = mediaStream;
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          // Chiamata esplicita a play() per avviare la riproduzione in tutti i browser e webview mobili
          videoRef.current.play().catch((playErr) => {
            console.warn("⚠️ [LivellaBolla] L'autoplay del video in background è stato bloccato, riproviamo:", playErr);
          });
        }
      } catch (err) {
        console.error("Errore accesso fotocamera posteriore:", err);
      }
    }

    startCamera();

    return () => {
      setIsVideoPlaying(false);
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [useCamera]);

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

  // Conferma e invia il testo formattato e l'immagine generata al form
  function handleConfirm() {
    const text = `📐 Livella a Bolla: Inclinazione Beta = ${effBeta > 0 ? "+" : ""}${effBeta}°, Gamma = ${effGamma > 0 ? "+" : ""}${effGamma}°`;
    
    // Se la fotocamera è attiva, sta riproducendo ed abbiamo il video, generiamo l'immagine unificata!
    if (useCamera && isVideoPlaying && videoRef.current) {
      try {
        const video = videoRef.current;
        const canvas = document.createElement("canvas");
        
        // Risoluzione nativa del video
        const w = video.videoWidth || 1280;
        const h = video.videoHeight || 720;
        canvas.width = w;
        canvas.height = h;
        
        const ctx = canvas.getContext("2d");
        if (ctx) {
          // 1. Disegna il frame corrente della fotocamera
          ctx.drawImage(video, 0, 0, w, h);
          
          // 2. Aggiunge una patina scura uniforme per far risaltare il reticolo ad alto contrasto
          ctx.fillStyle = "rgba(10, 15, 30, 0.25)";
          ctx.fillRect(0, 0, w, h);
          
          const greenColor = "rgb(16, 185, 129)";
          const whiteColor = "rgba(255, 255, 255, 0.75)";
          const strokeColor = isAligned ? greenColor : whiteColor;
          
          const cx = w / 2;
          const cy = h / 2;
          
          // 3. Disegna la croce gigante ad alto contrasto
          ctx.lineWidth = Math.max(3, Math.round(w / 400));
          ctx.lineCap = "round";
          
          // Ombreggiatura per contrasto elevato
          ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
          ctx.shadowBlur = 10;
          ctx.strokeStyle = strokeColor;
          
          // Linea Orizzontale
          ctx.beginPath();
          ctx.moveTo(cx - w * 0.35, cy);
          ctx.lineTo(cx + w * 0.35, cy);
          ctx.stroke();
          
          // Linea Verticale
          ctx.beginPath();
          ctx.moveTo(cx, cy - h * 0.35);
          ctx.lineTo(cx, cy + h * 0.35);
          ctx.stroke();
          
          ctx.shadowBlur = 0; // Ripristina ombra
          
          // 4. Disegna il mirino circolare centrale
          const radius = Math.min(w, h) * 0.18;
          ctx.lineWidth = Math.max(2, Math.round(w / 500));
          ctx.strokeStyle = strokeColor;
          ctx.fillStyle = isAligned ? "rgba(16, 185, 129, 0.08)" : "rgba(10, 15, 30, 0.3)";
          
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
          
          // Cerchio di tolleranza interno tratteggiato
          ctx.strokeStyle = isAligned ? greenColor : "rgba(255, 255, 255, 0.35)";
          ctx.setLineDash([8, 8]);
          ctx.beginPath();
          ctx.arc(cx, cy, radius * 0.25, 0, 2 * Math.PI);
          ctx.stroke();
          ctx.setLineDash([]);
          
          // 5. Calcola e disegna la bolla galleggiante
          const maxDisp = radius * 0.75;
          const sens = radius / 16; // 16 gradi massimo spostamento
          
          const moveX = Math.max(-maxDisp, Math.min(maxDisp, effGamma * sens));
          const moveY = Math.max(-maxDisp, Math.min(maxDisp, effBeta * sens));
          
          const bx = cx + moveX;
          const by = cy + moveY;
          const br = radius * 0.18;
          
          const grad = ctx.createRadialGradient(bx - br * 0.3, by - br * 0.3, br * 0.1, bx, by, br);
          if (isAligned) {
            grad.addColorStop(0, "rgb(52, 211, 153)");
            grad.addColorStop(1, "rgb(4, 120, 87)");
          } else {
            grad.addColorStop(0, "rgb(56, 189, 248)");
            grad.addColorStop(1, "rgb(2, 132, 199)");
          }
          
          ctx.fillStyle = grad;
          ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(bx, by, br, 0, 2 * Math.PI);
          ctx.fill();
          ctx.shadowBlur = 0;
          
          // 6. Box informativo con i gradi
          const boxW = Math.max(300, Math.round(w * 0.35));
          const boxH = Math.max(80, Math.round(h * 0.14));
          const boxX = (w - boxW) / 2;
          const boxY = h - boxH - Math.max(30, Math.round(h * 0.05));
          
          ctx.fillStyle = "rgba(10, 15, 30, 0.85)";
          ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(boxX, boxY, boxW, boxH, 16) : ctx.rect(boxX, boxY, boxW, boxH);
          ctx.fill();
          ctx.stroke();
          
          // Testi e gradi
          ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
          ctx.font = `bold ${Math.round(boxH * 0.13)}px sans-serif`;
          ctx.textAlign = "center";
          
          ctx.fillText("BECCHEGGIO (Y)", boxX + boxW * 0.25, boxY + boxH * 0.3);
          ctx.fillText("ROLLIO (X)", boxX + boxW * 0.75, boxY + boxH * 0.3);
          
          ctx.fillStyle = isAligned ? greenColor : "rgb(255, 255, 255)";
          ctx.font = `bold ${Math.round(boxH * 0.28)}px sans-serif`;
          
          const textBeta = `${effBeta > 0 ? "+" : ""}${effBeta}°`;
          const textGamma = `${effGamma > 0 ? "+" : ""}${effGamma}°`;
          ctx.fillText(textBeta, boxX + boxW * 0.25, boxY + boxH * 0.7);
          ctx.fillText(textGamma, boxX + boxW * 0.75, boxY + boxH * 0.7);
          
          // Linea separatrice
          ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
          ctx.beginPath();
          ctx.moveTo(boxX + boxW * 0.5, boxY + boxH * 0.2);
          ctx.lineTo(boxX + boxW * 0.5, boxY + boxH * 0.8);
          ctx.stroke();
          
          // Watermark WebCAD in alto a sinistra
          ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
          ctx.font = `bold ${Math.round(h * 0.024)}px sans-serif`;
          ctx.textAlign = "left";
          ctx.fillText("📐 WebCAD Bolla Digitale", 25, 40);
          
          // Stato In Bolla
          if (isAligned) {
            ctx.fillStyle = greenColor;
            ctx.font = `bold ${Math.round(boxH * 0.15)}px sans-serif`;
            ctx.textAlign = "center";
            ctx.fillText("✓ RILEVAMENTO IN BOLLA", cx, boxY - 15);
          }
        }
        
        const photoData = canvas.toDataURL("image/jpeg", 0.9);
        onCapture(text, photoData);
      } catch (err) {
        console.error("Errore generazione foto bolla:", err);
        onCapture(text, null);
      }
    } else {
      onCapture(text, null);
    }
  }

  // Calcola lo spostamento della bolla sul mirino grafico
  // Limitiamo lo spostamento per non far uscire la bolla dal mirino
  const maxDisplacement = 70; // pixel
  const sensitivity = 3.5;    // pixel per grado
  
  const moveX = Math.max(-maxDisplacement, Math.min(maxDisplacement, effGamma * sensitivity));
  const moveY = Math.max(-maxDisplacement, Math.min(maxDisplacement, effBeta * sensitivity));

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-between p-6 transition-all duration-300"
      style={{ 
        background: useCamera && isVideoPlaying ? "rgba(10, 15, 30, 0.45)" : "rgba(10, 15, 30, 0.96)", 
        backdropFilter: useCamera && isVideoPlaying ? "none" : "blur(8px)" 
      }}
    >
      {/* CSS protettivo per nascondere qualsiasi controllo nativo o icona play di fallback dei browser mobili */}
      <style dangerouslySetInnerHTML={{__html: `
        video::-webkit-media-controls {
          display: none !important;
        }
        video::-webkit-media-controls-start-playback-button {
          display: none !important;
        }
      `}} />

      {/* Stream Video Fotocamera Posteriore */}
      {useCamera && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onPlaying={() => setIsVideoPlaying(true)}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-500"
          style={{ 
            zIndex: 0, 
            opacity: isVideoPlaying ? 0.65 : 0,
            background: "transparent"
          }}
        />
      )}

      {/* Intestazione */}
      <div className="w-full max-w-md flex items-center justify-between py-2 border-b border-white/10 relative z-10">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-1.5 shadow-sm">
            🟢 Livella a Bolla Digitale
          </h3>
          <p className="text-xs text-white/50">Appoggia il telefono o inquadra per allineare</p>
        </div>
        <div className="flex gap-2">
          {/* Tasto Switch Fotocamera */}
          <button
            type="button"
            onClick={() => setUseCamera(c => !c)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white/80 border transition-all active:scale-95 cursor-pointer"
            style={{
              background: useCamera ? "rgba(14, 165, 233, 0.2)" : "rgba(255, 255, 255, 0.05)",
              borderColor: useCamera ? "hsl(199 89% 48%)" : "rgba(255,255,255,0.15)",
            }}
            title={useCamera ? "Spegni Fotocamera" : "Accendi Fotocamera"}
          >
            📷 {useCamera ? "Camera On" : "Camera Off"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white/70 hover:bg-white/10 transition-colors cursor-pointer"
          >
            Chiudi
          </button>
        </div>
      </div>

      {/* Grafica Centrale Livella */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 my-6 w-full relative z-10">
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
            {/* Grande croce di allineamento gigante ad alto contrasto per inquadrare oggetti reali */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden" style={{ zIndex: 5 }}>
              {/* Linea Orizzontale */}
              <div 
                className="absolute w-[85vw] max-w-lg h-[2px] transition-all duration-300"
                style={{ 
                  backgroundColor: isAligned ? "hsl(142, 80%, 50%)" : "rgba(255, 255, 255, 0.4)",
                  boxShadow: isAligned 
                    ? "0 0 10px hsl(142, 80%, 50%), 0 1px 3px rgba(0,0,0,0.8)" 
                    : "0 1px 3px rgba(0, 0, 0, 0.8)",
                }}
              />
              {/* Linea Verticale */}
              <div 
                className="absolute h-[65vh] max-h-96 w-[2px] transition-all duration-300"
                style={{ 
                  backgroundColor: isAligned ? "hsl(142, 80%, 50%)" : "rgba(255, 255, 255, 0.4)",
                  boxShadow: isAligned 
                    ? "0 0 10px hsl(142, 80%, 50%), 0 1px 3px rgba(0,0,0,0.8)" 
                    : "0 1px 3px rgba(0, 0, 0, 0.8)",
                }}
              />
            </div>

            {/* Il Mirino Circolare */}
            <div
              className="relative w-48 h-48 rounded-full border-2 flex items-center justify-center transition-all duration-300"
              style={{
                borderColor: isAligned ? "hsl(142, 60%, 50%)" : "rgba(255, 255, 255, 0.25)",
                background: isAligned ? "hsl(142, 60%, 50% / 0.08)" : "rgba(10, 15, 30, 0.35)",
                backdropFilter: "blur(2px)",
                boxShadow: isAligned ? "0 0 35px hsl(142, 60%, 50% / 0.3)" : "none",
              }}
            >
              {/* Cerchio centrale di tolleranza */}
              <div
                className="absolute w-10 h-10 rounded-full border border-dashed transition-all"
                style={{
                  borderColor: isAligned ? "hsl(142, 60%, 50%)" : "rgba(255, 255, 255, 0.35)",
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
