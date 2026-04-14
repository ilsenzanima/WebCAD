import { create } from "zustand";

/**
 * ============================================
 * Store Zustand - Stato del progetto attivo
 * ============================================
 * Gestisce lo stato corrente del progetto, livello e selezione.
 * Sarà esteso negli Epic successivi con lo stato del Canvas.
 */

interface ProjectState {
  // Progetto e livello corrente
  activeProjectId: string | null;
  activeLevelId: string | null;

  // Azioni
  setActiveProject: (projectId: string | null) => void;
  setActiveLevel: (levelId: string | null) => void;
  reset: () => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  activeProjectId: null,
  activeLevelId: null,

  setActiveProject: (projectId) =>
    set({ activeProjectId: projectId, activeLevelId: null }),

  setActiveLevel: (levelId) => set({ activeLevelId: levelId }),

  reset: () => set({ activeProjectId: null, activeLevelId: null }),
}));
