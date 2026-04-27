"use client";

import { useState } from "react";

interface Props {
  onClose: () => void;
  onSubmit: (name: string, elevationZ: number) => Promise<void>;
  defaultName?: string;
  defaultElevation?: number;
  title?: string;
  submitLabel?: string;
}

export default function CreateDrawingModal({ 
  onClose, 
  onSubmit, 
  defaultName = "Nuovo Piano", 
  defaultElevation = 0,
  title = "Crea Disegno",
  submitLabel = "Crea"
}: Props) {
  const [name, setName] = useState(defaultName);
  const [elevation, setElevation] = useState(defaultElevation.toString());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const elevZ = parseInt(elevation, 10);
    if (isNaN(elevZ)) return;
    setIsSubmitting(true);
    await onSubmit(name, elevZ);
    setIsSubmitting(false);
  };

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
          {title}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "hsl(215 15% 65%)" }}>
              Nome del Disegno (es. Piano Terra)
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
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

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "hsl(215 15% 65%)" }}>
              Piano di partenza (Elevazione Z)
            </label>
            <input
              type="number"
              required
              value={elevation}
              onChange={e => setElevation(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
              style={{
                background: "hsl(220 32% 10%)",
                border: "1px solid hsl(220 20% 20%)",
                color: "hsl(210 40% 96%)",
              }}
              onFocus={e => e.currentTarget.style.borderColor = "hsl(220 90% 56%)"}
              onBlur={e => e.currentTarget.style.borderColor = "hsl(220 20% 20%)"}
            />
            <p className="text-xs mt-1" style={{ color: "hsl(215 15% 45%)" }}>
              Usa 0 per Piano Terra, 1 per Primo Piano, -1 per Interrato, ecc.
            </p>
          </div>

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
