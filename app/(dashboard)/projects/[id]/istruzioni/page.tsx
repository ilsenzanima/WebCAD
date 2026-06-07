import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { getUserTags } from "@/app/actions/settings";
import AssemblyInstructionsClient from "@/app/ui/projects/AssemblyInstructionsClient";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AssemblyInstructionsPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const projectRes = (await supabase
    .from("projects")
    .select("id, name")
    .eq("id", id)
    .single()) as any;

  const materials = await getUserTags("material_category");

  if (projectRes.error || !projectRes.data) {
    return notFound();
  }

  const project = projectRes.data;

  return (
    <AssemblyInstructionsClient
      project={project}
      catalogMaterials={materials}
    />
  );
}
