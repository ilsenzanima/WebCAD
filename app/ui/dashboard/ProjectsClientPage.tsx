"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import NewProjectModal from "./NewProjectModal";
import QuickAddModal from "@/app/ui/projects/QuickAddModal";
import { useOfflineStore, generateTempId } from "@/lib/stores/offline-store";

interface Project {
  id: string;
  name: string;
  created_at: string;
  updated_at?: string;
}

interface ProjectsClientPageProps {
  projects: Project[];
}

function safeFormatDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

// Genera colore determistico dall'id
const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
  "linear-gradient(135deg, hsl(16 100% 58%), hsl(0 84% 55%))",
  "linear-gradient(135deg, hsl(142 71% 45%), hsl(160 60% 38%))",
  "linear-gradient(135deg, hsl(280 80% 60%), hsl(260 70% 52%))",
  "linear-gradient(135deg, hsl(38 92% 50%), hsl(25 90% 48%))",
];

function avatarGradient(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash) + id.charCodeAt(i);
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

function getProjectInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export default function ProjectsClientPage({ projects }: ProjectsClientPageProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [quickAdd, setQuickAdd] = useState<{ projectId: string; type: "nota" | "sketch" | "3d" } | null>(null);

  // Gestore per il salvataggio rapido dal pop-up della card
  const handleQuickAddSubmit = async (title: string, pianoName: string) => {
    if (!quickAdd) return;
    const { projectId, type } = quickAdd;
    
    // 1. Controlla se il livello esiste già offline
    const cachedLevels = useOfflineStore.getState().levels[projectId] ?? [];
    let level = cachedLevels.find(l => l.name.toLowerCase() === pianoName.toLowerCase());
    let levelId = level?.id;
    
    if (!levelId) {
      // Crea il livello optimisticamente
      levelId = generateTempId();
      useOfflineStore.getState().addLevelOptimistic(
        levelId,
        projectId,
        pianoName,
        0,
        "2d_wall",
        pianoName
      );
    }
    
    // 2. Crea la nota optimisticamente in base al tipo
    const tempNoteId = generateTempId();
    
    if (type === "nota") {
      const initialItems = [{ item_type: "nota" as const, value_text: title, sort_order: 0 }];
      useOfflineStore.getState().saveFieldNoteItemsOptimistic(
        tempNoteId,
        projectId,
        levelId,
        initialItems,
        "Appunti Cantiere"
      );
      
      setQuickAdd(null);
      router.push(`/projects/${projectId}/levels/${levelId}/appunti/${tempNoteId}/modifica`);
    } else if (type === "sketch") {
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
        projectId,
        levelId,
        initialItems,
        "Sketch"
      );
      
      setQuickAdd(null);
      router.push(`/projects/${projectId}/levels/${levelId}/appunti/${tempNoteId}/modifica`);
    } else if (type === "3d") {
      const initialItems = [
        { item_type: "nota" as const, value_text: title, sort_order: 0 }
      ];
      
      useOfflineStore.getState().saveFieldNoteItemsOptimistic(
        tempNoteId,
        projectId,
        levelId,
        initialItems,
        "Report 3D"
      );
      
      setQuickAdd(null);
      router.push(`/projects/${projectId}/levels/${levelId}/appunti/${tempNoteId}/modifica`);
    }
  };

  // Ordina i cantieri in ordine alfabetico per nome
  const filtered = projects
    .filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const currentProjectLevels = quickAdd 
    ? (useOfflineStore.getState().levels[quickAdd.projectId] ?? []).map(l => l.name)
    : [];

  return (
    <>
      <NewProjectModal open={isModalOpen} onClose={() => setIsModalOpen(false)} />

      {quickAdd && (
        <QuickAddModal
          type={quickAdd.type}
          existingPiani={currentProjectLevels}
          onClose={() => setQuickAdd(null)}
          onSubmit={handleQuickAddSubmit}
        />
      )}

      <div className="flex flex-col h-full">
        {/* ── Barra superiore fissa ───────────────────────────── */}
        <div
          className="sticky top-0 z-10 px-4 sm:px-8 py-3 sm:py-5 flex items-center gap-2 sm:gap-4"
          style={{
            background: "hsl(222 47% 6%)",
            borderBottom: "1px solid hsl(220 20% 14%)",
          }}
        >
          {/* Titolo + contatore */}
          <div className="flex items-baseline gap-2 mr-1 sm:mr-2 flex-shrink-0">
            <h1 className="text-base sm:text-lg font-bold text-white">Progetti</h1>
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{
                background: "hsl(220 90% 56% / 0.15)",
                color: "hsl(220 90% 70%)",
              }}
            >
              {projects.length}
            </span>
          </div>

          {/* Search bar */}
          <div className="relative flex-1 max-w-lg">
            <span
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm pointer-events-none"
              style={{ color: "hsl(215 15% 45%)" }}
            >
              🔍
            </span>
            <input
              id="projects-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca progetto..."
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

          {/* CTA nuovo progetto */}
          <button
            id="btn-new-project"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white flex-shrink-0 transition-all duration-200 whitespace-nowrap cursor-pointer"
            style={{
              background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
              boxShadow: "0 4px 16px hsl(220 90% 56% / 0.3)",
            }}
          >
            <span className="text-base leading-none">+</span>
            <span className="hidden sm:inline">Nuovo Progetto</span>
            <span className="sm:hidden">Nuovo</span>
          </button>
        </div>

        {/* ── Elenco alfabetico cantieri (Stile Lista) ─────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-4 sm:py-6">
          {filtered.length > 0 ? (
            <div
              className="rounded-2xl overflow-hidden divide-y flex flex-col"
              style={{
                background: "hsl(220 26% 14% / 0.4)",
                border: "1px solid hsl(220 20% 16%)",
              }}
            >
              {filtered.map((project) => (
                <ProjectRow 
                  key={project.id} 
                  project={project} 
                  onQuickAdd={(type) => setQuickAdd({ projectId: project.id, type })}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              hasSearch={searchQuery.length > 0}
              onNewProject={() => setIsModalOpen(true)}
            />
          )}
        </div>
      </div>
    </>
  );
}

// ── Componente riga elenco progetto ───────────────────────────
function ProjectRow({ 
  project, 
  onQuickAdd 
}: { 
  project: Project; 
  onQuickAdd: (type: "nota" | "sketch" | "3d") => void; 
}) {
  const gradient = avatarGradient(project.id);
  const initials = getProjectInitials(project.name);
  const date = safeFormatDate(project.updated_at || project.created_at);

  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 transition-colors hover:bg-white/[0.01]"
      style={{ borderBottom: "1px solid hsl(220 20% 16%)" }}
    >
      {/* Sinistra cliccabile per entrare */}
      <Link
        href={`/projects/${project.id}`}
        className="flex items-center gap-3.5 min-w-0 flex-1 focus:outline-none"
        aria-label={`Apri progetto ${project.name}`}
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0 shadow-sm"
          style={{ background: gradient }}
        >
          {initials || "🏢"}
        </div>

        <div className="min-w-0">
          <h3 className="text-white font-bold text-sm leading-tight truncate group-hover:text-sky-400 transition-colors">
            {project.name}
          </h3>
          <p className="text-[10px] text-white/40 leading-none mt-1">
            Modificato: {date}
          </p>
        </div>
      </Link>

      {/* Pulsanti rapidi a destra */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => onQuickAdd("nota")}
          className="px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold transition-all border border-sky-500/10 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 active:scale-95 cursor-pointer flex items-center gap-1.5 animate-pulse-subtle"
          title="Aggiungi una nota/misura a questo progetto"
        >
          <span>📝</span>
          <span>Nota</span>
        </button>
        <button
          type="button"
          onClick={() => onQuickAdd("sketch")}
          className="px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold transition-all border border-amber-500/10 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 active:scale-95 cursor-pointer flex items-center gap-1.5"
          title="Disegna uno sketch a questo progetto"
        >
          <span>🎨</span>
          <span>Sketch</span>
        </button>
        <button
          type="button"
          onClick={() => onQuickAdd("3d")}
          className="px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold transition-all border border-purple-500/10 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 active:scale-95 cursor-pointer flex items-center gap-1.5"
          title="Carica o visualizza un modello 3D"
        >
          <span>📦</span>
          <span>3D</span>
        </button>

        <div className="w-[1.5px] h-5 bg-white/10 mx-1 hidden sm:block" />

        <Link
          href={`/projects/${project.id}`}
          className="text-xs font-bold px-3 py-1.5 rounded-lg transition-colors border border-white/5 bg-white/5 hover:bg-white/10 text-white/80 whitespace-nowrap ml-auto"
        >
          Apri →
        </Link>
      </div>
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────
function EmptyState({
  hasSearch,
  onNewProject,
}: {
  hasSearch: boolean;
  onNewProject: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center py-20 rounded-2xl animate-fade-in"
      style={{
        background: "hsl(220 26% 14%)",
        border: "1px dashed hsl(220 20% 24%)",
      }}
    >
      <div className="text-5xl mb-4">{hasSearch ? "🔍" : "📋"}</div>
      <h3 className="text-white font-semibold mb-2">
        {hasSearch ? "Nessun risultato" : "Nessun progetto ancora"}
      </h3>
      <p
        className="text-sm text-center max-w-xs leading-relaxed"
        style={{ color: "hsl(215 15% 50%)" }}
      >
        {hasSearch
          ? "Prova con un termine di ricerca diverso."
          : "Crea il tuo primo progetto e inizia a prendere note, sketch e modelli 3D."}
      </p>
      {!hasSearch && (
        <button
          onClick={onNewProject}
          className="mt-6 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 cursor-pointer"
          style={{
            background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
            boxShadow: "0 4px 16px hsl(220 90% 56% / 0.3)",
          }}
        >
          + Crea il primo progetto
        </button>
      )}
    </div>
  );
}
