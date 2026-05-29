"use client";

import { useState } from "react";
import CalcolatriceWidget from "./CalcolatriceWidget";

interface GlobalCalcTriggerProps {
  mode: "desktop" | "mobile";
}

export default function GlobalCalcTrigger({ mode }: GlobalCalcTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (mode === "desktop") {
    return (
      <>
        <button
          onClick={() => setIsOpen(true)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left hover:bg-white/5 cursor-pointer"
          style={{ color: "hsl(215 20% 65%)" }}
        >
          <span className="text-base w-5 text-center">🧮</span>
          <span>Calcolatrice</span>
        </button>

        <CalcolatriceWidget 
          isOpen={isOpen} 
          onClose={() => setIsOpen(false)} 
          showImportButton={false} 
        />
      </>
    );
  }

  // Mobile Bottom Nav Mode
  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
        style={{ color: "hsl(215 20% 55%)" }}
      >
        <span className="text-xl leading-none">🧮</span>
        <span className="text-[10px] font-medium leading-none">Calcoli</span>
      </button>

      <CalcolatriceWidget 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
        showImportButton={false} 
      />
    </>
  );
}
