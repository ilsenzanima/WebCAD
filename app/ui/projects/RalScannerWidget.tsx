"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { RAL_DATABASE, RalColor } from "@/lib/colors/ral-database";

interface RalScannerWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectColor?: (colorString: string) => void;
}

export default function RalScannerWidget({
  isOpen,
  onClose,
  onSelectColor,
}: RalScannerWidgetProps) {
  const [mounted, setMounted] = useState(false);
  const [useCamera, setUseCamera] = useState(true);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);

  // Colore attualmente catturato o selezionato
  const [currentRgb, setCurrentRgb] = useState<[number, number, number]>([128, 128, 128]);
  const [matchedRal, setMatchedRal] = useState<RalColor | null>(null);
  const [matchDistance, setMatchDistance] = useState<number>(0);

  // Ricerca manuale
  const [searchQuery, setSearchQuery] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loopRef = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => {
      stopCamera();
    };
  }, []);

  // Gestione Stream Video
  useEffect(() => {
    if (!isOpen || !mounted) return;

    if (useCamera && !isFrozen) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [useCamera, isOpen, mounted, isFrozen]);

  // Loop di cattura frame
  useEffect(() => {
    if (useCamera && isVideoPlaying && !isFrozen) {
      // Avvia loop di cattura colore pixel centrale
      const captureLoop = () => {
        captureColor();
        loopRef.current = requestAnimationFrame(captureLoop);
      };
      loopRef.current = requestAnimationFrame(captureLoop);
    } else {
      if (loopRef.current) {
        cancelAnimationFrame(loopRef.current);
        loopRef.current = null;
      }
    }

    return () => {
      if (loopRef.current) {
        cancelAnimationFrame(loopRef.current);
      }
    };
  }, [useCamera, isVideoPlaying, isFrozen]);

  async function startCamera() {
    setIsVideoPlaying(false);
    if (typeof navigator === "undefined" || !navigator.mediaDevices) return;
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch((err) => {
          console.warn("Autoplay del video bloccato:", err);
        });
      }
    } catch (err) {
      console.error("Errore accesso fotocamera per scanner RAL:", err);
      setUseCamera(false); // Fallback su inserimento manuale
    }
  }

  function stopCamera() {
    if (loopRef.current) {
      cancelAnimationFrame(loopRef.current);
      loopRef.current = null;
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsVideoPlaying(false);
  }

  function captureColor() {
    const video = videoRef.current;
    if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) return;

    // Usiamo un canvas per estrarre il pixel centrale
    const canvas = canvasRef.current || document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 120;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Disegna il video scalato sul canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Estrae pixel al centro esatto
    const cx = Math.floor(canvas.width / 2);
    const cy = Math.floor(canvas.height / 2);
    const pixel = ctx.getImageData(cx, cy, 1, 1).data;

    const rgb: [number, number, number] = [pixel[0], pixel[1], pixel[2]];
    setCurrentRgb(rgb);
    findClosestRal(rgb);
  }

  function findClosestRal(rgb: [number, number, number]) {
    let minDistance = Infinity;
    let closest: RalColor = RAL_DATABASE[0];

    // Distanza Euclidea nello spazio RGB
    for (const ral of RAL_DATABASE) {
      const dist = Math.sqrt(
        Math.pow(rgb[0] - ral.rgb[0], 2) +
        Math.pow(rgb[1] - ral.rgb[1], 2) +
        Math.pow(rgb[2] - ral.rgb[2], 2)
      );

      if (dist < minDistance) {
        minDistance = dist;
        closest = ral;
      }
    }

    setMatchedRal(closest);
    setMatchDistance(minDistance);
  }

  // Seleziona colore manualmente
  function handleSelectManual(ral: RalColor) {
    setCurrentRgb(ral.rgb);
    setMatchedRal(ral);
    setMatchDistance(0); // Corrispondenza esatta
  }

  function handleConfirm() {
    if (!matchedRal) return;
    const formatted = `${matchedRal.code} (${matchedRal.nameIt})`;
    if (onSelectColor) {
      onSelectColor(formatted);
    }
    onClose();
  }

  // Accuratezza percentuale invertendo la distanza euclidea massima (sqrt(255^2 * 3) = ~441.67)
  const accuracy = Math.max(0, Math.round(100 - (matchDistance / 441.67) * 100));

  // Filtro ricerca manuale
  const filteredRal = RAL_DATABASE.filter(
    (ral) =>
      ral.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ral.nameIt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ral.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Sfondo scuro sfocato */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md animate-fade-in"
        onClick={onClose}
      />

      {/* Finestra Principale */}
      <div
        className="relative w-full max-w-lg rounded-3xl p-6 border shadow-[0_20px_60px_rgba(0,0,0,0.6)] flex flex-col gap-5 max-h-[90vh] overflow-y-auto animate-scale-in scrollbar-none"
        style={{
          background: "hsl(220 32% 10% / 0.95)",
          borderColor: "hsl(220 20% 18%)",
        }}
      >
        {/* CSS per nascondere controlli video */}
        <style dangerouslySetInnerHTML={{__html: `
          video::-webkit-media-controls { display: none !important; }
        `}} />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🎨</span>
            <div>
              <h3 className="text-white font-bold text-sm tracking-wide">Rilevatore Colore RAL</h3>
              <p className="text-[10px] text-white/40">Acquisisci da camera o inserisci a mano</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 bg-white/5 hover:bg-white/10 hover:text-white transition-all text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Switch Mode (Camera vs Manuale) */}
        <div className="flex p-0.5 rounded-xl border bg-white/5 border-white/10 flex-shrink-0">
          <button
            onClick={() => {
              setIsFrozen(false);
              setUseCamera(true);
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              useCamera ? "bg-sky-500 text-white shadow-md" : "text-white/60 hover:text-white"
            }`}
          >
            📷 Usa Fotocamera
          </button>
          <button
            onClick={() => {
              setUseCamera(false);
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              !useCamera ? "bg-sky-500 text-white shadow-md" : "text-white/60 hover:text-white"
            }`}
          >
            ✏️ Manuale / Ricerca
          </button>
        </div>

        {/* Zona Principale */}
        <div className="flex-1 flex flex-col min-h-[220px] max-h-[350px] relative overflow-hidden rounded-2xl border border-white/10">
          {useCamera ? (
            /* Vista Camera */
            <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onPlaying={() => setIsVideoPlaying(true)}
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Mirino centrale */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div
                  className={`w-9 h-9 rounded-full border-2 transition-all duration-300 flex items-center justify-center ${
                    isFrozen ? "border-emerald-400 bg-emerald-500/20" : "border-white bg-white/10"
                  }`}
                  style={{
                    boxShadow: isFrozen ? "0 0 15px hsl(142 80% 50% / 0.5)" : "0 0 10px rgba(0,0,0,0.5)",
                  }}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                </div>
              </div>

              {/* Tag di stato o blocco */}
              {isFrozen && (
                <div className="absolute top-3 left-3 bg-emerald-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                  Bloccato
                </div>
              )}
            </div>
          ) : (
            /* Vista Manuale / Ricerca */
            <div className="flex-1 flex flex-col bg-hsl(220 35% 6%) p-3 gap-2 overflow-hidden">
              {/* Campo di ricerca */}
              <input
                type="text"
                placeholder="Cerca codice o nome (es. 7016, Antracite)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs outline-none bg-white/5 border border-white/10 text-white placeholder-white/30"
              />

              {/* Elenco Colori Filtrati */}
              <div className="flex-1 overflow-y-auto space-y-1 pr-1 scrollbar-none">
                {filteredRal.length === 0 ? (
                  <p className="text-xs text-white/30 italic text-center py-10">Nessun colore trovato.</p>
                ) : (
                  filteredRal.map((ral) => (
                    <button
                      key={ral.code}
                      onClick={() => handleSelectManual(ral)}
                      className={`w-full flex items-center justify-between p-2 rounded-xl border text-left transition-all hover:bg-white/5 cursor-pointer ${
                        matchedRal?.code === ral.code ? "border-sky-500 bg-sky-500/10" : "border-white/5 bg-white/2"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Box Colore */}
                        <div
                          className="w-6 h-6 rounded-lg border border-white/15 flex-shrink-0"
                          style={{ backgroundColor: ral.hex }}
                        />
                        <div className="min-w-0">
                          <span className="block text-xs font-bold text-white leading-tight font-mono">{ral.code}</span>
                          <span className="block text-[10px] text-white/50 truncate leading-tight">{ral.nameIt}</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-white/30 font-mono pr-1">{ral.hex}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Confronto e Anteprima Match */}
        {matchedRal && (
          <div
            className="p-4 rounded-2xl flex flex-col gap-3.5 border"
            style={{
              background: "hsl(220 35% 6%)",
              borderColor: "hsl(220 20% 14%)",
            }}
          >
            <div className="flex items-center justify-between text-[10px] font-bold text-white/40 uppercase tracking-wider">
              <span>Anteprima Confronto</span>
              {useCamera && (
                <span
                  className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: accuracy > 85 ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)",
                    color: accuracy > 85 ? "rgb(52,211,153)" : "rgb(251,191,36)",
                  }}
                >
                  Accuratezza: {accuracy}%
                </span>
              )}
            </div>

            {/* Split Box */}
            <div className="grid grid-cols-2 gap-3.5">
              {/* Sinistro: Colore Rilevato */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[9px] text-white/50 text-center font-semibold">CATTURATO / REALE</span>
                <div
                  className="h-14 rounded-xl border border-white/10 flex items-center justify-center transition-all duration-300"
                  style={{
                    backgroundColor: `rgb(${currentRgb[0]}, ${currentRgb[1]}, ${currentRgb[2]})`,
                    boxShadow: "inset 0 2px 10px rgba(0,0,0,0.4)",
                  }}
                >
                  <span
                    className="text-[9px] font-bold font-mono px-2 py-0.5 rounded bg-black/60 text-white"
                  >
                    RGB: {currentRgb.join(",")}
                  </span>
                </div>
              </div>

              {/* Destro: RAL Abbinato */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[9px] text-white/50 text-center font-semibold">ABBINATO RAL CLASSIC</span>
                <div
                  className="h-14 rounded-xl border border-white/10 flex items-center justify-center relative overflow-hidden"
                  style={{
                    backgroundColor: matchedRal.hex,
                    boxShadow: "inset 0 2px 10px rgba(0,0,0,0.2)",
                  }}
                >
                  <span
                    className="text-[9px] font-bold font-mono px-2 py-0.5 rounded bg-black/60 text-white"
                  >
                    {matchedRal.hex}
                  </span>
                </div>
              </div>
            </div>

            {/* Info Testo Colore */}
            <div className="flex items-center justify-between border-t border-white/5 pt-2">
              <div>
                <span className="block text-sm font-black text-white font-mono leading-none">{matchedRal.code}</span>
                <span className="text-[11px] text-white/60 font-semibold">{matchedRal.nameIt}</span>
              </div>
              <span className="text-[10px] text-white/30 italic font-mono">{matchedRal.name}</span>
            </div>
          </div>
        )}

        {/* Pulsanti Azioni */}
        <div className="flex gap-2.5 border-t border-white/5 pt-4 flex-shrink-0">
          {useCamera && (
            <button
              onClick={() => setIsFrozen((f) => !f)}
              className="flex-1 py-3 rounded-xl text-xs font-bold border border-white/10 text-white/80 hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
            >
              {isFrozen ? "🔓 Ripristina Scanner" : "❄️ Blocca Rilevamento"}
            </button>
          )}
          <button
            onClick={handleConfirm}
            disabled={!matchedRal}
            className="flex-1 py-3 rounded-xl text-xs font-bold text-white transition-all shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer"
            style={{
              background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
              boxShadow: "0 4px 15px hsl(220 90% 56% / 0.25)",
            }}
          >
            🎨 Conferma e Usa Colore
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
