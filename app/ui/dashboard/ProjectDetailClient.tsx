"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Project, ProjectNote } from "@/lib/types/database";
import { updateProject, deleteProject, createProjectNote, updateProjectNote, deleteProjectNote } from "@/app/actions/projects";
import { formatDate } from "@/lib/format";
import { DeleteIcon, ArrowLeftIcon } from "./icons";

interface ProjectDetailClientProps {
  project: Project;
  initialNotes: ProjectNote[];
}

export default function ProjectDetailClient({ project, initialNotes }: ProjectDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || "");

  const [notes, setNotes] = useState<ProjectNote[]>(initialNotes);
  const [newNote, setNewNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");

  const handleSave = () => {
    if (!name.trim()) { alert("Il nome non può essere vuoto"); return; }
    startTransition(async () => {
      const res = await updateProject(project.id, { name: name.trim(), description: description || null });
      if (!res.success) { alert(res.error); return; }
      router.refresh();
    });
  };

  const handleDelete = () => {
    if (!confirm("Eliminare questo progetto e tutte le sue note?")) return;
    startTransition(async () => {
      const res = await deleteProject(project.id);
      if (!res.success) { alert(res.error); return; }
      router.push("/dashboard/projects");
    });
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    startTransition(async () => {
      const res = await createProjectNote(project.id, newNote);
      if (!res.success || !res.data) { alert(res.error); return; }
      setNotes((prev) => [res.data as ProjectNote, ...prev]);
      setNewNote("");
    });
  };

  const startEditNote = (note: ProjectNote) => {
    setEditingId(note.id);
    setEditingContent(note.content);
  };

  const handleSaveNote = (id: string) => {
    if (!editingContent.trim()) return;
    startTransition(async () => {
      const res = await updateProjectNote(id, editingContent);
      if (!res.success || !res.data) { alert(res.error); return; }
      setNotes((prev) => prev.map((n) => (n.id === id ? (res.data as ProjectNote) : n)));
      setEditingId(null);
    });
  };

  const handleDeleteNote = (id: string) => {
    if (!confirm("Eliminare questa nota?")) return;
    startTransition(async () => {
      const res = await deleteProjectNote(id);
      if (!res.success) { alert(res.error); return; }
      setNotes((prev) => prev.filter((n) => n.id !== id));
    });
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-3xl mx-auto">
      <Link href="/dashboard/projects" className="inline-flex items-center gap-1.5 text-[11px] font-bold text-zinc-400 hover:text-white transition-all">
        <ArrowLeftIcon size={12} /> Progetti
      </Link>

      <div className="animate-fade-in flex items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent truncate">
          📁 {project.name}
        </h1>
        <button onClick={handleDelete} className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all flex-shrink-0" title="Elimina progetto">
          <DeleteIcon size={16} />
        </button>
      </div>

      {/* Info progetto */}
      <div className="rounded-2xl p-5 border shadow-2xl backdrop-blur-xl animate-fade-in space-y-3"
        style={{ background: "linear-gradient(135deg, hsla(240, 10%, 12%, 0.5), hsla(240, 10%, 10%, 0.8))", borderColor: "hsla(240, 5%, 18%, 0.7)" }}>
        <div className="space-y-1">
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Nome</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg text-xs text-white border border-zinc-800 bg-zinc-950/80" />
        </div>
        <div className="space-y-1">
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Descrizione</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
            className="w-full px-3 py-2.5 rounded-lg text-xs text-white border border-zinc-800 bg-zinc-950/80 resize-none" />
        </div>
        <button onClick={handleSave} disabled={isPending}
          className="w-full py-3 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-500 transition-all">
          Salva modifiche
        </button>
      </div>

      {/* Note */}
      <div className="rounded-2xl p-5 border shadow-2xl backdrop-blur-xl animate-fade-in space-y-4"
        style={{ background: "linear-gradient(135deg, hsla(240, 10%, 12%, 0.5), hsla(240, 10%, 10%, 0.8))", borderColor: "hsla(240, 5%, 18%, 0.7)" }}>
        <h3 className="text-sm font-extrabold text-white">📝 Note</h3>

        <form onSubmit={handleAddNote} className="space-y-2">
          <textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Aggiungi una nota..." rows={3}
            className="w-full px-3 py-2.5 rounded-lg text-xs text-white border border-zinc-800 bg-zinc-950/80 resize-none" />
          <button type="submit" disabled={isPending || !newNote.trim()}
            className="px-4 py-2.5 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-500 transition-all disabled:opacity-50">
            Aggiungi nota
          </button>
        </form>

        <div className="space-y-2">
          {notes.map((note) => (
            <div key={note.id} className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-950/40 group">
              {editingId === note.id ? (
                <div className="space-y-2">
                  <textarea value={editingContent} onChange={(e) => setEditingContent(e.target.value)} rows={3}
                    className="w-full px-3 py-2 rounded-lg text-xs text-white border border-zinc-800 bg-zinc-950/80 resize-none" autoFocus />
                  <div className="flex gap-2">
                    <button onClick={() => handleSaveNote(note.id)} disabled={isPending}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-all">
                      Salva
                    </button>
                    <button onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-zinc-400 hover:text-white transition-all">
                      Annulla
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-zinc-200 whitespace-pre-wrap break-words">{note.content}</p>
                    <p className="text-[10px] text-zinc-500 mt-1.5">{formatDate(note.created_at)}</p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button onClick={() => startEditNote(note)} className="p-1.5 rounded text-slate-500 hover:text-white" title="Modifica nota">
                      ✏️
                    </button>
                    <button onClick={() => handleDeleteNote(note.id)} className="p-1.5 rounded text-slate-500 hover:text-rose-400" title="Elimina nota">
                      <DeleteIcon size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {notes.length === 0 && <p className="text-[11px] text-zinc-500">Nessuna nota ancora aggiunta.</p>}
        </div>
      </div>
    </div>
  );
}
