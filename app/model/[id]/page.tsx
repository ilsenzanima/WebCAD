import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProjectModel } from "@/app/actions/projects";
import ModelEditorClient from "@/app/ui/dashboard/ModelEditorClient";

export const metadata = {
  title: "Modello 3D - Finanza Privata",
  description: "Editor CAD 3D a tutta pagina per un modello di progetto",
};

// Fuori dal gruppo (dashboard): nessuna sidebar/header del gestionale, cosi'
// l'editor CAD ha a disposizione tutta la pagina.
export default async function ModelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) redirect("/login");

  const model = await getProjectModel(id);
  if (!model) notFound();

  return <ModelEditorClient model={model} />;
}
