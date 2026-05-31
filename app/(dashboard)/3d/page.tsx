import type { Metadata } from "next";
import Link from "next/link";
import ModelViewer from "@/app/ui/projects/ModelViewer";

export const metadata: Metadata = {
  title: "Visualizzatore Modelli 3D GLB - WebCAD",
  description: "Visualizza ed esplora modelli 3D in formato GLB/GLTF esportati da CAD esterni.",
};

export default function ThreeDPage() {
  return (
    <div className="min-h-screen w-full flex flex-col justify-between p-4 md:p-6 text-white"
      style={{
        background: "radial-gradient(circle at top, hsl(220 35% 12%), hsl(220 35% 6%))",
      }}>
      
      {/* Header */}
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between py-4 border-b border-white/5">
        <Link href="/dashboard" className="text-xs font-semibold text-white/60 hover:text-white transition-colors">
          ← Torna alla Dashboard
        </Link>
        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
          style={{
            background: "hsl(220 90% 56% / 0.15)",
            border: "1px solid hsl(220 90% 56% / 0.3)",
            color: "hsl(220 90% 70%)",
          }}>
          3D Viewer GLB
        </span>
      </div>

      {/* Main Container */}
      <div className="flex-1 w-full max-w-5xl mx-auto flex flex-col py-6 space-y-6">
        <div className="space-y-1 animate-fade-in">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Visualizzatore Modelli Esterni GLB
          </h1>
          <p className="text-xs text-white/50 leading-relaxed">
            Questo visualizzatore permette di ruotare, ispezionare ed ingrandire in tempo reale qualsiasi componente 3D (esportato in formato GLB o GLTF da software CAD come Fusion 360, FreeCAD, SketchUp, Blender, ecc.).
          </p>
        </div>

        {/* Il visualizzatore 3D (renderizzato con placeholder se non c'è url) */}
        <div className="w-full">
          <ModelViewer />
        </div>

        {/* Note informative sul formato */}
        <div className="p-4 rounded-xl border bg-white/5 border-white/15 text-xs text-white/70 leading-relaxed space-y-2">
          <h4 className="font-bold text-white uppercase tracking-wider">💡 Suggerimento all&apos;uso:</h4>
          <p>
            Puoi caricare file 3D `.glb` direttamente all&apos;interno delle **Note di Campo** di ciascun cantiere come allegati multimediali. Quando un file 3D viene allegato ad una nota, comparirà un pulsante <strong>&quot;Visualizza 3D&quot;</strong> sia in fase di compilazione sia nel report che aprirà questo visore interattivo per consentirti di analizzare il pezzo direttamente in cantiere sul tuo smartphone o tablet!
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="w-full max-w-5xl mx-auto text-center py-4 border-t border-white/5 text-[10px] text-white/40">
        © 2026 WebCAD Antincendio. Visualizzatore 3D basato su Three.js e Stage di Drei.
      </div>
    </div>
  );
}
