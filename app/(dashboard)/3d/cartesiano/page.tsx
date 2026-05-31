import type { Metadata } from "next";
import ThreeDDesigner from "@/app/ui/projects/ThreeDDesigner";

export const metadata: Metadata = {
  title: "Modellatore Cartesiano - WebCAD",
  description: "Disegno tridimensionale di condotte antincendio per coordinate cartesiane direzionali.",
};

export default function Cartesian3DPage() {
  return <ThreeDDesigner />;
}
