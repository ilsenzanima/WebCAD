"use client";

import { useState } from "react";
import Link from "next/link";
import NewProjectModal from "./NewProjectModal";

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

// Genera un colore "avatar" deterministico dall'id
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
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <NewProjectModal open={isModalOpen} onClose={() => setIsModalOpen(false)} />

      <div className="flex flex-col h-full">
        {/* ── Barra superiore fissa ───────────────────────────── */}
        <div
          className="sticky top-0 z-10 px-8 py-5 flex items-center gap-4"
          style={{
            background: "hsl(222 47% 6%)",
            borderBottom: "1px solid hsl(220 20% 14%)",
          }}
        >
          {/* Titolo + contatore */}
          <div className="flex items-baseline gap-2 mr-2 flex-shrink-0">
            <h1 className="text-lg font-bold text-white">Progetti</h1>
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
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = "hsl(220 90% 56%)")
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = "hsl(220 20% 20%)")
              }
            />
          </div>

          {/* CTA nuovo progetto */}
          <button
            id="btn-new-project"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white flex-shrink-0 transition-all duration-200"
            style={{
              background:
                "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
              boxShadow: "0 4px 16px hsl(220 90% 56% / 0.3)",
            }}
          >
            <span className="text-base leading-none">+</span>
            Nuovo Progetto
          </button>
        </div>

        {/* ── Griglia progetti ─────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-fade-in">
              {filtered.map((project) => (
                <ProjectCard
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

// ── Componente scheda ────────────────────────────────────────
function ProjectCard({ project }: { project: Project }) {
  const gradient = avatarGradient(project.id);
  const initials = getProjectInitials(project.name);
  const date = safeFormatDate(project.updated_at || project.created_at);

  return (
    <div
      className="relative group rounded-2xl overflow-hidden transition-all duration-200"
      style={{
        background: "hsl(220 26% 14%)",
        border: "1px solid hsl(220 20% 20%)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "hsl(220 20% 30%)";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 12px 32px rgba(0,0,0,0.3)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "hsl(220 20% 20%)";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
      }}
    >
      {/* Area cliccabile — tutta la card */}
      <Link
        href={`/projects/${project.id}`}
        className="block p-5 pb-4 focus:outline-none"
        aria-label={`Apri progetto ${project.name}`}
      >
        {/* Avatar */}
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-base mb-4"
          style={{ background: gradient }}
        >
          {initials || "🏗️"}
        </div>

        {/* Nome progetto */}
        <div
          className="text-white font-semibold text-sm leading-snug line-clamp-2 mb-1"
          style={{ minHeight: "2.5rem" }}
        >
          {project.name}
        </div>

        {/* Data */}
        <div className="text-xs" style={{ color: "hsl(215 15% 45%)" }}>
          Modificato il {date}
        </div>
      </Link>

      {/* Footer con azioni */}
      <div
        className="px-5 py-3 flex items-center justify-between"
        style={{ borderTop: "1px solid hsl(220 20% 18%)" }}
      >
        <Link
          href={`/projects/${project.id}`}
          className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          style={{
            background: "hsl(220 32% 20%)",
            color: "hsl(215 20% 65%)",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "hsl(220 32% 26%)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "hsl(220 32% 20%)")
          }
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
      <div className="text-5xl mb-4">{hasSearch ? "🔍" : "📐"}</div>
      <h3 className="text-white font-semibold mb-2">
        {hasSearch ? "Nessun risultato" : "Nessun progetto ancora"}
      </h3>
      <p
        className="text-sm text-center max-w-xs"
        style={{ color: "hsl(215 15% 50%)" }}
      >
        {hasSearch
          ? "Prova con un termine di ricerca diverso."
          : "Crea il tuo primo progetto antincendio e inizia a disegnare."}
      </p>
      {!hasSearch && (
        <button
          onClick={onNewProject}
          className="mt-6 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200"
          style={{
            background:
              "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
            boxShadow: "0 4px 16px hsl(220 90% 56% / 0.3)",
          }}
        >
          + Crea il primo progetto
        </button>
      )}
    </div>
  );
}
