import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getNoteTypes } from "@/app/actions/field-notes";
import NewNoteForm from "@/app/ui/projects/NewNoteForm";

export default async function NewFieldNotePage({
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: project, error } = await (supabase as any)
    .from("projects")
    .select("id, name")
    .eq("id", id)
    .single() as { data: { id: string; name: string } | null; error: unknown };

  if (error || !project) return notFound();

  const noteTypes = await getNoteTypes();

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
          <Link
            href={`/projects/${id}/appunti`}
            className="hover:text-white transition-colors"
          >
            Appunti
          </Link>
          <span>/</span>
          <span className="text-white">Nuovo</span>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-white">✏️ Nuovo Appunto</h1>
          <p className="mt-1 text-sm" style={{ color: "hsl(215 15% 50%)" }}>
            Compila il form e clicca "Salva Appunto". Il numero verrà assegnato
            automaticamente.
          </p>
        </div>
      </div>

      {/* ── Divisore ───── */}
      <div
        style={{
          height: "1px",
          background: "hsl(220 20% 14%)",
          margin: "0 2rem 1.5rem",
        }}
      />

      {/* ── Form ───────────────────────────── */}
      <div className="px-4 sm:px-8">
        <NewNoteForm projectId={id} noteTypes={noteTypes} />
      </div>
    </div>
  );
}
