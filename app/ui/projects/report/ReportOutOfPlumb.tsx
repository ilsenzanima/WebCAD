"use client";

import { useMemo, useState } from "react";
import type { FieldNote } from "@/app/actions/field-notes";

interface Props {
  notes: FieldNote[];
  levels: Array<{ id: string; name: string; piano?: string }>;
  onImageClick: (url: string) => void;
}

interface BollaRecord {
  noteId: string;
  noteNumber: number;
  levelName: string;
  pianoName: string;
  beta: number; // in gradi
  gamma: number; // in gradi
  originalText: string;
  photoUrl?: string;
  createdAt: string;
}

export default function ReportOutOfPlumb({ notes, levels, onImageClick }: Props) {
  // Stati per il calcolatore interattivo fuori bolla
  const [lengthValue, setLengthValue] = useState<number>(50);
  const [lengthUnit, setLengthUnit] = useState<"mm" | "cm" | "m">("cm");

  // Mappa id livello -> Livello
  const levelsMap = useMemo(() => {
    const map: Record<string, { id: string; name: string; piano?: string }> = {};
    levels.forEach((l) => {
      map[l.id] = l;
    });
    return map;
  }, [levels]);

  // Estrae tutti i rilievi effettuati con la livella a bolla
  const bollaRecords: BollaRecord[] = useMemo(() => {
    const records: BollaRecord[] = [];

    notes.forEach((note) => {
      let originalText = "";
      let photoUrl: string | undefined;

      // Cerchiamo la voce con il testo della bolla e la foto
      (note.field_note_items ?? []).forEach((item) => {
        if (item.item_type === "nota" && item.value_text?.includes("📐 Livella a Bolla")) {
          originalText = item.value_text;
        } else if (item.item_type === "foto" && item.value_text) {
          photoUrl = item.value_text;
        }
      });

      // Se non abbiamo trovato il testo della bolla in "nota", cerchiamo se c'è in altre note dell'appunto
      if (!originalText) {
        const fallbackItem = (note.field_note_items ?? []).find(
          (item) => item.item_type === "nota" && (item.value_text?.includes("Beta =") || item.value_text?.includes("Gamma ="))
        );
        if (fallbackItem?.value_text) {
          originalText = fallbackItem.value_text;
        }
      }

      if (originalText) {
        // Estraiamo Beta e Gamma usando regex robuste
        const betaRegex = /Beta\s*=\s*([+-]?\d+(?:\.\d+)?)/i;
        const gammaRegex = /Gamma\s*=\s*([+-]?\d+(?:\.\d+)?)/i;

        const betaMatch = originalText.match(betaRegex);
        const gammaMatch = originalText.match(gammaRegex);

        if (betaMatch || gammaMatch) {
          const beta = betaMatch ? parseFloat(betaMatch[1]) : 0;
          const gamma = gammaMatch ? parseFloat(gammaMatch[1]) : 0;
          const level = note.level_id ? levelsMap[note.level_id] : null;

          records.push({
            noteId: note.id,
            noteNumber: note.note_number,
            levelName: level ? level.name : "Generico",
            pianoName: level ? level.piano || "Piano ND" : "Generico",
            beta,
            gamma,
            originalText,
            photoUrl,
            createdAt: note.created_at,
          });
        }
      }
    });

    // Ordina per numero appunto
    return records.sort((a, b) => a.noteNumber - b.noteNumber);
  }, [notes, levelsMap]);

  // Lunghezza di verifica convertita in mm
  const lengthInMm = useMemo(() => {
    const val = Number(lengthValue);
    if (isNaN(val) || val <= 0) return 0;
    if (lengthUnit === "cm") return val * 10;
    if (lengthUnit === "m") return val * 1000;
    return val; // mm
  }, [lengthValue, lengthUnit]);

  // Utility per formattare lo scostamento fuori bolla
  const formatOffset = (offsetMm: number): string => {
    const abs = Math.abs(offsetMm);
    if (abs === 0) return "0 mm";
    if (abs < 0.05) return "0.0 mm";
    if (abs < 10) {
      return `${offsetMm > 0 ? "+" : ""}${offsetMm.toFixed(1)} mm`;
    }
    const offsetCm = offsetMm / 10;
    return `${offsetMm > 0 ? "+" : ""}${offsetCm.toFixed(2)} cm`;
  };

  return (
    <div className="space-y-6">
      {/* Calcolatore Interattivo - Nascosto in Stampa */}
      <div 
        className="p-6 rounded-3xl border bg-white/5 border-white/5 print:hidden"
        style={{
          background: "linear-gradient(135deg, hsl(220, 26%, 12%, 0.3), hsl(220, 26%, 8%, 0.5))",
          borderColor: "hsl(220 20% 16%)",
        }}
      >
        <div className="max-w-2xl">
          <span className="text-[10px] uppercase font-bold text-orange-400 tracking-wider">Simulatore di Precisione</span>
          <h3 className="text-base font-extrabold text-white mt-1">📐 Calcolatore Fuori Bolla Interattivo</h3>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            Inserisci una lunghezza personalizzata per verificare geometricamente lo spostamento verticale (Beccheggio/Y) e trasversale (Rollio/X) di tutti i rilievi salvati, partendo dal baricentro della bolla.
          </p>

          <div className="mt-4.5 flex items-center gap-3">
            <div className="relative">
              <input
                type="number"
                value={lengthValue || ""}
                onChange={(e) => setLengthValue(Math.max(1, parseFloat(e.target.value) || 0))}
                className="w-32 px-4 py-2.5 text-sm rounded-xl bg-white/5 border border-white/10 text-white outline-none focus:border-blue-500 font-bold"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500 pointer-events-none">
                {lengthUnit}
              </span>
            </div>

            <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
              {(["mm", "cm", "m"] as const).map((unit) => (
                <button
                  key={unit}
                  onClick={() => setLengthUnit(unit)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                    lengthUnit === unit ? "bg-white text-black" : "text-gray-400 hover:text-white"
                  }`}
                >
                  {unit}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Riconoscimento della Stampa: mostra le impostazioni correnti usate */}
      <div className="hidden print:block text-xs text-gray-600 mb-2 font-medium">
        📐 Calcolo del fuori bolla ricalcolato per una lunghezza di riferimento di: <strong>{lengthValue} {lengthUnit}</strong>
      </div>

      {/* Tabella / Elenco Rilievi */}
      {bollaRecords.length === 0 ? (
        <div className="p-12 text-center rounded-3xl border border-white/5 bg-white/5 text-gray-400">
           Nessun rilievo effettuato con la livella digitale in questo cantiere.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {bollaRecords.map((rec) => {
            // Calcolo scostamenti trigonometrici in tempo reale
            // delta = L * sin(angolo)
            const betaRad = (rec.beta * Math.PI) / 180;
            const gammaRad = (rec.gamma * Math.PI) / 180;

            const deltaY = lengthInMm * Math.sin(betaRad);
            const deltaX = lengthInMm * Math.sin(gammaRad);

            // Verifica se è in bolla (sotto 0.8 gradi come tolleranza standard)
            const inBolla = Math.abs(rec.beta) <= 0.8 && Math.abs(rec.gamma) <= 0.8;

            return (
              <div 
                key={rec.noteId} 
                className="p-5 rounded-3xl border bg-white/5 border-white/5 flex flex-col lg:flex-row lg:items-center justify-between gap-6 print:border-gray-200 print:bg-transparent print:p-4 print:break-inside-avoid"
              >
                <div className="space-y-4 flex-1 min-w-0">
                  {/* Badge e Titolo */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-400">
                      RILIEVO #{rec.noteNumber}
                    </span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-white/5 text-gray-300 border border-white/5 print:border-gray-300 print:text-black">
                      🏢 {rec.levelName} ({rec.pianoName})
                    </span>
                    {inBolla ? (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/10 print:text-emerald-700">
                        ✓ RILEVAMENTO IN BOLLA
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 border border-red-500/10 print:text-red-700">
                        ⚠️ FUORI BOLLA
                      </span>
                    )}
                  </div>

                  {/* Informazioni Inclinazione */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-3 bg-white/[0.02] border border-white/5 rounded-2xl print:border-gray-200">
                      <span className="text-[9px] uppercase font-bold text-gray-500">Angolo Beccheggio (Beta/Y)</span>
                      <p className="text-sm font-bold text-white mt-0.5 print:text-black">{rec.beta > 0 ? "+" : ""}{rec.beta}°</p>
                    </div>
                    <div className="p-3 bg-white/[0.02] border border-white/5 rounded-2xl print:border-gray-200">
                      <span className="text-[9px] uppercase font-bold text-gray-500">Angolo Rollio (Gamma/X)</span>
                      <p className="text-sm font-bold text-white mt-0.5 print:text-black">{rec.gamma > 0 ? "+" : ""}{rec.gamma}°</p>
                    </div>

                    <div className="p-3 bg-white/[0.02] border border-white/5 rounded-2xl print:border-gray-200">
                      <span className="text-[9px] uppercase font-bold text-orange-400 font-bold">Scostamento Y su {lengthValue}{lengthUnit}</span>
                      <p className="text-sm font-extrabold text-orange-400 mt-0.5">{formatOffset(deltaY)}</p>
                    </div>
                    <div className="p-3 bg-white/[0.02] border border-white/5 rounded-2xl print:border-gray-200">
                      <span className="text-[9px] uppercase font-bold text-blue-400 font-bold">Scostamento X su {lengthValue}{lengthUnit}</span>
                      <p className="text-sm font-extrabold text-blue-400 mt-0.5">{formatOffset(deltaX)}</p>
                    </div>
                  </div>

                  {/* Testo Rilevato Originale */}
                  <p className="text-[10px] text-gray-400 italic leading-relaxed break-words border-l-2 border-white/10 pl-2.5 print:text-gray-600 print:border-gray-300">
                    Dettagli originali salvati: {rec.originalText.replace("📐 Livella a Bolla: ", "")}
                  </p>
                </div>

                {/* Grafico Snapshot della bolla */}
                {rec.photoUrl && (
                  <div className="flex-shrink-0 self-start lg:self-center">
                    <div className="relative w-36 h-36 rounded-2xl overflow-hidden border border-white/10 bg-white/5 hover:border-blue-500/50 transition-colors cursor-pointer group print:w-44 print:h-44 print:border-gray-300">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={rec.photoUrl}
                        alt="Rilievo Livella"
                        onClick={() => onImageClick(rec.photoUrl!)}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
