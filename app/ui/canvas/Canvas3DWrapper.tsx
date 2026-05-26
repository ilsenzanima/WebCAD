"use client";

import dynamic from "next/dynamic";

// Disabilitiamo il Server Side Rendering per il componente Canvas 3D,
// poiché Three.js e React Three Fiber richiedono la presenza di "window".
const Canvas3DWorkspace = dynamic(
  () => import("@/app/ui/canvas/Canvas3DWorkspace"),
  { ssr: false }
);

interface Props {
  projectId: string;
}

export default function Canvas3DWrapper({ projectId }: Props) {
  return <Canvas3DWorkspace projectId={projectId} />;
}
