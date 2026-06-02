import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getNoteTypes, getFieldNote } from "@/app/actions/field-notes";
import LevelNewNoteForm from "@/app/ui/projects/LevelNewNoteForm";
import type { Material } from "@/lib/types/database";

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
  let { data: project } = await (supabase as any)
    .from("projects")
    .select("id, name")
    .eq("id", id)
    .single() as { data: { id: string; name: string } | null };

  if (!project) {
    project = { id, name: "Progetto" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { data: level } = await (supabase as any)
    .from("levels")
    .select("id, name, plan_image_url")
    .eq("id", levelId)
    .eq("project_id", id)
    .single() as { data: { id: string; name: string; plan_image_url: string | null } | null };

  if (!level) {
    level = { id: levelId, name: "Piano", plan_image_url: null };
  }

  const { getFieldNotes } = await import("@/app/actions/field-notes");
  const { getUserTags } = await import("@/app/actions/settings");

  const [noteTypes, dbNote, levelNotes, tags] = await Promise.all([
    getNoteTypes(),
    getFieldNote(noteId).catch(() => null),
    getFieldNotes(levelId).catch(() => []),
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
    level_id: levelId,
    note_number: 999,
    type_id: null,
    type_name: "Appunti Cantiere",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    field_note_items: [],
  };

  // Titolo: type_name (impostato dall'utente) → testo item 'nota' → numero progressivo
  const notaItem = note.field_note_items?.find((i: any) => i.item_type === "nota" && i.value_text?.trim());
  const noteTitle = (note as any).type_name?.trim() || notaItem?.value_text?.trim() || `Appunto #${note.note_number}`;

  return (
    <div className="flex flex-col h-full overflow-y-auto w-full animate-fade-in pb-4">
      <div className="px-4 sm:px-8 py-4 sm:py-6 space-y-3 sm:space-y-4">
        <div
          className="flex items-center gap-1.5 text-xs sm:text-sm font-medium flex-wrap"
          style={{ color: "hsl(215 15% 55%)" }}
        >
          <Link href="/projects" className="hover:text-white transition-colors">Note di Cantiere</Link>
          <span>/</span>
          <Link href={`/projects/${id}`} className="hover:text-white transition-colors">{project.name}</Link>
          <span>/</span>
          <span>{level.name}</span>
          <span>/</span>
          <span className="text-white">{noteTitle}</span>
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
            ✏️ Modifica {noteTitle}
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
          catalogMaterials={catalogMaterials}
        />
      </div>
    </div>
  );
}