import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getNoteTypes, getFieldNotes } from "@/app/actions/field-notes";
import LevelNewNoteForm from "@/app/ui/projects/LevelNewNoteForm";

export default async function LevelNewFieldNotePage({
  params,
}: {
  params: Promise<{ id: string; levelId: string }>;
}) {
  const { id, levelId } = await params;
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

  const { getMaterials } = await import("@/app/actions/materials");
  const [noteTypes, levelNotes, catalogMaterials] = await Promise.all([
    getNoteTypes(),
    getFieldNotes(levelId),
    getMaterials(),
  ]);

  // Calcola il prossimo numero di nota (massimo + 1 tra le note del livello, o 1 se nessuna)
  const nextNoteNumber = levelNotes.length > 0
    ? Math.max(...levelNotes.map((n) => n.note_number)) + 1
    : 1;

  return (
    <div className="flex flex-col h-full overflow-y-auto w-full animate-fade-in pb-4">
      {/* ── Header ───────────────────────────── */}
      <div className="px-4 sm:px-8 py-4 sm:py-6 space-y-3 sm:space-y-4">
        {/* Breadcrumb */}
        <div
          className="flex items-center gap-1.5 text-xs sm:text-sm font-medium flex-wrap"
          style={{ color: "hsl(215 15% 55%)" }}
        >
          <Link href="/projects" className="hover:text-white transition-colors">
            Progetti
          </Link>
          <span>/</span>
          <Link
            href={`/projects/${id}`}
            className="hover:text-white transition-colors"
          >
            {project.name}
          </Link>
          <span>/</span>
          <Link
            href={`/projects/${id}/levels/${levelId}/appunti`}
            className="hover:text-white transition-colors"
          >
            {level.name} — Appunti
          </Link>
          <span>/</span>
          <span className="text-white">Nuovo</span>
        </div>

        <div>
          {/* Badge livello */}
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
            ✏️ Nuovo Appunto
          </h1>
          <p className="mt-1 text-xs sm:text-sm" style={{ color: "hsl(215 15% 50%)" }}>
            Il numero verrà assegnato automaticamente in modo progressivo.
          </p>
        </div>
      </div>

      {/* ── Divisore ───── */}
      <div
        style={{
          height: "1px",
          background: "hsl(220 20% 14%)",
          margin: "0 1rem 1.5rem",
        }}
      />

      {/* ── Form ───────────────────────────── */}
      <div className="px-4 sm:px-8">
        <LevelNewNoteForm
          projectId={id}
          levelId={levelId}
          noteTypes={noteTypes}
          planImageUrl={level.plan_image_url}
          nextNoteNumber={nextNoteNumber}
          levelNotes={levelNotes}
          catalogMaterials={catalogMaterials}
        />
      </div>
    </div>
  );
}
