import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getFieldNotes } from "@/app/actions/field-notes";
import FieldNotesList from "@/app/ui/projects/FieldNotesList";
import StickyPlanimetria from "@/app/ui/projects/StickyPlanimetria";

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

  // Fetch livello (inclusa planimetria)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: level } = await (supabase as any)
    .from("levels")
    .select("id, name, elevation_z, plan_image_url")
    .eq("id", levelId)
    .eq("project_id", id)
    .single() as { data: { id: string; name: string; elevation_z: number; plan_image_url: string | null } | null };

  if (!level) return notFound();

  const notes = await getFieldNotes(levelId);
  const planImageUrl = level.plan_image_url;

  return (
    <div className="flex flex-col h-full overflow-y-auto w-full animate-fade-in pb-4">

      {/* ── Planimetria sticky (solo se disponibile) ───────── */}
      {planImageUrl && (
        <StickyPlanimetria planImageUrl={planImageUrl} notes={notes} levelName={level.name} />
      )}

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
        {!planImageUrl && (
          <div
            className="mb-4 px-4 py-3 rounded-xl text-xs flex items-center gap-2"
            style={{
              background: "hsl(220 26% 14%)",
              border: "1px dashed hsl(220 20% 24%)",
              color: "hsl(215 15% 45%)",
            }}
          >
            <span>🗺</span>
            <span>Nessuna planimetria caricata. Importa un&apos;immagine o PDF nell&apos;editor per abilitare &quot;Segna posizione&quot; sulle note.</span>
          </div>
        )}
        <FieldNotesList notes={notes} />
      </div>
    </div>
  );
}
