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

export default function CanvasWrapper({ projectId }: { projectId: string }) {
  const clearProjectState = useCanvasStore((state) => state.clearProjectState);

  useEffect(() => {
    clearProjectState();
    // In future epics, here we will trigger DB fetch using this projectId
  }, [projectId, clearProjectState]);

  return <CanvasWorkspace />;
}
