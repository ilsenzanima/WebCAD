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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

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
    // Fetch project data (cantiere)
    const { data, error: projectError } = await supabase
      .from("projects")
      .select("id, name, notes, created_at, updated_at")
      .eq("id", id)
      .single();

    if (projectError || !data) {
      return notFound();
    }
    project = data;

    // Fetch levels (note) di questo cantiere
    const [fetchedLevels, fetchedNotes] = await Promise.all([
      supabase
        .from("levels")
        .select("id, project_id, name, elevation_z, plan_image_url, scale_ratio, drawing_type, created_at, completed, piano")
        .eq("project_id", id)
        .order("elevation_z", { ascending: true })
        .then(res => res.data ?? []),
      getAllProjectFieldNotes(id)
    ]);
    levels = fetchedLevels;
    projectNotes = fetchedNotes;
  }

  return <ProjectDetailClient project={project} drawings={levels} notesList={projectNotes} />;
}
