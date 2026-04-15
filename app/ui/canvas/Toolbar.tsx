"use client";

import { useCanvasStore } from "@/lib/stores/canvas-store";
import { useEffect, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";

// Configuriamo il worker per viaggiare tramite CDN in modo da evitare problemi di bundling
// con Next.js e Turbopack. MVP friendly.
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

export default function Toolbar() {
  const {
    activeTool,
    setActiveTool,
    setBackgroundImage,
    calibrationPoints,
    resetCalibrationPoints,
    calibrationRatio,
    setCalibrationRatio,
    isProcessingFile,
    setIsProcessingFile,
  } = useCanvasStore();

  const [realDistanceMm, setRealDistanceMm] = useState<string>("");
  const [pendingPdf, setPendingPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [selectedPdfPage, setSelectedPdfPage] = useState<number>(1);

  const renderPdfPageToCanvas = async (pdf: pdfjsLib.PDFDocumentProxy, pageNumber: number) => {
    try {
      setIsProcessingFile(true);
      const page = await pdf.getPage(pageNumber);

      const scale = 4.0;
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) throw new Error("2D Context not found");
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({ canvasContext: context, viewport }).promise;

      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      setBackgroundImage(dataUrl);
      resetCalibrationPoints();
      setPendingPdf(null);
    } catch (error) {
      console.error("Errore render PDF:", error);
      alert("Impossibile generare la pagina del PDF.");
    } finally {
      setIsProcessingFile(false);
    }
  };

  // Handle Image Upload (Supporta PNG, JPG ed estrazione in canvas offline per i PDF ad Altissima Risoluzione)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === "application/pdf") {
      setIsProcessingFile(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const typedarray = new Uint8Array(event.target?.result as ArrayBuffer);
          const pdf = await pdfjsLib.getDocument(typedarray).promise;
          
          if (pdf.numPages > 1) {
            setPendingPdf(pdf);
            setSelectedPdfPage(1);
            setIsProcessingFile(false);
            if (e.target) e.target.value = "";
            return;
          }

          await renderPdfPageToCanvas(pdf, 1);
        } catch (error) {
          console.error("Errore parser PDF:", error);
          alert("Impossibile elaborare il PDF.");
          setIsProcessingFile(false);
        }
        if (e.target) e.target.value = "";
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    // Se è immagine standard (PNG/JPG)
    setIsProcessingFile(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setBackgroundImage(dataUrl);
      resetCalibrationPoints();
      setIsProcessingFile(false);
      e.target.value = ""; // resettiamo l'input
    };
    reader.readAsDataURL(file);
  };

  // Esegue il calcolo della calibrazione dal Modal inserito e salva il ratio
  const handleCalibrationSave = () => {
    if (calibrationPoints.length < 2) return;
    const p1 = calibrationPoints[0];
    const p2 = calibrationPoints[1];

    // Distanza Euclidiana in Pixel
    const distancePx = Math.sqrt(
      Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
    );

    // Valore reale inserito dall'utente in mm
    const distanceMm = parseFloat(realDistanceMm);
    if (isNaN(distanceMm) || distanceMm <= 0) {
      alert("Inserisci una lunghezza reale in millimetri (es: 2000 per 2 metri).");
      return;
    }

    // Ratio della SCALA
    const ratio = distanceMm / distancePx;
    setCalibrationRatio(ratio);
    setRealDistanceMm("");
    alert(`Calibrazione completata! (Ratio: ${ratio.toFixed(4)} mm/px)`);
  };

  return (
    <>
      {/* Floating Toolbar in Basso al Centro */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 p-2 rounded-2xl bg-[hsl(220_32%_10%/0.9)] backdrop-blur-md border border-[hsl(220_20%_22%)] shadow-2xl z-50">
        
        {/* Upload Planimetria */}
        <div className="relative group">
          <label
            htmlFor="upload-plan"
            className="flex items-center justify-center w-10 h-10 rounded-xl cursor-pointer hover:bg-[hsl(220_20%_22%)] transition-colors text-white relative overflow-hidden"
            title="Carica Planimetria (PDF/PNG/JPG)"
          >
            {isProcessingFile ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              "🗺️"
            )}
          </label>
          <input
            id="upload-plan"
            type="file"
            accept="image/png, image/jpeg, application/pdf"
            className="hidden"
            onChange={handleImageUpload}
          />
        </div>

        <div className="w-px h-6 bg-[hsl(220_20%_22%)] mx-1" />

        {/* Tools */}
        <button
          onClick={() => setActiveTool("select")}
          className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${
            activeTool === "select"
              ? "bg-[hsl(220_90%_56%/0.2)] text-[hsl(220_90%_65%)]"
              : "text-[hsl(215_20%_65%)] hover:bg-[hsl(220_20%_22%)] hover:text-white"
          }`}
          title="Seleziona (V)"
        >
          ↖
        </button>

        <button
          onClick={() => setActiveTool("pan")}
          className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${
            activeTool === "pan"
              ? "bg-[hsl(220_90%_56%/0.2)] text-[hsl(220_90%_65%)]"
              : "text-[hsl(215_20%_65%)] hover:bg-[hsl(220_20%_22%)] hover:text-white"
          }`}
          title="Pan / Muovi (H)"
        >
          ✋
        </button>

        <button
          onClick={() => setActiveTool("calibrate")}
          className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${
            activeTool === "calibrate"
              ? "bg-[hsl(16_100%_58%/0.2)] text-[hsl(16_100%_58%)]"
              : "text-[hsl(215_20%_65%)] hover:bg-[hsl(220_20%_22%)] hover:text-white"
          }`}
          title="Strumento Calibrazione (Clicca 2 punti)"
        >
          📏
        </button>

        {calibrationRatio != null && (
          <div className="ml-3 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[hsl(142_71%_45%/0.1)] text-[hsl(142_71%_45%)] border border-[hsl(142_71%_45%/0.2)]">
            Scala attiva
          </div>
        )}
      </div>

      {/* Modal di Calibrazione (Appare se ci sono 2 punti!) */}
      {activeTool === "calibrate" && calibrationPoints.length === 2 && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] p-6 rounded-2xl bg-[hsl(220_26%_14%)] border border-[hsl(220_20%_22%)] shadow-2xl z-50 animate-fade-in">
          <h3 className="text-lg font-bold text-white mb-2">Imposta la Scala</h3>
          <p className="text-sm text-[hsl(215_20%_65%)] mb-5">
            Hai selezionato un segmento. Quanto è lungo questo segmento nella realtà (in mm)?
          </p>
          
          <input
            autoFocus
            type="number"
            placeholder="es. 1500 (mm)"
            value={realDistanceMm}
            onChange={(e) => setRealDistanceMm(e.target.value)}
            className="w-full px-4 py-3 bg-[hsl(228_39%_8%)] border border-[hsl(220_20%_22%)] rounded-xl text-white mb-5 focus:outline-none focus:border-[hsl(16_100%_58%)]"
          />

          <div className="flex gap-3">
            <button
              onClick={() => {
                resetCalibrationPoints();
                setRealDistanceMm("");
              }}
              className="flex-1 py-2 text-sm font-medium text-[hsl(215_20%_65%)] hover:bg-[hsl(220_20%_22%)] rounded-xl transition-colors"
            >
              Riprova Punti
            </button>
            <button
              onClick={handleCalibrationSave}
              className="flex-1 py-2 text-sm font-semibold text-white bg-gradient-to-br from-[hsl(16_100%_58%)] to-[hsl(0_84%_60%)] rounded-xl opacity-90 hover:opacity-100 transition-opacity"
            >
              Calibra
            </button>
          </div>
        </div>
      )}

      {/* Modal Multi-Pagina PDF */}
      {pendingPdf && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] p-6 rounded-2xl bg-[hsl(220_26%_14%)] border border-[hsl(220_20%_22%)] shadow-2xl z-50 animate-fade-in">
          <h3 className="text-lg font-bold text-white mb-2">PDF Multi-pagina</h3>
          <p className="text-sm text-[hsl(215_20%_65%)] mb-5">
            Questo documento contiene {pendingPdf.numPages} pagine. Quale desideri caricare?
          </p>
          
          <input
            autoFocus
            type="number"
            min={1}
            max={pendingPdf.numPages}
            value={selectedPdfPage}
            onChange={(e) => {
              let val = parseInt(e.target.value);
              if (isNaN(val)) val = 1;
              if (val < 1) val = 1;
              if (val > pendingPdf.numPages) val = pendingPdf.numPages;
              setSelectedPdfPage(val);
            }}
            className="w-full px-4 py-3 bg-[hsl(228_39%_8%)] border border-[hsl(220_20%_22%)] rounded-xl text-white mb-5 focus:outline-none focus:border-[hsl(220_90%_65%)]"
          />

          <div className="flex gap-3">
            <button
              onClick={() => {
                setPendingPdf(null);
              }}
              className="flex-1 py-2 text-sm font-medium text-[hsl(215_20%_65%)] hover:bg-[hsl(220_20%_22%)] rounded-xl transition-colors"
            >
              Annulla
            </button>
            <button
              onClick={() => renderPdfPageToCanvas(pendingPdf, selectedPdfPage)}
              className="flex-1 py-2 text-sm font-semibold text-white bg-gradient-to-br from-[hsl(220_90%_56%)] to-[hsl(220_90%_65%)] rounded-xl opacity-90 hover:opacity-100 transition-opacity"
            >
              Carica
            </button>
          </div>
        </div>
      )}
    </>
  );
}
