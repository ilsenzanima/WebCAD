"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  onClose: () => void;
  onSubmit: (name: string, elevationZ: number, drawingType: "2d_wall" | "3d_box", piano: string) => Promise<void>;
  defaultName?: string;
  defaultPiano?: string;
  existingPiani?: string[];
  title?: string;
  submitLabel?: string;
}

export default function CreateDrawingModal({ 
  onClose, 
  onSubmit, 
  defaultName = "Nuova Nota", 
  defaultPiano = "",
  existingPiani = [],
  title = "Aggiungi Nota",
  submitLabel = "Aggiungi"
}: Props) {
  const [name, setName] = useState(defaultName);
  const [piano, setPiano] = useState(defaultPiano);
  const [showPianiDropdown, setShowPianiDropdown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Chiude il dropdown se clicchi fuori
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowPianiDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalPiano = piano.trim() || "Generico";
    setIsSubmitting(true);
    // elevationZ impostato a 0 (sarà calcolato in automatico o ordinato in backend)
    await onSubmit(name, 0, "2d_wall", finalPiano);
    setIsSubmitting(false);
  };

  const filteredPiani = existingPiani.filter(p => 
    p.toLowerCase().includes(piano.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div 
        className="w-full max-w-md rounded-2xl p-6 shadow-2xl relative"
        style={{
          background: "hsl(220 26% 14%)",
          border: "1px solid hsl(220 20% 22%)",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          ✕
        </button>

        <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
          📝 {title}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome della Nota */}
          <div>
            <label className="block text-xs font-semibold mb-1 uppercase tracking-wider text-white/50">
              Nome della Nota
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="es. Cassonetto Condotta 1, Spalla Pilastro..."
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
              style={{
                background: "hsl(220 32% 10%)",
                border: "1px solid hsl(220 20% 20%)",
                color: "hsl(210 40% 96%)",
              }}
              onFocus={e => e.currentTarget.style.borderColor = "hsl(220 90% 56%)"}
              onBlur={e => e.currentTarget.style.borderColor = "hsl(220 20% 20%)"}
            />
          </div>

          {/* Piano di Riferimento */}
          <div className="relative" ref={dropdownRef}>
            <label className="block text-xs font-semibold mb-1 uppercase tracking-wider text-white/50">
              Piano di Riferimento
            </label>
            <input
              type="text"
              required
              value={piano}
              onChange={e => {
                setPiano(e.target.value);
                setShowPianiDropdown(true);
              }}
              onFocus={() => setShowPianiDropdown(true)}
              placeholder="Scrivi o seleziona un piano..."
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
              style={{
                background: "hsl(220 32% 10%)",
                border: "1px solid hsl(220 20% 20%)",
                color: "hsl(210 40% 96%)",
              }}
              onFocusCapture={e => e.currentTarget.style.borderColor = "hsl(220 90% 56%)"}
              onBlurCapture={e => e.currentTarget.style.borderColor = "hsl(220 20% 20%)"}
              autoComplete="off"
            />

            {/* Dropdown di suggerimento dei Piani già esistenti */}
            {showPianiDropdown && existingPiani.length > 0 && (
              <div
                className="absolute left-0 right-0 mt-1 rounded-xl overflow-hidden z-50 border max-h-40 overflow-y-auto"
                style={{
                  background: "hsl(220 26% 14%)",
                  borderColor: "hsl(220 20% 22%)",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                }}
              >
                {filteredPiani.length > 0 ? (
                  filteredPiani.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setPiano(p);
                        setShowPianiDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs hover:bg-white/5 transition-colors text-white/80"
                      style={{ borderBottom: idx < filteredPiani.length - 1 ? "1px solid hsl(220 20% 18%)" : "none" }}
                    >
                      🏢 {p}
                    </button>
                  ))
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowPianiDropdown(false)}
                    className="w-full text-left px-4 py-2.5 text-xs text-white/40 italic"
                  >
                    Nessun piano corrispondente (creane uno nuovo)
                  </button>
                )}
              </div>
            )}
            <p className="text-[10px] mt-1 text-white/40">
              Scrivi un nuovo piano (es. 'Piano 3') o scegline uno già inserito per tenerli ordinati.
            </p>
          </div>

          {/* Bottoni d'azione */}
          <div className="pt-4 flex justify-end gap-3">
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
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all duration-200 shadow-lg disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
              }}
            >
              {isSubmitting ? "Salvataggio..." : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
