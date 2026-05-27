"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Stage, Layer, Line, Circle, Rect, Text, Arc } from "react-konva";
import Link from "next/link";
import { useCanvasStore, PIXELS_TO_MM, calculateStructuralPoints, type Wall } from "@/lib/stores/canvas-store";
import { useProjectStore } from "@/lib/stores/project-store";
import type { KonvaEventObject } from "konva/lib/Node";
import DrawingNotesSidebar from "./DrawingNotesSidebar";
import { saveWalls, getWalls } from "@/app/actions/projects";

// Snap a 20px (corrisponde a 200mm reali in scala 1px = 10mm)
const GRID_SIZE = 20;
const SNAP_DISTANCE_PX = 15;
const snapToGrid = (val: number) => Math.round(val / GRID_SIZE) * GRID_SIZE;

export default function CanvasWorkspace() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  
  // Stato globale Zustand
  const {
    stageX,
    stageY,
    scale,
    activeTool,
    selectedWallId,
    walls,
    drawingStartPoint,
    drawingEndPoint,
    hasUnsavedChanges,
    setStagePosition,
    setScale,
    setActiveTool,
    setSelectedWallId,
    addWall,
    updateWall,
    deleteWall,
    setDrawingStartPoint,
    setDrawingEndPoint,
    loadCanvasData,
    setHasUnsavedChanges
  } = useCanvasStore();

  const { activeLevelId, activeProjectId, levels } = useProjectStore();

  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [lengthInput, setLengthInput] = useState("");
  const [selectedOpening, setSelectedOpening] = useState<{ wallId: string; openingId: string } | null>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [offsetDirection, setOffsetDirection] = useState<Record<string, "start" | "end">>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") setIsShiftPressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") setIsShiftPressed(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // 1. Carica le pareti del disegno dal database all'avvio o al cambio livello
  useEffect(() => {
    if (!activeLevelId) return;

    startTransition(async () => {
      // Carica pareti
      const loadedWalls = await getWalls(activeLevelId);
      loadCanvasData(
        loadedWalls.map((w: any) => ({
          ...w,
          structuralPoints: calculateStructuralPoints(w.x1, w.y1, w.x2, w.y2, w.pitch)
        }))
      );
    });
  }, [activeLevelId, activeProjectId, levels, loadCanvasData]);


  
  useEffect(() => {
    const loadMaterials = async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data } = await supabase.from("materials").select("id,name,category,thickness_mm").eq("is_active", true);
      setMaterials(data ?? []);
    };
    loadMaterials();
  }, []);

  const studMaterials = useMemo(() => {
    return materials.filter((m) =>
      m.category?.toLowerCase().includes("profilo") ||
      m.name?.toLowerCase().includes("montante") ||
      m.name?.toLowerCase().includes("profilo") ||
      m.name?.toLowerCase().includes("stud")
    );
  }, [materials]);

  const plateMaterials = useMemo(() => {
    return materials.filter((m) =>
      m.category?.toLowerCase().includes("lastra") ||
      m.name?.toLowerCase().includes("lastra") ||
      m.name?.toLowerCase().includes("silicato") ||
      m.name?.toLowerCase().includes("cartongesso") ||
      m.name?.toLowerCase().includes("promat")
    );
  }, [materials]);

