import type { ReactNode } from "react";

/**
 * Layout per le pagine di autenticazione (Login).
 * Grafica premium in scala di grigi e testi coerenti con il gestionale spese.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2"
      style={{ background: "hsl(240 10% 4%)" }}>
      
      {/* Brand Panel - visibile solo su desktop */}
      <div className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, hsl(240 10% 3.9%) 0%, hsl(240 10% 8%) 50%, hsl(240 10% 12%) 100%)", borderRight: "1px solid hsl(240 5% 15%)" }}>

        {/* Griglia decorativa */}
        <div className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)`,
            backgroundSize: "40px 40px"
          }} />

        {/* Cerchi decorativi sfumati */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-5"
          style={{ background: "radial-gradient(circle, hsl(220 90% 56%), transparent 70%)" }} />
        <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full opacity-5"
          style={{ background: "radial-gradient(circle, hsl(240 5% 65%), transparent 70%)" }} />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg shadow-[0_0_20px_rgba(255,255,255,0.05)] bg-gradient-to-br from-zinc-700 to-zinc-900 border border-zinc-700 text-white select-none">
              💰
            </div>
            <span className="text-white font-extrabold text-lg tracking-tight">Finanza Privata</span>
          </div>
        </div>

        {/* Testo centrale */}
        <div className="relative z-10 space-y-6">
          <h2 className="text-4xl font-extrabold text-white leading-tight tracking-tight">
            Gestisci le tue spese<br />
            <span className="text-blue-500">senza pensieri</span>.
          </h2>
          <p style={{ color: "hsl(240 5% 65%)" }} className="text-sm leading-relaxed max-w-sm font-medium">
            Monitora le transazioni personali, pianifica le scadenze e analizza l'andamento del mese in modo rapido e sicuro.
          </p>

          {/* Features */}
          <div className="space-y-3 pt-2">
            {[
              { icon: "💸", text: "Registrazione rapida delle spese" },
              { icon: "📅", text: "Scadenziario interattivo e ricorrenze" },
              { icon: "📊", text: "Statistiche e categorie personalizzabili" },
            ].map((f) => (
              <div key={f.text} className="flex items-center gap-3 animate-fade-in">
                <span className="text-base">{f.icon}</span>
                <span className="text-xs font-semibold" style={{ color: "hsl(240 5% 65%)" }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "hsl(240 5% 40%)" }}>
            © 2026 Finanza Privata · Gestione Personale
          </p>
        </div>
      </div>

      {/* Form Panel */}
      <div className="flex items-center justify-center p-6 lg:p-12 relative"
        style={{ background: "hsl(240 10% 4%)" }}>

        {/* Logo mobile */}
        <div className="absolute top-6 left-6 flex items-center gap-2.5 lg:hidden select-none">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs shadow-sm bg-zinc-900 border border-zinc-800 text-white">
            💰
          </div>
          <span className="text-white font-extrabold text-sm tracking-wide">Finanza Privata</span>
        </div>

        <div className="w-full max-w-sm animate-fade-in">
          {children}
        </div>
      </div>
    </div>
  );
}
