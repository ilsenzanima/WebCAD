"use client";

import dynamic from "next/dynamic";

// Disabilitiamo il Server Side Rendering per il componente Canvas,
// poiché react-konva e HTML5 Canvas dipendono da "window".
// Next.js (Turbopack) richiede che questo avvenga dentro un Client Component.
const CanvasWorkspace = dynamic(
  () => import("@/app/ui/canvas/CanvasWorkspace"),
  { ssr: false }
);

export default function CanvasWrapper() {
  return <CanvasWorkspace />;
}
