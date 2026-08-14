import { getProjects } from "@/app/actions/projects";
import ProjectsClient from "@/app/ui/dashboard/ProjectsClient";

export const metadata = {
  title: "Progetti - Finanza Privata",
  description: "Vetrina dei tuoi progetti personali",
};

export default async function ProjectsPage() {
  const projects = await getProjects();

  return <ProjectsClient initialProjects={projects} />;
}
