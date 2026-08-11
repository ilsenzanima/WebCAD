"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";

interface BarcodeScannerModalProps {
  onDetected: (code: string) => void;
  onClose: () => void;
}

export default function BarcodeScannerModal({ onDetected, onClose }: BarcodeScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let cancelled = false;

    reader
      .decodeFromConstraints(
        { video: { facingMode: "environment" } },
        videoRef.current!,
        (result, _err, controls) => {
          if (cancelled) return;
          controlsRef.current = controls;
          if (result) {
            controls.stop();
            onDetected(result.getText());
          }
        }
      )
      .catch(() => {
        if (!cancelled) setError("Impossibile accedere alla fotocamera. Controlla di aver concesso il permesso.");
      });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 animate-fade-in" onClick={onClose}>
      <div
        className="relative w-full max-w-sm rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <span className="text-xs font-bold text-white">📷 Inquadra il codice a barre</span>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-lg leading-none px-1">✕</button>
        </div>
        {error ? (
          <div className="p-6 text-center text-xs text-rose-300">{error}</div>
        ) : (
          <div className="relative">
            <video ref={videoRef} className="w-full aspect-square object-cover bg-black" muted playsInline />
            <div className="pointer-events-none absolute inset-6 border-2 border-emerald-400/60 rounded-xl" />
          </div>
        )}
        <p className="px-4 py-3 text-[10px] text-zinc-500 text-center">Tieni fermo il codice a barre davanti alla fotocamera.</p>
      </div>
    </div>
  );
}
