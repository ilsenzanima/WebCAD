import type { Metadata } from "next";
import Link from "next/link";

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
          Nesting & CAD
        </span>
      </div>

      {/* Main Container */}
      <div className="flex-1 w-full max-w-5xl mx-auto flex flex-col py-6 space-y-6">
        <div className="space-y-1 animate-fade-in">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Gestione Allegati CAD e Nesting
          </h1>
          <p className="text-xs text-white/50 leading-relaxed">
            Abbiamo ottimizzato l&apos;applicazione per il cantiere! I file CAD `.glb`/`.gltf` allegati alle note possono essere scaricati direttamente per l&apos;uso con visualizzatori nativi, mentre le distinte pezzi alimentano l&apos;algoritmo di Nesting 2D automatico.
          </p>
        </div>

        {/* Ottimizzazione e Nesting in Cantiere */}
        <div className="w-full">
          <div className="p-6 rounded-2xl border text-center space-y-4"
            style={{
              background: "hsl(220 30% 10% / 0.8)",
              borderColor: "hsl(220 20% 18%)",
              backdropFilter: "blur(8px)",
            }}>
            <div className="text-4xl">✂️</div>
            <h3 className="text-lg font-bold text-white">Nesting e Ottimizzazione di Taglio 2D</h3>
            <p className="text-xs text-white/60 max-w-md mx-auto leading-relaxed">
              Il motore 3D interattivo in-app è stato sostituito dalla distinta **Pezzi da Tagliare** con algoritmo di Nesting 2D. Questo previene surriscaldamenti del telefono in cantiere e massimizza l&apos;efficienza nell&apos;uso delle lastre commerciali.
            </p>
            <div className="pt-2">
              <span className="inline-block px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                ✓ Nuova Distinta "Pezzi da Tagliare" con Nesting 2D integrato attiva!
              </span>
            </div>
          </div>
        </div>

        {/* Note informative sul formato */}
        <div className="p-4 rounded-xl border bg-white/5 border-white/15 text-xs text-white/70 leading-relaxed space-y-2">
          <h4 className="font-bold text-white uppercase tracking-wider">💡 Suggerimento all&apos;uso:</h4>
          <p>
            Puoi caricare file CAD `.glb` o `.gltf` direttamente all&apos;interno delle **Note di Campo** di ciascun cantiere. Gli allegati compariranno nella lista delle note con un pratico pulsante di download rapido per poter essere aperti o condivisi all&apos;istante con altre app specializzate!
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="w-full max-w-5xl mx-auto text-center py-4 border-t border-white/5 text-[10px] text-white/40">
        © 2026 WebCAD Antincendio. Sistema di nesting ottimizzato integrato.
      </div>
    </div>
  );
}
