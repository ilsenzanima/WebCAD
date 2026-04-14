"use client";

import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Line, Circle } from "react-konva";
import useImage from "use-image";
import { useCanvasStore } from "@/lib/stores/canvas-store";
import type { KonvaEventObject } from "konva/lib/Node";

/**
 * Componente Client-Side che gestisce l'area di disegno interattiva (Canvas 2D)
 * tramite react-konva. È escluso dal SSR in Next.js tramite importazione dinamica.
 */
export default function CanvasWorkspace() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Stato globale Zustand
  const {
    stageX,
    stageY,
    scale,
    activeTool,
    backgroundImageDataUrl,
    calibrationPoints,
    setStagePosition,
    setScale,
    addCalibrationPoint,
  } = useCanvasStore();

  // Caricamento asincrono dell'istanza immagine tramite use-image custom hook
  const [image] = useImage(backgroundImageDataUrl || "");

  // Update costanti delle dimensioni basate sul resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    updateSize(); // exec init
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Zoom tramite rotellina del mouse (solo scale, centrato al cursore)
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

    // Zoom-in quando si gira su (deltaY < 0), Zoom-out girando giù
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;

    // Limiti di zoom (0.1x a 10x)
    const clampedScale = Math.max(0.1, Math.min(newScale, 10));

    setScale(clampedScale);
    setStagePosition(
      pointer.x - mousePointTo.x * clampedScale,
      pointer.y - mousePointTo.y * clampedScale
    );
  };

  // Click principale sullo stage
  const handleStageClick = (e: KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    // Calcola la posizione reale (ignorando zoom / pan temporaneo del parent)
    const point = {
      x: (pointer.x - stage.x()) / stage.scaleX(),
      y: (pointer.y - stage.y()) / stage.scaleY(),
    };

    switch (activeTool) {
      case "calibrate":
        // Aggiungiamo un punto per la calibrazione
        addCalibrationPoint(point);
        break;
      // TODO: Gestire wall, duct, select
      default:
        break;
    }
  };

  return (
    <div ref={containerRef} className="w-full h-full bg-[hsl(228_39%_6%)] overflow-hidden">
      {/* Griglia infinita CSS sottostante (non renderizzata su Canvas per performance) */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(to right, hsl(220 20% 30%) 1px, transparent 1px),
            linear-gradient(to bottom, hsl(220 20% 30%) 1px, transparent 1px)
          `,
          backgroundSize: `${20 * scale}px ${20 * scale}px`,
          backgroundPosition: `${stageX}px ${stageY}px`
        }}
      />

      <Stage
        width={dimensions.width}
        height={dimensions.height}
        x={stageX}
        y={stageY}
        scaleX={scale}
        scaleY={scale}
        draggable={activeTool === "pan"}
        onWheel={handleWheel}
        onClick={handleStageClick}
        onDragEnd={(e) => {
          // Salva la nuova posizione dopo il drag (PAN)
          setStagePosition(e.target.x(), e.target.y());
        }}
        // Il cursore cambia in base al tool
        style={{ cursor: activeTool === "pan" ? "grab" : activeTool === "calibrate" ? "crosshair" : "default" }}
      >
        <Layer>
          {/* Sfondo: Planimetria caricata */}
          {image && (
            <KonvaImage
              image={image}
              x={0}
              y={0}
              opacity={0.7} // Semi-trasparente per vedere la griglia/linee apposte
              listening={false} // Evita eventi drag sull'immagine
            />
          )}

          {/* Indicatori (Punti) della calibrazione */}
          {activeTool === "calibrate" && calibrationPoints.map((pt, i) => (
            <Circle
              key={i}
              x={pt.x}
              y={pt.y}
              radius={5 / scale}
              fill="hsl(16 100% 58%)"
              stroke="white"
              strokeWidth={1.5 / scale}
            />
          ))}
          {/* Collegamento tra i due punti di calibrazione */}
          {activeTool === "calibrate" && calibrationPoints.length === 2 && (
            <Line
              points={[
                calibrationPoints[0].x, calibrationPoints[0].y,
                calibrationPoints[1].x, calibrationPoints[1].y
              ]}
              stroke="hsl(16 100% 58%)"
              strokeWidth={2 / scale}
              dash={[5 / scale, 5 / scale]} // Linea tratteggiata visibile nonostante lo zoom
            />
          )}

        </Layer>
      </Stage>
    </div>
  );
}
