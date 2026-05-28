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

  // Fetch project data (cantiere)
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, name, notes, created_at, updated_at")
    .eq("id", id)
    .single();

  if (projectError || !project) {
    return notFound();
  }

  // Fetch levels (note) di questo cantiere
  const [levels, projectNotes] = await Promise.all([
    supabase
      .from("levels")
      .select("id, project_id, name, elevation_z, plan_image_url, scale_ratio, drawing_type, created_at, completed, piano")
      .eq("project_id", id)
      .order("elevation_z", { ascending: true })
      .then(res => res.data ?? []),
    getAllProjectFieldNotes(id)
  ]);

  return <ProjectDetailClient project={project} drawings={levels} notesList={projectNotes} />;
}
