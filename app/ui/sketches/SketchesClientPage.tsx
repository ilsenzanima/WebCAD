"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSketch, deleteSketch, Sketch } from "@/app/actions/sketches";

interface SketchesClientPageProps {
  sketches: Sketch[];
  projectsWithLevels: Array<{
    id: string;
    name: string;
    levels: Array<{
      id: string;
      name: string;
      piano: string | null;
    }>;
  }>;
}

export default function SketchesClientPage({
  sketches: initialSketches,
  projectsWithLevels,
}: SketchesClientPageProps) {
  const router = useRouter();
  const [sketches, setSketches] = useState<Sketch[]>(initialSketches);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilterProject, setSelectedFilterProject] = useState("");
  
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Stati del modale
  const [isOpen, setIsOpen] = useState(false);
  const [newSketchName, setNewSketchName] = useState("");
  const [assocProjectId, setAssocProjectId] = useState("");
  const [assocLevelId, setAssocLevelId] = useState("");

  const [isPending, startTransition] = useTransition();
  const [deletePendingId, setDeletePendingId] = useState<string | null>(null);

  // Filtra gli sketch
  const filteredSketches = sketches.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.levels?.name.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (s.levels?.projects?.name.toLowerCase() || "").includes(searchQuery.toLowerCase());

    const matchesProject = !selectedFilterProject || 
      s.levels?.projects?.name === selectedFilterProject ||
      (selectedFilterProject === "Nessuno" && !s.level_id);

    return matchesSearch && matchesProject;
  });

  // Trova i livelli associati al progetto scelto nel modale
  const currentAssocProject = projectsWithLevels.find((p) => p.id === assocProjectId);
  const assocLevels = currentAssocProject?.levels ?? [];

  // Gestione Creazione
  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newSketchName.trim() || "Nuovo Sketch";

    startTransition(async () => {
      const res = await createSketch(name, assocLevelId || null);
      if (res.success && res.id) {
        setIsOpen(false);
        // Reset form
        setNewSketchName("");
        setAssocProjectId("");
        setAssocLevelId("");
        router.push(`/sketches/${res.id}`);
      } else {
        alert("Errore nella creazione dello sketch: " + res.error);
      }
    });
  }

  // Gestione Eliminazione
  async function handleDelete(id: string) {
    if (!confirm("Sei sicuro di voler eliminare definitivamente questo sketch?")) return;

    setDeletePendingId(id);
    const res = await deleteSketch(id);
    setDeletePendingId(null);

    if (res.success) {
      setSketches((prev) => prev.filter((s) => s.id !== id));
      router.refresh();
    } else {
      alert("Errore nell'eliminazione: " + res.error);
    }
  }

  // Formatta la data
  function formatDate(isoString: string) {
    if (!mounted) return "—";
    const d = new Date(isoString);
    return d.toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // Ottieni i progetti univoci per la tendina dei filtri
  const uniqueProjectNames = Array.from(
    new Set(
      sketches
        .map((s) => s.levels?.projects?.name)
        .filter(Boolean)
    )
  );

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Intestazione */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 
            className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2"
          >
            🎨 <span className="bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">Lavagna Sketch</span>
          </h1>
          <p className="text-xs md:text-sm text-white/50 mt-1">
            Disegna a mano libera da cellulare, prendi appunti veloci e associali alle note di cantiere.
          </p>
        </div>

        <button
          onClick={() => setIsOpen(true)}
          className="px-5 py-3 rounded-xl text-sm font-bold text-white transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          style={{
            background: "linear-gradient(135deg, hsl(16 100% 58%), hsl(0 84% 60%))",
            boxShadow: "0 4px 15px hsl(16 100% 58% / 0.25)",
          }}
        >
          <span>＋ Nuovo Sketch</span>
        </button>
      </div>

      {/* Barre di ricerca e filtro */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2 relative">
          <input
            type="text"
            placeholder="Cerca per nome sketch, nota o cantiere..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-white border transition-all focus:outline-none"
            style={{
              background: "hsl(220 32% 10%)",
              borderColor: "hsl(220 20% 16%)",
            }}
          />
          <span className="absolute left-3.5 top-3.5 text-white/40">🔍</span>
        </div>

        <div>
          <select
            value={selectedFilterProject}
            onChange={(e) => setSelectedFilterProject(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm text-white border transition-all focus:outline-none cursor-pointer"
            style={{
              background: "hsl(220 32% 10%)",
              borderColor: "hsl(220 20% 16%)",
            }}
          >
            <option value="">Filtra per Cantiere (Tutti)</option>
            <option value="Nessuno">Senza Associazione</option>
            {uniqueProjectNames.map((name) => (
              <option key={name} value={name!}>
                📍 {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Elenco Sketch */}
      {filteredSketches.length === 0 ? (
        <div 
          className="flex flex-col items-center justify-center p-12 rounded-2xl border text-center gap-4 transition-all"
          style={{
            background: "hsl(220 32% 10% / 0.3)",
            borderColor: "hsl(220 20% 16%)",
          }}
        >
          <span className="text-5xl animate-pulse">🖌️</span>
          <div>
            <h3 className="text-white font-bold text-base">Nessuno sketch trovato</h3>
            <p className="text-xs text-white/40 max-w-sm mt-1 mx-auto">
              {searchQuery || selectedFilterProject
                ? "Nessun disegno corrisponde ai filtri impostati. Prova a modificarli."
                : "Comincia subito a disegnare a mano libera per prendere appunti al volo! Tocca il pulsante in alto."}
            </p>
          </div>
          {!searchQuery && !selectedFilterProject && (
            <button
              onClick={() => setIsOpen(true)}
              className="px-4 py-2 rounded-lg text-xs font-bold text-white transition-all cursor-pointer"
              style={{ background: "hsl(220 90% 56%)" }}
            >
              Crea Primo Sketch
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSketches.map((sketch) => {
            const hasPreview = !!sketch.image_data;
            const levelInfo = sketch.levels;
            const projectName = levelInfo?.projects?.name;
            const levelName = levelInfo?.name;
            const pianoName = levelInfo?.piano;

            return (
              <div
                key={sketch.id}
                className="group relative flex flex-col rounded-2xl border overflow-hidden transition-all duration-300 hover:-translate-y-1"
                style={{
                  background: "hsl(220 32% 10%)",
                  borderColor: "hsl(220 20% 16%)",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                }}
              >
                {/* Anteprima Disegno */}
                <div 
                  className="h-44 relative flex items-center justify-center border-b overflow-hidden"
                  style={{ 
                    background: "hsl(228 39% 8%)",
                    borderColor: "hsl(220 20% 16%)" 
                  }}
                >
                  {hasPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={sketch.image_data!}
                      alt={sketch.name}
                      className="w-full h-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-white/20">
                      <span className="text-4xl">🎨</span>
                      <span className="text-[10px] tracking-wider uppercase font-semibold">Tavolozza Vuota</span>
                    </div>
                  )}

                  {/* Badge Associazione Cantiere */}
                  {projectName && (
                    <div 
                      className="absolute top-3 left-3 px-2.5 py-1 rounded-md text-[10px] font-bold text-white flex items-center gap-1 shadow-md"
                      style={{ background: "hsl(220 90% 56% / 0.95)", backdropFilter: "blur(4px)" }}
                    >
                      <span>📍</span>
                      <span className="truncate max-w-[120px]">{projectName}</span>
                    </div>
                  )}
                </div>

                {/* Dettagli Sketch */}
                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div>
                    <h3 className="text-white font-bold text-sm truncate leading-snug">
                      {sketch.name}
                    </h3>
                    <p className="text-[10px] text-white/40 mt-1">
                      Aggiornato: {formatDate(sketch.updated_at)}
                    </p>

                    {levelInfo && (
                      <div className="mt-3 p-2 rounded-lg bg-white/5 border border-white/5">
                        <p className="text-[10px] text-white/50 leading-tight">
                          Nota: <span className="text-white font-semibold">{levelName}</span>
                        </p>
                        {pianoName && (
                          <p className="text-[10px] text-white/40 mt-0.5 leading-tight">
                            Piano: <span className="text-orange-400 font-semibold">{pianoName}</span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Pulsanti Azione */}
                  <div className="flex gap-2 mt-2 pt-3 border-t border-white/5">
                    <Link
                      href={`/sketches/${sketch.id}`}
                      className="flex-1 py-2 rounded-lg text-xs font-bold text-center text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      style={{ background: "hsl(220 90% 56%)" }}
                    >
                      <span>✏️</span> Disegna
                    </Link>

                    <button
                      onClick={() => handleDelete(sketch.id)}
                      disabled={deletePendingId === sketch.id}
                      className="px-3 py-2 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/5 transition-all text-xs font-bold disabled:opacity-50 flex items-center justify-center cursor-pointer"
                      title="Elimina Sketch"
                    >
                      {deletePendingId === sketch.id ? "..." : "🗑️"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODALE NUOVO SKETCH */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Sfondo sfocato */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          <div
            className="relative w-full max-w-md rounded-2xl p-6 border shadow-2xl animate-fade-in"
            style={{
              background: "hsl(220 32% 10%)",
              borderColor: "hsl(220 20% 16%)",
            }}
          >
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-white/5">
              <h2 className="text-white font-bold text-lg flex items-center gap-2">
                🎨 Crea Nuovo Sketch
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white bg-white/10 hover:bg-white/20 transition-all"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-1.5">
                  Nome dello Sketch
                </label>
                <input
                  type="text"
                  required
                  placeholder="Es. Schema Cavedio, Misure Parete Nord..."
                  value={newSketchName}
                  onChange={(e) => setNewSketchName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm text-white border transition-all focus:outline-none"
                  style={{
                    background: "hsl(220 26% 14%)",
                    borderColor: "hsl(220 20% 18%)",
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-1.5">
                  Cantiere Associato (Opzionale)
                </label>
                <select
                  value={assocProjectId}
                  onChange={(e) => {
                    setAssocProjectId(e.target.value);
                    setAssocLevelId(""); // Reset level
                  }}
                  className="w-full px-3 py-2.5 rounded-xl text-sm text-white border transition-all focus:outline-none cursor-pointer"
                  style={{
                    background: "hsl(220 26% 14%)",
                    borderColor: "hsl(220 20% 18%)",
                  }}
                >
                  <option value="">Nessuno (Sketch Libero)</option>
                  {projectsWithLevels.map((p) => (
                    <option key={p.id} value={p.id}>
                      📍 {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {assocProjectId && (
                <div className="animate-fade-in">
                  <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-1.5">
                    Seleziona Nota di Cantiere / Zona
                  </label>
                  {assocLevels.length === 0 ? (
                    <p className="text-xs text-yellow-500 italic px-2">
                      Nessuna nota presente in questo cantiere.
                    </p>
                  ) : (
                    <select
                      value={assocLevelId}
                      required={!!assocProjectId}
                      onChange={(e) => setAssocLevelId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl text-sm text-white border transition-all focus:outline-none cursor-pointer"
                      style={{
                        background: "hsl(220 26% 14%)",
                        borderColor: "hsl(220 20% 18%)",
                      }}
                    >
                      <option value="">Scegli una Nota di Cantiere...</option>
                      {assocLevels.map((lvl) => (
                        <option key={lvl.id} value={lvl.id}>
                          📝 {lvl.name} {lvl.piano ? `(${lvl.piano})` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-white/5 mt-5">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold border border-white/10 text-white/70 hover:bg-white/5 transition-all cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={isPending || (!!assocProjectId && !assocLevelId)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-md disabled:opacity-50 cursor-pointer"
                  style={{
                    background: "linear-gradient(135deg, hsl(16 100% 58%), hsl(0 84% 60%))",
                  }}
                >
                  {isPending ? "Creazione..." : "Crea & Disegna 🚀"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
