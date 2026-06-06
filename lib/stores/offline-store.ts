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
  offlineMode: boolean; // Se forzata manuale
  
  // Cache locale
  projects: Record<string, Project>; // key: projectId
  levels: Record<string, Level[]>;    // key: projectId -> lista livelli
  fieldNotes: Record<string, FieldNote>; // key: noteId -> dettagli appunto
  catalogMaterials: Material[];
  noteTypes: FieldNoteType[];
  tempIdMap: Record<string, string>;

  // Coda offline
  offlineQueue: SyncOperation[];
  isSyncing: boolean;

  // Azioni di stato rete
  setOnlineStatus: (status: boolean) => void;
  setOfflineMode: (status: boolean) => Promise<void>;

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
  saveFieldNoteItemsOptimistic: (noteId: string, projectId: string, levelId: string | null, items: Omit<FieldNoteItem, "id">[], typeName?: string) => void;
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

export const isProjectPending = (queue: SyncOperation[], projectId: string) => {
  return queue.some(op => 
    (op.action === "CREATE_PROJECT" && op.payload.tempId === projectId) ||
    (op.action === "RENAME_PROJECT" && op.payload.projectId === projectId) ||
    (op.action === "DELETE_PROJECT" && op.payload.projectId === projectId)
  );
};

export const isLevelPending = (queue: SyncOperation[], levelId: string) => {
  return queue.some(op => 
    (op.action === "ADD_LEVEL" && op.payload.tempId === levelId) ||
    (op.action === "TOGGLE_LEVEL_COMPLETED" && op.payload.levelId === levelId)
  );
};

