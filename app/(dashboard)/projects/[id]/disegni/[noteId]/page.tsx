import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getNoteTypes, getFieldNote } from "@/app/actions/field-notes";
import CanalizzazioneDisegnoEditor from "@/app/ui/projects/CanalizzazioneDisegnoEditor";
import type { Material } from "@/lib/types/database";

export default async function DedicatedDrawingPage({
  params,
}: {
  params: Promise<{ id: string; noteId: string }>;
}) {
  const { id, noteId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { data: project } = await (supabase as any)
    .from("projects")
    .select("id, name")
    .eq("id", id)
    .single() as { data: { id: string; name: string } | null };

  if (!project) {
    project = { id, name: "Progetto" };
  }

  const { getUserTags } = await import("@/app/actions/settings");

  const [noteTypes, dbNote, tags] = await Promise.all([
    getNoteTypes(),
    getFieldNote(noteId).catch(() => null),
    getUserTags("material_category").catch(() => []),
  ]);

  const catalogMaterials = tags.map((tag) => ({
    id: tag.id,
    name: tag.name,
    user_id: tag.user_id,
    description: null,
    category: "material_category",
    length_mm: null,
    width_mm: null,
    thickness_mm: null,
    unit_cost: null,
    unit: "unità",
    stock_qty: null,
    supplier: null,
    sku: null,
    is_active: true,
    created_at: tag.created_at,
    updated_at: tag.created_at,
  } as Material));

  const note = dbNote || {
    id: noteId,
    project_id: id,
    level_id: null,
    note_number: 999,
    type_id: null,
    type_name: "Disegno",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    field_note_items: [],
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto w-full animate-fade-in pb-4">
      {/* ── Breadcrumbs e Titolo ── */}
      <div className="px-4 sm:px-8 py-4 sm:py-6 space-y-3 print:hidden">
        <div
          className="flex items-center gap-1.5 text-xs sm:text-sm font-medium flex-wrap"
          style={{ color: "hsl(215 15% 55%)" }}
        >
          <Link href="/projects" className="hover:text-white transition-colors">Note di Cantiere</Link>
          <span>/</span>
          <Link href={`/projects/${id}`} className="hover:text-white transition-colors">{project.name}</Link>
          <span>/</span>
          <span className="text-white">Disegno Tratta #{note.note_number}</span>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{
                background: "rgba(245, 158, 11, 0.15)",
                color: "#f59e0b",
                border: "1px solid rgba(245, 158, 11, 0.2)",
              }}
            >
              📐 Routing 3D Parametrico
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">
            📐 Spazio di Lavoro Disegno #{note.note_number}
          </h1>
        </div>
      </div>

      <div
        className="print:hidden"
        style={{
          height: "1px",
          background: "hsl(220 20% 14%)",
          margin: "0 1rem 1.5rem",
        }}
      />

      <div className="px-4 sm:px-8">
        <CanalizzazioneDisegnoEditor
          projectId={id}
          noteTypes={noteTypes}
          initialNote={note}
          catalogMaterials={catalogMaterials}
        />
      </div>
    </div>
  );
}
