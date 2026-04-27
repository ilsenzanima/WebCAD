"use client";

import { useState } from "react";
import PlanimetriaMappa from "./PlanimetriaMappa";
import type { FieldNote } from "@/app/actions/field-notes";

interface Props {
  planImageUrl: string;
  notes: FieldNote[];
  levelName: string;
}

export default function StickyPlanimetria({ planImageUrl, notes, levelName }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className="sticky top-0 z-20 px-4 sm:px-8 py-3"
      style={{
        background: "hsl(222 47% 6% / 0.95)",
        borderBottom: "1px solid hsl(220 20% 14%)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(215 15% 45%)" }}>
            🗺 Planimetria — {levelName}
          </span>
          <span className="text-xs" style={{ color: "hsl(215 15% 35%)" }}>
            · {notes.length} punt{notes.length === 1 ? "o" : "i"} segnati
          </span>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors border"
          style={{
            background: isOpen ? "hsl(220 26% 14%)" : "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
            color: "white",
            borderColor: isOpen ? "hsl(220 20% 22%)" : "transparent"
          }}
        >
          {isOpen ? "Nascondi Mappa" : "Vedi Mappa"}
        </button>
      </div>
      
      {isOpen && (
        <div className="mt-3 animate-fade-in">
          <PlanimetriaMappa planImageUrl={planImageUrl} notes={notes} />
        </div>
      )}
    </div>
  );
}
