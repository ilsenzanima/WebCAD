import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getFieldNotes } from "@/app/actions/field-notes";
import FieldNotesList from "@/app/ui/projects/FieldNotesList";

export default async function LevelFieldNotesPage({
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

  // Fetch progetto
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: project } = await (supabase as any)
    .from("projects")
    .select("id, name")
    .eq("id", id)
    .single() as { data: { id: string; name: string } | null };

  if (!project) return notFound();

  // Fetch livello
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: level } = await (supabase as any)
    .from("levels")
    .select("id, name, elevation_z")
    .eq("id", levelId)
    .eq("project_id", id)
    .single() as { data: { id: string; name: string; elevation_z: number } | null };

  if (!level) return notFound();

  const notes = await getFieldNotes(levelId);

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
            className="hover:text-white transition-colors truncate max-w-[100px] sm:max-w-none"
          >
            {project.name}
          </Link>
          <span>/</span>
          <span className="text-white truncate max-w-[120px] sm:max-w-none">
            {level.name} — Appunti
          </span>
        </div>

        <div className="flex items-start sm:items-center justify-between gap-3">
          <div className="min-w-0">
            {/* Badge livello */}
            <div className="flex items-center gap-2 mb-1">
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
              📋 Appunti Cantiere
            </h1>
            <p
              className="mt-0.5 text-xs sm:text-sm"
              style={{ color: "hsl(215 15% 50%)" }}
            >
              {notes.length} appunt{notes.length === 1 ? "o" : "i"} per questo piano
            </p>
          </div>

          <Link
            href={`/projects/${id}/levels/${levelId}/appunti/nuovo`}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white transition-all duration-200"
            style={{
              background:
                "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
              boxShadow: "0 4px 16px hsl(220 90% 56% / 0.3)",
            }}
          >
            <span className="text-base leading-none">＋</span>
            <span className="hidden sm:inline">Nuovo Appunto</span>
            <span className="sm:hidden">Nuovo</span>
          </Link>
        </div>
      </div>

      {/* ── Divisore ───── */}
      <div
        style={{
          height: "1px",
          background: "hsl(220 20% 14%)",
          margin: "0 1rem 0 1rem",
        }}
      />

      {/* ── Lista Appunti ───────────────────────── */}
      <div className="px-4 sm:px-8 py-4 sm:py-6">
        <FieldNotesList notes={notes} />
      </div>
    </div>
  );
}
