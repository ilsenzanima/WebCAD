import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getUserTags } from "@/app/actions/settings";
import CassonettiInstructionsClient from "@/app/ui/projects/CassonettiInstructionsClient";

export default async function CassonettiIstruzioniPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const materials = await getUserTags("material_category");
  const project = { id: "", name: "Cassonetti Copri Impianti" };

  return (
    <CassonettiInstructionsClient
      project={project}
      catalogMaterials={materials}
    />
  );
}
