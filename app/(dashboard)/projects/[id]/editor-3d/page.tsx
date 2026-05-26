import dynamic from "next/dynamic";
import EditorHeader from "@/app/ui/canvas/EditorHeader";
import { createClient } from "@/lib/supabase/server";
import { getLevels, get3DBox } from "@/app/actions/projects";
import type { Level } from "@/lib/types/database";

// Importazione dinamica del workspace 3D per disabilitare SSR (richiesto da Three.js/React Three Fiber)
const Canvas3DWorkspace = dynamic(
  () => import("@/app/ui/canvas/Canvas3DWorkspace"),
  { ssr: false }
);

export default async function Editor3DPage({
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

  // Livelli/disegni
  const levels = (await getLevels(id)) as Level[];
  const firstLevel = levels[0] ?? null;

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Header unificato */}
      <EditorHeader
        projectId={id}
        initialName={projectName}
        initialLevels={levels}
        initialLevelId={firstLevel?.id ?? ""}
      />

      {/* Area del Canvas 3D */}
      <div className="flex-1 w-full h-full relative">
        <Canvas3DWorkspace projectId={id} />
      </div>
    </div>
  );
}
