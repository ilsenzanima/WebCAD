import CanvasWrapper from "@/app/ui/canvas/CanvasWrapper";
import EditorHeader from "@/app/ui/canvas/EditorHeader";
import Toolbar from "@/app/ui/canvas/Toolbar";
import { createClient } from "@/lib/supabase/server";
import { getLevels } from "@/app/actions/projects";
import type { Level } from "@/lib/types/database";

export default async function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Dati del progetto
  const { data: project } = (await supabase
    .from("projects")
    .select("name")
    .eq("id", id)
    .single()) as any;

  const projectName = project?.name ?? "Progetto Senza Nome";

  // Livelli del progetto (ordinati per elevation_z)
  const levels = (await getLevels(id)) as Level[];
  const firstLevel = levels[0] ?? null;

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Header con gestione nome e livelli */}
      <EditorHeader
        projectId={id}
        initialName={projectName}
        initialLevels={levels}
        initialLevelId={firstLevel?.id ?? ""}
      />

      {/* Area del Canvas */}
      <div className="flex-1 w-full h-full relative cursor-crosshair">
        <CanvasWrapper projectId={id} />
      </div>

      {/* Toolbar comandi flottante */}
      <Toolbar />
    </div>
  );
}
