"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface PhotoQuotaEditorProps {
  imageUrl: string; // Immagine Base64 o URL
  onSave: (newImageUrl: string) => void;
  onClose: () => void;
}

interface QuotaLine {
  id: string;
  startX: number; // coordinate relative alla risoluzione nativa dell'immagine
  startY: number;
  endX: number;
  endY: number;
  axis: "x" | "y" | "z" | "neutral";
  valueText: string;
}

const AXIS_COLORS = {
  x: "hsl(0, 100%, 50%)",       // Rosso
  y: "hsl(120, 100%, 40%)",      // Verde
  z: "hsl(220, 100%, 55%)",      // Blu
  neutral: "hsl(45, 100%, 50%)", // Giallo
};

const AXIS_LABELS = {
  x: "Asse X (Rosso)",
  y: "Asse Y (Verde)",
  z: "Asse Z (Blu)",
  neutral: "Libera (Giallo)",
};

// Funzione helper per disegnare un segmento di quota completo di frecce e testo
function drawSingleLine(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  color: string,
  text: string,
  isDraft = false
) {
  ctx.save();

  // Spessore proporzionale alle dimensioni dell'immagine
  const baseDimension = Math.max(ctx.canvas.width, ctx.canvas.height);
  const lineWidth = Math.max(2, baseDimension * 0.005);
  const tickSize = Math.max(6, baseDimension * 0.015);
  const fontSize = Math.max(12, baseDimension * 0.022);

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";

  // 1. Disegna la linea principale
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // 2. Disegna i trattini obliqui tipici delle quote alle estremità (a 45°)
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const drawTick = (x: number, y: number) => {
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(angle + Math.PI/4) * tickSize, y - Math.sin(angle + Math.PI/4) * tickSize);
    ctx.lineTo(x + Math.cos(angle + Math.PI/4) * tickSize, y + Math.sin(angle + Math.PI/4) * tickSize);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth * 1.5;
    ctx.stroke();
  };

  drawTick(x1, y1);
  drawTick(x2, y2);

  // 3. Disegna il valore della quota al centro
  if (text && !isDraft) {
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const textWidth = ctx.measureText(text).width;
    const paddingX = fontSize * 0.5;
    const paddingY = fontSize * 0.3;

    // Disegna rettangolo di sfondo scuro ad alto contrasto
    ctx.fillStyle = "rgba(10, 15, 30, 0.85)";
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, lineWidth * 0.4);
    
    ctx.beginPath();
    ctx.roundRect(
      midX - textWidth/2 - paddingX,
      midY - fontSize/2 - paddingY,
      textWidth + paddingX * 2,
      fontSize + paddingY * 2,
      4
    );
    ctx.fill();
    ctx.stroke();

    // Scrivi il testo
    ctx.fillStyle = "white";
    ctx.fillText(text, midX, midY);
  }

  ctx.restore();
}

