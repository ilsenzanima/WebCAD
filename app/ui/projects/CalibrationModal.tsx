"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

interface Props {
  imageUrl: string;
  onClose: () => void;
  onSave: (ratio: number) => Promise<void>;
}

export default function CalibrationModal({ imageUrl, onClose, onSave }: Props) {
  const [points, setPoints] = useState<{ x: number, y: number, px: number, py: number }[]>([]);
  const [distanceMm, setDistanceMm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (points.length >= 2) return;
    if (!imgRef.current) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const yPercent = ((e.clientY - rect.top) / rect.height) * 100;

    // We also need the absolute pixel coordinates relative to the image natural size
    const imgElement = imgRef.current;
    const px = ((e.clientX - rect.left) / rect.width) * imgElement.naturalWidth;
    const py = ((e.clientY - rect.top) / rect.height) * imgElement.naturalHeight;

    setPoints(prev => [...prev, { x: xPercent, y: yPercent, px, py }]);
  }, [points]);

  const handleSave = async () => {
    if (points.length < 2) return;
    const p1 = points[0];
    const p2 = points[1];

    const distancePx = Math.sqrt(
      Math.pow(p2.px - p1.px, 2) + Math.pow(p2.py - p1.py, 2)
    );

    const distance = parseFloat(distanceMm);
    if (isNaN(distance) || distance <= 0) {
      alert("Inserisci una distanza valida in mm.");
      return;
    }

    const ratio = distance / distancePx;
    
    setIsSubmitting(true);
    await onSave(ratio);
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 backdrop-blur-sm">
      <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-20 pointer-events-none">
        <h2 className="text-white text-lg font-bold drop-shadow-md">Calibrazione Planimetria</h2>
        <button
          onClick={onClose}
          className="w-10 h-10 bg-white/10 text-white rounded-full flex items-center justify-center text-xl hover:bg-white/20 transition-all border border-white/20 shadow-xl pointer-events-auto"
        >
          ✕
        </button>
      </div>

      <div className="w-full h-[70vh] rounded-2xl overflow-hidden border border-white/20 bg-black relative">
        <TransformWrapper initialScale={1} minScale={0.5} maxScale={6} centerOnInit wheel={{ step: 0.1 }}>
          {(utils) => (
            <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
              <div 
                ref={containerRef}
                className="relative w-full h-full flex items-center justify-center cursor-crosshair"
                onClick={handleClick}
              >
                <img
                  ref={imgRef}
                  src={imageUrl}
                  alt="Planimetria"
                  className="max-w-full max-h-full object-contain"
                  draggable={false}
                />
                
                {/* Render points */}
                {points.map((p, i) => (
                  <div
                    key={i}
                    className="absolute flex items-center justify-center pointer-events-none"
                    style={{
                      left: `${p.x}%`,
                      top: `${p.y}%`,
                      transform: `translate(-50%, -50%) scale(${1 / utils.state.scale})`,
                      transformOrigin: "center center",
                    }}
                  >
                    <div className="w-4 h-4 rounded-full border-2 border-white bg-red-500 shadow-lg flex items-center justify-center text-[8px] text-white font-bold">
                      {i + 1}
                    </div>
                  </div>
                ))}

                {/* Line between points */}
                {points.length === 2 && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    <line
                      x1={`${points[0].x}%`}
                      y1={`${points[0].y}%`}
                      x2={`${points[1].x}%`}
                      y2={`${points[1].y}%`}
                      stroke="red"
                      strokeWidth={2 / utils.state.scale}
                      strokeDasharray="4 4"
                    />
                  </svg>
                )}
              </div>
            </TransformComponent>
          )}
        </TransformWrapper>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-full max-w-sm px-4">
        <div className="bg-[hsl(220_26%_14%)] border border-white/20 p-4 rounded-2xl shadow-2xl">
          {points.length < 2 ? (
            <p className="text-sm text-center text-white font-medium">
              Clicca due punti sulla mappa per definire una distanza nota.
              Punti: {points.length} / 2
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-[hsl(215_20%_65%)] text-center">Inserisci la distanza reale tra i due punti</p>
              <input
                type="number"
                autoFocus
                placeholder="Distanza in mm (es. 1000)"
                value={distanceMm}
                onChange={e => setDistanceMm(e.target.value)}
                className="w-full px-4 py-2 bg-[hsl(220_32%_10%)] border border-[hsl(220_20%_22%)] rounded-xl text-white text-center focus:outline-none focus:border-red-500 transition-colors"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setPoints([])}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold bg-[hsl(220_20%_22%)] text-white hover:bg-[hsl(220_20%_28%)] transition-colors"
                >
                  Riprova
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSubmitting || !distanceMm}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? "Salvataggio..." : "Salva"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
