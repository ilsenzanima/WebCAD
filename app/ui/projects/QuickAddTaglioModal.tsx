"use client";

import { useState, useMemo } from "react";
import type { FieldNote } from "@/app/actions/field-notes";

interface Props {
  onClose: () => void;
  onSubmit: (title: string, selectedNoteIds: string[]) => Promise<void>;
  notesWithCuts: FieldNote[];
}

const getNoteCutsSummary = (note: FieldNote) => {
  const cuts: string[] = [];
  (note.field_note_items ?? []).forEach((item) => {
    if (item.item_type === "dim_quadrata" && item.value_text) {
      try {
        const parsed = JSON.parse(item.value_text);
        if (parsed.isCutPiece || (parsed.q !== undefined && parsed.q !== null)) {
          cuts.push(`${parsed.b ?? "?"}x${parsed.h ?? "?"} ${parsed.unit ?? "cm"} (x${parsed.q ?? 1})`);
        }
      } catch {
        // ignora
      }
    }
  });
  return cuts.join(", ");
};

const getNoteTitle = (note: FieldNote) => {
  const notaText = (note.field_note_items ?? []).find((i) => i.item_type === "nota")?.value_text;
  if (notaText?.trim()) return notaText;
  return `Appunto #${note.note_number ?? "Senza Numero"}`;
};

export default function QuickAddTaglioModal({
  onClose,
  onSubmit,
  notesWithCuts,
}: Props) {
  const [title, setTitle] = useState("");
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedNoteIds(notesWithCuts.map((n) => n.id));
    } else {
      setSelectedNoteIds([]);
    }
  };

  const handleToggleNote = (noteId: string) => {
    setSelectedNoteIds((prev) =>
      prev.includes(noteId) ? prev.filter((id) => id !== noteId) : [...prev, noteId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedNoteIds.length === 0) {
      alert("Seleziona almeno un appunto da includere nel taglio.");
      return;
    }
    const finalTitle = title.trim() || "Taglio Parametrico";
    setIsSubmitting(true);
    await onSubmit(finalTitle, selectedNoteIds);
    setIsSubmitting(false);
  };

  const isAllSelected = notesWithCuts.length > 0 && selectedNoteIds.length === notesWithCuts.length;

  return (
    <div className="fixed inset-0 z-[2500] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-fade-in">
      <div
        className="w-full max-w-lg rounded-2xl p-6 shadow-2xl relative animate-slide-up flex flex-col max-h-[90vh]"
        style={{
          background: "hsl(220 26% 14%)",
          border: "1px solid hsl(220 20% 22%)",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors text-sm w-7 h-7 flex items-center justify-center rounded-full bg-white/5 border border-white/10"
        >
          ✕
        </button>

        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2 flex-shrink-0">
          <span className="text-xl">✂️</span> Crea Taglio Raggruppato (Nesting)
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4 flex flex-col flex-1 overflow-hidden">
          {/* Titolo del Taglio */}
          <div className="flex-shrink-0">
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-white/50">
              Nome del Taglio
            </label>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="es. Ottimizzazione Taglio Scala A, Commessa infissi..."
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
              style={{
                background: "hsl(220 32% 10%)",
                border: "1px solid hsl(220 20% 20%)",
                color: "hsl(210 40% 96%)",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "hsl(220 90% 56%)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "hsl(220 20% 20%)")}
            />
          </div>

          {/* Selezione Note con Misure di Taglio */}
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex items-center justify-between mb-1.5 flex-shrink-0">
              <label className="block text-xs font-semibold uppercase tracking-wider text-white/50">
                Seleziona Appunti da includere ({selectedNoteIds.length})
              </label>
              {notesWithCuts.length > 0 && (
                <label className="flex items-center gap-1.5 text-xs text-[hsl(220,90%,70%)] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-white/20 text-blue-600 focus:ring-0 bg-transparent"
                  />
                  Seleziona tutti
                </label>
              )}
            </div>

            <div
              className="flex-1 overflow-y-auto rounded-xl border p-2 divide-y scrollbar-thin"
              style={{
                background: "hsl(220 32% 10%)",
                borderColor: "hsl(220 20% 20%)",
              }}
            >
              {notesWithCuts.length > 0 ? (
                notesWithCuts.map((note) => {
                  const isChecked = selectedNoteIds.includes(note.id);
                  return (
                    <div
                      key={note.id}
                      onClick={() => handleToggleNote(note.id)}
                      className="flex items-start gap-3 py-3 px-2.5 hover:bg-white/5 transition-colors cursor-pointer select-none"
                      style={{ borderColor: "hsl(220 20% 16%)" }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // Gestito dal click sulla riga
                        className="mt-0.5 rounded border-white/20 text-blue-600 focus:ring-0 bg-transparent"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>📝</span> {getNoteTitle(note)}
                          {note.type_name && note.type_name !== "Appunti Cantiere" && (
                            <span
                              className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider"
                              style={{ background: "hsl(220 20% 18%)", color: "hsl(215 20% 65%)" }}
                            >
                              {note.type_name}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-emerald-400 mt-1 truncate">
                          ✂️ {getNoteCutsSummary(note)}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-xs text-white/40 italic">
                  Nessun appunto con componenti di taglio presente nel progetto.
                </div>
              )}
            </div>
          </div>

          {/* Footer Bottoni */}
          <div className="pt-2 flex justify-end gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
              style={{
                background: "hsl(220 26% 20%)",
                color: "hsl(210 40% 90%)",
              }}
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isSubmitting || selectedNoteIds.length === 0}
              className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all duration-200 shadow-lg disabled:opacity-50 cursor-pointer"
              style={{
                background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
              }}
            >
              {isSubmitting ? "Generazione..." : "Crea Taglio →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
