import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { getFieldNotes, createFieldNote } from "@/app/actions/field-notes";

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

  // Fetch progetto per validazione di sicurezza
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
    .select("id, name")
    .eq("id", levelId)
    .eq("project_id", id)
    .single() as { data: { id: string; name: string } | null };

  if (!level) return notFound();

  // Recupera le note esistenti per questo livello
  const notes = await getFieldNotes(levelId);
  let note = notes[0] ?? null;

  if (!note) {
    // Se non esiste ancora alcuna nota per il livello, ne creiamo una di default istantaneamente
    const res = await createFieldNote({
      project_id: id,
      level_id: levelId,
      type_id: null,
      type_name: "Appunti Cantiere",
      items: [
        {
          item_type: "nota",
          value_text: "",
          sort_order: 0
        }
      ]
    });
    if (res.success && res.note) {
      note = res.note;
    }
  }

  if (note) {
    redirect(`/projects/${id}/levels/${levelId}/appunti/${note.id}/modifica`);
  }

  // Fallback in caso di problemi imprevisti
  redirect(`/projects/${id}`);
}
