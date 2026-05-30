"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addLevel, updateProjectNotes, renameProject, toggleLevelCompleted } from "@/app/actions/projects";
import ProjectActionsMenu from "@/app/ui/dashboard/ProjectActionsMenu";
import CreateDrawingModal from "./CreateDrawingModal";
import type { FieldNote } from "@/app/actions/field-notes";
import { useOfflineStore, generateTempId } from "@/lib/stores/offline-store";


// ============================================
// Tipizzazione e utility
// ============================================

interface Project {
  id: string;
  name: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Drawing {
  id: string;
  project_id: string;
  name: string;
  elevation_z: number;
  plan_image_url?: string | null;
  scale_ratio?: string | null;
  created_at: string;
  completed?: boolean;
  piano?: string;
}

interface ProjectDetailClientProps {
  project: Project;
  drawings: Drawing[];
  notesList: FieldNote[];
}

function safeFormatDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

// Hook Debounce (Custom) per le note libere in calce
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// ============================================
// Componente Client Principale
// ============================================

export default function ProjectDetailClient({ project, drawings, notesList }: ProjectDetailClientProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  // Store offline Zustand
  const isOnline = useOfflineStore((state) => state.isOnline);
  const setProjectsCache = useOfflineStore((state) => state.setProjectsCache);
  const setLevelsCache = useOfflineStore((state) => state.setLevelsCache);
  const setFieldNotesCache = useOfflineStore((state) => state.setFieldNotesCache);
  const addLevelOptimistic = useOfflineStore((state) => state.addLevelOptimistic);
  const renameProjectOptimistic = useOfflineStore((state) => state.renameProjectOptimistic);
  const toggleLevelCompletedOptimistic = useOfflineStore((state) => state.toggleLevelCompletedOptimistic);

  // Leggi dinamicamente dallo store offline
  const cachedLevels = useOfflineStore((state) => state.levels[project.id]);
  const levelsToUse = cachedLevels && cachedLevels.length > 0 ? cachedLevels : drawings;

  // Inizializza la cache dello store all'avvio
  useEffect(() => {
    setProjectsCache([project as any]);
    setLevelsCache(project.id, drawings);
    setFieldNotesCache(notesList);
  }, [project, drawings, notesList, setProjectsCache, setLevelsCache, setFieldNotesCache]);

  // Stato note locali (completamento)
  const [localDrawings, setLocalDrawings] = useState<Drawing[]>(levelsToUse);

  // Stato per gli accordion aperti (dropdown note)
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});

  // Stato per le note autosave in calce
  const [notes, setNotes] = useState(project.notes ?? "");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const debouncedNotes = useDebounce(notes, 1000);
  
  // Stato per editare il titolo del cantiere
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(project.name);

  // Stato per modale "Aggiungi Nota"
  const [isCreatingLevel, setIsCreatingLevel] = useState(false);

  // Sincronizza lo stato locale quando cambiano i livelli dello store o le prop
  useEffect(() => {
    setLocalDrawings(levelsToUse);
  }, [levelsToUse]);


  // Calcola l'elenco dei piani unici già inseriti per proporli nel modale
  const existingPiani = useMemo(() => {
    const list = localDrawings.map((d) => d.piano || "Generico").filter(Boolean);
    return Array.from(new Set(list));
  }, [localDrawings]);

  // Genera una mappa con l'elenco formattato delle voci di ciascun appunto (Level)
  const formattedItemsMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    notesList.forEach((note) => {
      if (note.level_id) {
        const items: string[] = [];
        (note.field_note_items ?? []).forEach((item) => {
          if (item.item_type === "nota" && item.value_text) {
            items.push(`📝 ${item.value_text}`);
          } else if (item.item_type === "foto") {
            items.push("📷 Foto Allegata (Con Quote)");
          } else if (item.item_type === "base") {
            items.push(`↔ Larghezza: ${item.value_num} ${item.value_unit || "cm"}`);
          } else if (item.item_type === "altezza") {
            items.push(`↕ Altezza: ${item.value_num} ${item.value_unit || "cm"}`);
          } else if (item.item_type === "spessore") {
            items.push(`↗ Spessore: ${item.value_num} ${item.value_unit || "cm"}`);
          } else if (item.item_type === "dim_quadrata" && item.value_text) {
            try {
              const parsed = JSON.parse(item.value_text);
              items.push(`◻ Sezione: ${parsed.b || 0} x ${parsed.h || 0} ${parsed.unit || "cm"}`);
            } catch {
              items.push(`◻ Sezione Quadrata`);
            }
          } else if (item.item_type === "dim_cubica" && item.value_text) {
            try {
              const parsed = JSON.parse(item.value_text);
              items.push(`⬛ Vol: ${parsed.b || 0} x ${parsed.h || 0} x ${parsed.d || 0} ${parsed.unit || "cm"}`);
            } catch {
              items.push(`⬛ Dimensione Cubica`);
            }
          } else if (item.item_type === "materiale" && item.value_text) {
            items.push(`📦 Materiale: ${item.value_text}`);
          } else if (item.item_type === "lana_interna") {
            items.push(`✓ Lana Interna: ${item.value_bool ? "Presente" : "Non presente"}`);
          } else if (item.item_type === "dipintura") {
            items.push(`✓ Dipintura: ${item.value_bool ? "Presente" : "Non presente"}`);
          }
        });
        map[note.level_id] = items;
      }
    });
    return map;
  }, [notesList]);

  // Raggruppamento e ordinamento Note per Piano
  const groupedNotes = useMemo(() => {
    // 1. Applica il filtro di ricerca
    const filtered = localDrawings.filter((d) =>
      d.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // 2. Raggruppa per piano
    const groups: Record<string, Drawing[]> = {};
    filtered.forEach((d) => {
      const p = d.piano || "Generico";
      if (!groups[p]) groups[p] = [];
      groups[p].push(d);
    });

    // 3. Ordina le note dentro ciascun piano alfabeticamente
    Object.keys(groups).forEach((p) => {
      groups[p].sort((a, b) => a.name.localeCompare(b.name));
    });

    // 4. Ordina i piani in base alla quota media Z dei livelli contenuti
    const sortedPiani = Object.keys(groups).sort((a, b) => {
      const avgA = groups[a].reduce((sum, item) => sum + item.elevation_z, 0) / groups[a].length;
      const avgB = groups[b].reduce((sum, item) => sum + item.elevation_z, 0) / groups[b].length;
      return avgA - avgB;
    });

    return { groups, sortedPiani };
  }, [localDrawings, searchQuery]);

  // ============================================
  // Handlers
  // ============================================

  const handleCreateLevelSubmit = async (
    name: string,
    elevationZ: number,
    drawingType: "2d_wall" | "3d_box",
    piano: string
  ) => {
    if (!isOnline) {
      const tempId = generateTempId();
      addLevelOptimistic(tempId, project.id, name, elevationZ, "2d_wall", piano);
      setIsCreatingLevel(false);
      return;
    }

    const res = await addLevel(project.id, name, elevationZ, "2d_wall", piano);
    if (!res.success) {
      alert("Errore nella creazione della nota.");
    }
    setIsCreatingLevel(false);
    router.refresh();
  };

  const handleSaveTitle = () => {
    if (editTitle.trim() !== project.name && editTitle.trim()) {
      if (!isOnline) {
        renameProjectOptimistic(project.id, editTitle);
        setIsEditingTitle(false);
        return;
      }
      startTransition(async () => {
        await renameProject(project.id, editTitle);
        setIsEditingTitle(false);
      });
    } else {
      setIsEditingTitle(false);
      setEditTitle(project.name);
    }
  };

  // Cambia lo stato completato della nota a database
  const handleToggleCompleted = (levelId: string, currentCompleted: boolean) => {
    const nextCompleted = !currentCompleted;
    
    // Aggiornamento ottimistico dell'interfaccia client
    setLocalDrawings((prev) =>
      prev.map((d) => (d.id === levelId ? { ...d, completed: nextCompleted } : d))
    );

    if (!isOnline) {
      toggleLevelCompletedOptimistic(levelId, project.id, nextCompleted);
      return;
    }

    startTransition(async () => {
      const res = await toggleLevelCompleted(levelId, nextCompleted);
      if (!res.success) {
        // Rollback se fallisce
        setLocalDrawings((prev) =>
          prev.map((d) => (d.id === levelId ? { ...d, completed: currentCompleted } : d))
        );
        alert(res.error ?? "Impossibile aggiornare lo stato di completamento.");
      }
    });
  };


  // Toggle accordion espansione della riga nota
  const toggleAccordion = (levelId: string) => {
    setExpandedNotes((prev) => ({
      ...prev,
      [levelId]: !prev[levelId],
    }));
  };

  // Autosave note in calce
  useEffect(() => {
    if (debouncedNotes !== (project.notes ?? "")) {
      const saveNotes = async () => {
        setSaveStatus("saving");
        const res = await updateProjectNotes(project.id, debouncedNotes);
        if (res.success) {
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 2000);
        } else {
          setSaveStatus("error");
        }
      };
      saveNotes();
    }
  }, [debouncedNotes, project.id, project.notes]);

  return (
    <div className="flex flex-col h-full overflow-y-auto w-full animate-fade-in pb-4">
      {/* ── Breadcrumb e Header ───────────────────────────── */}
      <div className="px-4 sm:px-8 py-4 sm:py-6 space-y-3 sm:space-y-4">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs sm:text-sm font-medium" style={{ color: "hsl(215 15% 55%)" }}>
          <Link href="/projects" className="hover:text-white transition-colors">Note di Cantiere</Link>
          <span>/</span>
          <span className="text-white truncate max-w-[180px] sm:max-w-none">{project.name}</span>
        </div>

        {/* Titolo Cantiere */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="group flex items-center gap-2 sm:gap-3">
              {isEditingTitle ? (
                <input 
                  autoFocus
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={handleSaveTitle}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveTitle()}
                  className="text-xl sm:text-2xl font-bold bg-transparent border-b border-white outline-none w-full"
                  style={{ color: "hsl(210 40% 96%)" }}
                />
              ) : (
                <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2 truncate">
                  <span className="truncate">{project.name}</span>
                  <button 
                    onClick={() => setIsEditingTitle(true)}
                    className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-sm p-1 rounded-md bg-white/5 hover:bg-white/10"
                    title="Rinomina cantiere"
                  >
                    ✏️
                  </button>
                </h1>
              )}
            </div>
            <p className="mt-1 text-xs sm:text-sm" style={{ color: "hsl(215 15% 50%)" }}>
              Ultima modifica: {safeFormatDate(project.updated_at)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Barra Controlli (Cerca + Aggiungi) ───────────────────────────── */}
      <div 
        className="px-4 sm:px-8 py-3 sm:py-4 flex items-center gap-2 sm:gap-4 sticky top-0 z-10"
        style={{
          background: "hsl(222 47% 6%)",
          borderBottom: "1px solid hsl(220 20% 14%)",
          borderTop: "1px solid hsl(220 20% 14%)",
        }}
      >
        <div className="relative flex-1">
          <span
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm pointer-events-none"
            style={{ color: "hsl(215 15% 45%)" }}
          >
            🔍
          </span>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca note..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all"
            style={{
              background: "hsl(220 32% 12%)",
              border: "1px solid hsl(220 20% 20%)",
              color: "hsl(210 40% 96%)",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "hsl(220 90% 56%)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "hsl(220 20% 20%)")}
          />
        </div>

        {/* Pulsante Aggiungi Nota */}
        <button
          onClick={() => setIsCreatingLevel(true)}
          disabled={isPending}
          className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white transition-all duration-200 disabled:opacity-50 whitespace-nowrap focus:outline-none cursor-pointer"
          style={{
            background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
            boxShadow: "0 4px 16px hsl(220 90% 56% / 0.3)",
          }}
        >
          <span className="text-base leading-none">＋</span>
          <span>Aggiungi Nota</span>
        </button>

        {/* Menu Azioni Progetto/Cantiere */}
        <div className="relative flex items-center justify-center p-1">
          <ProjectActionsMenu projectId={project.id} projectName={project.name} />
        </div>
      </div>

      {/* ── Sezione Note Suddivise per Piano ──────────────────────── */}
      <div className="px-4 sm:px-8 py-4 sm:py-6 flex-1 space-y-6">
        {groupedNotes.sortedPiani.length > 0 ? (
          groupedNotes.sortedPiani.map((pianoName) => (
            <div key={pianoName} className="space-y-2.5">
              {/* Intestazione del Piano */}
              <h3
                className="text-xs font-extrabold uppercase tracking-wider pl-1 border-b pb-1.5"
                style={{ color: "hsl(220 90% 70%)", borderColor: "hsl(220 20% 16%)" }}
              >
                🏢 {pianoName}
              </h3>

              {/* Elenco Note di questo Piano */}
              <div
                className="rounded-2xl overflow-hidden divide-y"
                style={{
                  background: "hsl(220 26% 14% / 0.5)",
                  border: "1px solid hsl(220 20% 18%)",
                  borderColor: "hsl(220 20% 16%)",
                }}
              >
                {groupedNotes.groups[pianoName].map((note) => {
                  const isCompleted = !!note.completed;
                  const isExpanded = !!expandedNotes[note.id];
                  const items = formattedItemsMap[note.id] ?? [];

                  return (
                    <div
                      key={note.id}
                      className="transition-colors hover:bg-white/[0.01]"
                      style={{ borderBottom: "1px solid hsl(220 20% 16%)" }}
                    >
                      {/* Riga principale anteprima nota */}
                      <div className="flex items-center justify-between gap-3 p-4">
                        {/* Checkbox completato */}
                        <button
                          type="button"
                          onClick={() => handleToggleCompleted(note.id, isCompleted)}
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold transition-all flex-shrink-0"
                          style={{
                            background: isCompleted ? "hsl(142 60% 40%)" : "hsl(220 32% 10%)",
                            border: `1px solid ${isCompleted ? "hsl(142 60% 35%)" : "hsl(220 20% 22%)"}`,
                            color: isCompleted ? "white" : "transparent",
                          }}
                        >
                          ✓
                        </button>

                        {/* Nome Nota (Clic per espandere/comprimere l'accordion) */}
                        <div
                          onClick={() => toggleAccordion(note.id)}
                          className="flex-1 min-w-0 cursor-pointer select-none py-1 flex items-center gap-2"
                        >
                          <span
                            className="font-bold text-sm transition-all"
                            style={{
                              color: isCompleted ? "hsl(215 15% 45%)" : "white",
                              textDecoration: isCompleted ? "line-through" : "none",
                              opacity: isCompleted ? 0.5 : 1,
                            }}
                          >
                            {note.name}
                          </span>
                          <span className="text-[10px] text-white/30 transition-transform duration-200" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>
                            ▼
                          </span>
                        </div>

                        {/* Pulsante Modifica (Matita per aprire l'editor) */}
                        <Link
                          href={`/projects/${project.id}/levels/${note.id}/appunti`}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all bg-white/5 hover:bg-white/10 border border-white/5 flex-shrink-0"
                          title="Gestisci appunti e quote"
                        >
                          ✏️
                        </Link>
                      </div>

                      {/* Dropdown Accordion: Elenco rapido delle voci dell'appunto */}
                      {isExpanded && (
                        <div
                          className="px-6 pb-4 pt-1 animate-fade-in text-xs space-y-2 border-t border-dashed"
                          style={{ borderColor: "hsl(220 20% 16%)", background: "hsl(220 32% 8% / 0.4)" }}
                        >
                          {items.length > 0 ? (
                            <ul className="space-y-1.5">
                              {items.map((itemText, idx) => (
                                <li
                                  key={idx}
                                  className="text-white/70 leading-relaxed font-mono truncate"
                                >
                                  {itemText}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-white/40 italic">Nessuna misura o appunto inserito in questa nota. Premi ✏️ per aggiungerne.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="p-12 text-center rounded-2xl" style={{ border: "1px dashed hsl(220 20% 24%)", background: "hsl(220 26% 14%)" }}>
            <p className="text-sm" style={{ color: "hsl(215 15% 50%)" }}>Nessuna nota trovata per questo cantiere.</p>
          </div>
        )}
      </div>

      {/* ── Appunti Generali del Cantiere (Autosave in calce) ────────────────────── */}
      <div className="px-4 sm:px-8 mt-auto pt-4 sm:pt-6 border-t" style={{ borderColor: "hsl(220 20% 16%)" }}>
         <div className="flex items-center justify-between mb-3">
           <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(215 15% 45%)" }}>
             Note Generali del Cantiere
           </h2>
           <div className="text-[10px]" style={{ color: "hsl(215 15% 40%)" }}>
              {saveStatus === "saving" && <span className="animate-pulse">Salvataggio in corso...</span>}
              {saveStatus === "saved" && <span className="text-green-500">Salvato automaticamente ✓</span>}
              {saveStatus === "error" && <span className="text-red-500">Errore di salvataggio!</span>}
              {saveStatus === "idle" && <span>Modifiche salvate automaticamente</span>}
           </div>
         </div>
         
         <div 
           className="rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition-all"
           style={{ border: "1px solid hsl(220 20% 20%)", background: "hsl(220 26% 12%)" }}
         >
            <textarea 
              value={notes}
              onChange={(e) => {
                 setNotes(e.target.value);
                 if (saveStatus !== "saving") setSaveStatus("idle");
              }}
              placeholder="Scrivi qui annotazioni generali del cantiere, calcoli rapidi..."
              className="w-full min-h-[120px] p-4 bg-transparent resize-y outline-none text-xs leading-relaxed"
              style={{ color: "hsl(210 40% 90%)" }}
            />
         </div>
      </div>
      
      {isCreatingLevel && (
        <CreateDrawingModal
          title="Aggiungi Nota di Cantiere"
          submitLabel="Aggiungi"
          defaultName=""
          defaultPiano=""
          existingPiani={existingPiani}
          onClose={() => setIsCreatingLevel(false)}
          onSubmit={handleCreateLevelSubmit}
        />
      )}
    </div>
  );
}