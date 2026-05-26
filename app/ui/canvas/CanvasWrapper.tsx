"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useCanvasStore } from "@/lib/stores/canvas-store";

// Disabilitiamo il Server Side Rendering per il componente Canvas,
// poiché react-konva e HTML5 Canvas dipendono da "window".
const CanvasWorkspace = dynamic(
  () => import("@/app/ui/canvas/CanvasWorkspace"),
  { ssr: false }
);

export default function CanvasWrapper({ projectId }: { projectId: string }) {
  const hasUnsavedChanges = useCanvasStore((state) => state.hasUnsavedChanges);

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

  return <CanvasWorkspace />;
}
