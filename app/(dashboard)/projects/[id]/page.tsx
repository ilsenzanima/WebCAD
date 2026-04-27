import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import ProjectDetailClient from "@/app/ui/projects/ProjectDetailClient";

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

  // Fetch project data
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, name, notes, created_at, updated_at")
    .eq("id", id)
    .single();

  if (projectError || !project) {
    return notFound();
  }

  // Fetch levels (disegni) of this project
  const { data: levels, error: levelsError } = await supabase
    .from("levels")
    .select("id, project_id, name, elevation_z, plan_image_url, scale_ratio, created_at")
    .eq("project_id", id)
    .order("elevation_z", { ascending: true });

  const drawings = levels ?? [];

  return <ProjectDetailClient project={project} drawings={drawings} />;
}
