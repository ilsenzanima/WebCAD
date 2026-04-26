"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import type { FieldNote } from "@/app/actions/field-notes";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

interface Punto {
  noteNumber: number;
  x: number; // percentuale 0-100
  y: number; // percentuale 0-100
}

interface Props {
  planImageUrl: string;
  notes: FieldNote[];
  onPositionSelected?: (x: number, y: number) => void;
  pendingNoteNumber?: number | null;
  pendingPosition?: { x: number; y: number } | null;
}

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
        } catch { /* ignora */ }
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  const containerRef = useRef<HTMLDivElement>(null);

  const punti = estraiPunti(notes);
  const isSelecting = !!onPositionSelected;

  // Renderizza i punti
  const renderPunti = (isModal: boolean = false) => (
    <>
      {punti.map((p) => (
        <div
          key={`${p.noteNumber}-${p.x}-${p.y}`}
          className="absolute flex items-center justify-center pointer-events-none"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div
            className={`rounded-full flex items-center justify-center font-bold text-white shadow-lg border-2 border-white ${isModal ? 'w-8 h-8 text-xs' : 'w-6 h-6 text-[10px]'}`}
            style={{
              background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
            }}
          >
            {p.noteNumber}
          </div>
        </div>
      ))}
      {pendingPosition && (
        <div
          className="absolute flex items-center justify-center pointer-events-none"
          style={{
            left: `${pendingPosition.x}%`,
            top: `${pendingPosition.y}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div
            className={`rounded-full flex items-center justify-center font-bold text-white shadow-lg border-2 border-yellow-300 animate-pulse ${isModal ? 'w-8 h-8 text-xs' : 'w-6 h-6 text-[10px]'}`}
            style={{ background: "hsl(40 100% 50%)" }}
          >
            {pendingNoteNumber ?? "?"}
          </div>
        </div>
      )}
    </>
  );

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

  // Blocca lo scroll del body quando il modal è aperto
  useEffect(() => {
    if (zoomed) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [zoomed]);

  return (
    <>
      {/* ─── Mappa in pagina (con TransformWrapper per Zoom) ─── */}
      <div
        className="relative w-full rounded-xl overflow-hidden select-none bg-black border"
        style={{
          cursor: isSelecting ? "crosshair" : "default",
          height: isSelecting ? "50vh" : "auto", // Più alta se in selezione
          maxHeight: isSelecting ? "none" : "320px",
          borderColor: isSelecting ? "hsl(220 90% 56%)" : "hsl(220 20% 18%)",
        }}
      >
        <TransformWrapper
          initialScale={1}
          minScale={0.8}
          maxScale={5}
          disabled={!isSelecting && !zoomed} // Disabilita lo zoom inline se non è in selezione per non rubare lo scroll di pagina
          wheel={{ step: 0.1 }}
          doubleClick={{ disabled: true }}
          panning={{ velocityDisabled: true }}
        >
          <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
            <div 
              ref={containerRef}
              className="relative w-full flex items-center justify-center" 
              onClick={handleClick}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={planImageUrl}
                alt="Planimetria"
                className="w-full h-full object-contain"
                draggable={false}
              />
              {renderPunti()}
            </div>
          </TransformComponent>
        </TransformWrapper>

        {isSelecting && (
           <div className="absolute top-2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none">
            <div className="text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg"
                 style={{ background: "hsl(220 90% 56%)", color: "white" }}>
              Tocca o clicca per posizionare il punto
            </div>
            <div className="text-[10px] uppercase font-bold px-2 py-1 rounded-full shadow-md"
                 style={{ background: "black", color: "hsl(220 20% 70%)" }}>
              (Pinch per ingrandire)
            </div>
          </div>
        )}

        {!isSelecting && (
          <button
            onClick={() => setZoomed(true)}
            className="absolute bottom-2 right-2 w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-all"
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

      {/* ─── Modal zoom schermo intero (se non in selezione inline) ─── */}
      {zoomed && !isSelecting && mounted && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-0 sm:p-4 backdrop-blur-sm"
        >
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-20 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
            <span className="text-white text-sm font-medium drop-shadow-md">Planimetria Livello</span>
            <button
              onClick={() => setZoomed(false)}
              className="w-10 h-10 bg-white/10 text-white rounded-full flex items-center justify-center text-xl hover:bg-white/20 transition-all border border-white/20 backdrop-blur-md shadow-xl pointer-events-auto"
            >
              ✕
            </button>
          </div>

          <div className="w-full h-full overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing">
            <TransformWrapper
              initialScale={1}
              minScale={0.5}
              maxScale={6}
              centerOnInit
              wheel={{ step: 0.1 }}
            >
              <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
                <div className="relative flex items-center justify-center w-full h-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={planImageUrl}
                    alt="Planimetria ingrandita"
                    className="max-w-full max-h-full object-contain"
                    draggable={false}
                  />
                  {renderPunti(true)}
                </div>
              </TransformComponent>
            </TransformWrapper>
          </div>

          {/* Istruzioni bottom */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
            <div className="bg-black/50 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 flex items-center gap-4 shadow-xl">
              <span className="text-[10px] text-white/70 uppercase font-semibold tracking-wider">
                Usa due dita o rotellina per lo zoom
              </span>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
