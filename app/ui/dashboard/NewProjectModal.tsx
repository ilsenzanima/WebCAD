"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { createProject } from "@/app/actions/projects";

interface NewProjectModalProps {
  open: boolean;
  onClose: () => void;
}

export default function NewProjectModal({ open, onClose }: NewProjectModalProps) {
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName("");
      // Focus sull'input dopo il render
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    startTransition(() => createProject(name.trim()));
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={handleBackdropClick}
    >
      {/* Dialog */}
      <div
        className="w-full max-w-md rounded-2xl p-6 space-y-5 animate-fade-in"
        style={{
          background: "hsl(220 26% 14%)",
          border: "1px solid hsl(220 20% 22%)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
              style={{
                background: "linear-gradient(135deg, hsl(220 90% 56% / 0.2), hsl(215 85% 48% / 0.2))",
                border: "1px solid hsl(220 90% 56% / 0.3)",
              }}
            >
              📐
            </div>
            <h2 className="text-white font-semibold text-base">Nuovo Progetto</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors"
            style={{ color: "hsl(215 20% 55%)", background: "hsl(220 32% 20%)" }}
            aria-label="Chiudi"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="project-name"
              className="block text-xs font-medium"
              style={{ color: "hsl(215 20% 65%)" }}
            >
              Nome del progetto
            </label>
            <input
              ref={inputRef}
              id="project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Es. Progetto Antincendio Via Roma 12"
              maxLength={120}
              className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-opacity-40 transition-all outline-none"
              style={{
                background: "hsl(220 32% 18%)",
                border: "1px solid hsl(220 20% 26%)",
                color: "hsl(210 40% 96%)",
              }}
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = "hsl(220 90% 56%)")
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = "hsl(220 20% 26%)")
              }
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={{
                background: "hsl(220 32% 20%)",
                color: "hsl(215 20% 65%)",
              }}
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isPending || !name.trim()}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background:
                  "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
                boxShadow: name.trim()
                  ? "0 4px 16px hsl(220 90% 56% / 0.3)"
                  : "none",
              }}
            >
              {isPending ? "Creazione..." : "Crea Progetto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
