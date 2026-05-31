import type { Metadata } from "next";
import ThreeDSketchupDesigner from "@/app/ui/projects/ThreeDSketchupDesigner";

export const metadata: Metadata = {
  title: "Modellatore SketchUp 3D - WebCAD",
  description: "Disegna profili 2D ed estrudili in solidi tridimensionali (Push/Pull) in tempo reale.",
};

export default function SketchupPage() {
  return <ThreeDSketchupDesigner />;
}
