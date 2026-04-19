"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addLevel, updateProjectNotes, renameProject } from "@/app/actions/projects";
import ProjectActionsMenu from "@/app/ui/dashboard/ProjectActionsMenu";

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
  name: string;
  elevation_z: number;
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

  // Filtraggio disegni
  const filteredDrawings = drawings.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ============================================
  // Handlers
  // ============================================

  const handleCreate2D = () => {
    startTransition(async () => {
      const res = await addLevel(project.id);
      if (res.success && res.level) {
        // Redirige automaticamente al nuovo livello creato nell'editor
        // Passando `levelId` tramite URL se supportato dall'editor (lo adatteremo in futuro).
        // Per ora andiamo all'editor che carica il default o l'ultimo
        router.push(`/projects/${project.id}/editor`);
      } else {
        alert("Errore nella creazione del disegno 2D.");
      }
    });
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
    <div className="flex flex-col h-full overflow-y-auto w-full animate-fade-in pb-16">
      
      {/* ── Breadcrumb e Header (non sticky) ───────────────────────────── */}
      <div className="px-8 py-6 space-y-4">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm font-medium" style={{ color: "hsl(215 15% 55%)" }}>
          <Link href="/projects" className="hover:text-white transition-colors">Progetti</Link>
          <span>/</span>
          <span className="text-white">{project.name}</span>
        </div>

        {/* Titolo Progetto */}
        <div className="flex items-center justify-between">
          <div>
            <div className="group flex items-center gap-3">
              {isEditingTitle ? (
                <input 
                  autoFocus
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={handleSaveTitle}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveTitle()}
                  className="text-2xl font-bold bg-transparent border-b border-white outline-none focus:border-brand-primary"
                  style={{ color: "hsl(210 40% 96%)" }}
                />
              ) : (
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                  {project.name}
                  <button 
                    onClick={() => setIsEditingTitle(true)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-sm p-1 rounded-md bg-white/5 hover:bg-white/10"
                    title="Rinomina progetto"
                  >
                    ✏️
                  </button>
                </h1>
              )}
            </div>
            <p className="mt-1 text-sm" style={{ color: "hsl(215 15% 50%)" }}>
              Ultima modifica: {safeFormatDate(project.updated_at)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Barra Controlli (Search + Add) ───────────────────────────── */}
      <div 
        className="px-8 py-4 flex items-center gap-4 sticky top-0 z-10"
        style={{
          background: "hsl(222 47% 6%)",
          borderBottom: "1px solid hsl(220 20% 14%)",
          borderTop: "1px solid hsl(220 20% 14%)",
        }}
      >
        <div className="relative flex-1 max-w-lg">
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
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
              boxShadow: "0 4px 16px hsl(220 90% 56% / 0.3)",
            }}
          >
            <span className="text-base leading-none">＋</span>
            Crea Disegno ▾
          </button>
          
          {/* Dropdown Menu */}
          <div 
             className="absolute right-0 mt-2 w-48 rounded-xl overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top translate-y-1 group-hover:translate-y-0"
             style={{
               background: "hsl(220 26% 14%)",
               border: "1px solid hsl(220 20% 22%)",
               boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
               zIndex: 50
             }}
          >
            <button 
              onClick={handleCreate2D}
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
      <div className="px-8 py-6">
        <h2 className="text-sm border-b pb-2 mb-4 font-semibold uppercase tracking-wider" style={{ color: "hsl(215 15% 45%)", borderColor: "hsl(220 20% 16%)" }}>
          Disegni del progetto ({filteredDrawings.length})
        </h2>
        
        {filteredDrawings.length > 0 ? (
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredDrawings.map((draw) => {
                const gradient = avatarGradient(draw.id);
                return (
                  <Link
                    key={draw.id}
                    // Adatteremo l'editor per ricevere levelId
                    href={`/projects/${project.id}/editor`}
                    className="relative block rounded-2xl p-5 hover:translate-y-[-2px] transition-all duration-200 group"
                    style={{
                      background: "hsl(220 26% 14%)",
                      border: "1px solid hsl(220 20% 20%)",
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLAnchorElement).style.borderColor = "hsl(220 90% 56%)";
                      (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.3)";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLAnchorElement).style.borderColor = "hsl(220 20% 20%)";
                      (e.currentTarget as HTMLAnchorElement).style.boxShadow = "none";
                    }}
                  >
                     <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white mb-3"
                        style={{ background: gradient }}
                      >
                        📐
                      </div>
                      <div className="text-white font-semibold text-sm truncate">{draw.name}</div>
                      <div className="text-xs mt-1" style={{ color: "hsl(215 15% 45%)" }}>
                        Creato il {safeFormatDate(draw.created_at)}
                      </div>
                      
                      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                         <span className="text-xs font-semibold px-2 py-1 rounded" style={{ background: "hsl(220 32% 20%)", color: "hsl(215 20% 65%)" }}>
                           Apri
                         </span>
                      </div>
                  </Link>
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
      <div className="px-8 mt-auto pt-6 border-t" style={{ borderColor: "hsl(220 20% 16%)" }}>
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
      
    </div>
  );
}