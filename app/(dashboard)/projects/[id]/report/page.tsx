import ProjectReport from "@/app/ui/projects/ProjectReport";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <ProjectReport projectId={id} />;
}
