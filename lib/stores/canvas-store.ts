import { create } from "zustand";

/**
 * ============================================
 * Store Zustand - Stato del Canvas 2D Parametrico
 * ============================================
 * Gestisce viewport, strumenti attivi, selezione e la
 * geometria delle pareti parametriche con montanti (Auto-Pitch).
 */

export type CanvasTool = "select" | "pan" | "wall" | "door" | "window";

export interface Opening {
  id: string;
  type: "door" | "window";
  width: number;
  height: number;
  offset: number;
}

export interface Wall {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number; // in mm
  height: number; // in mm
  pitch: number; // in mm
  structuralPoints: { x: number; y: number; isManual: boolean }[];
  studMaterialId?: string | null;
  studThickness?: number;
  layerSideAMaterialId?: string | null;
  layerSideACount?: number;
  layerSideAThickness?: number;
  layerSideBMaterialId?: string | null;
  layerSideBCount?: number;
  layerSideBThickness?: number;
  isControparete?: boolean;
  openings: Opening[];
}

interface CanvasState {
  // Viewport & Zoom
  stageX: number;
  stageY: number;
  scale: number;

  // Strumenti
  activeTool: CanvasTool;
  selectedWallId: string | null;

  // Pareti Disegnate
  walls: Wall[];
  
  // Disegno Attivo (Punto iniziale durante il trascinamento)
  drawingStartPoint: { x: number; y: number } | null;
  drawingEndPoint: { x: number; y: number } | null;

  // Stato Modifiche
  hasUnsavedChanges: boolean;

  // Azioni Viewport
  setStagePosition: (x: number, y: number) => void;
  setScale: (scale: number) => void;
  setActiveTool: (tool: CanvasTool) => void;
  setSelectedWallId: (id: string | null) => void;
  resetViewport: () => void;

  // Azioni Pareti
  addWall: (wall: Omit<Wall, "structuralPoints">) => void;
  updateWall: (id: string, changes: Partial<Omit<Wall, "id" | "structuralPoints">>) => void;
  deleteWall: (id: string) => void;
  
  // Set del disegno attivo
  setDrawingStartPoint: (point: { x: number; y: number } | null) => void;
  setDrawingEndPoint: (point: { x: number; y: number } | null) => void;

  // Utility
  clearCanvas: () => void;
  setHasUnsavedChanges: (dirty: boolean) => void;
  loadCanvasData: (walls: Wall[]) => void;
}

// Scala fissa: 1 pixel = 10 mm (1 cm)
export const PIXELS_TO_MM = 10;

