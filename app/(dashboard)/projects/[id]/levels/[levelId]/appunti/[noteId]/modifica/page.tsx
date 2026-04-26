import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getNoteTypes, getFieldNote } from "@/app/actions/field-notes";
import LevelNewNoteForm from "@/app/ui/projects/LevelNewNoteForm";

export default async function EditFieldNotePage({
  params,
}: {
  params: Promise<{ id: string; levelId: string; noteId: string }>;
}) {
  const { id, levelId, noteId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: project } = await (supabase as any)
    .from("projects")
    .select("id, name")
    .eq("id", id)
    .single() as { data: { id: string; name: string } | null };

  if (!project) return notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: level } = await (supabase as any)
    .from("levels")
    .select("id, name, plan_image_url")
    .eq("id", levelId)
    .eq("project_id", id)
    .single() as { data: { id: string; name: string; plan_image_url: string | null } | null };

  if (!level) return notFound();

  const { getFieldNotes } = await import("@/app/actions/field-notes");

  const [noteTypes, note, levelNotes] = await Promise.all([
    getNoteTypes(),
    getFieldNote(noteId),
    getFieldNotes(levelId),
  ]);

  if (!note || note.level_id !== levelId) return notFound();

  return (
    <div className="flex flex-col h-full overflow-y-auto w-full animate-fade-in pb-4">
      <div className="px-4 sm:px-8 py-4 sm:py-6 space-y-3 sm:space-y-4">
        <div
          className="flex items-center gap-1.5 text-xs sm:text-sm font-medium flex-wrap"
          style={{ color: "hsl(215 15% 55%)" }}
        >
          <Link href="/projects" className="hover:text-white transition-colors">Progetti</Link>
          <span>/</span>
          <Link href={`/projects/${id}`} className="hover:text-white transition-colors">{project.name}</Link>
          <span>/</span>
          <Link href={`/projects/${id}/levels/${levelId}/appunti`} className="hover:text-white transition-colors">
            {level.name} — Appunti
          </Link>
          <span>/</span>
          <span className="text-white">Modifica #{note.note_number}</span>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{
                background: "hsl(220 90% 56% / 0.15)",
                color: "hsl(220 90% 70%)",
                border: "1px solid hsl(220 90% 56% / 0.2)",
              }}
            >
              📐 {level.name}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">
            ✏️ Modifica Appunto #{note.note_number}
          </h1>
        </div>
      </div>

      <div
        style={{
          height: "1px",
          background: "hsl(220 20% 14%)",
          margin: "0 1rem 1.5rem",
        }}
      />

      <div className="px-4 sm:px-8">
        <LevelNewNoteForm
          projectId={id}
          levelId={levelId}
          noteTypes={noteTypes}
          initialNote={note}
          planImageUrl={level.plan_image_url}
          levelNotes={levelNotes}
        />
      </div>
    </div>
  );
}