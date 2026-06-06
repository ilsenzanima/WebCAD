"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

interface CalcolatriceWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  showImportButton?: boolean;
}

export default function CalcolatriceWidget({
  isOpen,
  onClose,
  showImportButton = false,
}: CalcolatriceWidgetProps) {
  const [display, setDisplay] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Carica cronologia locale all'avvio
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("webcad_calc_history");
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  if (!isOpen || !mounted) return null;

  // Calcola in modo sicuro senza eval
  function calculateExpression(expr: string): string {
    try {
      // Sostituiamo i simboli visivi con quelli operativi
      let cleanExpr = expr.replace(/×/g, "*").replace(/÷/g, "/").replace(/,/g, ".");
      
      // Sanitizzazione rigorosa per prevenire codice malevolo
      if (!/^[0-9+\-*/().\s]+$/.test(cleanExpr)) {
        return "Errore";
      }

      // Eseguiamo il calcolo in una sandbox sicura
      const result = new Function(`return (${cleanExpr})`)();
      if (result === Infinity || result === -Infinity || isNaN(result)) {
        return "Errore";
      }
      
      // Arrotondiamo a 3 decimali al massimo per le misure di cantiere
      return Number(result.toFixed(3)).toString().replace(/\./g, ",");
    } catch (err) {
      return "Errore";
    }
  }

  function handleKeyPress(key: string) {
    // Vibrazione tattile su mobile
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(15);
    }

    if (key === "C") {
      setDisplay("");
      setLastResult(null);
    } else if (key === "del") {
      setDisplay((prev) => prev.slice(0, -1));
    } else if (key === "=") {
      if (!display) return;
      const res = calculateExpression(display);
      if (res !== "Errore") {
        const record = `${display} = ${res}`;
        const newHistory = [record, ...history].slice(0, 20); // Max 20 record
        setHistory(newHistory);
        localStorage.setItem("webcad_calc_history", JSON.stringify(newHistory));
        setLastResult(res);
        setDisplay(res);
      } else {
        setDisplay("Errore");
        setTimeout(() => setDisplay(""), 1200);
      }
    } else {
      // Evitiamo operatori doppi consecutivi
      const operators = ["+", "-", "×", "÷"];
      if (operators.includes(key) && operators.includes(display.slice(-1))) {
        setDisplay((prev) => prev.slice(0, -1) + key);
        return;
      }
      setDisplay((prev) => (prev === "Errore" ? key : prev + key));
    }
  }

  function handleImport(expr: string) {
    // Emette l'evento personalizzato per NewNoteForm o SketchEditor
    window.dispatchEvent(
      new CustomEvent("webcad-import-calc", {
        detail: { calculation: expr },
      })
    );

    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([20, 50, 20]);
    }
    
    // Feedback visivo temporaneo
    alert("Calcolo importato con successo come riga di appunto!");
  }

  function clearHistory() {
    setHistory([]);
    localStorage.removeItem("webcad_calc_history");
  }

  const buttons = [
    ["(", ")", "del", "C"],
    ["7", "8", "9", "÷"],
    ["4", "5", "6", "×"],
    ["1", "2", "3", "-"],
    ["0", ",", "=", "+"],
  ];

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Sfondo sfocato oscurato */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-md animate-fade-in"
        onClick={onClose}
      />

      {/* Finestra Calcolatrice Premium */}
      <div
        className="relative w-full max-w-sm rounded-3xl p-6 border shadow-[0_20px_60px_rgba(0,0,0,0.6)] flex flex-col gap-4 animate-scale-in"
        style={{
          background: "hsl(220 32% 10% / 0.95)",
          borderColor: "hsl(220 20% 18%)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🧮</span>
            <h3 className="text-white font-bold text-sm tracking-wide">Calcolatrice Tecnico Cantiere</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 bg-white/5 hover:bg-white/10 hover:text-white transition-all text-sm"
          >
            ✕
          </button>
        </div>

        {/* Display Risultato */}
        <div 
          className="p-4 rounded-2xl flex flex-col justify-end items-end gap-1 relative overflow-hidden"
          style={{
            background: "hsl(220 35% 6%)",
            border: "1px solid hsl(220 20% 14%)",
            minHeight: "80px"
          }}
        >
          <div className="text-[11px] text-white/30 truncate max-w-full tracking-wider font-mono">
            {display ? "IMMISSIONE" : "PRONTO"}
          </div>
          <div className="text-white font-bold text-2xl tracking-wide font-mono select-all truncate max-w-full">
            {display || "0"}
          </div>
        </div>

        {/* Tasti Calcolatrice Grid */}
        <div className="grid grid-cols-4 gap-2">
          {buttons.map((row, rIdx) =>
            row.map((btn) => {
              const isOperator = ["+", "-", "×", "÷", "="].includes(btn);
              const isClear = ["C", "del"].includes(btn);
              
              let btnBg = "hsl(220 26% 14%)";
              let btnColor = "hsl(210 40% 90%)";
              let btnBorder = "hsl(220 20% 18%)";
              
              if (btn === "=") {
                btnBg = "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))";
                btnColor = "white";
                btnBorder = "hsl(220 90% 56% / 0.5)";
              } else if (isOperator) {
                btnBg = "hsl(220 26% 18%)";
                btnColor = "hsl(24 95% 50%)"; // Arancione tecnico
              } else if (isClear) {
                btnBg = "hsl(0 60% 12% / 0.3)";
                btnColor = "hsl(0 80% 65%)";
                btnBorder = "hsl(0 60% 20% / 0.2)";
              }

              return (
                <button
                  key={btn}
                  onClick={() => handleKeyPress(btn)}
                  className="py-3.5 rounded-2xl text-sm font-bold border transition-all active:scale-95 shadow-md flex items-center justify-center cursor-pointer select-none"
                  style={{
                    background: btnBg,
                    color: btnColor,
                    borderColor: btnBorder,
                  }}
                >
                  {btn}
                </button>
              );
            })
          )}
        </div>

        {/* Pulsante Importazione rapida se all'interno delle Note */}
        {showImportButton && display && display !== "Errore" && (
          <button
            onClick={() => handleImport(display)}
            className="w-full py-3 rounded-2xl font-bold text-xs text-white transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
            style={{
              background: "linear-gradient(135deg, hsl(24 95% 50%), hsl(16 100% 50%))",
              boxShadow: "0 4px 14px hsl(24 95% 50% / 0.2)",
            }}
          >
            📥 Inserisci come Riga di Appunto
          </button>
        )}

        {/* Cronologia dei calcoli */}
        <div className="flex-1 flex flex-col gap-2 min-h-[110px] max-h-[140px]">
          <div className="flex items-center justify-between border-t border-white/5 pt-2 text-[10px] font-bold text-white/40 uppercase tracking-wider">
            <span>Cronologia Calcoli</span>
            {history.length > 0 && (
              <button 
                onClick={clearHistory}
                className="text-[9px] text-red-400 hover:text-red-300 font-bold"
              >
                Ripulisci
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 text-xs font-mono scrollbar-none">
            {history.length === 0 ? (
              <p className="text-[10px] text-white/30 italic text-center py-6">Nessun calcolo recente.</p>
            ) : (
              history.map((record, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between p-2 rounded-xl border group hover:bg-white/5 transition-all"
                  style={{
                    background: "hsl(220 30% 8%)",
                    borderColor: "hsl(220 20% 12%)"
                  }}
                >
                  <span className="text-white/80 truncate pr-2">{record}</span>
                  <div className="flex gap-1 flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                    {/* Pulsante usa come immissione */}
                    <button
                      onClick={() => setDisplay(record.split(" = ")[1].replace(/,/g, "."))}
                      className="px-1.5 py-0.5 rounded bg-white/5 text-[9px] text-white/60 hover:text-white"
                      title="Usa risultato"
                    >
                      Usa
                    </button>
                    {/* Pulsante importazione calcolo intero */}
                    {showImportButton && (
                      <button
                        onClick={() => handleImport(record)}
                        className="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 text-[9px]"
                        title="Importa questo calcolo"
                      >
                        Importa
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
