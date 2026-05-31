"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Project, Level, Material } from "@/lib/types/database";
import type { FieldNote, FieldNoteItem, FieldNoteType } from "@/app/actions/field-notes";

export interface SyncOperation {
  id: string; // ID dell'operazione della coda (UUID client-side)
  action: 
    | "CREATE_PROJECT"
    | "RENAME_PROJECT"
    | "ADD_LEVEL"
    | "TOGGLE_LEVEL_COMPLETED"
    | "SAVE_NOTE_ITEMS"
    | "DELETE_NOTE"
    | "UPDATE_NOTE_TEXT"
    | "DELETE_PROJECT";
  payload: any;
  timestamp: number;
}

interface OfflineState {
  // Connettività
  isOnline: boolean;
  
  // Cache locale
  projects: Record<string, Project>; // key: projectId
  levels: Record<string, Level[]>;    // key: projectId -> lista livelli
  fieldNotes: Record<string, FieldNote>; // key: noteId -> dettagli appunto
  catalogMaterials: Material[];
  noteTypes: FieldNoteType[];

  // Coda offline
  offlineQueue: SyncOperation[];
  isSyncing: boolean;

  // Azioni di stato rete
  setOnlineStatus: (status: boolean) => void;

  // Caricamento dati (inizializzazione cache online)
  setProjectsCache: (projects: Project[]) => void;
  setLevelsCache: (projectId: string, levels: Level[]) => void;
  setFieldNotesCache: (notes: FieldNote[]) => void;
  setFieldNoteDetailCache: (noteId: string, note: FieldNote) => void;
  setCatalogMaterialsCache: (materials: Material[]) => void;
  setNoteTypesCache: (types: FieldNoteType[]) => void;

  // Azioni Ottimistiche (funzionano sia ONLINE che OFFLINE)
  addProjectOptimistic: (tempId: string, name: string) => void;
  renameProjectOptimistic: (projectId: string, newName: string) => void;
  deleteProjectOptimistic: (projectId: string) => void;
  addLevelOptimistic: (tempId: string, projectId: string, name: string, elevationZ: number, drawingType: "2d_wall" | "3d_box", piano: string) => void;
  toggleLevelCompletedOptimistic: (levelId: string, projectId: string, completed: boolean) => void;
  saveFieldNoteItemsOptimistic: (noteId: string, projectId: string, levelId: string, items: Omit<FieldNoteItem, "id">[], typeName?: string) => void;
  deleteFieldNoteOptimistic: (noteId: string, projectId: string) => void;
  updateLevelNoteTextOptimistic: (levelId: string, text: string) => void;

  // Sincronizzazione
  syncOfflineData: () => Promise<void>;
  clearQueue: () => void;
}

