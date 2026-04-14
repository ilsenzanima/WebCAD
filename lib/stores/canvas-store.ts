import { create } from "zustand";

/**
 * ============================================
 * Store Zustand - Stato del Canvas 2D
 * ============================================
 * Gestisce viewport, zoom, strumento attivo e selezione
 * per il motore Canvas react-konva (Epic 2+).
 */

export type CanvasTool =
  | "select"
  | "pan"
  | "line"
  | "wall"
  | "duct"
  | "measure";

interface CanvasState {
  // Viewport
  stageX: number;
  stageY: number;
  scale: number;

  // Strumento attivo
  activeTool: CanvasTool;

  // Selezione
  selectedElementIds: string[];

  // Rapporto di scala calibrato (pixel -> mm)
  calibrationRatio: number | null;

  // Azioni
  setStagePosition: (x: number, y: number) => void;
  setScale: (scale: number) => void;
  setActiveTool: (tool: CanvasTool) => void;
  setSelectedElements: (ids: string[]) => void;
  toggleElementSelection: (id: string) => void;
  setCalibrationRatio: (ratio: number | null) => void;
  resetViewport: () => void;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  stageX: 0,
  stageY: 0,
  scale: 1,
  activeTool: "select",
  selectedElementIds: [],
  calibrationRatio: null,

  setStagePosition: (x, y) => set({ stageX: x, stageY: y }),
  setScale: (scale) => set({ scale }),
  setActiveTool: (tool) => set({ activeTool: tool, selectedElementIds: [] }),
  setSelectedElements: (ids) => set({ selectedElementIds: ids }),
  toggleElementSelection: (id) =>
    set((state) => ({
      selectedElementIds: state.selectedElementIds.includes(id)
        ? state.selectedElementIds.filter((eid) => eid !== id)
        : [...state.selectedElementIds, id],
    })),
  setCalibrationRatio: (ratio) => set({ calibrationRatio: ratio }),
  resetViewport: () => set({ stageX: 0, stageY: 0, scale: 1 }),
}));
