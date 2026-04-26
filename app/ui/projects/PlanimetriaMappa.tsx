"use client";

import { useState, useRef, useCallback } from "react";
import type { FieldNote } from "@/app/actions/field-notes";

interface Punto {
  noteNumber: number;
  x: number; // percentuale 0-100
  y: number; // percentuale 0-100
}

interface Props {
  /** Data URL della planimetria (plan_image_url del livello) */
  planImageUrl: string;
  /** Note del livello — da queste estraiamo le posizioni già salvate */
  notes: FieldNote[];
  /** Se fornito, il prossimo numero di nota da posizionare (modalità selezione) */
  onPositionSelected?: (x: number, y: number) => void;
  /** Numero della nota corrente da mostrare come "in attesa di conferma" */
  pendingNoteNumber?: number | null;
  /** Posizione in attesa di conferma */
  pendingPosition?: { x: number; y: number } | null;
}

/** Estrae i punti posizione da tutte le note del livello */
function estraiPunti(notes: FieldNote[]): Punto[] {
  const punti: Punto[] = [];
  for (const note of notes) {
    const items = note.field_note_items ?? [];
    for (const item of items) {
      if (item.item_type === "posizione" && item.value_text) {
        try {
          const { x, y } = JSON.parse(item.value_text);
          if (typeof x === "number" && typeof y === "number") {
            punti.push({ noteNumber: note.note_number, x, y });
          }
        } catch { /* ignora JSON malformato */ }
      }
    }
  }
  return punti;
}

export default function PlanimetriaMappa({
  planImageUrl,
  notes,
  onPositionSelected,
  pendingNoteNumber,
  pendingPosition,
}: Props) {
  const [zoomed, setZoomed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const punti = estraiPunti(notes);
  const isSelecting = !!onPositionSelected;

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isSelecting) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      onPositionSelected?.(Math.round(x * 10) / 10, Math.round(y * 10) / 10);
    },
    [isSelecting, onPositionSelected]
  );

  return (
    <>
      {/* ─── Mappa principale ─── */}
      <div
        ref={containerRef}
        className="relative w-full rounded-xl overflow-hidden select-none"
        style={{
          cursor: isSelecting ? "crosshair" : "default",
          aspectRatio: "16/9",
          background: "hsl(220 26% 8%)",
          border: `1px solid ${isSelecting ? "hsl(220 90% 56%)" : "hsl(220 20% 18%)"}`,
          maxHeight: "320px",
        }}
        onClick={handleClick}
      >
        {/* Planimetria */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={planImageUrl}
          alt="Planimetria"
          className="w-full h-full object-contain"
          draggable={false}
        />

        {/* Istruzione durante la selezione */}
        {isSelecting && (
          <div
            className="absolute top-2 left-1/2 -translate-x-1/2 text-xs font-semibold px-3 py-1.5 rounded-full"
            style={{
              background: "hsl(220 90% 56% / 0.85)",
              color: "white",
              pointerEvents: "none",
            }}
          >
            Tocca o clicca per segnare la posizione
          </div>
        )}

        {/* Punti salvati */}
        {punti.map((p) => (
          <div
            key={`${p.noteNumber}-${p.x}-${p.y}`}
            className="absolute flex items-center justify-center"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
            }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-lg border-2 border-white"
              style={{
                background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
              }}
            >
              {p.noteNumber}
            </div>
          </div>
        ))}

        {/* Punto in attesa (posizione selezionata ma non ancora salvata) */}
        {pendingPosition && (
          <div
            className="absolute flex items-center justify-center"
            style={{
              left: `${pendingPosition.x}%`,
              top: `${pendingPosition.y}%`,
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
            }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-lg border-2 border-yellow-300 animate-pulse"
              style={{ background: "hsl(40 100% 50%)" }}
            >
              {pendingNoteNumber ?? "?"}
            </div>
          </div>
        )}

        {/* Pulsante zoom */}
        {!isSelecting && (
          <button
            onClick={(e) => { e.stopPropagation(); setZoomed(true); }}
            className="absolute bottom-2 right-2 w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all"
            style={{
              background: "hsl(220 26% 14% / 0.85)",
              border: "1px solid hsl(220 20% 22%)",
              color: "white",
            }}
            title="Ingrandisci planimetria"
          >
            ⛶
          </button>
        )}
      </div>

      {/* ─── Modal zoom ─── */}
      {zoomed && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setZoomed(false)}
        >
          <div
            className="relative w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="relative w-full rounded-2xl overflow-hidden"
              style={{
                background: "hsl(220 26% 8%)",
                border: "1px solid hsl(220 20% 20%)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={planImageUrl}
                alt="Planimetria ingrandita"
                className="w-full h-auto object-contain max-h-[80vh]"
              />
              {/* Punti nella versione zoom */}
              {punti.map((p) => (
                <div
                  key={`z-${p.noteNumber}-${p.x}-${p.y}`}
                  className="absolute flex items-center justify-center"
                  style={{
                    left: `${p.x}%`,
                    top: `${p.y}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-xl border-2 border-white"
                    style={{
                      background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
                    }}
                  >
                    {p.noteNumber}
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setZoomed(false)}
              className="absolute top-3 right-3 w-10 h-10 rounded-full flex items-center justify-center text-white text-lg transition-all"
              style={{ background: "hsl(220 26% 20% / 0.9)" }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}
