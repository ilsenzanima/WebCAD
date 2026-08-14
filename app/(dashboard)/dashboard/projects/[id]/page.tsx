import { notFound } from "next/navigation";
import { getProject, getProjectMaterials } from "@/app/actions/projects";
import ProjectDetailClient from "@/app/ui/dashboard/ProjectDetailClient";

export const metadata = {
  title: "Progetto - Finanza Privata",
  description: "Dettaglio progetto, note e lista materiali",
};

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const project = await getProject(id);
  if (!project) notFound();

  const materials = await getProjectMaterials(id);

  return <ProjectDetailClient project={project} initialMaterials={materials} />;
}
