import CanvasWrapper from "@/app/ui/canvas/CanvasWrapper";
import Canvas3DWrapper from "@/app/ui/canvas/Canvas3DWrapper";
import EditorHeader from "@/app/ui/canvas/EditorHeader";
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
    .select("name, notes")
    .eq("id", id)
    .single()) as any;

  const projectName = project?.name ?? "Progetto Senza Nome";

  // Livelli del progetto (ordinati per elevation_z)
  const levels = (await getLevels(id)) as Level[];
  const firstLevel = levels[0] ?? null;

  return (
    <div className="relative w-full h-full flex flex-col bg-[#08090d]">
      {/* Header con gestione nome e livelli */}
      <EditorHeader
        projectId={id}
        initialName={projectName}
        initialLevels={levels}
        initialLevelId={firstLevel?.id ?? ""}
      />

      {/* Split Screen Area */}
      <div className="flex-1 w-full h-full flex flex-col lg:flex-row overflow-hidden">
        {/* Lato Sinistro: Canvas 2D Konva per il Disegno Sezione Frontale */}
        <div className="flex-1 h-[55vh] lg:h-full relative border-b lg:border-b-0 lg:border-r border-[hsl(220_20%_18%)] cursor-crosshair">
          <CanvasWrapper projectId={id} />
        </div>
        {/* Lato Destro: Render 3D in Tempo Reale React Three Fiber */}
        <div className="w-full lg:w-[42%] h-[45vh] lg:h-full relative overflow-hidden bg-[#08090d]">
          <Canvas3DWrapper projectId={id} />
        </div>
      </div>
    </div>
  );
}
