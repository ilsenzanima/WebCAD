"use client";

import { useEffect } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

interface Props {
  imageUrl: string;
  onClose: () => void;
  title?: string;
  children?: React.ReactNode; // Optional overlay content like markers
}

export default function ImageViewerModal({ imageUrl, onClose, title, children }: Props) {
  // Prevent scrolling on body when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="relative w-full h-full flex flex-col items-center justify-center"
        onClick={(e) => e.stopPropagation()} // Prevent clicks inside from closing
      >
        {/* Header toolbar */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-10 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
          <span className="text-white text-sm font-medium drop-shadow-md">{title || "Anteprima Immagine"}</span>
        </div>

        {/* Pulsante Chiudi fisso */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-10 h-10 bg-white/10 text-white rounded-full flex items-center justify-center text-xl hover:bg-white/20 transition-all border border-white/20 backdrop-blur-md shadow-xl"
        >
          ✕
        </button>

        {/* Controlli zoom on-screen */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="bg-black/50 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 flex items-center gap-4 shadow-xl pointer-events-auto">
            <span className="text-[10px] text-white/70 uppercase font-semibold tracking-wider">
              Usa due dita o rotellina per lo zoom
            </span>
          </div>
        </div>

        {/* Area Pannable & Zoomable */}
        <div className="w-full h-full overflow-hidden flex items-center justify-center p-2 sm:p-6 cursor-grab active:cursor-grabbing">
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
                  src={imageUrl}
                  alt={title || "Ingrandimento"}
                  className="max-w-full max-h-full object-contain"
                  draggable={false}
                />
                {/* Overlay (es. punti mappa) */}
                {children}
              </div>
            </TransformComponent>
          </TransformWrapper>
        </div>
      </div>
    </div>
  );
}
