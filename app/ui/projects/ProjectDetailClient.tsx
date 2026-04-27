"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addLevel, updateProjectNotes, renameProject } from "@/app/actions/projects";
import ProjectActionsMenu from "@/app/ui/dashboard/ProjectActionsMenu";
import CreateDrawingModal from "./CreateDrawingModal";
import LevelCard from "./LevelCard";

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
  scale_ratio?: number | null;
  created_at: string;
}

interface ProjectDetailClientProps {
  project: Project;
  drawings: Drawing[];
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

// Genera avatar gradient in base all'id
const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
  "linear-gradient(135deg, hsl(16 100% 58%), hsl(0 84% 55%))",
  "linear-gradient(135deg, hsl(142 71% 45%), hsl(160 60% 38%))",
];

function avatarGradient(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash) + id.charCodeAt(i);
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

// ============================================
// Hook Hook Debounce (Custom)
// ============================================

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

export default function ProjectDetailClient({ project, drawings }: ProjectDetailClientProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  // Stato per le note autosave
  const [notes, setNotes] = useState(project.notes ?? "");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const debouncedNotes = useDebounce(notes, 1000); // 1s di debounce
  
  // Stato per editare il titolo progetto
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(project.name);

  // Stato per modale "Crea/Copia Disegno"
  const [isCreatingLevel, setIsCreatingLevel] = useState(false);
  const [levelTemplate, setLevelTemplate] = useState<{name: string, elevation_z: number} | null>(null);

  // Filtraggio disegni
  const filteredDrawings = drawings.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ============================================
  // Handlers
  // ============================================

  const handleCreateLevelSubmit = async (name: string, elevationZ: number) => {
    const res = await addLevel(project.id, name, elevationZ);
    if (!res.success) {
      alert("Errore nella creazione del disegno 2D.");
    }
    setIsCreatingLevel(false);
    setLevelTemplate(null);
  };

  const openCreateModal = (template?: {name: string, elevation_z: number}) => {
    setLevelTemplate(template || null);
    setIsCreatingLevel(true);
  };

  const handleSaveTitle = () => {
    if (editTitle.trim() !== project.name && editTitle.trim()) {
      startTransition(async () => {
        await renameProject(project.id, editTitle);
        setIsEditingTitle(false);
      });
    } else {
      setIsEditingTitle(false);
      setEditTitle(project.name);
    }
  };

  // Autosave notes
  useEffect(() => {
    // Si avvia solo se è cambiato rispetto al caricamento o precedente salvataggio 
    // Manca un check stringente per "non salvare al primo render", ma lo copriamo col debounce
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
          <Link href="/projects" className="hover:text-white transition-colors">Progetti</Link>
          <span>/</span>
          <span className="text-white truncate max-w-[180px] sm:max-w-none">{project.name}</span>
        </div>

        {/* Titolo Progetto */}
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
                    title="Rinomina progetto"
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

      {/* ── Barra Controlli (Search + Add) ───────────────────────────── */}
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
            placeholder="Cerca disegni/piani..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all"
            style={{
              background: "hsl(220 32% 12%)",
              border: "1px solid hsl(220 20% 20%)",
              color: "hsl(210 40% 96%)",
            }}
            onFocus={(e) =>
              (e.currentTarget.style.borderColor = "hsl(220 90% 56%)")
            }
            onBlur={(e) =>
              (e.currentTarget.style.borderColor = "hsl(220 20% 20%)")
            }
          />
        </div>

        {/* Dropdown Creatore Disegni */}
        <div className="relative group">
           <button
            disabled={isPending}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white transition-all duration-200 disabled:opacity-50 whitespace-nowrap peer focus:outline-none"
            style={{
              background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
              boxShadow: "0 4px 16px hsl(220 90% 56% / 0.3)",
            }}
          >
            <span className="text-base leading-none">＋</span>
            <span className="hidden sm:inline">Crea Disegno</span>
            <span className="sm:hidden">Nuovo</span>
            ▾
          </button>
          
          {/* Dropdown Menu */}
          <div 
             className="absolute right-0 mt-2 w-48 rounded-xl overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible peer-focus:opacity-100 peer-focus:visible hover:opacity-100 hover:visible transition-all duration-200 transform origin-top translate-y-1 group-hover:translate-y-0 peer-focus:translate-y-0"
             style={{
               background: "hsl(220 26% 14%)",
               border: "1px solid hsl(220 20% 22%)",
               boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
               zIndex: 50
             }}
          >
            <button 
              onClick={() => openCreateModal()}
              disabled={isPending}
              className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition-colors flex items-center justify-between group/item"
              style={{ color: "hsl(210 40% 96%)" }}
            >
              <span>Disegno 2D (Piano)</span>
              <span className="opacity-0 group-hover/item:opacity-100 transition-opacity">→</span>
            </button>
            <button 
              disabled
              title="Work In Progress"
              className="w-full text-left px-4 py-3 text-sm flex items-center justify-between opacity-40 cursor-not-allowed"
              style={{ color: "hsl(210 40% 96%)", borderTop: "1px solid hsl(220 20% 20%)" }}
            >
              <span>Disegno 3D</span>
              <span className="text-xs bg-white/10 px-1.5 py-0.5 rounded">Presto</span>
            </button>
          </div>
        </div>

        {/* Menu Azioni Progetto */}
        <div className="relative flex items-center justify-center p-1">
          <ProjectActionsMenu projectId={project.id} projectName={project.name} />
        </div>
      </div>

      {/* ── Disegni Grid ─────────────────────────────────── */}
      <div className="px-4 sm:px-8 py-4 sm:py-6">
        <h2 className="text-xs sm:text-sm border-b pb-2 mb-4 font-semibold uppercase tracking-wider" style={{ color: "hsl(215 15% 45%)", borderColor: "hsl(220 20% 16%)" }}>
          Disegni del progetto ({filteredDrawings.length})
        </h2>
        
        {filteredDrawings.length > 0 ? (
           <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {filteredDrawings.map((draw) => {
                const gradient = avatarGradient(draw.id);
                return (
                  <LevelCard 
                    key={draw.id} 
                    drawing={draw as any} 
                    gradient={gradient} 
                    onAddLevel={(ref) => openCreateModal({ name: `${ref.name} (Copia)`, elevation_z: ref.elevation_z + 1 })}
                    formatDate={safeFormatDate}
                  />
                );
              })}
           </div>
        ) : (
          <div className="p-10 text-center rounded-2xl" style={{ border: "1px dashed hsl(220 20% 24%)", background: "hsl(220 26% 14%)" }}>
             <p className="text-sm" style={{ color: "hsl(215 15% 50%)" }}>Nessun disegno trovato in questo progetto.</p>
          </div>
        )}
      </div>

      {/* ── Appunti (Note Editor) ─────────────────────────────────── */}
      <div className="px-4 sm:px-8 mt-auto pt-4 sm:pt-6 border-t" style={{ borderColor: "hsl(220 20% 16%)" }}>
         <div className="flex items-center justify-between mb-3">
           <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "hsl(215 15% 45%)" }}>
             Appunti / Note
           </h2>
           <div className="text-xs" style={{ color: "hsl(215 15% 40%)" }}>
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
              placeholder="Aggiungi appunti per questo progetto, specifiche, calcoli..."
              className="w-full min-h-[200px] p-5 bg-transparent resize-y outline-none text-sm leading-relaxed"
              style={{ color: "hsl(210 40% 90%)" }}
            />
         </div>
      </div>
      
      {isCreatingLevel && (
        <CreateDrawingModal
          title="Crea Nuovo Disegno"
          submitLabel="Crea"
          defaultName={levelTemplate?.name || "Nuovo Piano"}
          defaultElevation={levelTemplate?.elevation_z || 0}
          onClose={() => setIsCreatingLevel(false)}
          onSubmit={handleCreateLevelSubmit}
        />
      )}
    </div>
  );
}