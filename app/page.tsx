/**
 * Pagina principale - WebCAD Antincendio
 * Placeholder per Epic 0 (Scaffolding).
 * Il contenuto reale verrà implementato a partire dall'Epic 1.
 */
export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-950">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-white tracking-tight">
          🏗️ WebCAD Antincendio
        </h1>
        <p className="text-lg text-gray-400">
          Fire Protection CAD &amp; Material Optimizer
        </p>
        <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-2 text-sm text-emerald-400 ring-1 ring-emerald-500/20">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
          </span>
          Epic 0 completato — Infrastruttura pronta
        </div>
      </div>
    </main>
  );
}
