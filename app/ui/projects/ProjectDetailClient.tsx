"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateProjectNotes, renameProject, toggleLevelCompleted } from "@/app/actions/projects";
import ProjectActionsMenu from "@/app/ui/dashboard/ProjectActionsMenu";
import QuickAddModal from "./QuickAddModal";
import QuickAddTaglioModal from "./QuickAddTaglioModal";
import type { FieldNote } from "@/app/actions/field-notes";
import { toggleFieldNoteCompleted } from "@/app/actions/field-notes";
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

  // Stati per accordion note, lightbox foto e completamento singola nota
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [activeLightboxUrl, setActiveLightboxUrl] = useState<string | null>(null);
  const [localCompletedNotes, setLocalCompletedNotes] = useState<Record<string, boolean>>({});

  const handleToggleNoteCompleted = (noteId: string, currentCompleted: boolean) => {
    const nextCompleted = !currentCompleted;
    setLocalCompletedNotes((prev) => ({ ...prev, [noteId]: nextCompleted }));

    if (!isOnline) {
      // Aggiorna localmente lo store offline se la nota è presente nella cache
      const cached = cachedFieldNotes[noteId];
      if (cached) {
        useOfflineStore.getState().setFieldNotesCache([
          { ...cached, completed: nextCompleted } as FieldNote
        ]);
      }
      return;
    }

    startTransition(async () => {
      const res = await toggleFieldNoteCompleted(noteId, nextCompleted);
      if (res.success) {
        router.refresh();
      } else {
        setLocalCompletedNotes((prev) => ({ ...prev, [noteId]: currentCompleted }));
        alert("Errore durante l'aggiornamento dello stato della nota: " + res.error);
      }
    });
  };

  // Store offline Zustand
  const isOnline = useOfflineStore((state) => state.isOnline);
  const setProjectsCache = useOfflineStore((state) => state.setProjectsCache);
  const setLevelsCache = useOfflineStore((state) => state.setLevelsCache);
  const setFieldNotesCache = useOfflineStore((state) => state.setFieldNotesCache);
  const addLevelOptimistic = useOfflineStore((state) => state.addLevelOptimistic);
  const renameProjectOptimistic = useOfflineStore((state) => state.renameProjectOptimistic);
  const toggleLevelCompletedOptimistic = useOfflineStore((state) => state.toggleLevelCompletedOptimistic);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Leggi dinamicamente dallo store offline
  const cachedLevels = useOfflineStore((state) => state.levels[project.id]);
  const levelsToUse = mounted && cachedLevels && cachedLevels.length > 0 ? cachedLevels : drawings;
  const cachedFieldNotes = useOfflineStore((state) => state.fieldNotes);

  // Unisce le note caricate dal server con quelle presenti nello store offline per questo progetto
  const projectNotes = useMemo(() => {
    if (!mounted) return notesList; // Durante SSR/idratazione iniziale, usa solo i dati del server per evitare discrepanze UI

    const allNotesMap: Record<string, FieldNote> = {};
    notesList.forEach(n => { allNotesMap[n.id] = n; });
    Object.values(cachedFieldNotes).forEach(n => {
      if (n.project_id === project.id) {
        allNotesMap[n.id] = n;
      }
    });
    return Object.values(allNotesMap);
  }, [notesList, cachedFieldNotes, project.id, mounted]);

  // Raggruppa le note per livello
  const notesByLevel = useMemo(() => {
    const map: Record<string, FieldNote[]> = {};
    projectNotes.forEach((note) => {
      if (note.level_id) {
        if (!map[note.level_id]) map[note.level_id] = [];
        map[note.level_id].push(note);
      }
    });
    return map;
  }, [projectNotes]);

  // Inizializza la cache dello store all'avvio
  useEffect(() => {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    setProjectsCache([project as any]);
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    setLevelsCache(project.id, drawings as any);
    setFieldNotesCache(notesList);
  }, [project, drawings, notesList, setProjectsCache, setLevelsCache, setFieldNotesCache]);

  // Stato note locali (completamento)
  const [localDrawings, setLocalDrawings] = useState<Drawing[]>(levelsToUse as Drawing[]);

  // Stato per le note autosave in calce
  const [notes, setNotes] = useState(project.notes ?? "");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const debouncedNotes = useDebounce(notes, 1000);
  
  // Gestione collassabile note generali (default aperto se c'è testo salvato)
  const [notesOpen, setNotesOpen] = useState(notes.trim() !== "");
  
  // Stato per editare il titolo del cantiere
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(project.name);

  // Stati per inserimento rapido dropdown e modale
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [quickAddType, setQuickAddType] = useState<"nota" | "sketch" | "taglio" | null>(null);

  // Gestore per l'inserimento rapido dal dettaglio del progetto
  const handleQuickAddSubmit = async (title: string, pianoName: string) => {
    if (!quickAddType) return;
    
    // 1. Controlla se il livello esiste già offline
    let level = localDrawings.find(l => l.name.toLowerCase() === pianoName.toLowerCase());
    let levelId = level?.id;
    
    if (!levelId) {
      // Crea il livello optimisticamente
      levelId = generateTempId();
      addLevelOptimistic(
        levelId,
        project.id,
        pianoName,
        0,
        "2d_wall",
        pianoName
      );
    }
    
    // 2. Crea la nota optimisticamente in base al tipo
    const tempNoteId = generateTempId();
    
    if (quickAddType === "nota") {
      const initialItems = [{ item_type: "nota" as const, value_text: title, sort_order: 0 }];
      useOfflineStore.getState().saveFieldNoteItemsOptimistic(
        tempNoteId,
        project.id,
        levelId,
        initialItems,
        "Appunti Cantiere"
      );
      
      setQuickAddType(null);
      router.push(`/projects/${project.id}/levels/${levelId}/appunti/${tempNoteId}/modifica`);
    } else if (quickAddType === "sketch") {
      // Genera un foglio millimetrato Base64 iniziale
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 1200;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 1200, 1200);
        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 1;
        for (let i = 0; i < 1200; i += 40) {
          ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 1200); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(1200, i); ctx.stroke();
        }
      }
      const emptySketchBase64 = canvas.toDataURL("image/png");
      
      const initialItems = [
        { item_type: "nota" as const, value_text: title, sort_order: 0 },
        { item_type: "foto" as const, value_text: emptySketchBase64, sort_order: 1 }
      ];
      
      useOfflineStore.getState().saveFieldNoteItemsOptimistic(
        tempNoteId,
        project.id,
        levelId,
        initialItems,
        "Sketch"
      );
      
      setQuickAddType(null);
      router.push(`/projects/${project.id}/levels/${levelId}/appunti/${tempNoteId}/modifica`);
    }
  };

  // Filtra le note del progetto che contengono elementi con pezzi da tagliare (nesting)
  const notesWithCuts = useMemo(() => {
    return projectNotes.filter((note) =>
      (note.field_note_items ?? []).some(
        (item) =>
          item.item_type === "dim_quadrata" &&
          (item.value_text || item.composite) &&
          (() => {
            try {
              const parsed = item.value_text ? JSON.parse(item.value_text) : item.composite;
              return parsed && (parsed.isCutPiece || (parsed.q !== undefined && parsed.q !== null));
            } catch {
              return false;
            }
          })()
      )
    );
  }, [projectNotes]);

  const handleQuickAddTaglioSubmit = async (title: string, selectedNoteIds: string[]) => {
    // 1. Usa un livello chiamato "Generico", "Tagli" o "Taglio"
    let level = localDrawings.find((l) => l.name.toLowerCase() === "generico" || l.name.toLowerCase() === "tagli" || l.name.toLowerCase() === "taglio");
    let levelId = level?.id;

    if (!levelId) {
      levelId = generateTempId();
      addLevelOptimistic(levelId, project.id, "Generico", 0, "2d_wall", "Generico");
    }

    // 2. Crea la nota di tipo "Taglio"
    const tempNoteId = generateTempId();

    const initialItems: any[] = [
      { id: generateTempId(), item_type: "nota" as const, value_text: `Taglio: ${title}`, sort_order: 0 },
    ];

    const getNoteTitle = (note: any) => {
      const notaText = (note.field_note_items ?? []).find((i: any) => i.item_type === "nota")?.value_text;
      if (notaText?.trim()) return notaText;
      return `Appunto #${note.note_number ?? "Senza Numero"}`;
    };

    let order = 1;
    // Raccoglie gli elementi 'dim_quadrata' (pezzo da tagliare) e materiali correlati dalle note selezionate
    selectedNoteIds.forEach((noteId) => {
      const sourceNote = projectNotes.find((n) => n.id === noteId);
      if (sourceNote && sourceNote.field_note_items) {
        const sourceTitle = getNoteTitle(sourceNote);
        sourceNote.field_note_items.forEach((item) => {
          if (item.item_type === "dim_quadrata") {
            try {
              const parsed = item.value_text ? JSON.parse(item.value_text) : item.composite;
              if (parsed && (parsed.isCutPiece || (parsed.q !== undefined && parsed.q !== null))) {
                initialItems.push({
                  id: generateTempId(),
                  item_type: "dim_quadrata" as const,
                  value_text: JSON.stringify({ ...parsed, refTitle: sourceTitle }),
                  sort_order: order++,
                });
              }
            } catch {
              // ignora
            }
          } else if (item.item_type === "materiale" && (item.value_text || item.composite)) {
            let matText = item.value_text;
            if (!matText && item.composite) {
              matText = typeof item.composite === "string" ? item.composite : (item.composite.name || JSON.stringify(item.composite));
            }
            if (matText) {
              initialItems.push({
                id: generateTempId(),
                item_type: "materiale" as const,
                value_text: matText,
                sort_order: order++,
              });
            }
          }
        });
      }
    });

    useOfflineStore.getState().saveFieldNoteItemsOptimistic(
      tempNoteId,
      project.id,
      levelId,
      initialItems,
      "Taglio"
    );

    setQuickAddType(null);
    router.push(`/projects/${project.id}/tagli/${tempNoteId}`);
  };

  // Sincronizza lo stato locale quando cambiano i livelli dello store o le prop
  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setLocalDrawings(levelsToUse as Drawing[]);
  }, [levelsToUse]);


  // Calcola l'elenco dei piani unici già inseriti per proporli nel modale
  const existingPiani = useMemo(() => {
    const list = localDrawings.map((d) => d.piano || "Generico").filter(Boolean);
    return Array.from(new Set(list));
  }, [localDrawings]);

  // Mappa di associazione rapida levelId -> noteId per navigazione immediata senza redirector
  const levelToNoteIdMap = useMemo(() => {
    const map: Record<string, string> = {};
    notesList.forEach((n) => {
      if (n.level_id) {
        map[n.level_id] = n.id;
      }
    });
    return map;
  }, [notesList]);

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
              if (parsed.isCutPiece || (parsed.q !== undefined && parsed.q !== null)) {
                items.push(`✂️ Pezzo: ${parsed.b || 0} x ${parsed.h || 0} ${parsed.unit || "cm"} (Qtà: ${parsed.q || 1})`);
              } else {
                items.push(`📐 Dim: ${parsed.b || 0} x ${parsed.h || 0} ${parsed.unit || "cm"}`);
              }
            } catch {
              items.push(`📐 Dimensione quadrata`);
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
      <div className="px-4 sm:px-8 py-2 sm:py-3 border-b" style={{ borderColor: "hsl(220 20% 12%)" }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-4">
          <div className="min-w-0 flex items-center gap-2 sm:gap-3">
            {/* Breadcrumb + Titolo in linea */}
            <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "hsl(215 15% 50%)" }}>
              <Link href="/projects" className="hover:text-white transition-colors flex-shrink-0">Cantieri</Link>
              <span className="flex-shrink-0">/</span>
            </div>

            <div className="group flex items-center gap-1.5 min-w-0">
              {isEditingTitle ? (
                <input 
                  autoFocus
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={handleSaveTitle}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveTitle()}
                  className="text-base sm:text-lg font-bold bg-transparent border-b border-white outline-none w-full"
                  style={{ color: "hsl(210 40% 96%)" }}
                />
              ) : (
                <h1 className="text-base sm:text-lg font-bold text-white flex items-center gap-1.5 truncate">
                  <span className="truncate">{project.name}</span>
                  <button 
                    onClick={() => setIsEditingTitle(true)}
                    className="flex-shrink-0 opacity-60 sm:opacity-0 group-hover:opacity-100 transition-opacity text-xs p-1 rounded-md bg-white/5 hover:bg-white/10"
                    title={`Rinomina cantiere (Ultima modifica: ${mounted ? safeFormatDate(project.updated_at) : "—"})`}
                  >
                    ✏️
                  </button>
                </h1>
              )}
            </div>
          </div>

          <div className="text-[10px] sm:text-xs flex-shrink-0" style={{ color: "hsl(215 15% 45%)" }}>
            Ultima modifica: {mounted ? safeFormatDate(project.updated_at) : "—"}
          </div>
        </div>
      </div>

      {/* ── Barra Controlli (Cerca + Aggiungi) ───────────────────────────── */}
      <div 
        className="px-4 sm:px-8 py-1.5 sm:py-2 flex items-center gap-2 sm:gap-4 sticky top-0 z-10"
        style={{
          background: "hsl(222 47% 6%)",
          borderBottom: "1px solid hsl(220 20% 14%)",
          borderTop: "1px solid hsl(220 20% 14%)",
        }}
      >
        <div className="relative flex-1">
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none"
            style={{ color: "hsl(215 15% 45%)" }}
          >
            🔍
          </span>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca note..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none transition-all"
            style={{
              background: "hsl(220 32% 12%)",
              border: "1px solid hsl(220 20% 20%)",
              color: "hsl(210 40% 96%)",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "hsl(220 90% 56%)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "hsl(220 20% 20%)")}
          />
        </div>

        {/* Pulsante Report & Ottimizzazione */}
        <Link
          href={`/projects/${project.id}/report`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 whitespace-nowrap cursor-pointer"
        >
          <span>📊</span>
          <span className="hidden sm:inline">Report Cantiere</span>
          <span className="sm:hidden">Report</span>
        </Link>

        {/* Pulsante Dropdown Aggiungi ＋ */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowAddMenu(!showAddMenu)}
            disabled={isPending}
            className="flex items-center gap-1.5 sm:gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white transition-all duration-150 disabled:opacity-50 whitespace-nowrap focus:outline-none cursor-pointer hover:brightness-110 active:scale-95"
            style={{
              background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
              boxShadow: "0 4px 16px hsl(220 90% 56% / 0.25)",
            }}
          >
            <span>Aggiungi ＋</span>
          </button>
          
          {showAddMenu && (
            <div
              className="absolute right-0 mt-1.5 w-40 rounded-xl overflow-hidden z-50 border flex flex-col"
              style={{
                background: "hsl(220 26% 14%)",
                borderColor: "hsl(220 20% 22%)",
                boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setShowAddMenu(false);
                  setQuickAddType("nota");
                }}
                className="w-full text-left px-4 py-2.5 text-xs hover:bg-white/5 transition-colors text-white/90 flex items-center gap-2"
              >
                <span>📝</span> Nota
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddMenu(false);
                  setQuickAddType("sketch");
                }}
                className="w-full text-left px-4 py-2.5 text-xs hover:bg-white/5 transition-colors text-white/90 border-t border-white/5 flex items-center gap-2"
              >
                <span>🎨</span> Sketch (Disegno)
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddMenu(false);
                  setQuickAddType("taglio");
                }}
                className="w-full text-left px-4 py-2.5 text-xs hover:bg-white/5 transition-colors text-white/90 border-t border-white/5 flex items-center gap-2"
              >
                <span>✂️</span> Crea Taglio (Nesting)
              </button>
            </div>
          )}
        </div>

        {/* Menu Azioni Progetto/Cantiere */}
        <div className="relative flex items-center justify-center p-1">
          <ProjectActionsMenu projectId={project.id} projectName={project.name} />
        </div>
      </div>

      {/* ── Elenco Note Raggruppate per Piano ───────────────────────────── */}
      <div className="flex-1 p-4 sm:p-8 space-y-6 sm:space-y-8 overflow-y-auto">
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

              {/* Elenco Livelli di questo Piano */}
              <div
                className="rounded-2xl overflow-hidden divide-y flex flex-col"
                style={{
                  background: "hsl(220 26% 14% / 0.5)",
                  border: "1px solid hsl(220 20% 18%)",
                  borderColor: "hsl(220 20% 16%)",
                }}
              >
                {groupedNotes.groups[pianoName].map((lvl) => {
                  const levelNotesList = notesByLevel[lvl.id] ?? [];
                  
                  return (
                    <div key={lvl.id} className="p-4 space-y-3">
                      {/* Titolo Livello */}
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{lvl.name}</span>
                          <span className="text-[10px] text-white/40">({levelNotesList.length} elementi)</span>
                        </div>
                      </div>

                      {/* Lista elementi del livello */}
                      {levelNotesList.length > 0 ? (
                        <div className="space-y-2.5 pt-1">
                          {levelNotesList.map((note) => {
                            const typeName = note.type_name || "Appunti Cantiere";
                            
                            const is3DModelUrl = (url?: string | null) => {
                              if (!url) return false;
                              return url.startsWith("data:model/") || url.startsWith("data:application/octet-stream") || url.startsWith("data:application/x-gltf") || url.endsWith(".glb") || url.endsWith(".gltf");
                            };

                            const has3DModel = note.field_note_items?.some(i => i.item_type === "foto" && is3DModelUrl(i.value_text));
                            
                            // Troviamo eventuali foto o snapshot per la preview (prendiamo la prima foto che non è un modello 3D)
                            const fotoItem = note.field_note_items?.find(i => i.item_type === "foto" && !is3DModelUrl(i.value_text));
                            const previewUrl = fotoItem?.value_text;
                            
                            // Determinazione tag dinamico Disegno in presenza di foto normali
                            const hasFotoNormal = note.field_note_items?.some(i => i.item_type === "foto" && !is3DModelUrl(i.value_text));
                            const isTaglio = typeName === "Taglio";
                            const isSketchOrDesign = (typeName === "Sketch" || hasFotoNormal) && !has3DModel;
                            
                            const is3D = typeName === "Report 3D" || has3DModel;
                            
                            const displayIcon = isTaglio ? "✂️" : is3D ? "🧊" : isSketchOrDesign ? "🎨" : "📝";
                            const displayTag = isTaglio ? "Taglio" : is3D ? "3D" : isSketchOrDesign ? "Disegno" : "Nota";
                            
                            const titleItem = note.field_note_items?.find(i => i.item_type === "nota");
                            const noteTitle = titleItem?.value_text || `Appunto #${note.note_number}`;
                            
                            const isExpanded = !!expandedNotes[note.id];
                            const isNoteCompleted = localCompletedNotes[note.id] !== undefined 
                              ? localCompletedNotes[note.id] 
                              : !!note.completed;
                            
                            return (
                              <div 
                                key={note.id} 
                                onClick={() => setExpandedNotes(prev => ({ ...prev, [note.id]: !prev[note.id] }))}
                                className="p-3.5 bg-white/[0.015] border border-white/5 rounded-xl flex flex-col gap-1 hover:bg-white/[0.03] transition-colors cursor-pointer select-none"
                                style={{
                                  borderColor: isNoteCompleted ? "hsl(142 60% 40% / 0.15)" : "hsl(220 20% 20% / 0.25)",
                                }}
                              >
                                <div className="flex items-center justify-between gap-3 w-full">
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    {/* Spunta Completato (Punto 2) */}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleNoteCompleted(note.id, isNoteCompleted);
                                      }}
                                      className="w-5 h-5 rounded-full flex items-center justify-center border transition-all flex-shrink-0 cursor-pointer"
                                      style={{
                                        background: isNoteCompleted ? "hsl(142 60% 40% / 0.2)" : "transparent",
                                        borderColor: isNoteCompleted ? "hsl(142 60% 40%)" : "rgba(255, 255, 255, 0.25)",
                                        color: isNoteCompleted ? "hsl(142 60% 55%)" : "transparent"
                                      }}
                                      title={isNoteCompleted ? "Segna come da completare" : "Segna come completato"}
                                    >
                                      <span className="text-[10px] font-bold">✓</span>
                                    </button>

                                    {/* Icona in base al tipo */}
                                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-base flex-shrink-0">
                                      {displayIcon}
                                    </div>
                                    
                                    {/* Testo e tipo */}
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`text-white text-xs font-bold break-words min-w-0 ${isNoteCompleted ? "line-through opacity-50" : ""}`}>
                                          {noteTitle}
                                        </span>
                                        <span className="text-[8px] uppercase font-mono px-1.5 py-0.5 rounded-full font-extrabold"
                                          style={{
                                            background: isSketchOrDesign ? "rgba(245, 158, 11, 0.15)" : is3D ? "rgba(168, 85, 247, 0.15)" : "rgba(14, 165, 233, 0.15)",
                                            color: isSketchOrDesign ? "#fbbf24" : is3D ? "#c084fc" : "#38bdf8",
                                            border: `1px solid ${isSketchOrDesign ? "rgba(245, 158, 11, 0.3)" : is3D ? "rgba(168, 85, 247, 0.3)" : "rgba(14, 165, 233, 0.3)"}`
                                          }}
                                        >
                                          {displayTag}
                                        </span>
                                        {isNoteCompleted && (
                                          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                            COMPLETATO
                                          </span>
                                        )}
                                      </div>
                                      
                                      {/* Sotto-dettagli compatti (se non espanso) */}
                                      {!isExpanded && (
                                        <div className="text-[10px] text-white/40 mt-1 break-words leading-relaxed">
                                          {(note.field_note_items ?? [])
                                            .filter(i => i.item_type !== "nota" && i.item_type !== "foto")
                                            .map(i => {
                                              if (i.item_type === "base") return `↔ ${i.value_num}${i.value_unit || "cm"}`;
                                              if (i.item_type === "altezza") return `↕ ${i.value_num}${i.value_unit || "cm"}`;
                                              if (i.item_type === "spessore") return `↗ ${i.value_num}${i.value_unit || "cm"}`;
                                              if (i.item_type === "materiale") return `📦 ${i.value_text}`;
                                              return "";
                                            })
                                            .filter(Boolean)
                                            .join(" · ") || (isSketchOrDesign ? "Disegno a mano libera / quotato" : is3D ? "Modello 3D esterno con snapshot" : "Nessuna misura")}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    {/* Anteprima grafica fluttuante compatta (se presente) */}
                                    {previewUrl && !isExpanded && (
                                      <div 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveLightboxUrl(previewUrl);
                                        }}
                                        className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center flex-shrink-0 cursor-zoom-in"
                                      >
                                        <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
                                      </div>
                                    )}
                                    
                                    {/* Pulsante Modifica */}
                                    <Link
                                      href={isTaglio ? `/projects/${project.id}/tagli/${note.id}` : `/projects/${project.id}/levels/${lvl.id}/appunti/${note.id}/modifica`}
                                      onClick={(e) => e.stopPropagation()}
                                      className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-white transition-all bg-white/5 border border-white/10 hover:bg-white/10"
                                    >
                                      {isTaglio ? "✂️ Configura" : isSketchOrDesign ? "✏️ Disegna" : is3D ? "👁 Visualizza" : "✏️ Modifica"}
                                    </Link>

                                    {/* Indicatore espansione */}
                                    <span className="text-[10px] text-white/30 transition-transform duration-200" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>
                                      ▼
                                    </span>
                                  </div>
                                </div>

                                {/* Sezione Espandibile Accordion (Punto 4 e 5) */}
                                {isExpanded && (
                                  <div 
                                    className="mt-3.5 pt-3.5 border-t border-white/5 space-y-3.5 w-full text-left"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                      {(note.field_note_items ?? [])
                                        .filter(i => i.item_type !== "foto")
                                        .sort((a, b) => a.sort_order - b.sort_order)
                                        .map((item) => {
                                          let desc = "";
                                          let icon = "📝";
                                          const valNum = item.value_num;
                                          const valUnit = item.value_unit || "mm";
                                          const valBool = item.value_bool;
                                          const valText = item.value_text || "";

                                          switch (item.item_type) {
                                            case "base":
                                              desc = `Base: ${valNum} ${valUnit}`;
                                              icon = "↔";
                                              break;
                                            case "altezza":
                                              desc = `Altezza: ${valNum} ${valUnit}`;
                                              icon = "↕";
                                              break;
                                            case "spessore":
                                              desc = `Spessore: ${valNum} ${valUnit}`;
                                              icon = "↗";
                                              break;
                                            case "lana_interna":
                                              desc = `Lana Interna: ${valBool ? "Sì" : "No"}`;
                                              icon = "🔥";
                                              break;
                                            case "dipintura":
                                              desc = `Dipintura: ${valBool ? "Sì" : "No"}`;
                                              icon = "🎨";
                                              break;
                                            case "dim_quadrata":
                                              try {
                                                const parsed = valText ? JSON.parse(valText) : {};
                                                if (parsed.isCutPiece || (parsed.q !== undefined && parsed.q !== null)) {
                                                  desc = `Pezzo da tagliare: ${parsed.b || 0} x ${parsed.h || 0} ${parsed.unit || "cm"} (Qtà: ${parsed.q})`;
                                                  icon = "✂️";
                                                } else {
                                                  desc = `Dimensione quadrata: ${parsed.b || 0} x ${parsed.h || 0} ${parsed.unit || "cm"}`;
                                                  icon = "📐";
                                                }
                                              } catch {
                                                desc = `Dimensione quadrata: ${valNum || 0} ${valUnit || "cm"}`;
                                                icon = "📐";
                                              }
                                              break;
                                            case "dim_cubica":
                                              try {
                                                const parsed = valText ? JSON.parse(valText) : {};
                                                desc = `Sezione 3D: ${parsed.b || 0} x ${parsed.h || 0} x ${parsed.d || 0} ${parsed.unit || "cm"}`;
                                              } catch {
                                                desc = `Dimensione Cubica: ${valNum || 0} ${valUnit || "cm"}`;
                                              }
                                              icon = "⬛";
                                              break;
                                            case "materiale":
                                              desc = `Materiale: ${valText}`;
                                              icon = "🪵";
                                              break;
                                            case "nota":
                                              desc = valText;
                                              icon = "📝";
                                              break;
                                            case "posizione":
                                              desc = `Posizione: ${valText}`;
                                              icon = "📍";
                                              break;
                                            default:
                                              desc = `${item.item_type}: ${valText || valNum || ""}`;
                                          }

                                          return (
                                            <div 
                                              key={item.id} 
                                              className="flex items-start gap-2.5 px-3 py-2 rounded-xl border border-white/5 bg-white/[0.015]"
                                              style={{ color: "hsl(210 40% 90%)" }}
                                            >
                                              <span className="w-5 h-5 rounded bg-white/5 flex items-center justify-center text-[10px] font-mono flex-shrink-0">
                                                {icon}
                                              </span>
                                              <span className="break-words whitespace-pre-wrap leading-snug text-xs">{desc}</span>
                                            </div>
                                          );
                                        })}
                                    </div>

                                    {/* Immagine Allegata in Grande */}
                                    {previewUrl && (
                                      <div className="space-y-1.5 pt-1">
                                        <span className="text-[9px] uppercase font-extrabold text-white/40 tracking-wider">📸 Allegato Visivo (Clicca per ingrandire)</span>
                                        <div 
                                          onClick={() => setActiveLightboxUrl(previewUrl)}
                                          className="w-full max-w-md h-48 rounded-xl overflow-hidden border border-white/10 bg-black/25 flex items-center justify-center cursor-zoom-in hover:border-white/20 transition-all shadow-inner"
                                        >
                                          <img src={previewUrl} alt="Visualizzazione" className="w-full h-full object-contain hover:scale-[1.015] transition-transform duration-300" />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[11px] text-white/30 italic py-2">
                          Nessun elemento ancora inserito. Clicca su Aggiungi in alto o usa i pulsanti rapidi sulla card.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="p-12 text-center rounded-2xl" style={{ border: "1px dashed hsl(220 20% 24%)", background: "hsl(220 26% 14%)" }}>
            <p className="text-sm" style={{ color: "hsl(215 15% 50%)" }}>Nessun elemento corrispondente alla ricerca.</p>
          </div>
        )}
      </div>

      {/* ── Appunti Generali del Cantiere (Autosave in calce) ────────────────────── */}
      <div className="px-4 sm:px-8 mt-auto pt-2 pb-2 border-t" style={{ borderColor: "hsl(220 20% 16%)" }}>
         <div className="flex items-center justify-between mb-2">
           <button
             type="button"
             onClick={() => setNotesOpen((o) => !o)}
             className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider focus:outline-none select-none hover:text-white transition-colors"
             style={{ color: "hsl(215 15% 45%)" }}
           >
             <span>🏢 Note Generali del Cantiere</span>
             <span className="text-[9px] transition-transform duration-200" style={{ transform: notesOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
               ▼
             </span>
           </button>
           <div className="text-[10px]" style={{ color: "hsl(215 15% 40%)" }}>
              {saveStatus === "saving" && <span className="animate-pulse">Salvataggio...</span>}
              {saveStatus === "saved" && <span className="text-green-500">Salvato ✓</span>}
              {saveStatus === "error" && <span className="text-red-500">Errore!</span>}
              {saveStatus === "idle" && notesOpen && <span>Salvataggio automatico</span>}
           </div>
         </div>
         
         {notesOpen && (
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
                className="w-full min-h-[80px] p-3 bg-transparent resize-y outline-none text-xs leading-relaxed"
                style={{ color: "hsl(210 40% 90%)" }}
              />
            </div>
         )}
      </div>

      {/* Modale Inserimento Rapido */}
      {quickAddType && quickAddType !== "taglio" && (
        <QuickAddModal
          type={quickAddType}
          existingPiani={existingPiani}
          onClose={() => setQuickAddType(null)}
          onSubmit={handleQuickAddSubmit}
        />
      )}

      {quickAddType === "taglio" && (
        <QuickAddTaglioModal
          notesWithCuts={notesWithCuts}
          onClose={() => setQuickAddType(null)}
          onSubmit={handleQuickAddTaglioSubmit}
        />
      )}

      {/* Lightbox Pieno Schermo */}
      {activeLightboxUrl && (
        <div 
          onClick={() => setActiveLightboxUrl(null)}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 cursor-zoom-out transition-all duration-300"
        >
          <div className="relative max-w-5xl max-h-[90vh] overflow-hidden flex flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <img src={activeLightboxUrl} alt="Visualizzazione pieno schermo" className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
            <button
              onClick={() => setActiveLightboxUrl(null)}
              className="absolute top-4 right-4 z-50 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs transition-all shadow-lg cursor-pointer"
            >
              Chiudi ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}