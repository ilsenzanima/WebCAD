import CanvasWrapper from "@/app/ui/canvas/CanvasWrapper";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import Toolbar from "@/app/ui/canvas/Toolbar";

export default async function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Dati di base del progetto e livello corrente (Epic 4 estenderà per multi-piano)
  const { data: project } = (await supabase
    .from("projects")
    .select("name")
    .eq("id", id)
    .single()) as any;

  const projectName = project?.name || "Progetto Senza Nome";

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Header Assoluto in Z-index alto */}
      <header className="absolute top-0 left-0 right-0 h-14 bg-[hsl(220_32%_10%/0.8)] backdrop-blur-md border-b border-[hsl(220_20%_22%)] z-50 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-[hsl(220_20%_22%)] transition-colors text-[hsl(215_20%_65%)]"
          >
            ←
          </Link>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">{projectName}</span>
            <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-[hsl(16_100%_58%/0.15)] text-[hsl(16_100%_65%)]">
              Livello 0
            </span>
          </div>
        </div>

        {/* Info/Azioni in alto a destra */}
        <div className="flex items-center gap-3">
          <button className="px-4 py-1.5 rounded-lg text-sm font-medium bg-[hsl(220_20%_22%)] hover:bg-[hsl(220_20%_28%)] text-white transition-colors">
            Salva
          </button>
        </div>
      </header>

      {/* Area del Canvas (Dynamic no-SSR) */}
      <div className="flex-1 w-full h-full relative cursor-crosshair">
        <CanvasWrapper projectId={id} />
      </div>

      {/* Toolbar Comandi Flottante */}
      <Toolbar />
    </div>
  );
}
