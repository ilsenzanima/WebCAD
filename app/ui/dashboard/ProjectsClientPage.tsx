"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import NewProjectModal from "./NewProjectModal";
import { useOfflineStore } from "@/lib/stores/offline-store";

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
  const [onlineProjects, setOnlineProjects] = useState<Project[]>([]);
  const [loadingOnline, setLoadingOnline] = useState(false);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const cachedProjects = useOfflineStore((state) => state.projects);

  const fetchProjects = async () => {
    setLoadingOnline(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("projects")
        .select("id, name, created_at, updated_at")
        .order("updated_at", { ascending: false })
        .order("created_at", { ascending: false });

      if (!error && data) {
        setOnlineProjects(data as any[]);
        // Aggiorna lo store offline
        useOfflineStore.getState().setProjectsCache(data as any[]);
      }
    } catch (err) {
      console.error("Errore caricamento progetti in background:", err);
    } finally {
      setLoadingOnline(false);
    }
  };

  // Fetch dei progetti in background lato client al montaggio
  useEffect(() => {
    fetchProjects();
  }, []);

  // Ascolta gli aggiornamenti realtime da Supabase per ricaricare la lista in tempo reale
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleRealtimeChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.table === "projects") {
        console.log("[ProjectsClientPage] Rilevato aggiornamento realtime, rinfresco progetti...");
        fetchProjects();
      }
    };

    window.addEventListener("realtime-db-change", handleRealtimeChange);
    return () => {
      window.removeEventListener("realtime-db-change", handleRealtimeChange);
    };
  }, []);

  const projectsList = useMemo(() => {
    if (!mounted) return [];
    const map = new Map<string, any>();
    
    // Seleziona come base i progetti scaricati online se presenti, altrimenti usa la cache offline locale
    const baseProjects = onlineProjects.length > 0 ? onlineProjects : Object.values(cachedProjects);
    baseProjects.forEach(p => map.set(p.id, p));

    const queue = useOfflineStore.getState().offlineQueue;

    // 1. Rimuoviamo i progetti che hanno un'operazione di eliminazione pendente in coda
    const deletedProjectIds = new Set(
      queue
        .filter(op => op.action === "DELETE_PROJECT")
        .map(op => op.payload.projectId)
    );
    deletedProjectIds.forEach(id => map.delete(id));

    // 2. Aggiungiamo i progetti in cache solo se sono nuovi (ID temp_ o operazione CREATE_PROJECT)
    Object.values(cachedProjects).forEach(p => {
      const isNewPending = p.id.startsWith("temp_") || queue.some(op => 
        op.action === "CREATE_PROJECT" && op.payload.tempId === p.id
      );

      if (isNewPending) {
        // Applica rinomine locali se presenti nella coda
        let currentName = p.name;
        queue.forEach(op => {
          if (op.action === "RENAME_PROJECT" && op.payload.projectId === p.id) {
            currentName = op.payload.newName;
          }
        });
        if (!deletedProjectIds.has(p.id)) {
          map.set(p.id, { ...p, name: currentName });
        }
      } else {
        // Se il progetto esiste ed ha una rinomina pendente nella coda locale,
        // aggiorniamo il nome optimisticamente
        const existing = map.get(p.id);
        if (existing) {
          let currentName = existing.name;
          queue.forEach(op => {
            if (op.action === "RENAME_PROJECT" && op.payload.projectId === p.id) {
              currentName = op.payload.newName;
            }
          });
          map.set(p.id, { ...existing, name: currentName });
        }
      }
    });

    // Ordina per data di aggiornamento/creazione decrescente
    return Array.from(map.values()).sort((a, b) => {
      const dateA = new Date(a.updated_at || a.created_at).getTime();
      const dateB = new Date(b.updated_at || b.created_at).getTime();
      return dateB - dateA;
    });
  }, [onlineProjects, cachedProjects, mounted]);



  // Ordina i cantieri in ordine alfabetico per nome
  const filtered = projectsList
    .filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <NewProjectModal open={isModalOpen} onClose={() => setIsModalOpen(false)} />

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
              {projectsList.length}
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

// ── Componente riga elenco cantiere (Stile Lista Pulito) ───────────────────────────
function ProjectRow({ 
  project 
}: { 
  project: Project; 
}) {
  const gradient = avatarGradient(project.id);
  const initials = getProjectInitials(project.name);
  
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const date = mounted ? safeFormatDate(project.updated_at || project.created_at) : "—";

  return (
    <Link
      href={`/projects/${project.id}`}
      className="flex items-center justify-between gap-4 p-4 transition-all hover:bg-white/[0.03] group focus:outline-none cursor-pointer"
      style={{ borderBottom: "1px solid hsl(220 20% 16%)" }}
      aria-label={`Apri progetto ${project.name}`}
    >
      {/* Sinistra: Avatar e Nome */}
      <div className="flex items-center gap-3.5 min-w-0">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0 shadow-sm transition-transform group-hover:scale-105"
          style={{ background: gradient }}
        >
          {initials || "🏢"}
        </div>

        <div className="min-w-0">
          <h3 className="text-white font-bold text-sm leading-tight truncate group-hover:text-sky-400 transition-colors">
            {project.name}
          </h3>
          <p className="text-[10px] text-white/40 leading-none mt-1 sm:hidden">
            Modificato: {date}
          </p>
        </div>
      </div>

      {/* Destra: Data ultima modifica e pulsante Apri */}
      <div className="flex items-center gap-4 flex-shrink-0">
        <span className="text-[11px] text-white/40 leading-none hidden sm:inline">
          Ultima modifica: {date}
        </span>
        <span 
          className="text-xs font-bold px-3.5 py-1.5 rounded-xl transition-all border border-white/5 bg-white/5 hover:bg-white/10 text-white/80 group-hover:bg-sky-500/10 group-hover:text-sky-400 group-hover:border-sky-500/20 active:scale-95 cursor-pointer flex items-center gap-1"
        >
          Apri <span>→</span>
        </span>
      </div>
    </Link>
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
