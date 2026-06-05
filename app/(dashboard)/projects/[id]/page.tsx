import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import ProjectDetailClient from "@/app/ui/projects/ProjectDetailClient";
import { getAllProjectFieldNotes } from "@/app/actions/field-notes";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  let project;
  let levels: any[] = [];
  let projectNotes: any[] = [];

  if (id.startsWith("temp_")) {
    project = {
      id,
      name: "Nuovo Progetto Offline",
      notes: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  } else {
    // Eseguiamo l'auth check e il fetch dei dati in parallelo per abbattere la latenza sequenziale
    const [userRes, projectRes, levelsRes, notesRes] = await Promise.all([
      supabase.auth.getUser(),
      supabase
        .from("projects")
        .select("id, name, notes, created_at, updated_at")
        .eq("id", id)
        .single(),
      supabase
        .from("levels")
        .select("id, project_id, name, elevation_z, plan_image_url, scale_ratio, drawing_type, created_at, completed, piano")
        .eq("project_id", id)
        .order("elevation_z", { ascending: true }),
      getAllProjectFieldNotes(id)
    ]) as [any, any, any, any];

    if (!userRes.data.user) {
      redirect("/login");
    }

    if (projectRes.error || !projectRes.data) {
      return notFound();
    }

    project = projectRes.data;
    levels = levelsRes.data ?? [];
    projectNotes = notesRes;
  }

  return <ProjectDetailClient project={project} drawings={levels} notesList={projectNotes} />;
}
