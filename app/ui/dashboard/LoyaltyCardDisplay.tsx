"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";

// Formati ZXing (rilevati in scansione) con corrispondenza diretta in JsBarcode.
const JSBARCODE_FORMAT_MAP: Record<string, string> = {
  CODE_128: "CODE128",
  CODE_39: "CODE39",
  CODE_93: "CODE93",
  EAN_13: "EAN13",
  EAN_8: "EAN8",
  UPC_A: "UPC",
  ITF: "ITF14",
  CODABAR: "codabar",
};

const QR_FORMATS = new Set(["QR_CODE", "MICRO_QR_CODE"]);

// Formati 2D diversi dal QR che non si possono ridisegnare fedelmente
// (l'immagine risultante non sarebbe leggibile dallo stesso tipo di lettore).
const UNSUPPORTED_FORMATS = new Set(["DATA_MATRIX", "AZTEC", "PDF_417", "MAXICODE", "RSS_14", "RSS_EXPANDED", "UPC_EAN_EXTENSION"]);

interface LoyaltyCardDisplayProps {
  code: string;
  format: string | null;
}

export default function LoyaltyCardDisplay({ code, format }: LoyaltyCardDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const isQr = format ? QR_FORMATS.has(format) : false;
  const isUnsupported = format ? UNSUPPORTED_FORMATS.has(format) : false;
  // Nessun formato noto (es. inserito a mano): CODE128 codifica qualunque
  // testo/numero, buon compromesso di default.
  const jsBarcodeFormat = isQr || isUnsupported ? null : (format && JSBARCODE_FORMAT_MAP[format]) || "CODE128";

  useEffect(() => {
    if (!canvasRef.current || isUnsupported) return;
    try {
      if (isQr) {
        QRCode.toCanvas(canvasRef.current, code, { width: 220, margin: 1 });
      } else if (jsBarcodeFormat) {
        JsBarcode(canvasRef.current, code, { format: jsBarcodeFormat, width: 2, height: 90, displayValue: true, fontSize: 14, margin: 8 });
      }
    } catch {
      // Il testo non e' compatibile col formato scelto: resta solo il codice testuale sotto.
    }
  }, [code, isQr, isUnsupported, jsBarcodeFormat]);

  return (
    <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white">
      {isUnsupported ? (
        <p className="text-[11px] text-zinc-600 text-center py-6">Formato non riproducibile a schermo: mostra questo codice al cassiere.</p>
      ) : (
        <canvas ref={canvasRef} className="max-w-full" />
      )}
      <p className="text-xs font-mono font-bold text-zinc-800 tracking-wider break-all text-center">{code}</p>
    </div>
  );
}
