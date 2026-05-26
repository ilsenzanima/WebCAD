import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import NotesRedirector from "@/app/ui/projects/NotesRedirector";

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

  return <NotesRedirector projectId={id} levelId={levelId} />;
}