// Ricalcola i montanti strutturali (Auto-Pitch) per una parete
export function calculateStructuralPoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  pitchMm: number,
  openings: Opening[] = []
): { x: number; y: number; isManual: boolean }[] {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenPx = Math.sqrt(dx * dx + dy * dy);
  
  if (lenPx === 0) return [];

  const pitchPx = pitchMm / PIXELS_TO_MM;
  const points: { x: number; y: number; isManual: boolean }[] = [];

  // Montante iniziale in A
  points.push({ x: x1, y: y1, isManual: false });

  const openingRanges = openings.map((o) => ({ start: o.offset / PIXELS_TO_MM, end: (o.offset + o.width) / PIXELS_TO_MM }));
  const isInsideOpening = (d: number) => openingRanges.some((r) => d > r.start && d < r.end);

  // Montanti intermedi
  if (pitchPx > 0 && lenPx > pitchPx) {
    const numStuds = Math.floor(lenPx / pitchPx);
    for (let i = 1; i <= numStuds; i++) {
      const t = (i * pitchPx) / lenPx;
      // Evitiamo di sovrapporre il montante finale se è vicinissimo
      if (t < 0.98) {
        const dist = t * lenPx;
        if (isInsideOpening(dist)) continue;
        points.push({
          x: x1 + t * dx,
          y: y1 + t * dy,
          isManual: false,
        });
      }
    }
  }

  for (const opening of openings) {
    for (const edge of [opening.offset, opening.offset + opening.width]) {
      const t = (edge / PIXELS_TO_MM) / lenPx;
      if (t <= 0 || t >= 1) continue;
      points.push({ x: x1 + t * dx, y: y1 + t * dy, isManual: false });
      points.push({ x: x1 + t * dx, y: y1 + t * dy, isManual: false });
    }
  }

  // Montante finale in B (garantito per stabilità)
  points.push({ x: x2, y: y2, isManual: false });

  return points;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  stageX: 0,
  stageY: 0,
  scale: 1,
  activeTool: "select",
  selectedWallId: null,
  walls: [],
  drawingStartPoint: null,
  drawingEndPoint: null,
  hasUnsavedChanges: false,

  setStagePosition: (x, y) => set({ stageX: x, stageY: y }),
  setScale: (scale) => set({ scale }),
  setActiveTool: (tool) => set({ activeTool: tool, selectedWallId: null, drawingStartPoint: null, drawingEndPoint: null }),
  setSelectedWallId: (id) => set({ selectedWallId: id }),
  resetViewport: () => set({ stageX: 0, stageY: 0, scale: 1 }),

  addWall: (newWall) =>
    set((state) => {
      const structuralPoints = calculateStructuralPoints(
        newWall.x1,
        newWall.y1,
        newWall.x2,
        newWall.y2,
        newWall.pitch,
        newWall.openings ?? []
      );
      
      const resolvedWall = {
        studMaterialId: null,
        studThickness: 50,
        layerSideAMaterialId: null,
        layerSideACount: 1,
        layerSideAThickness: 12.5,
        layerSideBMaterialId: null,
        layerSideBCount: 1,
        layerSideBThickness: 12.5,
        isControparete: false,
        ...newWall,
      };
      resolvedWall.thickness = (resolvedWall.studThickness ?? 50) + (resolvedWall.layerSideACount ?? 1) * (resolvedWall.layerSideAThickness ?? 12.5) + ((resolvedWall.isControparete ? 0 : (resolvedWall.layerSideBCount ?? 1) * (resolvedWall.layerSideBThickness ?? 12.5)));
      const wall: Wall = {
        ...resolvedWall,
        structuralPoints,
      };

      return {
        walls: [...state.walls, wall],
        hasUnsavedChanges: true,
        selectedWallId: wall.id, // Seleziona automaticamente la nuova parete
      };
    }),

  updateWall: (id, changes) =>
    set((state) => {
      const updatedWalls = state.walls.map((w) => {
        if (w.id !== id) return w;
        
        const merged = { ...w, ...changes };
        // Ricalcola i punti strutturali basati sulle nuove geometrie o parametri
        const structuralPoints = calculateStructuralPoints(
          merged.x1,
          merged.y1,
          merged.x2,
          merged.y2,
          merged.pitch,
          merged.openings ?? []
        );
        const computedThickness = (merged.studThickness ?? 50) + (merged.layerSideACount ?? 1) * (merged.layerSideAThickness ?? 12.5) + ((merged.isControparete ? 0 : (merged.layerSideBCount ?? 1) * (merged.layerSideBThickness ?? 12.5)));

        return {
          ...merged,
          thickness: computedThickness,
          structuralPoints,
        };
      });

      return {
        walls: updatedWalls,
        hasUnsavedChanges: true,
      };
    }),

  deleteWall: (id) =>
    set((state) => ({
      walls: state.walls.filter((w) => w.id !== id),
      selectedWallId: state.selectedWallId === id ? null : state.selectedWallId,
      hasUnsavedChanges: true,
    })),

  setDrawingStartPoint: (point) => set({ drawingStartPoint: point }),
  setDrawingEndPoint: (point) => set({ drawingEndPoint: point }),

  clearCanvas: () =>
    set({
      stageX: 0,
      stageY: 0,
      scale: 1,
      activeTool: "select",
      selectedWallId: null,
      walls: [],
      drawingStartPoint: null,
      drawingEndPoint: null,
      hasUnsavedChanges: false,
    }),

  setHasUnsavedChanges: (dirty) => set({ hasUnsavedChanges: dirty }),
  
  loadCanvasData: (walls) =>
    set({
      walls,
      hasUnsavedChanges: false,
    }),
}));
