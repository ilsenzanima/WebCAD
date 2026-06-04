"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  type: "nota" | "sketch" | "3d" | "taglio";
  onClose: () => void;
  onSubmit: (title: string, piano: string) => Promise<void>;
  existingPiani?: string[];
}

const TYPE_CONFIG = {
  nota: { icon: "📝", title: "Aggiungi Nota", label: "Titolo della Nota", placeholder: "es. Rilievo Staffaggi, Misure Canali..." },
  sketch: { icon: "🎨", title: "Aggiungi Sketch", label: "Titolo dello Sketch", placeholder: "es. Schema Planimetria, Dettaglio Staffa..." },
  "3d": { icon: "📦", title: "Aggiungi Report 3D", label: "Titolo del Report 3D", placeholder: "es. Componente Curva, Rilievo 3D Collettore..." },
  taglio: { icon: "✂️", title: "Crea Piano di Taglio", label: "Titolo del Piano di Taglio", placeholder: "es. Taglio Tubi Collettore, Ordine Lamiere..." },
};

export default function QuickAddModal({
  type,
  onClose,
  onSubmit,
  existingPiani = [],
}: Props) {
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.nota;
  const [title, setTitle] = useState("");
  const [piano, setPiano] = useState("");
  const [showPianiDropdown, setShowPianiDropdown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Chiude il dropdown se si clicca fuori
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
    const finalTitle = title.trim() || "Senza Titolo";
    setIsSubmitting(true);
    await onSubmit(finalTitle, finalPiano);
    setIsSubmitting(false);
  };

  const filteredPiani = existingPiani.filter(p =>
    p.toLowerCase().includes(piano.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[2500] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-fade-in">
      <div
        className="w-full max-w-md rounded-2xl p-6 shadow-2xl relative animate-slide-up"
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

        <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
          <span className="text-xl">{config.icon}</span> {config.title}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Titolo */}
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-white/50">
              {config.label}
            </label>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={config.placeholder}
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
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-white/50">
              Piano / Livello
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

            {/* Dropdown piani */}
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
                    Crea come nuovo piano
                  </button>
                )}
              </div>
            )}
            <p className="text-[10px] mt-1.5 text-white/40">
              Scrivi un nuovo piano (es. &apos;Piano 1&apos;) o seleziona uno esistente.
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
              className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all duration-200 shadow-lg disabled:opacity-50 cursor-pointer"
              style={{
                background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
              }}
            >
              {isSubmitting ? "Inizializzazione..." : "Procedi →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