// Salva le modifiche su Supabase
  const handleSaveToDatabase = () => {
    if (!activeLevelId || !activeProjectId) return;
    startTransition(async () => {
      const res = await saveWalls(activeLevelId, activeProjectId, walls);
      if (res.success) {
        setHasUnsavedChanges(false);
        alert("Disegno salvato con successo nel database! ✓");
      } else {
        alert("Errore durante il salvataggio.");
      }
    });
  };

  // Update costanti delle dimensioni basate sul resize del div parent
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Zoom tramite rotellina del mouse
  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const scaleBy = 1.1;
    const stage = e.target.getStage();
    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
    const clampedScale = Math.max(0.2, Math.min(newScale, 5));

    setScale(clampedScale);
    setStagePosition(
      pointer.x - mousePointTo.x * clampedScale,
      pointer.y - mousePointTo.y * clampedScale
    );
  };

  const handleCreateWall = (x1: number, y1: number, x2: number, y2: number) => {
    const TOLERANCE_PX = 2;
    
    const extWall = walls.find(w => {
      const startsAtStart = Math.hypot(w.x1 - x1, w.y1 - y1) < TOLERANCE_PX;
      const startsAtEnd = Math.hypot(w.x2 - x1, w.y2 - y1) < TOLERANCE_PX;
      return startsAtStart || startsAtEnd;
    });

    if (extWall) {
      const dx1 = extWall.x2 - extWall.x1;
      const dy1 = extWall.y2 - extWall.y1;
      const angle1 = Math.atan2(dy1, dx1);
      
      const dx2 = x2 - x1;
      const dy2 = y2 - y1;
      const angle2 = Math.atan2(dy2, dx2);
      
      let diff = Math.abs(angle1 - angle2);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;
      
      const isCollinear = diff < 0.1 || Math.abs(diff - Math.PI) < 0.1;
      
      if (isCollinear) {
        const confirmMerge = window.confirm("Vuoi unire questa parete a quella esistente per formarne una sola continua?");
        if (confirmMerge) {
          const startsAtEnd = Math.hypot(extWall.x2 - x1, extWall.y2 - y1) < TOLERANCE_PX;
          if (startsAtEnd) {
            updateWall(extWall.id, { x2, y2 });
          } else {
            updateWall(extWall.id, { x1: x2, y1: y2 });
          }
          return { fused: true, endPoint: { x: x2, y: y2 } };
        }
      }
    }

    addWall({
      id: `wall_${Date.now()}`,
      x1,
      y1,
      x2,
      y2,
      thickness: 100,
      height: 2700,
      pitch: 600,
      openings: []
    });
    
    return { fused: false, endPoint: { x: x2, y: y2 } };
  };

  // Interazioni di disegno click sullo stage
  const getSnapPoint = (x:number,y:number) => {
    let best = { x: snapToGrid(x), y: snapToGrid(y) };
    let min = Infinity;
    walls.forEach((w) => {
      [{x:w.x1,y:w.y1},{x:w.x2,y:w.y2}].forEach((p)=>{ const d = Math.hypot(p.x-x,p.y-y); if (d < SNAP_DISTANCE_PX && d < min){ min=d; best=p; } });
    });
    return best;
  };

  const handleStageMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 2) { setDrawingStartPoint(null); setDrawingEndPoint(null); setLengthInput(""); return; }
    if (activeTool !== "wall" && activeTool !== "door" && activeTool !== "window") return;

    const stage = e.target.getStage();
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    // Coordinate reali nello stage (con zoom/pan)
    const rawX = (pointer.x - stage.x()) / stage.scaleX();
    const rawY = (pointer.y - stage.y()) / stage.scaleY();

    if (activeTool === "door" || activeTool === "window") return;
    const snapped = getSnapPoint(rawX, rawY);
    if (!drawingStartPoint) { setDrawingStartPoint(snapped); setDrawingEndPoint(snapped); return; }
    setDrawingEndPoint(snapped);
    const len = Math.hypot(snapped.x - drawingStartPoint.x, snapped.y - drawingStartPoint.y);
    if (len > GRID_SIZE / 2) {
      const res = handleCreateWall(drawingStartPoint.x, drawingStartPoint.y, snapped.x, snapped.y);
      setDrawingStartPoint(res.endPoint);
      setDrawingEndPoint(res.endPoint);
    }
  };

  const handleStageMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    if (activeTool !== "wall" || !drawingStartPoint) return;

    const stage = e.target.getStage();
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const rawX = (pointer.x - stage.x()) / stage.scaleX();
    const rawY = (pointer.y - stage.y()) / stage.scaleY();

    // Snap alla griglia
    let snappedX = snapToGrid(rawX);
    let snappedY = snapToGrid(rawY);

    // Tracciamento Ortogonale con tasto Shift
    if (isShiftPressed) {
      const dx = Math.abs(snappedX - drawingStartPoint.x);
      const dy = Math.abs(snappedY - drawingStartPoint.y);
      if (dx > dy) {
        snappedY = drawingStartPoint.y; // Blocca orizzontale
      } else {
        snappedX = drawingStartPoint.x; // Blocca verticale
      }
    }

    setDrawingEndPoint({ x: snappedX, y: snappedY });
  };

  const handleStageMouseUp = () => {};

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setDrawingStartPoint(null); setDrawingEndPoint(null); setLengthInput(""); }
      if (activeTool === "wall" && drawingStartPoint && /[0-9]/.test(e.key)) setLengthInput((v) => v + e.key);
      if (e.key === "Backspace") setLengthInput((v) => v.slice(0,-1));
      if (e.key === "Enter" && drawingStartPoint && drawingEndPoint && lengthInput) {
        const mm = parseFloat(lengthInput);
        const dx = drawingEndPoint.x - drawingStartPoint.x; const dy = drawingEndPoint.y - drawingStartPoint.y; const l = Math.hypot(dx,dy)||1;
        const px = mm / PIXELS_TO_MM;
        const end = { x: drawingStartPoint.x + (dx/l)*px, y: drawingStartPoint.y + (dy/l)*px };
        const res = handleCreateWall(drawingStartPoint.x, drawingStartPoint.y, end.x, end.y);
        setDrawingStartPoint(res.endPoint); setDrawingEndPoint(res.endPoint); setLengthInput("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeTool, drawingStartPoint, drawingEndPoint, lengthInput, addWall, setDrawingStartPoint, setDrawingEndPoint]);

  const selectedWall = walls.find((w) => w.id === selectedWallId);

  return (
    <div ref={containerRef} className="w-full h-full bg-[hsl(228_39%_6%)] overflow-hidden flex relative">
      
      {/* ── Griglia CSS Infinita sottostante ── */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(to right, hsl(220 20% 30%) 1px, transparent 1px),
            linear-gradient(to bottom, hsl(220 20% 30%) 1px, transparent 1px)
          `,
          backgroundSize: `${GRID_SIZE * scale}px ${GRID_SIZE * scale}px`,
          backgroundPosition: `${stageX}px ${stageY}px`
        }}
      />

      {/* ── Canvas Interattivo (Stage) ── */}
      <Stage
        width={dimensions.width}
        height={dimensions.height}
        x={stageX}
        y={stageY}
        scaleX={scale}
        scaleY={scale}
        draggable={activeTool === "pan"}
        onWheel={handleWheel}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onTouchStart={(e) => handleStageMouseDown(e as any)}
        onTouchMove={(e) => handleStageMouseMove(e as any)}
        onTouchEnd={() => handleStageMouseUp()}
        onContextMenu={(e) => { e.evt.preventDefault(); setDrawingStartPoint(null); setDrawingEndPoint(null); setLengthInput(""); }}
        onDragEnd={(e) => setStagePosition(e.target.x(), e.target.y())}
        style={{
          cursor:
            activeTool === "pan"
              ? "grab"
              : activeTool === "wall"
              ? "crosshair"
              : "default",
        }}
      >
        <Layer>
          {/* Render delle Lastre Disegnate */}
          {walls.map((wall) => {
            const dx = wall.x2 - wall.x1;
            const dy = wall.y2 - wall.y1;
            const angle = Math.atan2(dy, dx);
            const lenPx = Math.sqrt(dx * dx + dy * dy);
            const isSel = wall.id === selectedWallId;

            // Spessore reale in pixel (es: 100mm = 10px)
            const thickPx = wall.thickness / PIXELS_TO_MM;

            // Calcola le coordinate spostate in base all'offset laterale dello spessore
            let ox1 = wall.x1;
            let oy1 = wall.y1;
            let ox2 = wall.x2;
            let oy2 = wall.y2;

            const offsetSide = wall.offsetSide || "left";
            if (offsetSide !== "center") {
              const nx = -Math.sin(angle);
              const ny = Math.cos(angle);
              const mult = offsetSide === "left" ? 1 : -1;
              const shiftPx = (thickPx / 2) * mult;
              ox1 += shiftPx * nx;
              oy1 += shiftPx * ny;
              ox2 += shiftPx * nx;
              oy2 += shiftPx * ny;
            }

            return (
              <ReactKonvaGroup
                key={wall.id}
                onClick={() => {
                  if (activeTool === "select") setSelectedWallId(wall.id);
                }}
                onTap={() => {
                  if (activeTool === "select") setSelectedWallId(wall.id);
                }}
              >
                {/* Geometria Lastra Spessa */}
                <Line
                  points={[ox1, oy1, ox2, oy2]}
                  stroke={isSel ? "hsl(220 90% 56%/0.85)" : "hsl(215 20% 45%/0.85)"}
                  strokeWidth={thickPx}
                  lineCap="square"
                />

                {/* Linea Filiforme d'asse dello scheletro di snap per precisione */}
                <Line
                  points={[wall.x1, wall.y1, wall.x2, wall.y2]}
                  stroke={isSel ? "white" : "hsl(16, 100%, 58%/0.65)"}
                  strokeWidth={1.5 / scale}
                  lineCap="round"
                />

                {/* Testo quota larghezza faccia in mm */}
                <Text
                  x={(wall.x1 + wall.x2) / 2}
                  y={(wall.y1 + wall.y2) / 2 - 15 / scale}
                  text={`${Math.round(lenPx * PIXELS_TO_MM)} mm`}
                  fontSize={10 / scale}
                  fill="white"
                  align="center"
                  verticalAlign="middle"
                  fontStyle="bold"
                  shadowColor="black"
                  shadowBlur={4}
                  shadowOffset={{ x: 1, y: 1 }}
                />
              </ReactKonvaGroup>
            );
          })}

          {/* Render della Parete in fase di tracciamento (Drag) */}
          {activeTool === "wall" && drawingStartPoint && drawingEndPoint && (
            <ReactKonvaGroup>
              <Line
                points={[
                  drawingStartPoint.x,
                  drawingStartPoint.y,
                  drawingEndPoint.x,
                  drawingEndPoint.y,
                ]}
                stroke="hsl(220 90% 56%)"
                strokeWidth={10}
                opacity={0.5}
                lineCap="square"
              />
              <Line
                points={[
                  drawingStartPoint.x,
                  drawingStartPoint.y,
                  drawingEndPoint.x,
                  drawingEndPoint.y,
                ]}
                stroke="white"
                strokeWidth={2 / scale}
                dash={[5 / scale, 5 / scale]}
              />
            </ReactKonvaGroup>
          )}
        </Layer>
      </Stage>

      {drawingStartPoint && lengthInput && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 px-3 py-2 rounded bg-black/80 text-white text-xs z-30">
          Lunghezza: {lengthInput} mm (Invio per confermare)
        </div>
      )}

      {/* ── Toolbar Comandi Flottante ── */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 p-2 rounded-2xl bg-[hsl(220_32%_10%/0.9)] backdrop-blur-md border border-[hsl(220_20%_22%)] shadow-2xl z-20">
        <button
          onClick={() => setActiveTool("select")}
          className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
            activeTool === "select"
              ? "bg-[hsl(220_90%_56%/0.2)] text-[hsl(220_90%_65%)] border border-blue-500/30"
              : "text-[hsl(215_20%_65%)] hover:bg-white/5"
          }`}
          title="Seleziona"
        >
          ↖ Selezione
        </button>

        <button
          onClick={() => setActiveTool("pan")}
          className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
            activeTool === "pan"
              ? "bg-[hsl(220_90%_56%/0.2)] text-[hsl(220_90%_65%)] border border-blue-500/30"
              : "text-[hsl(215_20%_65%)] hover:bg-white/5"
          }`}
          title="Sposta"
        >
          ✋ Pan
        </button>

        <button
          onClick={() => setActiveTool("wall")}
          className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
            activeTool === "wall"
              ? "bg-[hsl(16_100%_58%/0.2)] text-[hsl(16_100%_65%)] border border-orange-500/30"
              : "text-[hsl(215_20%_65%)] hover:bg-white/5"
          }`}
          title="Disegna Lastra"
        >
          📏 Disegna Lastra
        </button>

        <div className="w-px h-6 bg-white/10" />

        <button
          onClick={() => setIsNotesOpen(true)}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-[hsl(215_20%_75%)] hover:bg-white/5 cursor-pointer"
        >
          📋 Note
        </button>

        <Link
          href={`/projects/${activeProjectId}/report`}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors shadow-lg cursor-pointer"
        >
          🖨️ Report
        </Link>

        <button
          onClick={handleSaveToDatabase}
          disabled={isPending || !hasUnsavedChanges}
          className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer bg-blue-600 hover:bg-blue-700 shadow-lg"
        >
          {isPending ? "Salvataggio..." : "Salva Cloud ✓"}
        </button>
      </div>

      {/* ── Pannello Configurazione Lastra Selezionata ── */}
      {activeTool === "select" && selectedWall && (
        <div
          className="absolute top-16 left-6 w-85 p-5 rounded-2xl border shadow-2xl z-20 flex flex-col gap-4 animate-fade-in max-h-[82vh] overflow-y-auto scrollbar-thin"
          style={{
            background: "hsl(220 26% 12% / 0.95)",
            borderColor: "hsl(220 20% 22%)",
            backdropFilter: "blur(10px)",
          }}
        >
          <div className="flex justify-between items-center border-b pb-2" style={{ borderColor: "hsl(220 20% 20%)" }}>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              Specifiche Lastra
            </h4>
            <button
              onClick={() => setSelectedWallId(null)}
              className="text-gray-400 hover:text-white transition-colors text-xs cursor-pointer"
            >
              Chiudi
            </button>
          </div>

          <div className="flex flex-col gap-3.5">
            {/* Sezione 1: Dimensioni Fisiche */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-gray-400 uppercase block tracking-wider">Geometria Pezzo</span>
              
              <div>
                <label className="text-[9px] text-gray-500 block uppercase mb-0.5">Larghezza Faccia 2D (mm)</label>
                <input
                  type="number"
                  value={Math.round(Math.hypot(selectedWall.x2 - selectedWall.x1, selectedWall.y2 - selectedWall.y1) * PIXELS_TO_MM)}
                  onChange={(e) => {
                    const newLenMm = parseInt(e.target.value, 10) || 0;
                    const dx = selectedWall.x2 - selectedWall.x1;
                    const dy = selectedWall.y2 - selectedWall.y1;
                    const lenPx = Math.hypot(dx, dy);
                    const newLenPx = newLenMm / PIXELS_TO_MM;
                    const dirX = lenPx === 0 ? 1 : dx / lenPx;
                    const dirY = lenPx === 0 ? 0 : dy / lenPx;
                    updateWall(selectedWall.id, {
                      x2: selectedWall.x1 + dirX * newLenPx,
                      y2: selectedWall.y1 + dirY * newLenPx,
                    });
                  }}
                  className="w-full bg-[hsl(220_32%_8%)] border border-[hsl(220_20%_20%)] text-white text-xs px-2.5 py-1.5 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="text-[9px] text-gray-500 block uppercase mb-0.5">Lunghezza Estrusione Cassonetto (mm)</label>
                <input
                  type="number"
                  value={useCanvasStore.getState().globalExtrusionLength}
                  onChange={(e) => {
                    const val = Math.max(100, parseInt(e.target.value, 10) || 0);
                    useCanvasStore.getState().setGlobalExtrusionLength(val);
                  }}
                  className="w-full bg-[hsl(220_32%_8%)] border border-[hsl(220_20%_20%)] text-white text-xs px-2.5 py-1.5 rounded-xl outline-none"
                />
                <span className="text-[9px] text-gray-500 mt-1 block italic">Note: Aggiorna la lunghezza di tutte le lastre.</span>
              </div>
            </div>

            {/* Sezione 2: Materiale & Spessore Lastra */}
            <div className="border-t pt-3 space-y-2.5" style={{ borderColor: "hsl(220 20% 20%)" }}>
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">Materiale & Spessore</span>

              {/* Selettore Lastra dal Catalogo */}
              <div>
                <label className="text-[9px] text-gray-500 block uppercase mb-0.5">Lastra da Catalogo</label>
                <select
                  value={selectedWall.materialId || ""}
                  onChange={(e) => {
                    const matId = e.target.value;
                    const mat = materials.find((m) => m.id === matId);
                    updateWall(selectedWall.id, {
                      materialId: matId || null,
                      thickness: mat ? mat.thickness_mm : selectedWall.thickness
                    });
                  }}
                  className="w-full bg-[hsl(220_32%_8%)] border border-[hsl(220_20%_20%)] text-white text-xs px-2.5 py-1.5 rounded-xl outline-none cursor-pointer"
                >
                  <option value="">Nessuno (Imposta manuale)</option>
                  {plateMaterials.map((m) => {
                    const dimStr = m.length_mm && m.width_mm
                      ? ` - ${m.length_mm}x${m.width_mm}x${m.thickness_mm}mm`
                      : ` (${m.thickness_mm}mm)`;
                    return (
                      <option key={m.id} value={m.id}>{m.name}{dimStr}</option>
                    );
                  })}
                </select>
              </div>

              {/* Spessore manuale */}
              <div>
                <label className="text-[9px] text-gray-500 block uppercase mb-0.5">Spessore Lastra (mm)</label>
                <input
                  type="number"
                  value={selectedWall.thickness}
                  onChange={(e) => {
                    const val = Math.max(1, parseInt(e.target.value, 10) || 0);
                    updateWall(selectedWall.id, { thickness: val });
                  }}
                  className="w-full bg-[hsl(220_32%_8%)] border border-[hsl(220_20%_20%)] text-white text-xs px-2.5 py-1.5 rounded-xl outline-none"
                />
              </div>

              {/* Allineamento Spessore (OffsetSide) */}
              <div>
                <label className="text-[9px] text-gray-500 block uppercase mb-0.5">Allineamento Spessore (Offset)</label>
                <select
                  value={selectedWall.offsetSide || "left"}
                  onChange={(e) => updateWall(selectedWall.id, { offsetSide: e.target.value as any })}
                  className="w-full bg-[hsl(220_32%_8%)] border border-[hsl(220_20%_20%)] text-white text-xs px-2.5 py-1.5 rounded-xl outline-none cursor-pointer"
                >
                  <option value="left">Sinistra / Sopra rispetto all'asse ➡️</option>
                  <option value="right">Destra / Sotto rispetto all'asse ⬅️</option>
                  <option value="center">Centrato sull'asse 🟢</option>
                </select>
              </div>
            </div>

            {/* Riepilogo Metri e Superfici */}
            <div className="border-t pt-3" style={{ borderColor: "hsl(220 20% 20%)" }}>
              <div className="text-[10px] text-gray-400 flex justify-between">
                <span>Larghezza Faccia 2D:</span>
                <span className="font-semibold text-white">
                  {Math.round(Math.hypot(selectedWall.x2 - selectedWall.x1, selectedWall.y2 - selectedWall.y1) * PIXELS_TO_MM)} mm
                </span>
              </div>
              <div className="text-[10px] text-gray-400 flex justify-between mt-1">
                <span>Lunghezza Lastra 3D:</span>
                <span className="font-semibold text-white">
                  {useCanvasStore.getState().globalExtrusionLength} mm
                </span>
              </div>
              <div className="text-[10px] text-gray-400 flex justify-between mt-1">
                <span>Superficie Singola Lastra:</span>
                <span className="font-semibold text-green-400">
                  {(((Math.hypot(selectedWall.x2 - selectedWall.x1, selectedWall.y2 - selectedWall.y1) * PIXELS_TO_MM) * useCanvasStore.getState().globalExtrusionLength) / 1000000).toFixed(2)} m²
                </span>
              </div>
            </div>

            <button
              onClick={() => deleteWall(selectedWall.id)}
              className="w-full py-2.5 rounded-xl text-xs font-semibold text-red-400 border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 transition-all mt-1 cursor-pointer"
            >
              🗑️ Elimina Lastra
            </button>
          </div>
        </div>
      )}

      {/* Sidebar Note */}
      {activeLevelId && (
        <DrawingNotesSidebar
          levelId={activeLevelId}
          isOpen={isNotesOpen}
          onClose={() => setIsNotesOpen(false)}
        />
      )}
    </div>
  );
}

// Wrapper fittizio per Konva Group necessario in TypeScript/React-Konva
function ReactKonvaGroup({ children, ...props }: any) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const KonvaGroup = require("react-konva").Group;
  return <KonvaGroup {...props}>{children}</KonvaGroup>;
}
