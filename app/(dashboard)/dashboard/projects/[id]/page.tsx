import { notFound } from "next/navigation";
import { getProject, getProjectMaterials, getProjectSketches } from "@/app/actions/projects";
import ProjectDetailClient from "@/app/ui/dashboard/ProjectDetailClient";

export const metadata = {
  title: "Progetto - Finanza Privata",
  description: "Dettaglio progetto, note, lista materiali e disegni",
};

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const project = await getProject(id);
  if (!project) notFound();

  const [materials, sketches] = await Promise.all([getProjectMaterials(id), getProjectSketches(id)]);

  return <ProjectDetailClient project={project} initialMaterials={materials} initialSketches={sketches} />;
}
