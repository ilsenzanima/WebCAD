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
  const hasUnsavedChanges = useCanvasStore((state) => state.hasUnsavedChanges);
  const setHasUnsavedChanges = useCanvasStore((state) => state.setHasUnsavedChanges);
  const { levels, activeLevelId, setActiveProject } = useProjectStore();

  // Gestione avviso chiusura tab browser
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = ""; // Mostra il dialog standard del browser
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    // Synchronize canvas store with active project level data
    // We only clear if there is no activeLevelId (project init)
    if (!activeLevelId) {
      clearProjectState();
      return;
    }

    const currentLevel = levels.find((l) => l.id === activeLevelId);
    if (currentLevel) {
      loadProjectData({
        plan_image_url: currentLevel.plan_image_url,
        scale_ratio: currentLevel.scale_ratio,
      });
    }
  }, [activeLevelId, levels, clearProjectState, loadProjectData]);

  return <CanvasWorkspace />;
}
