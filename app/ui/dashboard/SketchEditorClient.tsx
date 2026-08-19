"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ProjectSketch, SketchStroke } from "@/lib/types/database";
import { updateProjectSketchStrokes, renameProjectSketch, deleteProjectSketch } from "@/app/actions/projects";
import DrawingCanvas from "./DrawingCanvas";
import { ArrowLeftIcon, DeleteIcon } from "./icons";

interface SketchEditorClientProps {
  sketch: ProjectSketch;
}

// Editor a tutta pagina, fuori dal layout con sidebar/header del gestionale:
// solo una barra minima con nome/indietro/elimina, tutto il resto e' per il canvas.
export default function SketchEditorClient({ sketch: initialSketch }: SketchEditorClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sketch, setSketch] = useState<ProjectSketch>(initialSketch);
  const [nameDraft, setNameDraft] = useState(initialSketch.name);

  const handleSaveStrokes = async (strokes: SketchStroke[]) => {
    const res = await updateProjectSketchStrokes(sketch.id, strokes);
    if (!res.success) console.error(res.error);
  };

  const handleRenameBlur = () => {
    const trimmed = nameDraft.trim() || "Disegno senza titolo";
    setNameDraft(trimmed);
    if (trimmed === sketch.name) return;
    setSketch((s) => ({ ...s, name: trimmed }));
    startTransition(async () => {
      const res = await renameProjectSketch(sketch.id, trimmed);
      if (!res.success) alert(res.error);
    });
  };

  const handleDelete = () => {
    if (!confirm("Eliminare questo disegno?")) return;
    startTransition(async () => {
      const res = await deleteProjectSketch(sketch.id);
      if (!res.success) { alert(res.error); return; }
      router.push(`/dashboard/projects/${sketch.project_id}`);
    });
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(240 10% 4%), hsl(240 10% 8%))" }}>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800/70 flex-shrink-0">
        <Link href={`/dashboard/projects/${sketch.project_id}`}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold text-zinc-400 hover:text-white transition-all flex-shrink-0">
          <ArrowLeftIcon size={12} /> Progetto
        </Link>
        <input
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={handleRenameBlur}
          className="flex-1 min-w-0 bg-transparent text-sm font-extrabold text-white px-2 py-1.5 rounded-lg border border-transparent hover:border-zinc-800 focus:border-zinc-600 focus:bg-zinc-950/60 transition-all outline-none"
        />
        <button onClick={handleDelete} disabled={isPending}
          className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-rose-300 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all flex-shrink-0 flex items-center gap-1.5">
          <DeleteIcon size={12} /> Elimina
        </button>
      </div>

      <div className="flex-1 overflow-auto p-3 md:p-5">
        <div className="w-full max-w-[1600px] mx-auto">
          <DrawingCanvas initialStrokes={sketch.strokes} onSave={handleSaveStrokes} />
        </div>
      </div>
    </div>
  );
}
