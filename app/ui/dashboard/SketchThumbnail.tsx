"use client";

import { useEffect, useRef } from "react";
import type { SketchStroke } from "@/lib/types/database";
import { SHEET_WIDTH, SHEET_HEIGHT, renderSketch } from "@/lib/sketchRender";

interface SketchThumbnailProps {
  strokes: SketchStroke[];
}

// Anteprima statica (non interattiva) di un disegno per la vetrina: ridisegna
// gli stessi tratti vettoriali dell'editor, in piccolo.
export default function SketchThumbnail({ strokes }: SketchThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = SHEET_WIDTH * dpr;
    canvas.height = SHEET_HEIGHT * dpr;
    ctx.scale(dpr, dpr);
    renderSketch(ctx, strokes);
  }, [strokes]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full block"
      style={{ aspectRatio: `${SHEET_WIDTH} / ${SHEET_HEIGHT}` }}
    />
  );
}
