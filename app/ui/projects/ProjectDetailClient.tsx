"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateProjectNotes, renameProject, toggleLevelCompleted } from "@/app/actions/projects";
import ProjectActionsMenu from "@/app/ui/dashboard/ProjectActionsMenu";
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

  const [activePdfViewerUrl, setActivePdfViewerUrl] = useState<{ url: string; title: string } | null>(null);

  // Store offline Zustand
  const isOnline = useOfflineStore((state) => state.isOnline);
  const offlineMode = useOfflineStore((state) => state.offlineMode);
  const isOfflineActive = offlineMode || !isOnline;

  const setProjectsCache = useOfflineStore((state) => state.setProjectsCache);
  const setLevelsCache = useOfflineStore((state) => state.setLevelsCache);
  const setFieldNotesCache = useOfflineStore((state) => state.setFieldNotesCache);
  const addLevelOptimistic = useOfflineStore((state) => state.addLevelOptimistic);
  const renameProjectOptimistic = useOfflineStore((state) => state.renameProjectOptimistic);
  const toggleLevelCompletedOptimistic = useOfflineStore((state) => state.toggleLevelCompletedOptimistic);

  const cachedLevels = useOfflineStore((state) => state.levels[project.id]);
  const cachedFieldNotes = useOfflineStore((state) => state.fieldNotes);

  // Stati per accordion note, lightbox foto e completamento singola nota
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [activeLightboxUrl, setActiveLightboxUrl] = useState<string | null>(null);
  const [localCompletedNotes, setLocalCompletedNotes] = useState<Record<string, boolean>>({});

  const handleToggleNoteCompleted = (noteId: string, currentCompleted: boolean) => {
    const nextCompleted = !currentCompleted;
    setLocalCompletedNotes((prev) => ({ ...prev, [noteId]: nextCompleted }));

    if (isOfflineActive) {
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

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Leggi dinamicamente dallo store offline unendo i livelli del server
  const levelsToUse = useMemo(() => {
    if (!mounted) return drawings;
    if (!cachedLevels || cachedLevels.length === 0) return drawings;

    const queue = useOfflineStore.getState().offlineQueue;
    const allLevelsMap = new Map<string, Drawing>();
    drawings.forEach((d) => allLevelsMap.set(d.id, d as Drawing));

    cachedLevels.forEach((lvl) => {
      const isPending = lvl.id.startsWith("temp_") || queue.some(op => 
        (op.action === "ADD_LEVEL" && op.payload.tempId === lvl.id) ||
        (op.action === "TOGGLE_LEVEL_COMPLETED" && op.payload.levelId === lvl.id)
      );
      if (isPending || !allLevelsMap.has(lvl.id)) {
        allLevelsMap.set(lvl.id, lvl as Drawing);
      }
    });

    return Array.from(allLevelsMap.values());
  }, [drawings, cachedLevels, mounted]);

  const [activeTab, setActiveTab] = useState<"note" | "disegni" | "tagli" | "pdf">("note");

  // Unisce le note caricate dal server con quelle presenti nello store offline per questo progetto
  const projectNotes = useMemo(() => {
    if (!mounted) return notesList;

    const allNotesMap: Record<string, FieldNote> = {};
    notesList.forEach(n => { allNotesMap[n.id] = n; });

    const queue = useOfflineStore.getState().offlineQueue;
    Object.values(cachedFieldNotes).forEach(n => {
      if (n.project_id === project.id) {
        const isPending = n.id.startsWith("temp_") || queue.some(op => op.payload.noteId === n.id);
        if (isPending || !allNotesMap[n.id]) {
          allNotesMap[n.id] = n;
        }
      }
    });
    return Object.values(allNotesMap);
  }, [notesList, cachedFieldNotes, project.id, mounted]);

  const standardNotes = useMemo(() => {
    return projectNotes.filter((n) => n.type_name !== "Taglio" && n.type_name !== "PDF" && n.type_name !== "Disegno");
  }, [projectNotes]);

  const disegnoNotes = useMemo(() => {
    return projectNotes.filter((n) => n.type_name === "Disegno");
  }, [projectNotes]);

  const taglioNotes = useMemo(() => {
    return projectNotes.filter((n) => n.type_name === "Taglio");
  }, [projectNotes]);

  const pdfNotes = useMemo(() => {
    return projectNotes.filter((n) => n.type_name === "PDF");
  }, [projectNotes]);

  // Raggruppa le note per livello
  const notesByLevel = useMemo(() => {
    const map: Record<string, FieldNote[]> = {};
    const notesToGroup = activeTab === "note" ? standardNotes : [];
    notesToGroup.forEach((note) => {
      if (note.level_id) {
        if (!map[note.level_id]) map[note.level_id] = [];
        map[note.level_id].push(note);
      }
    });
    return map;
  }, [standardNotes, activeTab]);

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

  // Gestore per l'inserimento diretto di una nota senza modali
  const handleAddNoteDirectly = () => {
    // 1. Usa il primo livello disponibile se presente, altrimenti creane uno chiamato "Generico"
    let levelId;
    if (localDrawings.length > 0) {
      levelId = localDrawings[0].id;
    } else {
      levelId = generateTempId();
      addLevelOptimistic(levelId, project.id, "Generico", 0, "2d_wall", "Generico");
    }

    // 2. Crea la nota vuota optimisticamente
    const tempNoteId = generateTempId();
    const initialItems = [{ item_type: "nota" as const, value_text: "", sort_order: 0 }];
    useOfflineStore.getState().saveFieldNoteItemsOptimistic(
      tempNoteId,
      project.id,
      levelId,
      initialItems,
      "Appunti Cantiere"
    );

    router.push(`/projects/${project.id}/levels/${levelId}/appunti/${tempNoteId}/modifica`);
  };

  // Gestore per l'inserimento diretto di un piano di taglio senza modali
  const handleAddTaglioDirectly = () => {
    const tempNoteId = generateTempId();
    const initialItems = [
      { id: generateTempId(), item_type: "nota" as const, value_text: "Taglio: Nuovo Piano di Taglio", sort_order: 0 },
    ];
    useOfflineStore.getState().saveFieldNoteItemsOptimistic(
      tempNoteId,
      project.id,
      null, // level_id impostato a null (livello generale di progetto)
      initialItems,
      "Taglio"
    );
    router.push(`/projects/${project.id}/tagli/${tempNoteId}`);
  };

  // Gestore per l'inserimento diretto di un disegno di canalizzazione senza modali
  const handleAddDisegnoDirectly = () => {
    const tempNoteId = generateTempId();
    const initialItems = [
      { id: generateTempId(), item_type: "nota" as const, value_text: "Disegno: Nuovo Tracciato", sort_order: 0 },
    ];
    useOfflineStore.getState().saveFieldNoteItemsOptimistic(
      tempNoteId,
      project.id,
      null, // level_id nullo (livello generale di progetto)
      initialItems,
      "Disegno"
    );
    router.push(`/projects/${project.id}/disegni/${tempNoteId}`);
  };

  // Filtra le note del progetto che contengono elementi con pezzi da tagliare (nesting)
  const notesWithCuts = useMemo(() => {
    return projectNotes.filter((note) =>
      note.type_name !== "Taglio" &&
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
            items.push(`↔ Larghezza: ${item.value_num} ${item.value_unit || "cm"}${item.value_text ? ` (${item.value_text})` : ""}`);
          } else if (item.item_type === "altezza") {
            items.push(`↕ Altezza: ${item.value_num} ${item.value_unit || "cm"}${item.value_text ? ` (${item.value_text})` : ""}`);
          } else if (item.item_type === "spessore") {
            items.push(`↗ Spessore: ${item.value_num} ${item.value_unit || "cm"}${item.value_text ? ` (${item.value_text})` : ""}`);
          } else if (item.item_type === "dim_quadrata" && item.value_text) {
            try {
              const parsed = JSON.parse(item.value_text);
              const refStr = parsed.refTitle ? `[${parsed.refTitle}] ` : "";
              if (parsed.isCutPiece || (parsed.q !== undefined && parsed.q !== null)) {
                items.push(`✂️ Pezzo: ${refStr}${parsed.b || 0} x ${parsed.h || 0} ${parsed.unit || "cm"} (Qtà: ${parsed.q || 1})`);
              } else {
                items.push(`📐 Dim: ${refStr}${parsed.b || 0} x ${parsed.h || 0} ${parsed.unit || "cm"}`);
              }
            } catch {
              items.push(`📐 Dimensione quadrata`);
            }
          } else if (item.item_type === "dim_cubica" && item.value_text) {
            try {
              const parsed = JSON.parse(item.value_text);
              const refStr = parsed.refTitle ? `[${parsed.refTitle}] ` : "";
              items.push(`⬛ Vol: ${refStr}${parsed.b || 0} x ${parsed.h || 0} x ${parsed.d || 0} ${parsed.unit || "cm"}`);
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
      if (isOfflineActive) {
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

    if (isOfflineActive) {
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



        {/* Pulsante Aggiungi Nota */}
        <button
          type="button"
          onClick={handleAddNoteDirectly}
          disabled={isPending}
          className="flex items-center gap-1.5 sm:gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white transition-all duration-150 disabled:opacity-50 whitespace-nowrap focus:outline-none cursor-pointer hover:brightness-110 active:scale-95"
          style={{
            background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
            boxShadow: "0 4px 16px hsl(220 90% 56% / 0.25)",
          }}
        >
          <span>Aggiungi Nota ＋</span>
        </button>

        {/* Menu Azioni Progetto/Cantiere */}
        <div className="relative flex items-center justify-center p-1">
          <ProjectActionsMenu projectId={project.id} projectName={project.name} />
        </div>
      </div>

      {/* ── Tab Switcher di Navigazione Interna ── */}
      <div className="px-4 sm:px-8 pt-4 pb-0 flex gap-2 border-b border-white/5 print:hidden">
        <button
          type="button"
          onClick={() => setActiveTab("note")}
          className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === "note"
              ? "border-[hsl(220,90%,56%)] text-white"
              : "border-transparent text-white/40 hover:text-white/70"
          }`}
        >
          📝 Appunti & Disegni
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("disegni")}
          className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === "disegni"
              ? "border-[hsl(220,90%,56%)] text-white"
              : "border-transparent text-white/40 hover:text-white/70"
          }`}
        >
          📐 Disegno ({disegnoNotes.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("tagli")}
          className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === "tagli"
              ? "border-[hsl(220,90%,56%)] text-white"
              : "border-transparent text-white/40 hover:text-white/70"
          }`}
        >
          ✂️ Piani di Taglio ({taglioNotes.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("pdf")}
          className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === "pdf"
              ? "border-[hsl(220,90%,56%)] text-white"
              : "border-transparent text-white/40 hover:text-white/70"
          }`}
        >
          📄 PDF ({pdfNotes.length})
        </button>
      </div>

      {/* ── Contenuto Schede ── */}
      <div className="flex-1 p-4 sm:p-8 space-y-6 sm:space-y-8 overflow-y-auto">
        {activeTab === "note" && (
          groupedNotes.sortedPiani.length > 0 ? (
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
                              
                              const titleItem = note.field_note_items?.find((i: any) => i.item_type === "nota");
                              const ct = note.type_name?.trim();
                              const noteTitle = (ct && ct !== "Appunti Cantiere") ? ct : (titleItem?.value_text?.trim() || `Appunto #${note.note_number}`);
                              
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
                                      {/* Spunta Completato */}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleToggleNoteCompleted(note.id, isNoteCompleted);
                                        }}
                                        className="w-5 h-5 rounded-lg flex items-center justify-center border font-bold text-xs transition-colors hover:bg-white/5"
                                        style={{
                                          borderColor: isNoteCompleted ? "hsl(142 60% 45%)" : "hsl(220 20% 22%)",
                                          background: isNoteCompleted ? "hsl(142 60% 15% / 0.3)" : "transparent",
                                          color: isNoteCompleted ? "hsl(142 60% 55%)" : "transparent",
                                        }}
                                      >
                                        ✓
                                      </button>
                                      
                                      <div className="min-w-0 flex-1">
                                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                                          <span>{displayIcon}</span>
                                          <span className="truncate">{noteTitle}</span>
                                          <span 
                                            className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider"
                                            style={{
                                              background: is3D 
                                                ? "rgba(168, 85, 247, 0.15)" 
                                                : isSketchOrDesign 
                                                ? "rgba(245, 158, 11, 0.15)" 
                                                : isTaglio
                                                ? "rgba(16, 185, 129, 0.15)"
                                                : "rgba(14, 165, 233, 0.15)",
                                              color: is3D ? "#c084fc" : isSketchOrDesign ? "#fbbf24" : isTaglio ? "#10b981" : "#38bdf8",
                                            }}
                                          >
                                            {displayTag}
                                          </span>
                                        </div>
                                        <div className="text-[10px] text-white/30 mt-0.5 font-medium">
                                          Appunto #{note.note_number} · {mounted ? new Date(note.created_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      {/* Anteprima grafica fluttuante compatta */}
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

                                  {/* Sezione Espandibile Accordion */}
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
                                            if (item.item_type === "nota" && item.value_text) {
                                              desc = `📝 ${item.value_text}`;
                                            } else if (item.item_type === "materiale" && item.value_text) {
                                              desc = `📦 Materiale: ${item.value_text}`;
                                            } else if (item.item_type === "base" && item.value_num != null) {
                                              desc = `↔ Larghezza: ${item.value_num} ${item.value_unit || "cm"}${item.value_text ? ` (${item.value_text})` : ""}`;
                                            } else if (item.item_type === "altezza" && item.value_num != null) {
                                              desc = `↕ Altezza: ${item.value_num} ${item.value_unit || "cm"}${item.value_text ? ` (${item.value_text})` : ""}`;
                                            } else if (item.item_type === "spessore" && item.value_num != null) {
                                              desc = `↗ Spessore: ${item.value_num} ${item.value_unit || "cm"}${item.value_text ? ` (${item.value_text})` : ""}`;
                                            } else if (item.item_type === "lana_interna") {
                                              desc = `✓ Lana Interna: ${item.value_bool ? "Presente" : "Non presente"}`;
                                            } else if (item.item_type === "dipintura") {
                                              desc = `✓ Dipintura: ${item.value_bool ? "Presente" : "Non presente"}`;
                                            } else if (item.item_type === "dim_quadrata" && item.value_text) {
                                              try {
                                                const cv = JSON.parse(item.value_text);
                                                const refStr = cv.refTitle ? `[${cv.refTitle}] ` : "";
                                                if (cv.isCutPiece || (cv.q !== undefined && cv.q !== null)) {
                                                  desc = `✂️ Pezzo da taglio: ${refStr}${cv.b || 0}x${cv.h || 0} ${cv.unit || "cm"} (Qtà: ${cv.q || 1})`;
                                                } else {
                                                  desc = `📐 Dimensione: ${refStr}${cv.b || 0}x${cv.h || 0} ${cv.unit || "cm"}`;
                                                }
                                              } catch { desc = "📐 Dimensione quadrata"; }
                                            } else if (item.item_type === "dim_cubica" && item.value_text) {
                                              try {
                                                const cv = JSON.parse(item.value_text);
                                                const refStr = cv.refTitle ? `[${cv.refTitle}] ` : "";
                                                desc = `⬛ Volume: ${refStr}${cv.b || 0}x${cv.h || 0}x${cv.d || 0} ${cv.unit || "cm"}`;
                                              } catch { desc = "⬛ Dimensione Cubica"; }
                                            } else if (item.item_type === "posizione" && item.value_text) {
                                              try {
                                                const { x, y } = JSON.parse(item.value_text);
                                                desc = `📍 Posizione: x:${x}% y:${y}%`;
                                              } catch { desc = "📍 Posizione planimetria"; }
                                            }
                                            if (!desc) return null;
                                            return (
                                              <div 
                                                key={item.id} 
                                                className="px-3 py-2 rounded-lg"
                                                style={{ background: "hsl(220 32% 10% / 0.4)", border: "1px solid hsl(220 20% 16%)" }}
                                              >
                                                {desc}
                                              </div>
                                            );
                                          })}
                                      </div>

                                      {/* Foto Allegata in Accordion */}
                                      {note.field_note_items?.some(i => i.item_type === "foto") && (
                                        <div className="space-y-2">
                                          <div className="text-[10px] font-bold uppercase tracking-wider text-white/30">Allegati Visivi</div>
                                          <div className="flex flex-wrap gap-2">
                                            {note.field_note_items
                                              ?.filter(i => i.item_type === "foto")
                                              .map((foto) => {
                                                const is3D = is3DModelUrl(foto.value_text);
                                                if (is3D) {
                                                  return (
                                                    <div 
                                                      key={foto.id}
                                                      className="p-3 rounded-xl border flex flex-col gap-2 bg-[hsl(220,32%,10%)] border-[hsl(220,20%,18%)] w-full max-w-xs"
                                                    >
                                                      <span className="text-xs font-bold text-white flex items-center gap-1.5">🧊 Modello CAD 3D (.glb)</span>
                                                      <a 
                                                        href={foto.value_text || "#"} 
                                                        download={`pezzo_${foto.id.substring(0,6)}.glb`}
                                                        className="px-3 py-1.5 rounded-lg text-center font-semibold text-xs text-white bg-blue-600 hover:bg-blue-500 transition-colors w-full"
                                                      >
                                                        ⬇ Scarica File CAD
                                                      </a>
                                                    </div>
                                                  );
                                                }
                                                return (
                                                  <div 
                                                    key={foto.id} 
                                                    onClick={() => setActiveLightboxUrl(foto.value_text || null)}
                                                    className="w-24 h-24 rounded-lg overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center cursor-zoom-in group relative"
                                                  >
                                                    <img src={foto.value_text || ""} alt="Allegato" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold">
                                                      INGRANDISCI
                                                    </div>
                                                  </div>
                                                );
                                              })}
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
                          <div className="py-4 text-center text-xs text-white/30 italic">
                            Nessun appunto registrato in questo livello.
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
              <p className="text-sm" style={{ color: "hsl(215 15% 50%)" }}>Nessun appunto o disegno trovato.</p>
            </div>
          )
        )}

        {activeTab === "disegni" && (
          /* ── Tab Disegni Raggruppati ── */
          <div className="space-y-4">
            {disegnoNotes.length > 0 && (
              <div className="flex justify-end print:hidden">
                <button
                  type="button"
                  onClick={handleAddDisegnoDirectly}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 flex items-center gap-1 cursor-pointer"
                >
                  <span>📐</span> Nuovo Disegno Tratta
                </button>
              </div>
            )}
            {disegnoNotes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {disegnoNotes.map((note) => {
                  const titleItem = note.field_note_items?.find(i => i.item_type === "nota" && i.sort_order === 0);
                  const noteTitle = titleItem?.value_text?.replace("Disegno: ", "") || `Disegno #${note.note_number}`;
                  
                  const materialItem = note.field_note_items?.find(i => i.item_type === "materiale");
                  const matName = materialItem?.value_text || "Generico";

                  const segmentsItem = note.field_note_items?.find(i => i.item_type === "dim_quadrata" && i.sort_order === 1);
                  let segmentsCount = 0;
                  try {
                    if (segmentsItem?.value_text) {
                      const parsed = JSON.parse(segmentsItem.value_text);
                      if (Array.isArray(parsed)) segmentsCount = parsed.length;
                    }
                  } catch {}

                  const formattedDate = mounted ? new Date(note.created_at).toLocaleDateString("it-IT", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }) : "—";

                  return (
                    <div 
                      key={note.id}
                      onClick={() => router.push(`/projects/${project.id}/disegni/${note.id}`)}
                      className="p-5 bg-white/[0.015] border border-white/5 rounded-2xl flex flex-col justify-between gap-4 hover:bg-white/[0.03] transition-all cursor-pointer select-none"
                      style={{ borderColor: "hsl(220 20% 20% / 0.25)" }}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span
                            className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full"
                            style={{ background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.2)" }}
                          >
                            📐 3D Route
                          </span>
                          <span className="text-[10px] text-white/40">{formattedDate}</span>
                        </div>
                        <h4 className="text-sm font-bold text-white leading-snug">
                          {noteTitle}
                        </h4>
                        <div className="flex items-center gap-4 text-xs text-white/50 pt-1">
                          <span className="flex items-center gap-1">📦 <strong className="text-white/80 font-semibold">{matName}</strong></span>
                          <span className="flex items-center gap-1">📐 <strong className="text-white/80 font-semibold">{segmentsCount}</strong> {segmentsCount === 1 ? "segmento" : "segmenti"}</span>
                        </div>
                      </div>
                      
                      <div className="flex justify-end gap-2 border-t border-white/5 pt-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Sei sicuro di voler eliminare questo disegno di canalizzazione?")) {
                              useOfflineStore.getState().deleteFieldNoteOptimistic(note.id, project.id);
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 border border-red-500/10 transition-colors"
                        >
                          Elimina
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/projects/${project.id}/disegni/${note.id}`);
                          }}
                          className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white transition-all bg-[hsl(220,90%,56%)] hover:bg-[hsl(220,85%,48%)] active:scale-95 cursor-pointer"
                        >
                          Configura →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-16 text-center rounded-2xl border border-dashed border-white/10 bg-white/[0.01]">
                <div className="text-3xl mb-3">📐</div>
                <h4 className="text-sm font-bold text-white mb-1">Nessun disegno creato</h4>
                <p className="text-xs text-white/40 max-w-xs mx-auto mb-4">
                  Disegna un percorso 3D completo per canalizzazioni, calcolando i singoli spezzoni e raccordi.
                </p>
                <button
                  type="button"
                  onClick={handleAddDisegnoDirectly}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[hsl(220,90%,56%)] hover:bg-[hsl(220,85%,48%)] active:scale-95 cursor-pointer"
                >
                  Crea Primo Disegno
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "tagli" && (
          /* ── Tab Tagli Raggruppati ── */
          <div className="space-y-4">
            {taglioNotes.length > 0 && (
              <div className="flex justify-end print:hidden">
                <button
                  type="button"
                  onClick={handleAddTaglioDirectly}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 flex items-center gap-1 cursor-pointer"
                >
                  <span>✂️</span> Nuovo Piano di Taglio
                </button>
              </div>
            )}
            {taglioNotes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {taglioNotes.map((note) => {
                  const titleItem = note.field_note_items?.find(i => i.item_type === "nota" && i.sort_order === 0);
                  const noteTitle = titleItem?.value_text?.replace("Taglio: ", "") || `Taglio #${note.note_number}`;
                  
                  const materialItem = note.field_note_items?.find(i => i.item_type === "materiale");
                  const matName = materialItem?.value_text || "Generico";

                  const piecesCount = (note.field_note_items ?? []).filter(i => i.item_type === "dim_quadrata").length;
                  
                  const formattedDate = mounted ? new Date(note.created_at).toLocaleDateString("it-IT", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }) : "—";

                  return (
                    <div 
                      key={note.id}
                      onClick={() => router.push(`/projects/${project.id}/tagli/${note.id}`)}
                      className="p-5 bg-white/[0.015] border border-white/5 rounded-2xl flex flex-col justify-between gap-4 hover:bg-white/[0.03] transition-all cursor-pointer select-none"
                      style={{ borderColor: "hsl(220 20% 20% / 0.25)" }}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span
                            className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full"
                            style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.2)" }}
                          >
                            ✂️ Nesting Plan
                          </span>
                          <span className="text-[10px] text-white/40">{formattedDate}</span>
                        </div>
                        <h4 className="text-sm font-bold text-white leading-snug">
                          {noteTitle}
                        </h4>
                        <div className="flex items-center gap-4 text-xs text-white/50 pt-1">
                          <span className="flex items-center gap-1">📦 <strong className="text-white/80 font-semibold">{matName}</strong></span>
                          <span className="flex items-center gap-1">✂️ <strong className="text-white/80 font-semibold">{piecesCount}</strong> {piecesCount === 1 ? "pezzo" : "pezzi"}</span>
                        </div>
                      </div>
                      
                      <div className="flex justify-end gap-2 border-t border-white/5 pt-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Sei sicuro di voler eliminare questo piano di taglio?")) {
                              useOfflineStore.getState().deleteFieldNoteOptimistic(note.id, project.id);
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 border border-red-500/10 transition-colors"
                        >
                          Elimina
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/projects/${project.id}/tagli/${note.id}`);
                          }}
                          className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white transition-all bg-[hsl(220,90%,56%)] hover:bg-[hsl(220,85%,48%)] active:scale-95 cursor-pointer"
                        >
                          Configura →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-16 text-center rounded-2xl border border-dashed border-white/10 bg-white/[0.01]">
                <div className="text-3xl mb-3">✂️</div>
                <h4 className="text-sm font-bold text-white mb-1">Nessun piano di taglio creato</h4>
                <p className="text-xs text-white/40 max-w-xs mx-auto mb-4">
                  Crea un piano di taglio ottimizzato per ridurre lo sfrido di lamiera o profilati.
                </p>
                <button
                  type="button"
                  onClick={handleAddTaglioDirectly}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[hsl(220,90%,56%)] hover:bg-[hsl(220,85%,48%)] active:scale-95 cursor-pointer"
                >
                  Crea Primo Taglio
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "pdf" && (
          /* ── Tab Documenti PDF ── */
          <div className="space-y-4">
            {pdfNotes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pdfNotes.map((note) => {
                  const titleItem = note.field_note_items?.find(i => i.item_type === "nota" && i.sort_order === 0);
                  const noteTitle = titleItem?.value_text?.replace("PDF: ", "") || `Documento #${note.note_number}`;
                  
                  const fileItem = note.field_note_items?.find(i => i.item_type === "foto" && i.value_text?.startsWith("data:application/pdf"));
                  const pdfBase64 = fileItem?.value_text || "";

                  const formattedDate = mounted ? new Date(note.created_at).toLocaleDateString("it-IT", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }) : "—";

                  const handleDownload = (e: React.MouseEvent) => {
                    e.stopPropagation();
                    if (!pdfBase64) {
                      alert("File PDF non disponibile o vuoto.");
                      return;
                    }
                    try {
                      const pureBase64 = pdfBase64.includes("base64,") ? pdfBase64.split("base64,")[1] : pdfBase64;
                      const byteCharacters = atob(pureBase64);
                      const byteNumbers = new Array(byteCharacters.length);
                      for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                      }
                      const byteArray = new Uint8Array(byteNumbers);
                      const blob = new Blob([byteArray], { type: "application/pdf" });
                      
                      const link = document.createElement("a");
                      link.href = URL.createObjectURL(blob);
                      const cleanFilename = noteTitle.trim().replace(/[^a-z0-9]/gi, "_").toLowerCase() || "piano_di_taglio";
                      link.download = `${cleanFilename}.pdf`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    } catch (err) {
                      console.error("Errore durante il download del PDF:", err);
                      alert("Errore durante il download del file PDF.");
                    }
                  };

                  return (
                    <div 
                      key={note.id}
                      onClick={() => setActivePdfViewerUrl({ url: pdfBase64, title: noteTitle })}
                      className="p-5 bg-white/[0.015] border border-white/5 rounded-2xl flex flex-col justify-between gap-4 hover:bg-white/[0.03] transition-all cursor-pointer select-none"
                      style={{ borderColor: "hsl(220 20% 20% / 0.25)" }}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span
                            className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full"
                            style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.2)" }}
                          >
                            📄 PDF Document
                          </span>
                          <span className="text-[10px] text-white/40">{formattedDate}</span>
                        </div>
                        <h4 className="text-sm font-bold text-white leading-snug flex items-center gap-2">
                          <span className="text-red-500 text-base">📕</span>
                          <span className="truncate">{noteTitle}</span>
                        </h4>
                      </div>
                      
                      <div className="flex justify-end gap-2 border-t border-white/5 pt-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Sei sicuro di voler eliminare definitivamente questo documento PDF?")) {
                              useOfflineStore.getState().deleteFieldNoteOptimistic(note.id, project.id);
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 border border-red-500/10 transition-colors"
                        >
                          Elimina
                        </button>
                        <button
                          type="button"
                          onClick={handleDownload}
                          className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white transition-all bg-[hsl(220,90%,56%)] hover:bg-[hsl(220,85%,48%)] active:scale-95 cursor-pointer flex items-center gap-1.5"
                        >
                          <span>⬇</span> Scarica PDF
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-16 text-center rounded-2xl border border-dashed border-white/10 bg-white/[0.01]">
                <div className="text-3xl mb-3">📄</div>
                <h4 className="text-sm font-bold text-white mb-1">Nessun documento PDF salvato</h4>
                <p className="text-xs text-white/40 max-w-xs mx-auto mb-4">
                  I PDF generati e scaricati dall'officina di taglio verranno archiviati qui automaticamente.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Lightbox PDF Pieno Schermo */}
        {activePdfViewerUrl && (
          <div className="fixed inset-0 z-[110] flex flex-col bg-black/95 backdrop-blur-md p-4 transition-all duration-300">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4 print:hidden">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">📕 {activePdfViewerUrl.title}</h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!activePdfViewerUrl.url) {
                      alert("File PDF non disponibile o vuoto.");
                      return;
                    }
                    try {
                      const pureBase64 = activePdfViewerUrl.url.includes("base64,") ? activePdfViewerUrl.url.split("base64,")[1] : activePdfViewerUrl.url;
                      const byteCharacters = atob(pureBase64);
                      const byteNumbers = new Array(byteCharacters.length);
                      for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                      }
                      const byteArray = new Uint8Array(byteNumbers);
                      const blob = new Blob([byteArray], { type: "application/pdf" });
                      
                      const link = document.createElement("a");
                      link.href = URL.createObjectURL(blob);
                      const cleanFilename = activePdfViewerUrl.title.trim().replace(/[^a-z0-9]/gi, "_").toLowerCase() || "piano_di_taglio";
                      link.download = `${cleanFilename}.pdf`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    } catch (err) {
                      console.error("Errore durante il download del PDF:", err);
                      alert("Errore durante il download del file PDF.");
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs transition-colors shadow-lg cursor-pointer"
                >
                  ⬇ Scarica PDF
                </button>
                <button
                  onClick={() => setActivePdfViewerUrl(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs transition-colors shadow-lg cursor-pointer"
                >
                  Chiudi ✕
                </button>
              </div>
            </div>
            <div className="flex-1 w-full h-full overflow-hidden bg-white/5 rounded-xl">
              <embed src={activePdfViewerUrl.url} type="application/pdf" className="w-full h-full rounded-xl" />
            </div>
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