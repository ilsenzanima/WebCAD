"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface FreehandSketchEditorProps {
  imageUrl?: string | null; // Foto di sfondo opzionale
  onSave: (newImageUrl: string) => void;
  onClose: () => void;
}

const LOGICAL_WIDTH = 1200;
const LOGICAL_HEIGHT = 1200;

const COLORS = [
  "#ffffff", // Bianco
  "#000000", // Nero
  "#ef4444", // Rosso
  "#22c55e", // Verde
  "#3b82f6", // Blu
  "#eab308", // Giallo
  "#f97316", // Arancione
  "#a855f7", // Viola
];

export default function FreehandSketchEditor({ imageUrl, onSave, onClose }: FreehandSketchEditorProps) {
  const [tool, setTool] = useState<"pen" | "line" | "rect" | "circle" | "eraser">("pen");
  const [color, setColor] = useState(imageUrl ? "#ef4444" : "#000000"); // Rosso su foto, nero su bianco per default
  const [brushSize, setBrushSize] = useState(4);
  const [undoStack, setUndoStack] = useState<string[]>([]); // Stack di Base64 della sola drawing layer

  const [isDrawing, setIsDrawing] = useState(false);
  const [startPt, setStartPt] = useState<{ x: number; y: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement>(null);
  const bgImgRef = useRef<HTMLImageElement | null>(null);

  // Inizializza i canvas alla risoluzione logica
  useEffect(() => {
    const bgCanvas = bgCanvasRef.current;
    const drawingCanvas = drawingCanvasRef.current;
    const tempCanvas = tempCanvasRef.current;

    if (!bgCanvas || !drawingCanvas || !tempCanvas) return;

    bgCanvas.width = LOGICAL_WIDTH;
    bgCanvas.height = LOGICAL_HEIGHT;
    drawingCanvas.width = LOGICAL_WIDTH;
    drawingCanvas.height = LOGICAL_HEIGHT;
    tempCanvas.width = LOGICAL_WIDTH;
    tempCanvas.height = LOGICAL_HEIGHT;

    const bgCtx = bgCanvas.getContext("2d");
    if (bgCtx) {
      if (imageUrl) {
        // Carica foto di sfondo
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          bgImgRef.current = img;
          bgCtx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
          // Disegna l'immagine centrandola o riempiendo mantenendo le proporzioni
          const scale = Math.min(LOGICAL_WIDTH / img.width, LOGICAL_HEIGHT / img.height);
          const x = (LOGICAL_WIDTH - img.width * scale) / 2;
          const y = (LOGICAL_HEIGHT - img.height * scale) / 2;
          bgCtx.fillStyle = "#1e293b"; // Sfondo scuro per i bordi vuoti
          bgCtx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
          bgCtx.drawImage(img, x, y, img.width * scale, img.height * scale);
        };
        img.src = imageUrl;
      } else {
        // Disegna griglia millimetrata tecnica
        bgCtx.fillStyle = "#ffffff";
        bgCtx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

        // Griglia millimetrata fine
        bgCtx.strokeStyle = "#f1f5f9";
        bgCtx.lineWidth = 1;
        for (let i = 0; i < LOGICAL_WIDTH; i += 20) {
          bgCtx.beginPath(); bgCtx.moveTo(i, 0); bgCtx.lineTo(i, LOGICAL_HEIGHT); bgCtx.stroke();
        }
        for (let j = 0; j < LOGICAL_HEIGHT; j += 20) {
          bgCtx.beginPath(); bgCtx.moveTo(0, j); bgCtx.lineTo(LOGICAL_WIDTH, j); bgCtx.stroke();
        }

        // Griglia millimetrata spessa ogni 100px
        bgCtx.strokeStyle = "#cbd5e1";
        bgCtx.lineWidth = 1.5;
        for (let i = 0; i < LOGICAL_WIDTH; i += 100) {
          bgCtx.beginPath(); bgCtx.moveTo(i, 0); bgCtx.lineTo(i, LOGICAL_HEIGHT); bgCtx.stroke();
        }
        for (let j = 0; j < LOGICAL_HEIGHT; j += 100) {
          bgCtx.beginPath(); bgCtx.moveTo(0, j); bgCtx.lineTo(LOGICAL_WIDTH, j); bgCtx.stroke();
        }
      }
    }

    // Pulisce il canvas di disegno
    const drawCtx = drawingCanvas.getContext("2d");
    if (drawCtx) {
      drawCtx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      // Salva lo stato iniziale (vuoto) nello stack di undo
      setUndoStack([drawingCanvas.toDataURL()]);
    }
  }, [imageUrl]);

  // Converte le coordinate dell'evento in coordinate logiche 1200x1200
  const getLogicalCoords = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const pctX = (clientX - rect.left) / rect.width;
    const pctY = (clientY - rect.top) / rect.height;

    return {
      x: Math.round(pctX * LOGICAL_WIDTH),
      y: Math.round(pctY * LOGICAL_HEIGHT),
    };
  }, []);

  // Gestione dell'inizio disegno
  const handleStart = (clientX: number, clientY: number) => {
    const coords = getLogicalCoords(clientX, clientY);
    if (!coords) return;

    setIsDrawing(true);
    setStartPt(coords);

    const drawCtx = drawingCanvasRef.current?.getContext("2d");
    if (drawCtx && tool === "pen") {
      drawCtx.beginPath();
      drawCtx.moveTo(coords.x, coords.y);
      drawCtx.strokeStyle = color;
      drawCtx.lineWidth = brushSize;
      drawCtx.lineCap = "round";
      drawCtx.lineJoin = "round";
      drawCtx.globalCompositeOperation = "source-over";
    } else if (drawCtx && tool === "eraser") {
      drawCtx.beginPath();
      drawCtx.moveTo(coords.x, coords.y);
      drawCtx.strokeStyle = "rgba(0,0,0,1)"; // Qualsiasi colore va bene per destination-out
      drawCtx.lineWidth = brushSize * 4; // Gomma più spessa
      drawCtx.lineCap = "round";
      drawCtx.lineJoin = "round";
      drawCtx.globalCompositeOperation = "destination-out";
    }
  };

  // Gestione del disegno in tempo reale (Move)
  const handleMove = (clientX: number, clientY: number) => {
    if (!isDrawing || !startPt) return;

    const coords = getLogicalCoords(clientX, clientY);
    if (!coords) return;

    const drawCanvas = drawingCanvasRef.current;
    const tempCanvas = tempCanvasRef.current;
    const drawCtx = drawCanvas?.getContext("2d");
    const tempCtx = tempCanvas?.getContext("2d");

    if (!drawCanvas || !tempCanvas || !drawCtx || !tempCtx) return;

    // Se stiamo usando la penna o la gomma, disegnamo direttamente sul canvas effettivo
    if (tool === "pen" || tool === "eraser") {
      drawCtx.lineTo(coords.x, coords.y);
      drawCtx.stroke();
    } 
    // Altrimenti stiamo disegnando forme geometriche (linea, rettangolo, cerchio) -> usiamo l'overlay temporaneo
    else {
      tempCtx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      tempCtx.strokeStyle = color;
      tempCtx.lineWidth = brushSize;
      tempCtx.lineCap = "round";
      tempCtx.lineJoin = "round";

      if (tool === "line") {
        tempCtx.beginPath();
        tempCtx.moveTo(startPt.x, startPt.y);
        tempCtx.lineTo(coords.x, coords.y);
        tempCtx.stroke();
      } else if (tool === "rect") {
        const x = Math.min(startPt.x, coords.x);
        const y = Math.min(startPt.y, coords.y);
        const w = Math.abs(startPt.x - coords.x);
        const h = Math.abs(startPt.y - coords.y);
        tempCtx.beginPath();
        tempCtx.rect(x, y, w, h);
        tempCtx.stroke();
      } else if (tool === "circle") {
        const radius = Math.hypot(coords.x - startPt.x, coords.y - startPt.y);
        tempCtx.beginPath();
        tempCtx.arc(startPt.x, startPt.y, radius, 0, 2 * Math.PI);
        tempCtx.stroke();
      }
    }
  };

  // Fine disegno (Up)
  const handleEnd = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const drawCanvas = drawingCanvasRef.current;
    const tempCanvas = tempCanvasRef.current;
    const drawCtx = drawCanvas?.getContext("2d");
    const tempCtx = tempCanvas?.getContext("2d");

    if (!drawCanvas || !tempCanvas || !drawCtx || !tempCtx) return;

    // Se c'erano geometrie nel canvas temporaneo, le fondiamo in quello effettivo
    if (tool !== "pen" && tool !== "eraser") {
      drawCtx.globalCompositeOperation = "source-over";
      drawCtx.drawImage(tempCanvas, 0, 0);
      tempCtx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    }

    // Salva il nuovo stato nello stack di undo
    const newState = drawCanvas.toDataURL();
    setUndoStack((prev) => [...prev, newState]);
    setStartPt(null);
  };

  // Annulla ultimo tratto (Undo)
  const handleUndo = () => {
    if (undoStack.length <= 1) return; // Non rimuovere lo stato vuoto iniziale

    const previousStates = undoStack.slice(0, -1);
    const prevStateDataUrl = previousStates[previousStates.length - 1];

    const canvas = drawingCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      ctx.drawImage(img, 0, 0);
      setUndoStack(previousStates);
    };
    img.src = prevStateDataUrl;
  };

  // Pulisce tutto il disegno
  const handleClear = () => {
    if (window.confirm("Sei sicuro di voler cancellare l'intero disegno?")) {
      const canvas = drawingCanvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;

      ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      const clearedState = canvas.toDataURL();
      setUndoStack((prev) => [...prev, clearedState]);
    }
  };

  // Salva l'immagine finale fondendo sfondo e disegno
  const handleSave = () => {
    const bgCanvas = bgCanvasRef.current;
    const drawingCanvas = drawingCanvasRef.current;

    if (!bgCanvas || !drawingCanvas) return;

    // Crea un canvas di fusione temporaneo
    const mergeCanvas = document.createElement("canvas");
    mergeCanvas.width = LOGICAL_WIDTH;
    mergeCanvas.height = LOGICAL_HEIGHT;
    const mergeCtx = mergeCanvas.getContext("2d");

    if (!mergeCtx) return;

    // 1. Disegna lo sfondo (foto o griglia)
    mergeCtx.drawImage(bgCanvas, 0, 0);
    // 2. Disegna sopra le annotazioni trasparenti
    mergeCtx.drawImage(drawingCanvas, 0, 0);

    // Esporta come JPEG compresso al 75% per ottimizzare il salvataggio offline/Supabase
    const finalDataUrl = mergeCanvas.toDataURL("image/jpeg", 0.75);
    onSave(finalDataUrl);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-between p-4"
      style={{ background: "rgba(10, 15, 30, 0.96)", backdropFilter: "blur(10px)" }}
    >
      {/* Header dell'Editor */}
      <div className="w-full max-w-4xl flex items-center justify-between py-2 border-b border-white/10">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span>🎨</span> {imageUrl ? "Disegna su Foto a Mano Libera" : "Lavagna Sketch Tecnica"}
          </h3>
          <p className="text-xs text-white/50">Disegna linee, cerchi, rettangoli e note a mano libera</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white/70 hover:bg-white/10 transition-colors"
        >
          Annulla
        </button>
      </div>

      {/* Area dei Canvas sovrapposti */}
      <div
        ref={containerRef}
        className="flex-1 w-full max-w-4xl flex items-center justify-center overflow-hidden my-4 relative"
      >
        <div className="relative w-full max-w-full max-h-[60vh] aspect-square rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-black/40">
          {/* 1. Sfondo (Griglia o Foto) */}
          <canvas
            ref={bgCanvasRef}
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          />
          {/* 2. Layer di disegno effettivo (Trasparente) */}
          <canvas
            ref={drawingCanvasRef}
            onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
            onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={(e) => {
              const t = e.touches[0];
              handleStart(t.clientX, t.clientY);
            }}
            onTouchMove={(e) => {
              const t = e.touches[0];
              handleMove(t.clientX, t.clientY);
            }}
            onTouchEnd={handleEnd}
            className="absolute inset-0 w-full h-full object-contain touch-none cursor-crosshair z-10"
          />
          {/* 3. Layer temporaneo per preview geometrie */}
          <canvas
            ref={tempCanvasRef}
            className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20"
          />
        </div>
      </div>

      {/* Barra degli Strumenti in basso */}
      <div className="w-full max-w-4xl bg-white/5 border border-white/10 rounded-2xl p-4 space-y-4 shadow-xl">
        {/* Selettore Strumenti e Spessore */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Bottoni Strumento */}
          <div className="flex flex-wrap items-center gap-1.5 bg-black/25 p-1 rounded-xl border border-white/5 self-start">
            <button
              type="button"
              onClick={() => setTool("pen")}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                tool === "pen" ? "bg-amber-500 text-white" : "text-white/60 hover:bg-white/5"
              }`}
            >
              <span>✏️</span> Penna
            </button>
            <button
              type="button"
              onClick={() => setTool("line")}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                tool === "line" ? "bg-amber-500 text-white" : "text-white/60 hover:bg-white/5"
              }`}
            >
              <span>📏</span> Linea
            </button>
            <button
              type="button"
              onClick={() => setTool("rect")}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                tool === "rect" ? "bg-amber-500 text-white" : "text-white/60 hover:bg-white/5"
              }`}
            >
              <span>◻️</span> Rettangolo
            </button>
            <button
              type="button"
              onClick={() => setTool("circle")}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                tool === "circle" ? "bg-amber-500 text-white" : "text-white/60 hover:bg-white/5"
              }`}
            >
              <span>◯</span> Cerchio
            </button>
            <button
              type="button"
              onClick={() => setTool("eraser")}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                tool === "eraser" ? "bg-amber-500 text-white" : "text-white/60 hover:bg-white/5"
              }`}
            >
              <span>🧽</span> Gomma
            </button>
          </div>

          {/* Slider spessore pennello */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-white/50 font-semibold uppercase tracking-wider">Spessore:</span>
            <input
              type="range"
              min="1"
              max="24"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              className="w-28 md:w-36 accent-amber-500"
            />
            <span className="text-xs font-bold text-white/80 w-6 text-right">{brushSize}px</span>
          </div>
        </div>

        {/* Palette Colori */}
        {tool !== "eraser" && (
          <div className="flex items-center gap-3 border-t border-white/5 pt-3">
            <span className="text-[10px] text-white/50 font-semibold uppercase tracking-wider">Colore:</span>
            <div className="flex items-center gap-2 flex-wrap">
              {COLORS.map((c) => {
                const isSelected = color === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="w-7 h-7 rounded-full border transition-all active:scale-90 flex items-center justify-center cursor-pointer"
                    style={{
                      backgroundColor: c,
                      borderColor: isSelected ? "white" : "transparent",
                      boxShadow: isSelected
                        ? `0 0 10px ${c === "#ffffff" ? "rgba(255,255,255,0.8)" : c}`
                        : "none",
                      borderWidth: isSelected ? "2px" : "1px",
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Pulsanti di Azione Finale */}
        <div className="flex items-center justify-between border-t border-white/10 pt-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleUndo}
              disabled={undoStack.length <= 1}
              className="px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
              style={{
                background: "hsl(220, 26%, 16%)",
                border: "1px solid hsl(220, 20%, 24%)",
                color: "white",
              }}
            >
              ↩ Annulla
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
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
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-lg cursor-pointer"
            style={{
              background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
              boxShadow: "0 4px 15px hsl(220 90% 56% / 0.25)",
            }}
          >
            ✓ Salva Disegno
          </button>
        </div>
      </div>
    </div>
  );
}