export const isNotePending = (queue: SyncOperation[], noteId: string) => {
  return queue.some(op => 
    (op.action === "SAVE_NOTE_ITEMS" && op.payload.noteId === noteId) ||
    (op.action === "DELETE_NOTE" && op.payload.noteId === noteId)
  );
};

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set, get) => ({
      isOnline: typeof window !== "undefined" ? window.navigator.onLine : true,
      offlineMode: false,
      projects: {},
      levels: {},
      fieldNotes: {},
      catalogMaterials: [],
      noteTypes: [],
      offlineQueue: [],
      isSyncing: false,
      tempIdMap: {},

      setOnlineStatus: (status) => set({ isOnline: status }),

      setOfflineMode: async (status) => {
        set({ offlineMode: status });
        if (!status && get().isOnline) {
          await get().syncOfflineData();
        }
      },

      setProjectsCache: (projects) => {
        const queue = get().offlineQueue;
        const cache: Record<string, Project> = {};
        projects.forEach((p) => {
          if (!isProjectPending(queue, p.id)) {
            cache[p.id] = p;
          }
        });
        set((state) => ({ projects: { ...state.projects, ...cache } }));
      },

      setLevelsCache: (projectId, levels) => {
        const queue = get().offlineQueue;
        set((state) => {
          const currentLevels = state.levels[projectId] ?? [];
          const updatedLevels = [...currentLevels];

          levels.forEach((serverLvl) => {
            if (!isLevelPending(queue, serverLvl.id)) {
              const idx = updatedLevels.findIndex((l) => l.id === serverLvl.id);
              if (idx > -1) {
                updatedLevels[idx] = serverLvl;
              } else {
                updatedLevels.push(serverLvl);
              }
            }
          });

          // Rimuovi eventuali livelli che sono stati rimossi sul server,
          // a meno che non siano livelli temporanei creati offline (che iniziano con temp_)
          // o che abbiano operazioni pendenti in coda.
          const serverIds = new Set(levels.map((l) => l.id));
          const filteredLevels = updatedLevels.filter((lvl) => 
            serverIds.has(lvl.id) || 
            lvl.id.startsWith("temp_") || 
            isLevelPending(queue, lvl.id)
          );

          return {
            levels: { ...state.levels, [projectId]: filteredLevels },
          };
        });
      },

      setFieldNotesCache: (notes) => {
        const queue = get().offlineQueue;
        const cache: Record<string, FieldNote> = {};
        notes.forEach((n) => {
          if (!isNotePending(queue, n.id)) {
            cache[n.id] = n;
          }
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

        // Accoda operazione
        const op: SyncOperation = {
          id: generateTempId(),
          action: "CREATE_PROJECT",
          payload: { tempId, name },
          timestamp: Date.now(),
        };
        set((state) => ({ offlineQueue: [...state.offlineQueue, op] }));

        if (!get().offlineMode && get().isOnline) {
          get().syncOfflineData();
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

        const op: SyncOperation = {
          id: generateTempId(),
          action: "RENAME_PROJECT",
          payload: { projectId, newName },
          timestamp: Date.now(),
        };
        set((state) => ({ offlineQueue: [...state.offlineQueue, op] }));

        if (!get().offlineMode && get().isOnline) {
          get().syncOfflineData();
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

        const op: SyncOperation = {
          id: generateTempId(),
          action: "DELETE_PROJECT",
          payload: { projectId },
          timestamp: Date.now(),
        };
        set((state) => ({ offlineQueue: [...state.offlineQueue, op] }));

        if (!get().offlineMode && get().isOnline) {
          get().syncOfflineData();
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

        const op: SyncOperation = {
          id: generateTempId(),
          action: "ADD_LEVEL",
          payload: { tempId, projectId, name, elevationZ, drawingType, piano },
          timestamp: Date.now(),
        };
        set((state) => ({ offlineQueue: [...state.offlineQueue, op] }));

        if (!get().offlineMode && get().isOnline) {
          get().syncOfflineData();
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

        const op: SyncOperation = {
          id: generateTempId(),
          action: "TOGGLE_LEVEL_COMPLETED",
          payload: { levelId, projectId, completed },
          timestamp: Date.now(),
        };
        set((state) => ({ offlineQueue: [...state.offlineQueue, op] }));

        if (!get().offlineMode && get().isOnline) {
          get().syncOfflineData();
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

        const op: SyncOperation = {
          id: generateTempId(),
          action: "SAVE_NOTE_ITEMS",
          payload: { noteId, projectId, levelId, items, typeName: typeName ?? "Appunti Cantiere" },
          timestamp: Date.now(),
        };
        set((state) => ({ offlineQueue: [...state.offlineQueue, op] }));

        if (!get().offlineMode && get().isOnline) {
          get().syncOfflineData();
        }
      },

      deleteFieldNoteOptimistic: (noteId, projectId) => {
        set((state) => {
          const newNotes = { ...state.fieldNotes };
          delete newNotes[noteId];
          return { fieldNotes: newNotes };
        });

        const op: SyncOperation = {
          id: generateTempId(),
          action: "DELETE_NOTE",
          payload: { noteId, projectId },
          timestamp: Date.now(),
        };
        set((state) => ({ offlineQueue: [...state.offlineQueue, op] }));

        if (!get().offlineMode && get().isOnline) {
          get().syncOfflineData();
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

        const op: SyncOperation = {
          id: generateTempId(),
          action: "UPDATE_NOTE_TEXT",
          payload: { levelId, text },
          timestamp: Date.now(),
        };
        set((state) => ({ offlineQueue: [...state.offlineQueue, op] }));

        if (!get().offlineMode && get().isOnline) {
          get().syncOfflineData();
        }
      },

      syncOfflineData: async () => {
        if (get().isSyncing) return;
        set({ isSyncing: true });

        try {
          // Importa Server Actions dinamicamente sul client
          const { createProject, renameProject, deleteProject, addLevel, toggleLevelCompleted } = await import("@/app/actions/projects");
          const { updateFieldNote, createFieldNote, deleteFieldNote, updateLevelNoteText } = await import("@/app/actions/field-notes");

          const queue = get().offlineQueue;
          if (queue.length === 0) {
            set({ isSyncing: false });
            return;
          }

          // Mappa di risoluzione degli ID temporanei a reali, ereditata dallo stato persistente
          const idMap: Record<string, string> = { ...get().tempIdMap };

          // Helper di auto-guarigione per risolvere ID orfani se il sync è stato interrotto o perso
          const healId = async (tempId: string | null | undefined, type: "project" | "level", contextId?: string | null): Promise<string | null> => {
            if (!tempId) return null;
            if (!tempId.startsWith("temp_")) return tempId;
            if (idMap[tempId]) return idMap[tempId];

            const { createClient } = await import("@/lib/supabase/client");
            const supabase = createClient() as any;

            try {
              if (type === "project") {
                const localProj = get().projects[tempId];
                if (localProj) {
                  const { data } = await supabase
                    .from("projects")
                    .select("id")
                    .eq("name", localProj.name)
                    .maybeSingle();
                  if (data) {
                    console.log(`%c[Sync Self-Healing]%c Progetto orfano risolto: ${tempId} -> ${data.id}`, "color: #eab308; font-weight: bold;", "color: inherit;");
                    idMap[tempId] = data.id;
                    set((state) => ({ tempIdMap: { ...state.tempIdMap, [tempId]: data.id } }));
                    return data.id;
                  }
                }
              } else if (type === "level" && contextId) {
                const resolvedProjId = idMap[contextId] ?? contextId;
                const localLvl = (get().levels[resolvedProjId] ?? []).find(l => l.id === tempId);
                if (localLvl) {
                  const { data } = await supabase
                    .from("levels")
                    .select("id")
                    .eq("project_id", resolvedProjId)
                    .eq("name", localLvl.name)
                    .maybeSingle();
                  if (data) {
                    console.log(`%c[Sync Self-Healing]%c Livello orfano risolto: ${tempId} -> ${data.id}`, "color: #eab308; font-weight: bold;", "color: inherit;");
                    idMap[tempId] = data.id;
                    set((state) => ({ tempIdMap: { ...state.tempIdMap, [tempId]: data.id } }));
                    return data.id;
                  }
                }
              }
            } catch (err) {
              console.warn("[Sync Self-Healing] Errore durante il ripristino dell'ID:", err);
            }
            return tempId;
          };

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

          const completedOps: string[] = [];

          console.log(
            `%c[Sync]%c Sincronizzazione offline avviata... (Elementi in coda: %c${queue.length}%c)`,
            "color: #10b981; font-weight: bold;",
            "color: inherit;",
            "color: #3b82f6; font-weight: bold;",
            "color: inherit;"
          );

          // Elabora in ordine sequenziale (FIFO)
          for (const op of queue) {
            const resolvedPayload = resolveIds(op.payload);
            try {
              switch (op.action) {
                case "CREATE_PROJECT": {
                  const { createClient } = await import("@/lib/supabase/client");
                  const supabase = createClient() as any;
                  const { data: { user } } = await supabase.auth.getUser();

                  if (user) {
                    // Prevenzione duplicazione: controlla se il progetto esiste già con questo nome
                    const { data: existingProj, error: checkError } = await supabase
                      .from("projects")
                      .select("id")
                      .eq("name", resolvedPayload.name)
                      .eq("user_id", user.id)
                      .maybeSingle();

                    if (!checkError && existingProj) {
                      console.log(`%c[Sync]%c Progetto "${resolvedPayload.name}" già esistente sul server. Recupero ID: ${existingProj.id}`, "color: #3b82f6; font-weight: bold;", "color: inherit;");
                      idMap[resolvedPayload.tempId] = existingProj.id;
                      set((state) => ({ tempIdMap: { ...state.tempIdMap, [resolvedPayload.tempId]: existingProj.id } }));
                      completedOps.push(op.id);
                      break;
                    }

                    const { data, error } = await supabase
                      .from("projects")
                      .insert({ name: resolvedPayload.name, user_id: user.id, client_info: {} })
                      .select("id")
                      .single();
                    
                    if (!error && data) {
                      idMap[resolvedPayload.tempId] = data.id;
                      set((state) => ({ tempIdMap: { ...state.tempIdMap, [resolvedPayload.tempId]: data.id } }));
                      completedOps.push(op.id);
                    } else {
                      throw error || new Error("CREATE_PROJECT failed");
                    }
                  } else {
                    throw new Error("Utente non autenticato");
                  }
                  break;
                }
                case "RENAME_PROJECT": {
                  const realProjId = await healId(resolvedPayload.projectId, "project");
                  const res = await renameProject(realProjId!, resolvedPayload.newName);
                  if (res && res.error) throw new Error(res.error);
                  completedOps.push(op.id);
                  break;
                }
                case "DELETE_PROJECT": {
                  const realProjId = await healId(resolvedPayload.projectId, "project");
                  const res = await deleteProject(realProjId!);
                  if (res && res.error) throw new Error(res.error);
                  completedOps.push(op.id);
                  break;
                }
                case "ADD_LEVEL": {
                  const realProjId = await healId(resolvedPayload.projectId, "project");
                  const { createClient } = await import("@/lib/supabase/client");
                  const supabase = createClient() as any;

                  // Prevenzione duplicazione: verifica se il livello esiste già sul server
                  const { data: existingLvl, error: checkError } = await supabase
                    .from("levels")
                    .select("id")
                    .eq("project_id", realProjId)
                    .eq("name", resolvedPayload.name)
                    .maybeSingle();

                  if (!checkError && existingLvl) {
                    console.log(`%c[Sync]%c Livello "${resolvedPayload.name}" già esistente sul server. Recupero ID: ${existingLvl.id}`, "color: #3b82f6; font-weight: bold;", "color: inherit;");
                    idMap[resolvedPayload.tempId] = existingLvl.id;
                    set((state) => ({ tempIdMap: { ...state.tempIdMap, [resolvedPayload.tempId]: existingLvl.id } }));
                    completedOps.push(op.id);
                    break;
                  }

                  const { data, error } = await supabase
                    .from("levels")
                    .insert({
                      project_id: realProjId,
                      name: resolvedPayload.name,
                      elevation_z: resolvedPayload.elevationZ,
                      drawing_type: resolvedPayload.drawingType,
                      piano: resolvedPayload.piano || "Generico",
                    })
                    .select("id")
                    .single();

                  if (!error && data) {
                    idMap[resolvedPayload.tempId] = data.id;
                    set((state) => ({ tempIdMap: { ...state.tempIdMap, [resolvedPayload.tempId]: data.id } }));
                    completedOps.push(op.id);
                  } else {
                    throw error || new Error("ADD_LEVEL failed");
                  }
                  break;
                }
                case "TOGGLE_LEVEL_COMPLETED": {
                  const realProjId = await healId(resolvedPayload.projectId, "project");
                  const realLvlId = await healId(resolvedPayload.levelId, "level", realProjId);
                  if (realLvlId && realLvlId.startsWith("temp_")) {
                    throw new Error("TOGGLE_LEVEL_COMPLETED level not synced yet");
                  }
                  const res = await toggleLevelCompleted(realLvlId!, resolvedPayload.completed);
                  if (res && res.error) throw new Error(res.error);
                  completedOps.push(op.id);
                  break;
                }
                case "SAVE_NOTE_ITEMS": {
                  const realProjId = await healId(resolvedPayload.projectId, "project");
                  if (realProjId && realProjId.startsWith("temp_")) {
                    throw new Error("SAVE_NOTE_ITEMS project not synced yet");
                  }

                  let realLvlId = await healId(resolvedPayload.levelId, "level", realProjId);
                  if (realLvlId && realLvlId.startsWith("temp_")) {
                    console.warn(`[Sync] Level ID ${realLvlId} non risolto. Impostato a null per evitare errori UUID.`);
                    realLvlId = null;
                  }

                  let realNoteId = resolvedPayload.noteId;

                  const { createClient } = await import("@/lib/supabase/client");
                  const supabase = createClient() as any;

                  if (realNoteId.startsWith("temp_")) {
                    if (idMap[realNoteId]) {
                      realNoteId = idMap[realNoteId];
                    } else {
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
                        set((state) => ({ tempIdMap: { ...state.tempIdMap, [resolvedPayload.noteId]: newNote.id } }));
                        realNoteId = newNote.id;
                      } else {
                        throw error || new Error("SAVE_NOTE_ITEMS parent note creation failed");
                      }
                    }
                  }

                  // 1. Carica i file Base64 accumulati offline su Supabase Storage
                  const { uploadBase64ToStorage } = await import("@/lib/supabase/storage");
                  const processedItems = [...resolvedPayload.items];
                  for (let i = 0; i < processedItems.length; i++) {
                    const item = processedItems[i];
                    if (item.value_text && item.value_text.startsWith("data:")) {
                      try {
                        const is3DModel = item.value_text.startsWith("data:model/") || item.value_text.startsWith("data:application/octet-stream") || item.value_text.startsWith("data:application/x-gltf");
                        const prefix = is3DModel ? "cad" : "foto";
                        console.log(`[Sync] Caricamento file base64 accumulato offline su storage (tipo: ${item.item_type})...`);
                        const publicUrl = await uploadBase64ToStorage(item.value_text, prefix);
                        processedItems[i] = { ...item, value_text: publicUrl };
                      } catch (uploadErr) {
                        console.error("Errore durante l'upload del file in background durante il sync:", uploadErr);
                        throw uploadErr;
                      }
                    }
                  }

                  const res = await updateFieldNote(realNoteId, {
                    project_id: realProjId!,
                    level_id: realLvlId,
                    type_name: resolvedPayload.typeName,
                    items: processedItems,
                  });
                  if (!res.success) throw new Error(res.error || "SAVE_NOTE_ITEMS items update failed");
                  completedOps.push(op.id);
                  break;
                }
                case "DELETE_NOTE": {
                  const realProjId = await healId(resolvedPayload.projectId, "project");
                  if (realProjId && realProjId.startsWith("temp_")) {
                    throw new Error("DELETE_NOTE project not synced yet");
                  }
                  const realNoteId = idMap[resolvedPayload.noteId] ?? resolvedPayload.noteId;
                  if (realNoteId.startsWith("temp_")) {
                    console.log(`[Sync] DELETE_NOTE per nota temporanea ${realNoteId} non creata sul server. Considerata completata.`);
                    completedOps.push(op.id);
                    break;
                  }
                  const res = await deleteFieldNote(realNoteId, realProjId!);
                  if (!res.success) throw new Error(res.error || "DELETE_NOTE failed");
                  completedOps.push(op.id);
                  break;
                }
                case "UPDATE_NOTE_TEXT": {
                  const realLvlId = await healId(resolvedPayload.levelId, "level", resolvedPayload.projectId);
                  if (realLvlId && realLvlId.startsWith("temp_")) {
                    throw new Error("UPDATE_NOTE_TEXT level not synced yet");
                  }
                  const res = await updateLevelNoteText(realLvlId!, resolvedPayload.text);
                  if (!res.success) throw new Error(res.error || "UPDATE_NOTE_TEXT failed");
                  completedOps.push(op.id);
                  break;
                }
              }
            } catch (err) {
              console.error(`Errore nella sincronizzazione dell'operazione ${op.action}:`, err);
              break;
            }
          }

          console.log(
            `%c[Sync]%c Sincronizzazione completata! (%c${completedOps.length}/${queue.length}%c operazioni elaborate)`,
            "color: #10b981; font-weight: bold;",
            "color: inherit;",
            "color: #3b82f6; font-weight: bold;",
            "color: inherit;"
          );

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
              offlineQueue: state.offlineQueue.filter((op) => !completedOps.includes(op.id)),
              isSyncing: false,
            };
          });
        } catch (err) {
          console.error("Errore generico in syncOfflineData:", err);
          set({ isSyncing: false });
        }
      },

      clearQueue: () => set({ offlineQueue: [] }),
    }),
    {
      name: "abaco-offline-storage",
      storage: createJSONStorage(() => localStorage),
      // Escludi lo stato di connettività isOnline e isSyncing dal localStorage per evitare blocchi
      partialize: (state) => ({
        offlineMode: state.offlineMode,
        projects: state.projects,
        levels: state.levels,
        fieldNotes: state.fieldNotes,
        catalogMaterials: state.catalogMaterials,
        noteTypes: state.noteTypes,
        offlineQueue: state.offlineQueue,
        tempIdMap: state.tempIdMap,
      }),
      // CRITICO: evita che Zustand idrati automaticamente il localStorage durante il rendering SSR.
      // L'idratazione viene eseguita manualmente nel NetworkSyncProvider (lato client) per
      // prevenire il mismatch HTML server/client che causa React Error #418.
      skipHydration: true,
    }
  )
);