// Generatore di ID temporanei robusti
export function generateTempId(): string {
  return `temp_${Math.random().toString(36).substring(2, 11)}_${Date.now()}`;
}

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set, get) => ({
      isOnline: typeof window !== "undefined" ? window.navigator.onLine : true,
      projects: {},
      levels: {},
      fieldNotes: {},
      catalogMaterials: [],
      noteTypes: [],
      offlineQueue: [],
      isSyncing: false,

      setOnlineStatus: (status) => set({ isOnline: status }),

      setProjectsCache: (projects) => {
        const cache: Record<string, Project> = {};
        projects.forEach((p) => {
          cache[p.id] = p;
        });
        set((state) => ({ projects: { ...state.projects, ...cache } }));
      },

      setLevelsCache: (projectId, levels) => {
        set((state) => ({
          levels: { ...state.levels, [projectId]: levels },
        }));
      },

      setFieldNotesCache: (notes) => {
        const cache: Record<string, FieldNote> = {};
        notes.forEach((n) => {
          cache[n.id] = n;
        });
        set((state) => ({ fieldNotes: { ...state.fieldNotes, ...cache } }));
      },

      setFieldNoteDetailCache: (noteId, note) => {
        set((state) => ({
          fieldNotes: { ...state.fieldNotes, [noteId]: note },
        }));
      },

      setCatalogMaterialsCache: (materials) => {
        set({ catalogMaterials: materials });
      },

      setNoteTypesCache: (types) => {
        set({ noteTypes: types });
      },

      // --- AZIONI OTTIMISTICHE ---

      addProjectOptimistic: (tempId, name) => {
        const newProject: Project = {
          id: tempId,
          name,
          client_info: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Aggiorna cache
        set((state) => ({
          projects: { ...state.projects, [tempId]: newProject },
          levels: { ...state.levels, [tempId]: [] }, // Inizializza livelli vuoti
        }));

        // Accoda operazione se siamo offline
        if (!get().isOnline) {
          const op: SyncOperation = {
            id: generateTempId(),
            action: "CREATE_PROJECT",
            payload: { tempId, name },
            timestamp: Date.now(),
          };
          set((state) => ({ offlineQueue: [...state.offlineQueue, op] }));
        }
      },

      renameProjectOptimistic: (projectId, newName) => {
        set((state) => {
          const current = state.projects[projectId];
          if (!current) return {};
          return {
            projects: {
              ...state.projects,
              [projectId]: { ...current, name: newName, updated_at: new Date().toISOString() },
            },
          };
        });

        if (!get().isOnline) {
          const op: SyncOperation = {
            id: generateTempId(),
            action: "RENAME_PROJECT",
            payload: { projectId, newName },
            timestamp: Date.now(),
          };
          set((state) => ({ offlineQueue: [...state.offlineQueue, op] }));
        }
      },

      deleteProjectOptimistic: (projectId) => {
        set((state) => {
          const newProjects = { ...state.projects };
          delete newProjects[projectId];
          const newLevels = { ...state.levels };
          delete newLevels[projectId];
          return { projects: newProjects, levels: newLevels };
        });

        if (!get().isOnline) {
          const op: SyncOperation = {
            id: generateTempId(),
            action: "DELETE_PROJECT",
            payload: { projectId },
            timestamp: Date.now(),
          };
          set((state) => ({ offlineQueue: [...state.offlineQueue, op] }));
        }
      },

      addLevelOptimistic: (tempId, projectId, name, elevationZ, drawingType, piano) => {
        const newLevel: Level = {
          id: tempId,
          project_id: projectId,
          name,
          elevation_z: elevationZ,
          scale_ratio: null,
          plan_image_url: null,
          drawing_type: drawingType,
          created_at: new Date().toISOString(),
        } as any; // Cast per includere campi dinamici di schema.sql

        set((state) => {
          const projectLevels = state.levels[projectId] ?? [];
          return {
            levels: {
              ...state.levels,
              [projectId]: [...projectLevels, newLevel],
            },
          };
        });

        if (!get().isOnline) {
          const op: SyncOperation = {
            id: generateTempId(),
            action: "ADD_LEVEL",
            payload: { tempId, projectId, name, elevationZ, drawingType, piano },
            timestamp: Date.now(),
          };
          set((state) => ({ offlineQueue: [...state.offlineQueue, op] }));
        }
      },

      toggleLevelCompletedOptimistic: (levelId, projectId, completed) => {
        set((state) => {
          const projectLevels = state.levels[projectId] ?? [];
          const updatedLevels = projectLevels.map((lvl) =>
            lvl.id === levelId ? { ...lvl, completed } : lvl
          );
          return {
            levels: {
              ...state.levels,
              [projectId]: updatedLevels,
            },
          };
        });

        if (!get().isOnline) {
          const op: SyncOperation = {
            id: generateTempId(),
            action: "TOGGLE_LEVEL_COMPLETED",
            payload: { levelId, projectId, completed },
            timestamp: Date.now(),
          };
          set((state) => ({ offlineQueue: [...state.offlineQueue, op] }));
        }
      },

      saveFieldNoteItemsOptimistic: (noteId, projectId, levelId, items, typeName) => {
        const updatedItems: FieldNoteItem[] = items.map((item, idx) => ({
          id: generateTempId(),
          ...item,
          sort_order: item.sort_order ?? idx,
        }));

        set((state) => {
          const existingNote = state.fieldNotes[noteId];
          const newNote: FieldNote = existingNote
            ? {
                ...existingNote,
                field_note_items: updatedItems,
                type_name: typeName ?? existingNote.type_name ?? "Appunti Cantiere",
                updated_at: new Date().toISOString(),
              }
            : {
                id: noteId,
                project_id: projectId,
                level_id: levelId,
                note_number: 999, // Segnaposto offline
                type_id: null,
                type_name: typeName ?? "Appunti Cantiere",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                field_note_items: updatedItems,
              };

          return {
            fieldNotes: {
              ...state.fieldNotes,
              [noteId]: newNote,
            },
          };
        });

        if (!get().isOnline) {
          const op: SyncOperation = {
            id: generateTempId(),
            action: "SAVE_NOTE_ITEMS",
            payload: { noteId, projectId, levelId, items, typeName: typeName ?? "Appunti Cantiere" },
            timestamp: Date.now(),
          };
          set((state) => ({ offlineQueue: [...state.offlineQueue, op] }));
        }
      },

      deleteFieldNoteOptimistic: (noteId, projectId) => {
        set((state) => {
          const newNotes = { ...state.fieldNotes };
          delete newNotes[noteId];
          return { fieldNotes: newNotes };
        });

        if (!get().isOnline) {
          const op: SyncOperation = {
            id: generateTempId(),
            action: "DELETE_NOTE",
            payload: { noteId, projectId },
            timestamp: Date.now(),
          };
          set((state) => ({ offlineQueue: [...state.offlineQueue, op] }));
        }
      },

      updateLevelNoteTextOptimistic: (levelId, text) => {
        // Trova o crea nota per questo livello
        let targetNoteId: string | null = null;
        const notes = get().fieldNotes;
        
        for (const nid in notes) {
          if (notes[nid].level_id === levelId) {
            targetNoteId = nid;
            break;
          }
        }

        if (!targetNoteId) {
          targetNoteId = generateTempId();
        }

        const textItem: Omit<FieldNoteItem, "id"> = {
          item_type: "nota",
          value_text: text,
          sort_order: 0,
        };

        set((state) => {
          const existingNote = state.fieldNotes[targetNoteId!];
          const updatedItems = [
            ...(existingNote?.field_note_items ?? []).filter((i) => i.item_type !== "nota"),
            { id: generateTempId(), ...textItem },
          ];

          const newNote: FieldNote = existingNote
            ? {
                ...existingNote,
                field_note_items: updatedItems,
                updated_at: new Date().toISOString(),
              }
            : {
                id: targetNoteId!,
                project_id: "offline_project", // Sarà risolto in sync
                level_id: levelId,
                note_number: 999,
                type_id: null,
                type_name: "Appunti Cantiere",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                field_note_items: updatedItems,
              };

          return {
            fieldNotes: {
              ...state.fieldNotes,
              [targetNoteId!]: newNote,
            },
          };
        });

        if (!get().isOnline) {
          const op: SyncOperation = {
            id: generateTempId(),
            action: "UPDATE_NOTE_TEXT",
            payload: { levelId, text },
            timestamp: Date.now(),
          };
          set((state) => ({ offlineQueue: [...state.offlineQueue, op] }));
        }
      },

      // --- ENGINE DI SINCRONIZZAZIONE (SYNC ENGINE) ---

      syncOfflineData: async () => {
        const queue = get().offlineQueue;
        if (queue.length === 0 || get().isSyncing) return;

        set({ isSyncing: true });

        // Mappa di risoluzione degli ID temporanei a reali
        const idMap: Record<string, string> = {};

        const resolveIds = (obj: any): any => {
          if (!obj) return obj;
          if (typeof obj === "string") {
            return idMap[obj] ?? obj;
          }
          if (Array.isArray(obj)) {
            return obj.map(resolveIds);
          }
          if (typeof obj === "object") {
            const res: any = {};
            for (const key in obj) {
              res[key] = resolveIds(obj[key]);
            }
            return res;
          }
          return obj;
        };

        // Importa Server Actions dinamicamente sul client
        const { createProject, renameProject, deleteProject, addLevel, toggleLevelCompleted } = await import("@/app/actions/projects");
        const { updateFieldNote, createFieldNote, deleteFieldNote, updateLevelNoteText } = await import("@/app/actions/field-notes");

        // Elabora in ordine sequenziale (FIFO)
        for (const op of queue) {
          const resolvedPayload = resolveIds(op.payload);
          try {
            switch (op.action) {
              case "CREATE_PROJECT": {
                // Crea il progetto sul server
                // L'azione createProject fa un redirect, ma le Server Actions catturano i redirect come errori controllati o li gestiscono.
                // Per evitare problemi di redirect forzato, creiamo una mini fetch o andiamo ad invocare la action.
                // Nota: createProject originariamente reindirizza. Se fallisce o reindirizza, gestiamo l'ID.
                // Invece di usare createProject standard che ha redirect(), useremo il client di Supabase se disponibile o invochiamo createProject gestendolo.
                // Poiché il client può importare `@/lib/supabase/client`, creiamo un client Supabase client-side per aggirare i redirect server-side bloccanti in background!
                const { createClient } = await import("@/lib/supabase/client");
                const supabase = createClient() as any;
                const { data: { user } } = await supabase.auth.getUser();

                if (user) {
                  const { data, error } = await supabase
                    .from("projects")
                    .insert({ name: resolvedPayload.name, user_id: user.id, client_info: {} })
                    .select("id")
                    .single();
                  
                  if (!error && data) {
                    idMap[resolvedPayload.tempId] = data.id;

                    // Crea anche il livello di default se eravamo offline
                    await supabase.from("levels").insert({
                      project_id: data.id,
                      name: "Piano Terra (2D)",
                      elevation_z: 0,
                      drawing_type: "2d_wall",
                      piano: "Generico",
                    });
                  } else {
                    console.error("Errore sync CREATE_PROJECT:", error);
                  }
                }
                break;
              }
              case "RENAME_PROJECT": {
                await renameProject(resolvedPayload.projectId, resolvedPayload.newName);
                break;
              }
              case "DELETE_PROJECT": {
                await deleteProject(resolvedPayload.projectId);
                break;
              }
              case "ADD_LEVEL": {
                // Inserimento livello tramite Supabase client per aggirare redirect e prendere l'id reale
                const { createClient } = await import("@/lib/supabase/client");
                const supabase = createClient() as any;
                const { data, error } = await supabase
                  .from("levels")
                  .insert({
                    project_id: resolvedPayload.projectId,
                    name: resolvedPayload.name,
                    elevation_z: resolvedPayload.elevationZ,
                    drawing_type: resolvedPayload.drawingType,
                    piano: resolvedPayload.piano || "Generico",
                  })
                  .select("id")
                  .single();

                if (!error && data) {
                  idMap[resolvedPayload.tempId] = data.id;
                } else {
                  console.error("Errore sync ADD_LEVEL:", error);
                }
                break;
              }
              case "TOGGLE_LEVEL_COMPLETED": {
                await toggleLevelCompleted(resolvedPayload.levelId, resolvedPayload.completed);
                break;
              }
              case "SAVE_NOTE_ITEMS": {
                // Risolve ID di progetto e livello reali
                const realProjId = resolvedPayload.projectId;
                const realLvlId = resolvedPayload.levelId;
                let realNoteId = resolvedPayload.noteId;

                const { createClient } = await import("@/lib/supabase/client");
                const supabase = createClient() as any;

                // Se la nota ha un TempID, creiamo prima la nota nel database
                if (realNoteId.startsWith("temp_")) {
                  const { data: numData } = await supabase.rpc("next_field_note_number", { p_user_id: (await supabase.auth.getUser()).data.user?.id });
                  const { data: newNote, error } = await supabase
                    .from("field_notes")
                    .insert({
                      project_id: realProjId,
                      level_id: realLvlId,
                      user_id: (await supabase.auth.getUser()).data.user?.id,
                      note_number: numData || 1,
                      type_name: resolvedPayload.typeName || "Appunti Cantiere",
                    })
                    .select("id")
                    .single();

                  if (!error && newNote) {
                    idMap[resolvedPayload.noteId] = newNote.id;
                    realNoteId = newNote.id;
                  } else {
                    console.error("Errore creazione field_notes in sync:", error);
                    continue;
                  }
                }

                // Salva le voci note
                await updateFieldNote(realNoteId, {
                  project_id: realProjId,
                  level_id: realLvlId,
                  items: resolvedPayload.items,
                });
                break;
              }
              case "DELETE_NOTE": {
                await deleteFieldNote(resolvedPayload.noteId, resolvedPayload.projectId);
                break;
              }
              case "UPDATE_NOTE_TEXT": {
                await updateLevelNoteText(resolvedPayload.levelId, resolvedPayload.text);
                break;
              }
            }
          } catch (err) {
            console.error(`Errore nella sincronizzazione dell'operazione ${op.action}:`, err);
          }
        }

        // Ricalcola la cache locale post-sync per rinfrescare con gli ID reali
        set((state) => {
          const resolvedProjects: Record<string, Project> = {};
          for (const key in state.projects) {
            const realKey = idMap[key] ?? key;
            resolvedProjects[realKey] = { ...state.projects[key], id: realKey };
          }

          const resolvedLevels: Record<string, Level[]> = {};
          for (const key in state.levels) {
            const realKey = idMap[key] ?? key;
            resolvedLevels[realKey] = state.levels[key].map((lvl) => ({
              ...lvl,
              id: idMap[lvl.id] ?? lvl.id,
              project_id: realKey,
            }));
          }

          const resolvedNotes: Record<string, FieldNote> = {};
          for (const key in state.fieldNotes) {
            const realKey = idMap[key] ?? key;
            const note = state.fieldNotes[key];
            resolvedNotes[realKey] = {
              ...note,
              id: realKey,
              project_id: idMap[note.project_id] ?? note.project_id,
              level_id: note.level_id ? (idMap[note.level_id] ?? note.level_id) : null,
            };
          }

          return {
            projects: resolvedProjects,
            levels: resolvedLevels,
            fieldNotes: resolvedNotes,
            offlineQueue: [], // Pulisce la coda
            isSyncing: false,
          };
        });
      },

      clearQueue: () => set({ offlineQueue: [] }),
    }),
    {
      name: "abaco-offline-storage",
      storage: createJSONStorage(() => localStorage),
      // Escludi lo stato di connettività isOnline e isSyncing dal localStorage per evitare blocchi
      partialize: (state) => ({
        projects: state.projects,
        levels: state.levels,
        fieldNotes: state.fieldNotes,
        catalogMaterials: state.catalogMaterials,
        noteTypes: state.noteTypes,
        offlineQueue: state.offlineQueue,
      }),
    }
  )
);
