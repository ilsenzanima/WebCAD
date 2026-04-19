"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useProjectStore } from "@/lib/stores/project-store";
import { useCanvasStore } from "@/lib/stores/canvas-store";
import {
  renameProject,
  addLevel,
  renameLevel,
  deleteLevel,
  updateLevelMetadata,
} from "@/app/actions/projects";
import type { Level } from "@/lib/types/database";

interface EditorHeaderProps {
  projectId: string;
  initialName: string;
  initialLevels: Level[];
  initialLevelId: string;
}

export default function EditorHeader({
  projectId,
  initialName,
  initialLevels,
  initialLevelId,
}: EditorHeaderProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // ── Store init ────────────────────────────────────────────
  const {
    activeProjectId,
    setActiveProject,
    projectName,
    setProjectName,
    levels,
    setLevels,
    activeLevelId,
    setActiveLevel,
    addLevel: storeAddLevel,
    updateLevel,
    removeLevel,
  } = useProjectStore();

  const {
    hasUnsavedChanges,
    setHasUnsavedChanges,
    backgroundImageDataUrl,
    calibrationRatio
  } = useCanvasStore();

  useEffect(() => {
    if (activeProjectId !== projectId) {
      setActiveProject(projectId);
    }
    setProjectName(initialName);
    setLevels(initialLevels);
    setActiveLevel(initialLevelId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const displayName = projectName ?? initialName;
  const displayLevels = levels.length > 0 ? levels : initialLevels;
  const displayActiveId = activeLevelId ?? initialLevelId;

  // ── Rinomina progetto inline ──────────────────────────────
  const [isRenamingProject, setIsRenamingProject] = useState(false);
  const [nameInput, setNameInput] = useState(displayName);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const openRenameProject = () => {
    setNameInput(displayName);
    setIsRenamingProject(true);
    setTimeout(() => nameInputRef.current?.focus(), 0);
  };

  const commitRenameProject = () => {
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === displayName) {
      setIsRenamingProject(false);
      return;
    }
    startTransition(async () => {
      await renameProject(projectId, trimmed);
      setProjectName(trimmed);
      setIsRenamingProject(false);
      router.refresh();
    });
  };

  // ── Panel livelli ─────────────────────────────────────────
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // Rinomina livello
  const [renamingLevelId, setRenamingLevelId] = useState<string | null>(null);
  const [levelNameInput, setLevelNameInput] = useState("");
  const levelInputRef = useRef<HTMLInputElement>(null);

  const openRenameLevel = (level: Level) => {
    setRenamingLevelId(level.id);
    setLevelNameInput(level.name);
    setTimeout(() => levelInputRef.current?.focus(), 0);
  };

  const commitRenameLevel = (levelId: string) => {
    const trimmed = levelNameInput.trim();
    if (!trimmed) {
      setRenamingLevelId(null);
      return;
    }
    startTransition(async () => {
      await renameLevel(levelId, projectId, trimmed);
      updateLevel(levelId, { name: trimmed });
      setRenamingLevelId(null);
      router.refresh();
    });
  };

  // Aggiungi livello
  const handleAddLevel = () => {
    startTransition(async () => {
      const result = await addLevel(projectId);
      if (result?.level) {
        storeAddLevel(result.level as Level);
        setActiveLevel(result.level.id);
        router.refresh();
      }
    });
  };

  // Elimina livello
  const handleDeleteLevel = (levelId: string) => {
    if (displayLevels.length <= 1) return;
    startTransition(async () => {
      await deleteLevel(levelId, projectId);
      removeLevel(levelId);
      router.refresh();
    });
  };

  // ── Salvataggio Manuale ───────────────────────────────────
  const handleSaveAll = () => {
    if (!activeLevelId || !activeProjectId) return;
    
    startTransition(async () => {
      const res = await updateLevelMetadata(activeLevelId, activeProjectId, {
        plan_image_url: backgroundImageDataUrl ?? undefined,
        scale_ratio: calibrationRatio ?? undefined,
      });

      if (res.success) {
        setHasUnsavedChanges(false);
        alert("Progetto salvato con successo!");
      } else {
        alert("Errore durante il salvataggio.");
      }
    });
  };

  // ── Guardia Navigazione ───────────────────────────────────
  const handleBackWithWarning = (e: React.MouseEvent) => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        "Hai delle modifiche non salvate (planimetria o scala). Sei sicuro di voler uscire? Le modifiche andranno perse."
      );
      if (!confirmed) {
        e.preventDefault();
      }
    }
  };

  const activeLevel = displayLevels.find((l) => l.id === displayActiveId);

  return (
    <>
      <header
        className="absolute top-0 left-0 right-0 h-14 backdrop-blur-md border-b z-50 flex items-center justify-between px-4 sm:px-6"
        style={{
          background: "hsl(220 32% 10% / 0.85)",
          borderColor: "hsl(220 20% 22%)",
        }}
      >
        {/* ── Sinistra: back + nome progetto ── */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={`/projects/${projectId}`}
            onClick={handleBackWithWarning}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors flex-shrink-0"
            style={{ color: "hsl(215 20% 65%)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "hsl(220 20% 22%)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
            title="Torna alla dashboard"
          >
            ←
          </Link>

          {/* Separatore */}
          <div
            className="w-px h-5 flex-shrink-0"
            style={{ background: "hsl(220 20% 24%)" }}
          />

          {/* Nome progetto */}
          {isRenamingProject ? (
            <input
              ref={nameInputRef}
              id="input-editor-project-name"
              className="bg-transparent text-white font-semibold text-sm outline-none border-b px-1 min-w-[120px] max-w-[240px]"
              style={{ borderColor: "hsl(220 90% 56%)" }}
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={commitRenameProject}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRenameProject();
                if (e.key === "Escape") setIsRenamingProject(false);
              }}
              disabled={isPending}
              maxLength={120}
            />
          ) : (
            <button
              id="btn-editor-rename-project"
              onClick={openRenameProject}
              className="font-semibold text-sm truncate max-w-[180px] sm:max-w-[280px] text-left transition-colors px-1 rounded"
              style={{ color: "hsl(215 20% 95%)" }}
              title="Clicca per rinominare"
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "hsl(220 90% 70%)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "hsl(215 20% 95%)")
              }
            >
              {displayName}✏️
            </button>
          )}

          {/* Badge livello attivo + trigger panel */}
          <button
            id="btn-toggle-levels-panel"
            onClick={() => setIsPanelOpen((p) => !p)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] uppercase font-bold flex-shrink-0 transition-all"
            style={{
              background: isPanelOpen
                ? "hsl(16 100% 58% / 0.25)"
                : "hsl(16 100% 58% / 0.15)",
              color: "hsl(16 100% 65%)",
              border: `1px solid ${
                isPanelOpen
                  ? "hsl(16 100% 58% / 0.4)"
                  : "hsl(16 100% 58% / 0.2)"
              }`,
            }}
            title="Gestisci piani"
          >
            🏢 {activeLevel?.name ?? "Piano"}
          </button>
        </div>

        {/* ── Destra: azioni ── */}
        <div className="flex items-center gap-2">
          <button
            id="btn-editor-save"
            onClick={handleSaveAll}
            disabled={isPending || (!hasUnsavedChanges && !isRenamingProject)}
            className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ 
              background: hasUnsavedChanges 
                ? "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))" 
                : "hsl(220 26% 20%)",
              boxShadow: hasUnsavedChanges ? "0 4px 12px hsl(220 90% 56% / 0.3)" : "none"
            }}
          >
            {isPending ? "Salvataggio..." : hasUnsavedChanges ? "Salva Modifiche" : "Salvato"}
          </button>
        </div>
      </header>

      {/* ── Panel Livelli ───────────────────────────────────── */}
      {isPanelOpen && (
        <>
          {/* Overlay leggero */}
          <div
            className="absolute inset-0 z-40"
            style={{ pointerEvents: "none" }}
          />
          <div
            className="absolute top-14 left-0 z-50 w-72 shadow-2xl overflow-hidden"
            style={{
              background: "hsl(220 32% 11%)",
              borderRight: "1px solid hsl(220 20% 20%)",
              borderBottom: "1px solid hsl(220 20% 20%)",
              borderBottomRightRadius: "1rem",
            }}
          >
            {/* Header panel */}
            <div
              className="px-4 py-3 flex items-center justify-between"
              style={{ borderBottom: "1px solid hsl(220 20% 18%)" }}
            >
              <span
                className="text-xs uppercase font-bold tracking-wider"
                style={{ color: "hsl(215 15% 50%)" }}
              >
                Piani del progetto
              </span>
              <button
                id="btn-close-levels-panel"
                onClick={() => setIsPanelOpen(false)}
                className="text-xs transition-colors px-1"
                style={{ color: "hsl(215 15% 45%)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = "hsl(215 15% 70%)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = "hsl(215 15% 45%)")
                }
              >
                ✕
              </button>
            </div>

            {/* Lista livelli */}
            <div className="max-h-72 overflow-y-auto">
              {displayLevels.map((level) => {
                const isActive = level.id === displayActiveId;
                const isThisRenaming = renamingLevelId === level.id;

                return (
                  <div
                    key={level.id}
                    className="relative flex items-center gap-2 px-4 py-2.5 transition-colors group"
                    style={{
                      background: isActive
                        ? "hsl(220 32% 18%)"
                        : "transparent",
                      borderLeft: isActive
                        ? "3px solid hsl(16 100% 58%)"
                        : "3px solid transparent",
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      if (!isThisRenaming) {
                        setActiveLevel(level.id);
                      }
                    }}
                  >
                    {/* Icona piano */}
                    <span className="text-base flex-shrink-0">
                      {level.elevation_z === 0 ? "🏠" : level.elevation_z > 0 ? "⬆️" : "⬇️"}
                    </span>

                    {/* Nome (o input per rename) */}
                    {isThisRenaming ? (
                      <input
                        ref={levelInputRef}
                        id={`input-rename-level-${level.id}`}
                        className="flex-1 bg-transparent text-white text-sm font-medium outline-none border-b"
                        style={{ borderColor: "hsl(220 90% 56%)" }}
                        value={levelNameInput}
                        onChange={(e) => setLevelNameInput(e.target.value)}
                        onBlur={() => commitRenameLevel(level.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRenameLevel(level.id);
                          if (e.key === "Escape") setRenamingLevelId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        disabled={isPending}
                        maxLength={80}
                      />
                    ) : (
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-sm font-medium truncate"
                          style={{
                            color: isActive
                              ? "white"
                              : "hsl(215 20% 75%)",
                          }}
                        >
                          {level.name}
                        </div>
                        <div
                          className="text-xs"
                          style={{ color: "hsl(215 15% 40%)" }}
                        >
                          z = {level.elevation_z >= 0 ? "+" : ""}
                          {level.elevation_z}
                        </div>
                      </div>
                    )}

                    {/* Azioni hover */}
                    {!isThisRenaming && (
                      <div
                        className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          id={`btn-rename-level-${level.id}`}
                          onClick={() => openRenameLevel(level)}
                          className="w-6 h-6 flex items-center justify-center rounded text-xs transition-colors"
                          style={{ color: "hsl(215 20% 60%)" }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background =
                              "hsl(220 32% 24%)")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background = "transparent")
                          }
                          title="Rinomina piano"
                        >
                          ✏️
                        </button>
                        {displayLevels.length > 1 && (
                          <button
                            id={`btn-delete-level-${level.id}`}
                            onClick={() => handleDeleteLevel(level.id)}
                            className="w-6 h-6 flex items-center justify-center rounded text-xs transition-colors"
                            style={{ color: "hsl(0 70% 60%)" }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.background =
                                "hsl(0 40% 18%)")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.background = "transparent")
                            }
                            title="Elimina piano"
                            disabled={isPending}
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer — aggiungi piano */}
            <div
              className="px-4 py-3"
              style={{ borderTop: "1px solid hsl(220 20% 18%)" }}
            >
              <button
                id="btn-add-level"
                onClick={handleAddLevel}
                disabled={isPending}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: isPending
                    ? "hsl(220 26% 18%)"
                    : "hsl(220 26% 20%)",
                  color: isPending
                    ? "hsl(215 15% 40%)"
                    : "hsl(215 20% 75%)",
                  border: "1px dashed hsl(220 20% 28%)",
                }}
                onMouseEnter={(e) => {
                  if (!isPending)
                    e.currentTarget.style.background = "hsl(220 26% 26%)";
                }}
                onMouseLeave={(e) => {
                  if (!isPending)
                    e.currentTarget.style.background = "hsl(220 26% 20%)";
                }}
              >
                {isPending ? "⏳ Caricamento…" : "+ Aggiungi Piano"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
