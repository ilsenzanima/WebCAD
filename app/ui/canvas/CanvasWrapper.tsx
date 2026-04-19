"use client";

import dynamic from "next/dynamic";

// Disabilitiamo il Server Side Rendering per il componente Canvas,
// poiché react-konva e HTML5 Canvas dipendono da "window".
// Next.js (Turbopack) richiede che questo avvenga dentro un Client Component.
const CanvasWorkspace = dynamic(
  () => import("@/app/ui/canvas/CanvasWorkspace"),
  { ssr: false }
);

import { useEffect } from "react";
import { useCanvasStore } from "@/lib/stores/canvas-store";
import { useProjectStore } from "@/lib/stores/project-store";

export default function CanvasWrapper({ projectId }: { projectId: string }) {
  const clearProjectState = useCanvasStore((state) => state.clearProjectState);
  const loadProjectData = useCanvasStore((state) => state.loadProjectData);
  const { levels, activeLevelId, setActiveProject } = useProjectStore();

  useEffect(() => {
    // Inizializziamo il progetto nello store se non già presente
    setActiveProject(projectId);
    
    // Puliamo lo stato precedente
    clearProjectState();

    // Se abbiamo dati per il livello attivo, carichiamoli nello store del canvas
    if (activeLevelId) {
       const currentLevel = levels.find(l => l.id === activeLevelId);
       if (currentLevel) {
          loadProjectData({
            plan_image_url: currentLevel.plan_image_url,
            scale_ratio: currentLevel.scale_ratio
          });
       }
    }
  }, [projectId, activeLevelId, levels, clearProjectState, loadProjectData, setActiveProject]);

  return <CanvasWorkspace />;
}
