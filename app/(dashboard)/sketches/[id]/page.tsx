import { getSketch } from "@/app/actions/sketches";
import { getFieldNotes } from "@/app/actions/field-notes";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SketchEditorClient from "@/app/ui/sketches/SketchEditorClient";

interface SketchEditorPageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: "Editor Sketch - WebCAD Antincendio",
  description: "Lavagna di disegno interattivo con riconoscimento delle forme",
};

export default async function SketchEditorPage({ params }: SketchEditorPageProps) {
  const { id } = await params;

  // 1. Carica lo sketch
  const sketch = await getSketch(id);
  if (!sketch) {
    redirect("/sketches");
  }

  // 2. Se è associato ad un livello, carica le sue note/misure di cantiere
  let associatedNotes: any[] = [];
  if (sketch.level_id) {
    associatedNotes = await getFieldNotes(sketch.level_id);
  }

  // 3. Carica tutti i progetti e livelli per consentire la riassociazione
  const supabaseTyped = await createClient();
  const supabase = supabaseTyped as any;
  const { data: projectsData } = await supabase
    .from("projects")
    .select(`
      id,
      name,
      levels:levels (
        id,
        name,
        piano
      )
    `)
    .order("name", { ascending: true });

  const projectsWithLevels = (projectsData ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    levels: (p.levels ?? []).sort((a: any, b: any) => a.name.localeCompare(b.name)),
  }));

  return (
    <SketchEditorClient
      sketch={sketch}
      associatedNotes={associatedNotes}
      projectsWithLevels={projectsWithLevels}
    />
  );
}