export default function PhotoQuotaEditor({ imageUrl, onSave, onClose }: PhotoQuotaEditorProps) {
  const [lines, setLines] = useState<QuotaLine[]>([]);
  const [currentAxis, setCurrentAxis] = useState<"x" | "y" | "z" | "neutral">("neutral");
  
  // Stati di disegno
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPt, setStartPt] = useState<{ x: number; y: number } | null>(null);
  const [currentPt, setCurrentPt] = useState<{ x: number; y: number } | null>(null);
  
  // Stato per l'inserimento della quota numerica
  const [showPrompt, setShowPrompt] = useState(false);
  const [pendingLine, setPendingLine] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Forza il focus e la selezione dell'input all'apertura per inserimento rapido da tastiera
  useEffect(() => {
    if (showPrompt) {
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [showPrompt]);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Ridisegna tutto sul canvas
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Imposta la dimensione del canvas interna pari alla dimensione reale dell'immagine
    canvas.width = img.width;
    canvas.height = img.height;

    // Cancella e disegna lo sfondo
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    // Disegna tutte le linee salvate
    lines.forEach((line) => {
      drawSingleLine(ctx, line.startX, line.startY, line.endX, line.endY, AXIS_COLORS[line.axis], line.valueText);
    });

    // Disegna la linea che si sta tracciando in tempo reale
    if (isDrawing && startPt && currentPt) {
      // Se premiamo un asse specifico, vincoliamo la linea ad essere ortogonale
      let endX = currentPt.x;
      let endY = currentPt.y;
      
      if (currentAxis === "x") {
        endY = startPt.y; // Forza orizzontale
      } else if (currentAxis === "y") {
        endX = startPt.x; // Forza verticale
      } else if (currentAxis === "z") {
        // Linea inclinata prospettica a 45 gradi
        const dx = currentPt.x - startPt.x;
        endY = startPt.y + (dx * 0.5); // Rapporto fisso per profondità
      }

      drawSingleLine(ctx, startPt.x, startPt.y, endX, endY, AXIS_COLORS[currentAxis], "", true);
    }
  }, [lines, isDrawing, startPt, currentPt, currentAxis]);

  // Caricamento dell'immagine
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      redraw();
    };
    img.src = imageUrl;
  }, [imageUrl, redraw]);

  // Ridimensionamento e ridisegno quando cambiano le linee o lo stato del disegno
  useEffect(() => {
    redraw();
  }, [redraw]);



  // Converte le coordinate dello schermo/touch in coordinate reali dell'immagine
  function getCanvasCoords(clientX: number, clientY: number): { x: number; y: number } | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    
    // Percentuale all'interno del rettangolo visualizzato
    const pctX = (clientX - rect.left) / rect.width;
    const pctY = (clientY - rect.top) / rect.height;

    // Mappato sulle dimensioni pixel reali dell'immagine
    return {
      x: Math.round(pctX * canvas.width),
      y: Math.round(pctY * canvas.height),
    };
  }

  // --- Gestione Eventi Touch / Mouse ---
  function handleStart(clientX: number, clientY: number) {
    if (showPrompt) return;
    const coords = getCanvasCoords(clientX, clientY);
    if (!coords) return;

    setIsDrawing(true);
    setStartPt(coords);
    setCurrentPt(coords);
  }

  function handleMove(clientX: number, clientY: number) {
    if (!isDrawing) return;
    const coords = getCanvasCoords(clientX, clientY);
    if (!coords) return;
    setCurrentPt(coords);
  }

  function handleEnd() {
    if (!isDrawing || !startPt || !currentPt) return;

    setIsDrawing(false);

    // Calcola il punto finale vincolato dall'asse
    let endX = currentPt.x;
    let endY = currentPt.y;

    if (currentAxis === "x") {
      endY = startPt.y;
    } else if (currentAxis === "y") {
      endX = startPt.x;
    } else if (currentAxis === "z") {
      const dx = currentPt.x - startPt.x;
      endY = startPt.y + (dx * 0.5);
    }

    // Ignora tocchi/click accidentali (troppo corti)
    const dist = Math.hypot(endX - startPt.x, endY - startPt.y);
    if (dist < 10) {
      setStartPt(null);
      setCurrentPt(null);
      return;
    }

    // Mostra il prompt per inserire la misura
    setPendingLine({
      startX: startPt.x,
      startY: startPt.y,
      endX,
      endY,
    });
    setInputValue("");
    setShowPrompt(true);

    // Mette il focus sull'input appena renderizzato
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);

    setStartPt(null);
    setCurrentPt(null);
  }

  // Salva la singola quota nell'array
  function savePendingQuota() {
    if (!pendingLine || !inputValue.trim()) {
      cancelPendingQuota();
      return;
    }

    const newLine: QuotaLine = {
      id: crypto.randomUUID(),
      ...pendingLine,
      axis: currentAxis,
      valueText: inputValue.trim(),
    };

    setLines((prev) => [...prev, newLine]);
    setPendingLine(null);
    setShowPrompt(false);
  }

  function cancelPendingQuota() {
    setPendingLine(null);
    setShowPrompt(false);
  }

  // Rimuove l'ultima linea tracciata (Undo)
  function handleUndo() {
    setLines((prev) => prev.slice(0, -1));
  }

  // Fonde il disegno del canvas sull'immagine originale e salva come base64 compresso
  function handleSaveFinal() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Genera l'immagine JPEG unita al 75% di qualità per ridurne il peso
    const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
    onSave(dataUrl);
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-between p-4"
      style={{ background: "rgba(10, 15, 30, 0.95)", backdropFilter: "blur(8px)" }}
    >
      {/* Intestazione */}
      <div className="w-full max-w-4xl flex items-center justify-between py-2 border-b border-white/10">
        <div>
          <h3 className="text-base font-bold text-white">📐 Disegna Quote su Foto</h3>
          <p className="text-xs text-white/50">Trascina il dito/cursore per tracciare una quota</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white/70 hover:bg-white/10 transition-colors"
        >
          Annulla
        </button>
      </div>

      {/* Area Canvas centrale */}
      <div
        ref={containerRef}
        className="flex-1 w-full max-w-4xl flex items-center justify-center overflow-hidden my-4 relative"
      >
        <canvas
          ref={canvasRef}
          onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
          onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
          onMouseUp={handleEnd}
          onTouchStart={(e) => {
            const t = e.touches[0];
            handleStart(t.clientX, t.clientY);
          }}
          onTouchMove={(e) => {
            const t = e.touches[0];
            handleMove(t.clientX, t.clientY);
          }}
          onTouchEnd={handleEnd}
          className="max-w-full max-h-[60vh] object-contain rounded-xl touch-none shadow-2xl cursor-crosshair border border-white/5 bg-black/40"
        />

        {/* Prompt modale inserimento quota integrato sopra il Canvas */}
        {showPrompt && (
          <div
            className="absolute p-4 rounded-2xl shadow-2xl w-72 border flex flex-col gap-3 animate-fade-in"
            style={{
              background: "hsl(220, 26%, 14%)",
              borderColor: "hsl(220, 20%, 24%)",
              boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
            }}
          >
            <label className="text-xs font-bold text-white/80">
              Inserisci la misura (es. 120 cm):
            </label>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                autoFocus
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") savePendingQuota();
                  if (e.key === "Escape") cancelPendingQuota();
                }}
                placeholder="Valore quota..."
                className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
                style={{
                  background: "hsl(220, 32%, 10%)",
                  border: "1px solid hsl(220, 20%, 22%)",
                  color: "white",
                }}
              />
            </div>
            <div className="flex justify-end gap-2 text-xs font-semibold">
              <button
                type="button"
                onClick={cancelPendingQuota}
                className="px-3 py-2 rounded-lg text-white/50 hover:bg-white/5 transition-all"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={savePendingQuota}
                className="px-4 py-2 rounded-lg text-white transition-all"
                style={{
                  background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
                }}
              >
                Conferma
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pannello Controlli e Assi in fondo */}
      <div className="w-full max-w-4xl bg-white/5 border border-white/10 rounded-2xl p-4 space-y-4">
        {/* Scelta Asse / Direzione */}
        <div>
          <label className="block text-xs font-semibold text-white/50 mb-2">
            Seleziona asse di riferimento per la quota:
          </label>
          <div className="grid grid-cols-4 gap-2">
            {(Object.keys(AXIS_LABELS) as Array<keyof typeof AXIS_LABELS>).map((axis) => {
              const isSelected = currentAxis === axis;
              const color = AXIS_COLORS[axis];
              return (
                <button
                  key={axis}
                  type="button"
                  onClick={() => setCurrentAxis(axis)}
                  className="py-2.5 px-1 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1.5 border"
                  style={{
                    background: isSelected ? `${color}15` : "transparent",
                    borderColor: isSelected ? color : "transparent",
                    color: isSelected ? "white" : "white/60",
                  }}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                    style={{ background: color, boxShadow: isSelected ? `0 0 8px ${color}` : "none" }}
                  />
                  <span className="text-[10px] text-center">{AXIS_LABELS[axis]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Azioni finali */}
        <div className="flex items-center justify-between border-t border-white/10 pt-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleUndo}
              disabled={lines.length === 0}
              className="px-3 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-40"
              style={{
                background: "hsl(220, 26%, 16%)",
                border: "1px solid hsl(220, 20%, 24%)",
                color: "white",
              }}
            >
              ↩ Annulla Ultimo
            </button>
            <button
              type="button"
              onClick={() => setLines([])}
              disabled={lines.length === 0}
              className="px-3 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-40"
              style={{
                background: "hsl(0, 60%, 20% / 0.3)",
                border: "1px solid hsl(0, 60% / 0.15)",
                color: "hsl(0, 70%, 75%)",
              }}
            >
              🗑️ Resetta
            </button>
          </div>

          <button
            type="button"
            onClick={handleSaveFinal}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-lg"
            style={{
              background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
              boxShadow: "0 4px 15px hsl(220 90% 56% / 0.25)",
            }}
          >
            ✓ Salva Immagine Quotata
          </button>
        </div>
      </div>
    </div>
  );
}
