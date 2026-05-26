"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Stage, Layer, Line, Circle, Rect, Text } from "react-konva";
import { useCanvasStore, PIXELS_TO_MM, calculateStructuralPoints, type Wall } from "@/lib/stores/canvas-store";
import { useProjectStore } from "@/lib/stores/project-store";
import type { KonvaEventObject } from "konva/lib/Node";
import DrawingNotesSidebar from "./DrawingNotesSidebar";
import { saveWalls, getWalls } from "@/app/actions/projects";

// Snap a 20px (corrisponde a 200mm reali in scala 1px = 10mm)
const GRID_SIZE = 20;
const snapToGrid = (val: number) => Math.round(val / GRID_SIZE) * GRID_SIZE;

export default function CanvasWorkspace() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Stati locali per caricamento database e note
  const [dbNotes, setDbNotes] = useState("");

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

  // 1. Carica le note e le pareti del disegno dal database all'avvio o al cambio livello
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

    // Cerca le note del progetto
    const currentProj = levels.find((l) => l.project_id === activeProjectId);
    // Nota: in uno scenario reale potremmo fare una fetch delle note, ma per semplicità
    // usiamo una fetch asincrona o leggiamo dal record. Per il momento usiamo una stringa vuota
    // che l'utente sovrascriverà, o carichiamo le note generali dal database.
  }, [activeLevelId, activeProjectId, levels, loadCanvasData]);

  // Caricamento iniziale note del progetto
  useEffect(() => {
    if (!activeProjectId) return;
    const fetchNotes = async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data } = await supabase
        .from("projects")
        .select("notes")
        .eq("id", activeProjectId)
        .single();
      if (data) setDbNotes(data.notes ?? "");
    };
    fetchNotes();
  }, [activeProjectId]);

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

  // Interazioni di disegno click sullo stage
  const handleStageMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    if (activeTool !== "wall") return;

    const stage = e.target.getStage();
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    // Coordinate reali nello stage (con zoom/pan)
    const rawX = (pointer.x - stage.x()) / stage.scaleX();
    const rawY = (pointer.y - stage.y()) / stage.scaleY();

    // Snap alla griglia
    const snapped = {
      x: snapToGrid(rawX),
      y: snapToGrid(rawY),
    };

    setDrawingStartPoint(snapped);
    setDrawingEndPoint(snapped);
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

  const handleStageMouseUp = () => {
    if (activeTool !== "wall" || !drawingStartPoint || !drawingEndPoint) return;

    // Calcoliamo lunghezza per evitare pareti a punto singolo
    const dx = drawingEndPoint.x - drawingStartPoint.x;
    const dy = drawingEndPoint.y - drawingStartPoint.y;
    const len = Math.sqrt(dx * dx + dy * dy);

    if (len > GRID_SIZE / 2) {
      addWall({
        id: `wall_${Date.now()}`,
        x1: drawingStartPoint.x,
        y1: drawingStartPoint.y,
        x2: drawingEndPoint.x,
        y2: drawingEndPoint.y,
        thickness: 100, // mm (default)
        height: 2700, // mm (default)
        pitch: 600, // mm (default)
      });
    }

    setDrawingStartPoint(null);
    setDrawingEndPoint(null);
  };

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
        onTouchStart={handleStageMouseDown}
        onTouchMove={handleStageMouseMove}
        onTouchEnd={handleStageMouseUp}
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
          {/* Render delle Pareti Disegnate */}
          {walls.map((wall) => {
            const dx = wall.x2 - wall.x1;
            const dy = wall.y2 - wall.y1;
            const angle = Math.atan2(dy, dx);
            const lenPx = Math.sqrt(dx * dx + dy * dy);
            const isSel = wall.id === selectedWallId;

            // Spessore reale in pixel (es: 100mm = 10px)
            const thickPx = wall.thickness / PIXELS_TO_MM;

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
                {/* Geometria Parete (Rettangolo ruotato) */}
                <Line
                  points={[wall.x1, wall.y1, wall.x2, wall.y2]}
                  stroke={isSel ? "hsl(220 90% 56%)" : "hsl(215 20% 45%)"}
                  strokeWidth={thickPx}
                  lineCap="square"
                  opacity={0.8}
                />

                {/* Profilo metallico di guida esterno */}
                <Line
                  points={[wall.x1, wall.y1, wall.x2, wall.y2]}
                  stroke={isSel ? "white" : "hsl(215 10% 25%)"}
                  strokeWidth={2 / scale}
                  lineCap="round"
                />

                {/* Render dei Montanti Strutturali (Auto-Pitch) */}
                {wall.structuralPoints.map((pt, idx) => (
                  <Circle
                    key={idx}
                    x={pt.x}
                    y={pt.y}
                    radius={Math.min(thickPx / 2.2, 5) / scale}
                    fill="hsl(16 100% 58%)"
                    stroke="white"
                    strokeWidth={1 / scale}
                  />
                ))}

                {/* Testo quota lunghezza in mm */}
                <Text
                  x={(wall.x1 + wall.x2) / 2}
                  y={(wall.y1 + wall.y2) / 2 - 15 / scale}
                  text={`${Math.round(lenPx * PIXELS_TO_MM)} mm`}
                  fontSize={11 / scale}
                  fill="white"
                  align="center"
                  verticalAlign="middle"
                  fontStyle="bold"
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
          title="Disegna Parete"
        >
          📏 Parete
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
        </button>

        <button
          onClick={handleSaveToDatabase}
          disabled={isPending || !hasUnsavedChanges}
          className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer bg-blue-600 hover:bg-blue-700 shadow-lg"
        >
          {isPending ? "Salvataggio..." : "Salva Cloud ✓"}
        </button>
      </div>

      {/* ── Pannello Configurazione Parete Selezionata ── */}
      {activeTool === "select" && selectedWall && (
        <div
          className="absolute top-16 left-6 w-80 p-5 rounded-2xl border shadow-2xl z-20 flex flex-col gap-4 animate-fade-in"
          style={{
            background: "hsl(220 26% 12% / 0.95)",
            borderColor: "hsl(220 20% 22%)",
            backdropFilter: "blur(10px)",
          }}
        >
          <div className="flex justify-between items-center border-b pb-2" style={{ borderColor: "hsl(220 20% 20%)" }}>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              Specifiche Parete
            </h4>
            <button
              onClick={() => setSelectedWallId(null)}
              className="text-gray-400 hover:text-white transition-colors text-xs"
            >
              Chiudi
            </button>
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <label className="text-[11px] font-semibold text-gray-400 block mb-1 uppercase">
                Spessore (mm)
              </label>
              <input
                type="number"
                value={selectedWall.thickness}
                onChange={(e) => updateWall(selectedWall.id, { thickness: parseInt(e.target.value, 10) || 0 })}
                className="w-full bg-[hsl(220_32%_8%)] border border-[hsl(220_20%_20%)] text-white text-sm px-3 py-2 rounded-xl focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-gray-400 block mb-1 uppercase">
                Altezza Parete (mm)
              </label>
              <input
                type="number"
                value={selectedWall.height}
                onChange={(e) => updateWall(selectedWall.id, { height: parseInt(e.target.value, 10) || 0 })}
                className="w-full bg-[hsl(220_32%_8%)] border border-[hsl(220_20%_20%)] text-white text-sm px-3 py-2 rounded-xl focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-gray-400 block mb-1 uppercase">
                Passo Montanti / Pitch (mm)
              </label>
              <input
                type="number"
                value={selectedWall.pitch}
                onChange={(e) => updateWall(selectedWall.id, { pitch: parseInt(e.target.value, 10) || 0 })}
                className="w-full bg-[hsl(220_32%_8%)] border border-[hsl(220_20%_20%)] text-white text-sm px-3 py-2 rounded-xl focus:border-blue-500 outline-none"
              />
            </div>

            <div className="border-t pt-3 mt-1" style={{ borderColor: "hsl(220 20% 20%)" }}>
              <div className="text-xs text-gray-400 flex justify-between">
                <span>Lunghezza reale:</span>
                <span className="font-semibold text-white">
                  {Math.round(
                    Math.sqrt(
                      (selectedWall.x2 - selectedWall.x1) ** 2 +
                        (selectedWall.y2 - selectedWall.y1) ** 2
                    ) * PIXELS_TO_MM
                  )}{" "}
                  mm
                </span>
              </div>
              <div className="text-xs text-gray-400 flex justify-between mt-1">
                <span>Montanti calcolati:</span>
                <span className="font-semibold text-orange-400">
                  {selectedWall.structuralPoints.length} pezzi
                </span>
              </div>
            </div>

            <button
              onClick={() => deleteWall(selectedWall.id)}
              className="w-full py-2.5 rounded-xl text-xs font-semibold text-red-400 border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 transition-all mt-2 cursor-pointer"
            >
              🗑️ Elimina Parete
            </button>
          </div>
        </div>
      )}

      {/* Sidebar Note */}
      <DrawingNotesSidebar
        projectId={activeProjectId || ""}
        initialNotes={dbNotes}
        isOpen={isNotesOpen}
        onClose={() => setIsNotesOpen(false)}
      />
    </div>
  );
}

// Wrapper fittizio per Konva Group necessario in TypeScript/React-Konva
function ReactKonvaGroup({ children, ...props }: any) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const KonvaGroup = require("react-konva").Group;
  return <KonvaGroup {...props}>{children}</KonvaGroup>;
}
