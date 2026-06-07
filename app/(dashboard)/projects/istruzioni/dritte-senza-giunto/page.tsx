import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getUserTags } from "@/app/actions/settings";
import AssemblyInstructionsClient from "@/app/ui/projects/AssemblyInstructionsClient";

export default async function DritteSenzaGiuntoPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const materials = await getUserTags("material_category");
  const project = { id: "", name: "Dritte senza Giunto" };

  return (
    <AssemblyInstructionsClient
      project={project}
      catalogMaterials={materials}
      variant="senza-giunto"
    />
  );
}
