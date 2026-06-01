"use client";

import { useMemo, useState, useEffect } from "react";
import type { FieldNote, FieldNoteItem } from "@/app/actions/field-notes";

interface Props {
  notes: FieldNote[];
  levels: Array<{ id: string; name: string; piano?: string }>;
  onImageClick: (url: string) => void;
}

export default function ReportFieldNotes({ notes, levels, onImageClick }: Props) {
  const [filterStatus, setFilterStatus] = useState<"all" | "completed" | "pending">("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Mappa id livello -> Livello
  const levelsMap = useMemo(() => {
    const map: Record<string, { id: string; name: string; piano?: string }> = {};
    levels.forEach((l) => {
      map[l.id] = l;
    });
    return map;
  }, [levels]);

  // Filtra e raggruppa le note per livello
  const groupedAndFilteredNotes = useMemo(() => {
    let filtered = notes;

    // Filtra per stato completato
    if (filterStatus === "completed") {
      filtered = filtered.filter((n) => n.completed);
    } else if (filterStatus === "pending") {
      filtered = filtered.filter((n) => !n.completed);
    }

    // Filtra per ricerca testuale
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((n) => {
        const typeMatch = n.type_name?.toLowerCase().includes(query);
        const numberMatch = `appunto #${n.note_number}`.includes(query);
        const itemMatch = (n.field_note_items ?? []).some((item) => {
          if (item.value_text) return item.value_text.toLowerCase().includes(query);
          if (item.value_num) return String(item.value_num).includes(query);
          return false;
        });
        return typeMatch || numberMatch || itemMatch;
      });
    }

    // Raggruppa per livello
    const groups: Record<string, FieldNote[]> = {};
    filtered.forEach((note) => {
      const lvlId = note.level_id || "generico";
      if (!groups[lvlId]) groups[lvlId] = [];
      groups[lvlId].push(note);
    });

    // Ordina i gruppi: mettiamo prima quelli associati a livelli reali
    const sortedLevelIds = Object.keys(groups).sort((a, b) => {
      if (a === "generico") return 1;
      if (b === "generico") return -1;
      const nameA = levelsMap[a]?.name || "";
      const nameB = levelsMap[b]?.name || "";
      return nameA.localeCompare(nameB);
    });

    return { groups, sortedLevelIds };
  }, [notes, filterStatus, searchQuery, levelsMap]);

  // Controlla se una nota contiene immagini
  const hasImages = (note: FieldNote) => {
    return (note.field_note_items ?? []).some((item) => item.item_type === "foto" && item.value_text);
  };

  // Formatta l'item della nota
  const renderNoteItem = (item: FieldNoteItem) => {
    switch (item.item_type) {
      case "nota":
        return (
          <div key={item.id} className="text-sm text-gray-300 leading-relaxed break-words print:text-gray-800">
            📝 <span className="font-medium text-white print:text-black">Nota:</span> {item.value_text}
          </div>
        );
      case "foto":
        if (!item.value_text) return null;
        return (
          <div key={item.id} className="mt-2.5">
            <div className="text-[10px] text-gray-400 font-semibold mb-1 print:text-gray-600">📷 SNAPSHOT DI RISCONTRO:</div>
            <div className="relative w-36 h-36 rounded-xl overflow-hidden border border-white/10 bg-white/5 hover:border-blue-500/50 transition-colors cursor-pointer group print:w-48 print:h-48 print:border-gray-300">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.value_text}
                alt="Allegato"
                onClick={() => onImageClick(item.value_text!)}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
            </div>
          </div>
        );
      case "base":
        return (
          <div key={item.id} className="text-xs text-gray-400 print:text-gray-700">
            ↔ <span className="font-semibold text-gray-300 print:text-black">Larghezza:</span> {item.value_num} {item.value_unit || "cm"}
          </div>
        );
      case "altezza":
        return (
          <div key={item.id} className="text-xs text-gray-400 print:text-gray-700">
            ↕ <span className="font-semibold text-gray-300 print:text-black">Altezza:</span> {item.value_num} {item.value_unit || "cm"}
          </div>
        );
      case "spessore":
        return (
          <div key={item.id} className="text-xs text-gray-400 print:text-gray-700">
            ↗ <span className="font-semibold text-gray-300 print:text-black">Spessore:</span> {item.value_num} {item.value_unit || "cm"}
          </div>
        );
      case "lana_interna":
        return (
          <div key={item.id} className="text-xs text-gray-400 print:text-gray-700">
            🔥 <span className="font-semibold text-gray-300 print:text-black">Isolamento Lana Interna:</span> {item.value_bool ? "Presente ✓" : "Assente"}
          </div>
        );
      case "dipintura":
        return (
          <div key={item.id} className="text-xs text-gray-400 print:text-gray-700">
            🎨 <span className="font-semibold text-gray-300 print:text-black">Trattamento Dipintura:</span> {item.value_bool ? "Presente ✓" : "Assente"}
          </div>
        );
      case "dim_quadrata":
        try {
          const parsed = JSON.parse(item.value_text || "{}");
          return (
            <div key={item.id} className="text-xs text-gray-400 print:text-gray-700">
              ◻ <span className="font-semibold text-gray-300 print:text-black">Sezione Cassonetto:</span> {parsed.b || 0} x {parsed.h || 0} {parsed.unit || "cm"}
            </div>
          );
        } catch {
          return null;
        }
      case "dim_cubica":
        try {
          const parsed = JSON.parse(item.value_text || "{}");
          return (
            <div key={item.id} className="text-xs text-gray-400 print:text-gray-700">
              ⬛ <span className="font-semibold text-gray-300 print:text-black">Dimensione Cubica:</span> {parsed.b || 0} x {parsed.h || 0} x {parsed.d || 0} {parsed.unit || "cm"}
            </div>
          );
        } catch {
          return null;
        }
      case "materiale":
        return (
          <div key={item.id} className="text-xs text-gray-400 print:text-gray-700">
            📦 <span className="font-semibold text-gray-300 print:text-black">Specifiche Materiale:</span> {item.value_text}
          </div>
        );
      case "posizione":
        return (
          <div key={item.id} className="text-xs text-gray-400 print:text-gray-700">
            📍 <span className="font-semibold text-gray-300 print:text-black">Posizione / Localizzazione:</span> {item.value_text}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Barra dei Filtri - Nascosta in Stampa */}
      <div 
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border bg-white/5 border-white/5 print:hidden"
        style={{ background: "hsl(220 26% 12% / 0.15)" }}
      >
        {/* Ricerca */}
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Cerca negli appunti..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-white/5 border border-white/5 text-white outline-none focus:border-blue-500 transition-colors"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none text-gray-400">
            🔍
          </span>
        </div>

        {/* Pulsanti Filtro */}
        <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-xl border border-white/5">
          {(["all", "completed", "pending"] as const).map((status) => {
            const label = status === "all" ? "Tutti" : status === "completed" ? "Risolti ✓" : "In corso ⏳";
            const active = filterStatus === status;
            return (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  active ? "bg-white text-black" : "text-gray-400 hover:text-white"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista Note Raggruppate */}
      <div className="space-y-8">
        {groupedAndFilteredNotes.sortedLevelIds.length === 0 ? (
          <div className="p-12 text-center rounded-3xl border border-white/5 bg-white/5 text-gray-400">
             Nessun appunto trovato con i filtri selezionati.
          </div>
        ) : (
          groupedAndFilteredNotes.sortedLevelIds.map((lvlId) => {
            const level = levelsMap[lvlId];
            const levelNotes = groupedAndFilteredNotes.groups[lvlId];

            return (
              <div key={lvlId} className="space-y-4 print:break-inside-avoid">
                {/* Intestazione Piano/Livello */}
                <div className="flex items-center gap-2 pb-2 border-b border-white/10 print:border-gray-300">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider print:text-black">
                    🏢 {level ? `${level.name} (${level.piano || "Piano ND"})` : "Appunti Generici / Note Libere"}
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/5 text-gray-400 border border-white/5 print:border-gray-300 print:text-black">
                    {levelNotes.length} {levelNotes.length === 1 ? "appunto" : "appunti"}
                  </span>
                </div>

                {/* Elenco note del livello */}
                <div className="grid grid-cols-1 gap-4">
                  {levelNotes.map((note) => {
                    const isSketch = note.type_name === "Sketch";
                    const is3d = note.type_name === "Report 3D";
                    const noteHasPics = hasImages(note);

                    // Determina il tag badge
                    let badgeLabel = note.type_name || "Nota";
                    let badgeBg = "bg-orange-500/10 text-orange-400 border-orange-500/10";
                    let badgeIcon = "📝";

                    if (isSketch || noteHasPics) {
                      badgeLabel = "Disegno";
                      badgeBg = "bg-blue-500/10 text-blue-400 border-blue-500/10 print:text-blue-700";
                      badgeIcon = "🎨";
                    } else if (is3d) {
                      badgeLabel = "Report 3D";
                      badgeBg = "bg-purple-500/10 text-purple-400 border-purple-500/10 print:text-purple-700";
                      badgeIcon = "📦";
                    }

                    return (
                      <div
                        key={note.id}
                        className={`p-5 rounded-3xl border transition-all flex flex-col md:flex-row md:justify-between md:items-start gap-4 ${
                          note.completed
                            ? "bg-emerald-500/[0.02] border-emerald-500/10 hover:border-emerald-500/20"
                            : "bg-white/5 border-white/5 hover:border-white/10"
                        } print:border-gray-200 print:bg-transparent print:p-4`}
                      >
                        <div className="space-y-3 flex-1 min-w-0">
                          {/* Badges e Stato */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-bold text-gray-400">
                              APPUNTO #{note.note_number}
                            </span>
                            
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${badgeBg}`}>
                              <span>{badgeIcon}</span> {badgeLabel}
                            </span>

                            {note.completed ? (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/10 print:text-emerald-700">
                                ✓ Risolto
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-400 border border-orange-500/10 print:text-orange-700">
                                ⏳ In corso
                              </span>
                            )}
                          </div>

                          {/* Lista Voci */}
                          <div className="space-y-2">
                            {(note.field_note_items ?? [])
                              .sort((a, b) => a.sort_order - b.sort_order)
                              .map((item) => renderNoteItem(item))}
                          </div>
                        </div>

                        {/* Metadati in spalla destra */}
                        <div className="text-left md:text-right text-[10px] text-gray-400 self-end md:self-start print:text-gray-600">
                          <p>Rilevato il: {mounted ? new Date(note.created_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</p>
                          <p className="mt-1">Ora: {mounted ? new Date(note.created_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) : "—"}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
