"use client";

import { useCanvasStore } from "@/lib/stores/canvas-store";
import { useProjectStore } from "@/lib/stores/project-store";
import { useEffect, useState, useTransition } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { updateLevelMetadata } from "@/app/actions/projects";
import { createClient } from "@/lib/supabase/client";

// Configuriamo il worker per viaggiare tramite CDN in modo da evitare problemi di bundling
// con Next.js e Turbopack. MVP friendly.
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

export default function Toolbar() {
  const [isPending, startTransition] = useTransition();
  const { activeProjectId, activeLevelId } = useProjectStore();
  const {
    activeTool,
    setActiveTool,
    setBackgroundImage,
    calibrationPoints,
    resetCalibrationPoints,
    calibrationRatio,
    setCalibrationRatio,
    isProcessingFile,
    setIsProcessingFile,
  } = useCanvasStore();

  // Note: PDF parsing and Calibration logic has been moved to LevelCard in the dashboard.

  return (
    <>
      {/* Floating Toolbar in Basso al Centro */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 p-2 rounded-2xl bg-[hsl(220_32%_10%/0.9)] backdrop-blur-md border border-[hsl(220_20%_22%)] shadow-2xl z-50">
        
        {/* Tools */}
        <button
          onClick={() => setActiveTool("select")}
          className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${
            activeTool === "select"
              ? "bg-[hsl(220_90%_56%/0.2)] text-[hsl(220_90%_65%)]"
              : "text-[hsl(215_20%_65%)] hover:bg-[hsl(220_20%_22%)] hover:text-white"
          }`}
          title="Seleziona (V)"
        >
          ↖
        </button>

        <button
          onClick={() => setActiveTool("pan")}
          className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${
            activeTool === "pan"
              ? "bg-[hsl(220_90%_56%/0.2)] text-[hsl(220_90%_65%)]"
              : "text-[hsl(215_20%_65%)] hover:bg-[hsl(220_20%_22%)] hover:text-white"
          }`}
          title="Pan / Muovi (H)"
        >
          ✋
        </button>

        {calibrationRatio != null && (
          <div className="ml-3 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[hsl(142_71%_45%/0.1)] text-[hsl(142_71%_45%)] border border-[hsl(142_71%_45%/0.2)]">
            Scala attiva
          </div>
        )}
      </div>


    </>
  );
}
