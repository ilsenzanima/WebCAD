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
  | "measure"
  | "calibrate";

interface CanvasState {
  // Viewport
  stageX: number;
  stageY: number;
  scale: number;

  // Strumento attivo
  activeTool: CanvasTool;

  // Selezione
  selectedElementIds: string[];

  // Planimetria (Background)
  backgroundImageDataUrl: string | null;

  // Calibrazione
  calibrationRatio: number | null; // Rapporto di scala (pixel -> mm)
  calibrationPoints: { x: number; y: number }[]; // Max 2 punti
  isProcessingFile: boolean;

  // Azioni Base
  setStagePosition: (x: number, y: number) => void;
  setScale: (scale: number) => void;
  setActiveTool: (tool: CanvasTool) => void;
  setSelectedElements: (ids: string[]) => void;
  toggleElementSelection: (id: string) => void;
  resetViewport: () => void;
  setIsProcessingFile: (isProcessing: boolean) => void;

  // Azioni Immagine & Calibrazione
  setBackgroundImage: (url: string | null) => void;
  setCalibrationRatio: (ratio: number | null) => void;
  addCalibrationPoint: (point: { x: number; y: number }) => void;
  resetCalibrationPoints: () => void;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  stageX: 0,
  stageY: 0,
  scale: 1,
  activeTool: "select",
  selectedElementIds: [],
  backgroundImageDataUrl: null,
  calibrationRatio: null,
  calibrationPoints: [],

  setStagePosition: (x, y) => set({ stageX: x, stageY: y }),
  setScale: (scale) => set({ scale }),
  setActiveTool: (tool) => set({ activeTool: tool, selectedElementIds: [], calibrationPoints: [] }),
  setSelectedElements: (ids) => set({ selectedElementIds: ids }),
  toggleElementSelection: (id) =>
    set((state) => ({
      selectedElementIds: state.selectedElementIds.includes(id)
        ? state.selectedElementIds.filter((eid) => eid !== id)
        : [...state.selectedElementIds, id],
    })),
  resetViewport: () => set({ stageX: 0, stageY: 0, scale: 1 }),
  setIsProcessingFile: (isProcessing) => set({ isProcessingFile: isProcessing }),

  setBackgroundImage: (url) => set({ backgroundImageDataUrl: url }),
  setCalibrationRatio: (ratio) => set({ calibrationRatio: ratio, calibrationPoints: [], activeTool: "select" }),
  addCalibrationPoint: (point) =>
    set((state) => {
      // Se abbiamo già 2 punti, ignora. L'UI gestirà il modal.
      if (state.calibrationPoints.length >= 2) return state;
      return { calibrationPoints: [...state.calibrationPoints, point] };
    }),
  resetCalibrationPoints: () => set({ calibrationPoints: [] }),
}));
