import Link from "next/link";

export default function AssemblyInstructionsHubPage() {
  const categories = [
    {
      id: "canalizzazioni",
      title: "📁 Canalizzazioni Antincendio",
      desc: "Istruzioni di montaggio 3D interattive e parametriche per canalizzazioni dritte (orizzontali e verticali), con opzione con giunto esterno o a giunti sfalsati.",
      badge: "Disponibile",
      href: "/projects/istruzioni/canalizzazioni",
      active: true,
    },
    {
      id: "cassonetti",
      title: "📦 Cassonetti Copri Impianti",
      desc: "Istruzioni di montaggio 3D interattive e parametriche per cavedi e cassonetti copri impianti a parete (verticali) o solaio (orizzontali), a 2, 3 o 4 lati.",
      badge: "Disponibile",
      href: "/projects/istruzioni/cassonetti",
      active: true,
    },
    {
      id: "serrande",
      title: "🔥 Serrande Tagliafuoco",
      desc: "Istruzioni per l'installazione e sigillatura di serrande tagliafuoco e giunti di dilatazione.",
      badge: "Soon",
      href: "#",
      active: false,
    },
  ];

  return (
    <div
      className="min-h-screen w-full flex flex-col p-4 md:p-6 text-white"
      style={{
        background: "radial-gradient(circle at top, hsl(220 35% 12%), hsl(220 35% 6%))",
      }}
    >
      {/* Header */}
      <div className="w-full flex items-center justify-between pb-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <Link
            href="/projects"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-white transition-colors"
          >
            ← Torna ai Progetti
          </Link>
          <span className="text-gray-500">/</span>
          <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">
            Archivio Istruzioni di Montaggio
          </span>
        </div>
      </div>

      {/* Titolo e Sottotitolo */}
      <div className="pt-8 pb-6 space-y-2">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
          🛠️ Archivio Istruzioni di Montaggio
        </h1>
        <p className="text-xs md:text-sm text-gray-400 max-w-2xl leading-relaxed">
          Seleziona una categoria e consulta le schede di montaggio 3D interattive per l'assemblaggio corretto delle canalizzazioni e dei sistemi antincendio.
        </p>
      </div>

      {/* Grid Modelli */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {categories.map((model) => (
          <div
            key={model.id}
            className={`p-6 rounded-2xl flex flex-col justify-between space-y-6 transition-all duration-300 ${
              model.active ? "hover:scale-[1.01]" : "opacity-60"
            }`}
            style={{
              background: "hsl(220 26% 14% / 0.8)",
              border: "1px solid hsl(220 20% 20%)",
              boxShadow: "0 4px 30px rgba(0, 0, 0, 0.2)",
            }}
          >
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span
                  className={`text-[9px] font-extrabold px-2 py-0.5 rounded uppercase ${
                    model.active
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-white/5 text-gray-400 border border-white/5"
                  }`}
                >
                  {model.badge}
                </span>
              </div>
              <h2 className="text-lg font-bold text-white">{model.title}</h2>
              <p className="text-xs text-gray-400 leading-relaxed">{model.desc}</p>
            </div>

            {model.active ? (
              <Link
                href={model.href}
                className="w-full py-3 px-4 rounded-xl text-xs font-bold bg-white text-black hover:bg-white/95 transition-all text-center block cursor-pointer"
              >
                Apri Istruzioni 3D →
              </Link>
            ) : (
              <button
                disabled
                className="w-full py-3 px-4 rounded-xl text-xs font-bold bg-white/5 text-gray-500 cursor-not-allowed border border-white/5 text-center block"
              >
                Prossimamente
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
