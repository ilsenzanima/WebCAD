import { create } from "zustand";
import type { Level } from "@/lib/types/database";

/**
 * ============================================
 * Store Zustand - Stato del progetto attivo
 * ============================================
 * Gestisce lo stato corrente del progetto, livello e selezione.
 * Esteso con nome progetto e lista livelli per il multi-piano.
 */

interface ProjectState {
  // Progetto corrente
  activeProjectId: string | null;
  projectName: string | null;

  // Livelli del progetto corrente
  levels: Level[];
  activeLevelId: string | null;

  // Azioni progetto
  setActiveProject: (projectId: string | null) => void;
  setProjectName: (name: string) => void;

  // Azioni livelli
  setLevels: (levels: Level[]) => void;
  setActiveLevel: (levelId: string | null) => void;
  addLevel: (level: Level) => void;
  updateLevel: (levelId: string, changes: Partial<Level>) => void;
  removeLevel: (levelId: string) => void;

  // Reset
  reset: () => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  activeProjectId: null,
  projectName: null,
  levels: [],
  activeLevelId: null,

  setActiveProject: (projectId) =>
    set({ activeProjectId: projectId, activeLevelId: null, levels: [] }),

  setProjectName: (name) => set({ projectName: name }),

  setLevels: (levels) =>
    set({
      levels,
      activeLevelId: levels.length > 0 ? levels[0].id : null,
    }),

  setActiveLevel: (levelId) => set({ activeLevelId: levelId }),

  addLevel: (level) =>
    set((state) => ({ levels: [...state.levels, level] })),

  updateLevel: (levelId, changes) =>
    set((state) => ({
      levels: state.levels.map((l) =>
        l.id === levelId ? { ...l, ...changes } : l
      ),
    })),

  removeLevel: (levelId) =>
    set((state) => {
      const filtered = state.levels.filter((l) => l.id !== levelId);
      const newActiveId =
        state.activeLevelId === levelId
          ? filtered.length > 0
            ? filtered[0].id
            : null
          : state.activeLevelId;
      return { levels: filtered, activeLevelId: newActiveId };
    }),

  reset: () =>
    set({
      activeProjectId: null,
      projectName: null,
      levels: [],
      activeLevelId: null,
    }),
}));
