import Link from "next/link";

export default function AssemblyInstructionsHubPage() {
  const categories = [
    { id: "canalizzazioni", label: "📁 Canalizzazioni", active: true },
    { id: "raccordi", label: "📐 Raccordi & Curve (Soon)", active: false },
    { id: "serrande", label: "🔥 Serrande & Giunti (Soon)", active: false },
  ];

  const models = [
    {
      id: "dritte-con-giunto",
      title: "▬ Canale Dritto con Giunto",
      desc: "Montaggio standard della canalizzazione dritta (orizzontale o verticale) utilizzando i coprigiunti esterni di testa largo da 10 a 20 cm per unire le tratte.",
      steps: "7 / 8 Passaggi",
      badge: "Standard",
      href: "/projects/istruzioni/dritte-con-giunto",
    },
    {
      id: "dritte-senza-giunto",
      title: "⎵ Canale Dritto senza Giunto (Sfalsato)",
      desc: "Tecnica di montaggio a giunti sfalsati. Si inizia tagliando a metà lunghezza il fondo e un fianco, per poi proseguire con lastre intere a scavalco senza l'uso di coprigiunti esterni.",
      steps: "6 / 7 Passaggi",
      badge: "Avanzato",
      href: "/projects/istruzioni/dritte-senza-giunto",
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
          Seleziona una categoria e consulta le schede di montaggio 3D interattive e parametriche per l'assemblaggio corretto delle canalizzazioni antincendio.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5 pb-px gap-1 mb-8 overflow-x-auto">
        {categories.map((cat) => (
          <button
            key={cat.id}
            disabled={!cat.active}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
              cat.active
                ? "border-orange-500 text-orange-400 bg-orange-500/5 cursor-pointer"
                : "border-transparent text-gray-500 cursor-not-allowed hover:text-gray-400"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Grid Modelli */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {models.map((model) => (
          <div
            key={model.id}
            className="p-6 rounded-2xl flex flex-col justify-between space-y-6 transition-all duration-300 hover:scale-[1.01]"
            style={{
              background: "hsl(220 26% 14% / 0.8)",
              border: "1px solid hsl(220 20% 20%)",
              boxShadow: "0 4px 30px rgba(0, 0, 0, 0.2)",
            }}
          >
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300 uppercase font-mono">
                  {model.steps}
                </span>
                <span
                  className={`text-[9px] font-extrabold px-2 py-0.5 rounded uppercase ${
                    model.badge === "Standard"
                      ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                      : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  }`}
                >
                  {model.badge}
                </span>
              </div>
              <h2 className="text-lg font-bold text-white">{model.title}</h2>
              <p className="text-xs text-gray-400 leading-relaxed">{model.desc}</p>
            </div>

            <Link
              href={model.href}
              className="w-full py-3 px-4 rounded-xl text-xs font-bold bg-white text-black hover:bg-white/95 transition-all text-center block cursor-pointer"
            >
              Apri Istruzioni 3D →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
