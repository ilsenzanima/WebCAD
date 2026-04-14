import type { ReactNode } from "react";

/**
 * Layout per le pagine di autenticazione.
 * Schermo diviso: brand panel a sinistra, form a destra.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Brand Panel - visibile solo su desktop */}
      <div className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, hsl(222 47% 6%) 0%, hsl(220 60% 12%) 50%, hsl(215 80% 16%) 100%)" }}>

        {/* Griglia decorativa */}
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `linear-gradient(hsl(220 90% 56% / 0.3) 1px, transparent 1px),
                              linear-gradient(90deg, hsl(220 90% 56% / 0.3) 1px, transparent 1px)`,
            backgroundSize: "40px 40px"
          }} />

        {/* Cerchi decorativi */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, hsl(16 100% 58%), transparent 70%)" }} />
        <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full opacity-8"
          style={{ background: "radial-gradient(circle, hsl(220 90% 56%), transparent 70%)" }} />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ background: "linear-gradient(135deg, hsl(16 100% 58%), hsl(0 84% 60%))" }}>
              🔥
            </div>
            <span className="text-white font-bold text-xl tracking-tight">WebCAD Antincendio</span>
          </div>
        </div>

        {/* Testo centrale */}
        <div className="relative z-10 space-y-6">
          <h2 className="text-4xl font-bold text-white leading-tight">
            Il tuo operatore CAD<br />
            <span style={{ color: "hsl(16 100% 64%)" }}>antincendio</span> in cloud.
          </h2>
          <p style={{ color: "hsl(215 20% 65%)" }} className="text-lg leading-relaxed max-w-sm">
            Progetta impianti, gestisci materiali e genera distinte di taglio in modo professionale.
          </p>

          {/* Features */}
          <div className="space-y-3 pt-2">
            {[
              { icon: "🏗️", text: "Modellazione parametrica 2D/3D" },
              { icon: "✂️", text: "Nesting e ottimizzazione materiali" },
              { icon: "📋", text: "Generazione BoM automatica" },
            ].map((f) => (
              <div key={f.text} className="flex items-center gap-3">
                <span className="text-lg">{f.icon}</span>
                <span className="text-sm" style={{ color: "hsl(215 20% 65%)" }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-xs" style={{ color: "hsl(215 15% 45%)" }}>
            © 2026 WebCAD Antincendio · Tutti i diritti riservati
          </p>
        </div>
      </div>

      {/* Form Panel */}
      <div className="flex items-center justify-center p-6 lg:p-12"
        style={{ background: "hsl(222 47% 6%)" }}>

        {/* Logo mobile */}
        <div className="absolute top-6 left-6 flex items-center gap-2 lg:hidden">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
            style={{ background: "linear-gradient(135deg, hsl(16 100% 58%), hsl(0 84% 60%))" }}>
            🔥
          </div>
          <span className="text-white font-semibold text-sm">WebCAD</span>
        </div>

        <div className="w-full max-w-sm animate-fade-in">
          {children}
        </div>
      </div>
    </div>
  );
}
