"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Project } from "@/lib/types/database";
import { createProject, deleteProject } from "@/app/actions/projects";
import { DeleteIcon, ArrowRightIcon } from "./icons";

interface ProjectsClientProps {
  initialProjects: Project[];
}

export default function ProjectsClient({ initialProjects }: ProjectsClientProps) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [isPending, startTransition] = useTransition();

  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const resetForm = () => {
    setName(""); setDescription("");
    setShowModal(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { alert("Inserisci il nome del progetto"); return; }

    startTransition(async () => {
      const res = await createProject({ name: name.trim(), description: description || null });
      if (!res.success || !res.data) { alert(res.error); return; }
      setProjects((prev) => [res.data as Project, ...prev]);
      resetForm();
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Eliminare questo progetto e tutte le sue note?")) return;
    startTransition(async () => {
      const res = await deleteProject(id);
      if (!res.success) { alert(res.error); return; }
      setProjects((prev) => prev.filter((p) => p.id !== id));
    });
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
          📁 Progetti
        </h1>
        <p className="text-sm text-slate-400 mt-1">I tuoi progetti personali, con una scheda e le note collegate a ciascuno.</p>
      </div>

      {/* Elenco Progetti */}
      <div className="rounded-2xl p-6 border shadow-2xl backdrop-blur-xl animate-fade-in"
        style={{ background: "linear-gradient(135deg, hsla(240, 10%, 12%, 0.5), hsla(240, 10%, 10%, 0.8))", borderColor: "hsla(240, 5%, 18%, 0.7)" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-extrabold text-white">Progetti</h3>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="px-4 py-2.5 rounded-xl text-xs font-extrabold text-white transition-all shadow-lg active:scale-98 flex items-center gap-2"
            style={{ background: "linear-gradient(135deg, hsl(245 70% 60%), hsl(255 60% 50%))" }}
          >
            <span>＋</span> Nuovo progetto
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {projects.map((p) => (
            <div key={p.id} className="relative group">
              <Link
                href={`/dashboard/projects/${p.id}`}
                className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-950/40 flex items-start justify-between gap-2 hover:border-zinc-600 transition-all h-full"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white break-words line-clamp-2">{p.name}</div>
                  <div className="text-[10px] text-zinc-500 break-words line-clamp-3 mt-0.5">
                    {p.description || "Apri la scheda →"}
                  </div>
                </div>
                <ArrowRightIcon size={12} className="text-zinc-600 flex-shrink-0 mt-0.5" />
              </Link>
              <button
                onClick={(e) => { e.preventDefault(); handleDelete(p.id); }}
                className="absolute top-2 right-7 p-1 rounded text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-950/80"
                title="Elimina progetto"
              >
                <DeleteIcon size={12} />
              </button>
            </div>
          ))}
        </div>
        {projects.length === 0 && <p className="text-[11px] text-zinc-500">Nessun progetto ancora inserito.</p>}
      </div>

      {/* Modale Nuovo Progetto */}
      {showModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 animate-fade-in overflow-y-auto"
          onClick={resetForm}
        >
          <div
            className="relative w-full max-w-lg my-8 rounded-2xl p-6 border shadow-2xl backdrop-blur-xl animate-fade-in max-h-[90vh] overflow-y-auto"
            style={{ background: "linear-gradient(135deg, hsla(245, 60%, 15%, 0.1), hsla(240, 10%, 10%, 0.97))", borderColor: "hsla(245, 60%, 50%, 0.15)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={resetForm}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white text-lg leading-none z-20"
              aria-label="Chiudi"
            >
              ✕
            </button>

            <h2 className="text-base font-extrabold text-white mb-4">Nuovo progetto</h2>

            <form onSubmit={handleSubmit} className="space-y-3">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome del progetto" required
                className="w-full px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80" />
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrizione (opzionale)" rows={3}
                className="w-full px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80 resize-none" />
              <button type="submit" disabled={isPending} className="w-full py-3 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-500 transition-all">
                Crea progetto
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
