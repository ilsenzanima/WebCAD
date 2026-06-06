"use client";

import { useState } from "react";
import RalScannerWidget from "../projects/RalScannerWidget";

interface GlobalRalTriggerProps {
  mode: "desktop" | "mobile";
}

export default function GlobalRalTrigger({ mode }: GlobalRalTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (mode === "desktop") {
    return (
      <>
        <button
          onClick={() => setIsOpen(true)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left hover:bg-white/5 cursor-pointer"
          style={{ color: "hsl(215 20% 65%)" }}
        >
          <span className="text-base w-5 text-center">🎨</span>
          <span>Rilevatore RAL</span>
        </button>

        <RalScannerWidget
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
        />
      </>
    );
  }

  // Mobile Bottom Nav / Tools Mode
  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex flex-col items-center justify-center p-4 rounded-2xl border text-center transition-all active:scale-95 cursor-pointer"
        style={{
          background: "hsl(220 26% 12%)",
          borderColor: "hsl(220 20% 18%)",
          width: "100%",
        }}
      >
        <span className="text-2xl mb-2 block">🎨</span>
        <span className="text-xs font-bold text-white/70">
          Rilevatore RAL
        </span>
      </button>

      <RalScannerWidget
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
