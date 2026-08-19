"use client";

import { useEffect, useImperativeHandle, useRef, useState, forwardRef, type ReactNode } from "react";
import type { SketchStroke } from "@/lib/types/database";
import { isNativeApp } from "@/lib/nativeUpdater";
import { SHEET_WIDTH, SHEET_HEIGHT, drawStroke, renderSketch } from "@/lib/sketchRender";

interface DrawingCanvasProps {
  initialStrokes: SketchStroke[];
  onSave: (strokes: SketchStroke[]) => Promise<void>;
  // Slot per un pulsante aggiuntivo nella toolbar (es. "Salva su Drive"), a cura del chiamante.
  extraToolbarActions?: ReactNode;
}

export interface DrawingCanvasHandle {
  exportPng: () => Promise<Blob | null>;
}

const COLORS = ["#111827", "#f8fafc", "#f43f5e", "#f97316", "#eab308", "#22c55e", "#0ea5e9", "#8b5cf6"];

function DrawingCanvas({ initialStrokes, onSave, extraToolbarActions }: DrawingCanvasProps, ref: React.Ref<DrawingCanvasHandle>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef<SketchStroke | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  const [strokes, setStrokes] = useState<SketchStroke[]>(initialStrokes);
  const [color, setColor] = useState("#111827");
  const [size, setSize] = useState(4);
  const [eraser, setEraser] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [lastPointerType, setLastPointerType] = useState<string | null>(null);

  // Sola lettura da telefono (app nativa installata o schermo stretto);
  // da PC/tablet con browser si legge e si disegna.
  const [readOnly, setReadOnly] = useState(false);
  useEffect(() => {
    const check = () => setReadOnly(isNativeApp() || window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const redrawAll = (allStrokes: SketchStroke[]) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    renderSketch(ctx, allStrokes);
  };

  useImperativeHandle(ref, () => ({
    exportPng: () =>
      new Promise<Blob | null>((resolve) => {
        const canvas = canvasRef.current;
        if (!canvas) { resolve(null); return; }
        canvas.toBlob((blob) => resolve(blob), "image/png");
      }),
  }));

  // Prepara il canvas alla risoluzione del dispositivo (nitido anche su schermi retina/tablet) e disegna lo stato iniziale.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = SHEET_WIDTH * dpr;
    canvas.height = SHEET_HEIGHT * dpr;
    ctx.scale(dpr, dpr);
    redrawAll(strokes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    redrawAll(strokes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes]);

  useEffect(() => {
    if (readOnly) return;
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus("saving");
    saveTimer.current = setTimeout(async () => {
      await onSave(strokes);
      setSaveStatus("saved");
    }, 600);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes, readOnly]);

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * SHEET_WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * SHEET_HEIGHT;
    // Mouse/touch senza sensore di pressione riportano 0 o 0.5: si usa un valore fisso plausibile.
    const pressure = e.pointerType === "pen" && e.pressure > 0 ? e.pressure : 0.5;
    return { x, y, pressure };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (readOnly) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setLastPointerType(e.pointerType);
    const point = getPoint(e);
    drawingRef.current = { color: eraser ? "#ffffff" : color, size: eraser ? size * 3 : size, eraser, points: [point] };
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) drawStroke(ctx, drawingRef.current);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (readOnly || !drawingRef.current) return;
    const point = getPoint(e);
    drawingRef.current.points.push(point);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pts = drawingRef.current.points;
    const segment: SketchStroke = { ...drawingRef.current, points: pts.slice(-2) };
    if (segment.points.length === 2) drawStroke(ctx, segment);
  };

  const commitStroke = () => {
    if (!drawingRef.current) return;
    const finished = drawingRef.current;
    drawingRef.current = null;
    setStrokes((prev) => [...prev, finished]);
  };

  const handleUndo = () => {
    if (strokes.length === 0) return;
    setStrokes((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (strokes.length === 0) return;
    if (!confirm("Cancellare tutto il disegno?")) return;
    setStrokes([]);
  };

  return (
    <div className="space-y-3">
      {readOnly ? (
        <p className="text-[10px] text-zinc-500">
          👁️ Sola lettura da telefono: apri il progetto da PC per disegnare e sfruttare la tavoletta grafica.
        </p>
      ) : (
        <div className="flex items-center gap-1.5 flex-wrap p-2 rounded-xl border border-zinc-800 bg-zinc-950/60">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => { setColor(c); setEraser(false); }}
              className={`w-6 h-6 rounded-full border-2 transition-all flex-shrink-0 ${!eraser && color === c ? "border-indigo-400 scale-110" : "border-zinc-700"}`}
              style={{ background: c }}
              title="Colore"
            />
          ))}
          <label className="relative w-6 h-6 rounded-full border-2 border-zinc-700 flex-shrink-0 cursor-pointer overflow-hidden" title="Colore personalizzato"
            style={{ background: "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }}>
            <input type="color" value={color} onChange={(e) => { setColor(e.target.value); setEraser(false); }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          </label>

          <div className="w-px h-5 bg-zinc-800 mx-1" />

          <button type="button" onClick={() => setEraser((v) => !v)}
            className={`px-2.5 h-7 rounded-lg text-[10px] font-bold transition-all ${eraser ? "bg-white/15 text-white" : "text-zinc-400 hover:text-white hover:bg-white/10"}`}>
            🧹 Gomma
          </button>

          <div className="flex items-center gap-1.5 px-2">
            <span className="text-[10px] text-zinc-500">Spessore</span>
            <input type="range" min={1} max={24} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-20 accent-indigo-500" />
          </div>

          <div className="w-px h-5 bg-zinc-800 mx-1" />

          <button type="button" onClick={handleUndo} disabled={strokes.length === 0}
            className="px-2.5 h-7 rounded-lg text-[10px] font-bold text-zinc-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30">
            ↩️ Annulla
          </button>
          <button type="button" onClick={handleClear} disabled={strokes.length === 0}
            className="px-2.5 h-7 rounded-lg text-[10px] font-bold text-rose-300 hover:bg-rose-500/10 transition-all disabled:opacity-30">
            🗑️ Cancella tutto
          </button>

          {extraToolbarActions && (
            <>
              <div className="w-px h-5 bg-zinc-800 mx-1" />
              {extraToolbarActions}
            </>
          )}

          <span className="ml-auto flex items-center gap-2 text-[10px] text-zinc-500 pr-1">
            {lastPointerType === "pen" && <span className="text-emerald-400">🖊️ Tavoletta rilevata (pressione attiva)</span>}
            {saveStatus === "saving" ? "Salvataggio…" : saveStatus === "saved" ? "Salvato ✓" : ""}
          </span>
        </div>
      )}

      <div className="rounded-xl overflow-hidden border border-zinc-800 bg-white" style={{ aspectRatio: `${SHEET_WIDTH} / ${SHEET_HEIGHT}` }}>
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={commitStroke}
          onPointerLeave={commitStroke}
          onPointerCancel={commitStroke}
          onContextMenu={(e) => e.preventDefault()}
          className={`w-full h-full block ${readOnly ? "" : "touch-none cursor-crosshair"}`}
        />
      </div>
    </div>
  );
}

export default forwardRef(DrawingCanvas);
