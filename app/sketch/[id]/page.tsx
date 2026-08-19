import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProjectSketch } from "@/app/actions/projects";
import SketchEditorClient from "@/app/ui/dashboard/SketchEditorClient";

export const metadata = {
  title: "Disegno - Finanza Privata",
  description: "Editor a tutta pagina per il disegno di un progetto",
};

// Fuori dal gruppo (dashboard): nessuna sidebar/header del gestionale, cosi'
// il canvas ha a disposizione tutta la pagina.
export default async function SketchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) redirect("/login");

  const sketch = await getProjectSketch(id);
  if (!sketch) notFound();

  return <SketchEditorClient sketch={sketch} />;
}
