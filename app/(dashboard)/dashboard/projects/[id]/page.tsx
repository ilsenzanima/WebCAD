import { notFound } from "next/navigation";
import { getProject, getProjectNotes } from "@/app/actions/projects";
import ProjectDetailClient from "@/app/ui/dashboard/ProjectDetailClient";

export const metadata = {
  title: "Progetto - Finanza Privata",
  description: "Dettaglio progetto e note collegate",
};

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const project = await getProject(id);
  if (!project) notFound();

  const notes = await getProjectNotes(id);

  return <ProjectDetailClient project={project} initialNotes={notes} />;
}
