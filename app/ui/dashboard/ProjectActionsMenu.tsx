"use client";

import { useRef, useState, useTransition } from "react";
import { renameProject, deleteProject } from "@/app/actions/projects";
import { useRouter } from "next/navigation";

interface ProjectActionsMenuProps {
  projectId: string;
  projectName: string;
}

export default function ProjectActionsMenu({
  projectId,
  projectName,
}: ProjectActionsMenuProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [localName, setLocalName] = useState(projectName);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const openRename = () => {
    setIsOpen(false);
    setIsRenaming(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const commitRename = () => {
    if (localName.trim() === projectName || !localName.trim()) {
      setIsRenaming(false);
      setLocalName(projectName);
      return;
    }
    startTransition(async () => {
      await renameProject(projectId, localName);
      setIsRenaming(false);
      router.refresh();
    });
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") commitRename();
    if (e.key === "Escape") {
      setIsRenaming(false);
      setLocalName(projectName);
    }
  };

  const confirmDelete = () => {
    setIsDeleteOpen(false);
    startTransition(async () => {
      await deleteProject(projectId);
      // Dopo aver eliminato il progetto torniamo alla dashboard/projects
      router.push("/projects");
      router.refresh();
    });
  };

  return (
    <>
      {/* Trigger — i tre puntini */}
      <div className="relative" onClick={(e) => e.preventDefault()}>
        <button
          id={`btn-menu-project-${projectId}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen((prev) => !prev);
          }}
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors text-sm"
          style={{
            color: "hsl(215 20% 55%)",
            background: isOpen ? "hsl(220 32% 22%)" : "transparent",
          }}
          aria-label="Opzioni progetto"
        >
          ⋮
        </button>

        {/* Dropdown */}
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={(e) => {
                e.preventDefault();
                setIsOpen(false);
              }}
            />
            <div
              className="absolute right-0 top-10 z-50 rounded-xl shadow-2xl overflow-hidden min-w-[160px]"
              style={{
                background: "hsl(220 32% 14%)",
                border: "1px solid hsl(220 20% 24%)",
              }}
            >
              <button
                id={`btn-rename-project-${projectId}`}
                onClick={(e) => {
                  e.preventDefault();
                  openRename();
                }}
                className="w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2"
                style={{ color: "hsl(215 20% 80%)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "hsl(220 32% 20%)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                ✏️ Rinomina
              </button>
              <div
                style={{ height: "1px", background: "hsl(220 20% 20%)" }}
              />
              <button
                id={`btn-delete-project-${projectId}`}
                onClick={(e) => {
                  e.preventDefault();
                  setIsOpen(false);
                  setIsDeleteOpen(true);
                }}
                className="w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2"
                style={{ color: "hsl(0 80% 65%)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "hsl(0 40% 18%)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                🗑️ Elimina
              </button>
            </div>
          </>
        )}
      </div>

      {/* Modale Rinomina */}
      {isRenaming && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 cursor-default"
          style={{ background: "hsl(228 39% 4% / 0.85)" }}
          onClick={(e) => {
             e.preventDefault();
             if(e.target === e.currentTarget) {
                 setIsRenaming(false);
                 setLocalName(projectName);
             }
          }}
        >
          <div
            className="rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            style={{
              background: "hsl(220 32% 12%)",
              border: "1px solid hsl(220 20% 22%)",
            }}
          >
            <h3 className="text-white font-semibold text-lg mb-4">
              Rinomina progetto
            </h3>
            <input
              ref={inputRef}
              id={`input-rename-${projectId}`}
              className="w-full bg-transparent text-white text-sm font-medium outline-none border-b pb-2 mb-6"
              style={{ borderColor: "hsl(220 90% 56%)" }}
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              onKeyDown={handleRenameKeyDown}
              disabled={isPending}
              maxLength={120}
              placeholder="Nome del progetto"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setIsRenaming(false);
                  setLocalName(projectName);
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: "hsl(220 26% 20%)",
                  color: "hsl(215 20% 75%)",
                }}
              >
                Annulla
              </button>
              <button
                onClick={commitRename}
                disabled={isPending}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all"
                style={{
                  background: isPending
                    ? "hsl(220 50% 35%)"
                    : "hsl(220 90% 56%)",
                }}
              >
                {isPending ? "Salvataggio…" : "Salva"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale elimina */}
      {isDeleteOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: "hsl(228 39% 4% / 0.85)" }}
          onClick={(e) => e.preventDefault()}
        >
          <div
            className="rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            style={{
              background: "hsl(220 32% 12%)",
              border: "1px solid hsl(220 20% 22%)",
            }}
          >
            <div className="text-3xl mb-3">⚠️</div>
            <h3 className="text-white font-semibold text-lg mb-2">
              Elimina progetto
            </h3>
            <p className="text-sm mb-6" style={{ color: "hsl(215 15% 55%)" }}>
              Sei sicuro di voler eliminare{" "}
              <strong className="text-white">{projectName}</strong>? Tutti i
              livelli ed elementi verranno cancellati definitivamente.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                id={`btn-cancel-delete-${projectId}`}
                onClick={() => setIsDeleteOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: "hsl(220 26% 20%)",
                  color: "hsl(215 20% 75%)",
                }}
              >
                Annulla
              </button>
              <button
                id={`btn-confirm-delete-${projectId}`}
                onClick={confirmDelete}
                disabled={isPending}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all"
                style={{
                  background: isPending
                    ? "hsl(0 50% 35%)"
                    : "hsl(0 70% 48%)",
                }}
              >
                {isPending ? "Eliminazione…" : "Elimina"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
