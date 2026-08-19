import { notFound } from "next/navigation";
import { getProject, getProjectMaterials, getProjectSketches, getProjectModels } from "@/app/actions/projects";
import ProjectDetailClient from "@/app/ui/dashboard/ProjectDetailClient";

export const metadata = {
  title: "Progetto - Finanza Privata",
  description: "Dettaglio progetto, note, lista materiali, disegni e modelli 3D",
};

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const project = await getProject(id);
  if (!project) notFound();

  const [materials, sketches, models] = await Promise.all([
    getProjectMaterials(id),
    getProjectSketches(id),
    getProjectModels(id),
  ]);

  return <ProjectDetailClient project={project} initialMaterials={materials} initialSketches={sketches} initialModels={models} />;
}
