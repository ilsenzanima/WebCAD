import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getFieldNotes } from "@/app/actions/field-notes";
import FieldNotesList from "@/app/ui/projects/FieldNotesList";

export default async function FieldNotesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Verifica che il progetto esista e appartenga all'utente
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: project, error } = await (supabase as any)
    .from("projects")
    .select("id, name")
    .eq("id", id)
    .single() as { data: { id: string; name: string } | null; error: unknown };

  if (error || !project) return notFound();

  const notes = await getFieldNotes(id);

  return (
    <div className="flex flex-col h-full overflow-y-auto w-full animate-fade-in pb-4">
      {/* ── Header ───────────────────────────── */}
      <div className="px-4 sm:px-8 py-4 sm:py-6 space-y-3 sm:space-y-4">
        {/* Breadcrumb */}
        <div
          className="flex items-center gap-2 text-sm font-medium"
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
          <span className="text-white">Appunti Cantiere</span>
        </div>

        <div className="flex items-start sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              📋 Appunti
            </h1>
            <p className="mt-0.5 text-xs sm:text-sm truncate" style={{ color: "hsl(215 15% 50%)" }}>
              {project.name} — {notes.length} appunt{notes.length === 1 ? "o" : "i"}
            </p>
          </div>

          <Link
            href={`/projects/${id}/appunti/nuovo`}
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
          margin: "0 2rem",
        }}
      />

      {/* ── Lista Appunti ───────────────────────── */}
      <div className="px-4 sm:px-8 py-4 sm:py-6">
        <FieldNotesList notes={notes} />
      </div>
    </div>
  );
}
