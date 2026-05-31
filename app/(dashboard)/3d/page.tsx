import type { Metadata } from "next";
import ThreeDDesigner from "@/app/ui/projects/ThreeDDesigner";

export const metadata: Metadata = {
  title: "Modellatore 3D - WebCAD",
  description: "Disegno tridimensionale di condotte antincendio per assi cartesiani vincolati.",
};

export default function ThreeDPage() {
  return <ThreeDDesigner />;
}
