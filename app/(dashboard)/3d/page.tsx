import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Area 3D - WebCAD",
  description: "Seleziona lo strumento di modellazione tridimensionale antincendio.",
};

export default function ThreeDHubPage() {
  return (
    <div className="min-h-screen w-full flex flex-col justify-between p-6 text-white"
      style={{
        background: "radial-gradient(circle at top, hsl(220 35% 12%), hsl(220 35% 6%))",
      }}>
      
      {/* Header */}
      <div className="w-full max-w-4xl mx-auto flex items-center justify-between py-4 border-b border-white/5">
        <Link href="/dashboard" className="text-xs font-semibold text-white/60 hover:text-white transition-colors">
          ← Torna alla Dashboard
        </Link>
        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
          style={{
            background: "hsl(220 90% 56% / 0.15)",
            border: "1px solid hsl(220 90% 56% / 0.3)",
            color: "hsl(220 90% 70%)",
          }}>
          Spazio 3D WebCAD
        </span>
      </div>

      {/* Main Selection Hub */}
      <div className="flex-1 w-full max-w-4xl mx-auto flex flex-col items-center justify-center py-12 text-center space-y-10 animate-fade-in">
        <div className="space-y-3">
          <div className="text-5xl">📦</div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Modellatore Geometrico 3D
          </h1>
          <p className="text-sm text-white/60 max-w-lg mx-auto">
            Scegli lo strumento 3D più adatto alle tue esigenze operative, ottimizzato per rilievi rapidi sul campo o progettazione di solidi in ufficio.
          </p>
        </div>

        {/* Le Due Opzioni in Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl pt-4">
          
          {/* Card 1: Modellatore Cartesiano (Mobile) */}
          <Link href="/3d/cartesiano" 
            className="group p-6 rounded-2xl border text-left space-y-6 transition-all duration-300 hover:-translate-y-1 active:scale-[0.99]"
            style={{
              background: "hsl(220 26% 14% / 0.6)",
              borderColor: "hsl(220 20% 20%)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
            }}>
            <div className="flex items-center justify-between">
              <div className="text-3xl p-3 rounded-xl bg-orange-500/10 text-orange-400 group-hover:scale-110 transition-transform">📱</div>
              <span className="text-[9px] bg-orange-500/15 border border-orange-500/30 text-orange-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Ottimizzato Mobile</span>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white group-hover:text-orange-400 transition-colors">Condotte Cartesiane X, Y, Z</h3>
              <p className="text-xs text-white/50 leading-relaxed">
                Ideale per l&apos;uso in cantiere sul telefono. Traccia percorsi di tubazioni in 3D inserendo le lunghezze dei tratti lungo le direzioni cartesiane con pulsanti rapidi.
              </p>
            </div>
            <div className="text-xs font-bold text-orange-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
              Apri Strumento 📱 →
            </div>
          </Link>

          {/* Card 2: Modellatore Solidi (SketchUp) */}
          <Link href="/3d/sketchup" 
            className="group p-6 rounded-2xl border text-left space-y-6 transition-all duration-300 hover:-translate-y-1 active:scale-[0.99]"
            style={{
              background: "hsl(220 26% 14% / 0.6)",
              borderColor: "hsl(220 20% 20%)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
            }}>
            <div className="flex items-center justify-between">
              <div className="text-3xl p-3 rounded-xl bg-sky-500/10 text-sky-400 group-hover:scale-110 transition-transform">💻</div>
              <span className="text-[9px] bg-sky-500/15 border border-sky-500/30 text-sky-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Ottimizzato Desktop</span>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white group-hover:text-sky-400 transition-colors">Modellatore Solidi (SketchUp)</h3>
              <p className="text-xs text-white/50 leading-relaxed">
                Disegna un profilo 2D cliccando sulla griglia di riferimento, chiudilo per formare una faccia e poi trascinalo (estrusione Push/Pull) per creare volumi 3D complessi.
              </p>
            </div>
            <div className="text-xs font-bold text-sky-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
              Apri Strumento 💻 →
            </div>
          </Link>

        </div>
      </div>

      {/* Footer */}
      <div className="w-full max-w-4xl mx-auto text-center py-4 border-t border-white/5 text-[10px] text-white/40">
        © 2026 WebCAD Antincendio. Modellazione solida e computo metrico integrati.
      </div>
    </div>
  );
}
