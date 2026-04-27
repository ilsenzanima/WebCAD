"use client";

import { useState } from "react";
import Link from "next/link";
import { updateLevelDetails, deleteLevel, updateLevelMetadata } from "@/app/actions/projects";
import CreateDrawingModal from "./CreateDrawingModal";
import CalibrationModal from "./CalibrationModal";
import { createClient } from "@/lib/supabase/client";
import * as pdfjsLib from "pdfjs-dist";

if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

interface Drawing {
  id: string;
  project_id: string;
  name: string;
  elevation_z: number;
  scale_ratio?: number | null;
  plan_image_url?: string | null;
  created_at: string;
}

interface Props {
  drawing: Drawing;
  gradient: string;
  onAddLevel: (refDrawing: Drawing) => void;
  formatDate: (date?: string | null) => string;
}

export default function LevelCard({ drawing, gradient, onAddLevel, formatDate }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  const handleEditSubmit = async (name: string, elevationZ: number) => {
    await updateLevelDetails(drawing.id, drawing.project_id, name, elevationZ);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (confirm(`Sei sicuro di voler eliminare il piano "${drawing.name}" e tutti i suoi dati associati?`)) {
      await deleteLevel(drawing.id, drawing.project_id);
    }
  };

  const handleSaveCalibration = async (ratio: number) => {
    await updateLevelMetadata(drawing.id, drawing.project_id, { scale_ratio: ratio });
    setIsCalibrating(false);
  };

  const uploadToStorage = async (file: Blob, fileName: string) => {
    const supabase = createClient();
    const { data, error } = await supabase.storage.from("plans").upload(fileName, file, { upsert: true });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from("plans").getPublicUrl(data.path);
    return publicUrl;
  };

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
          const page = await pdf.getPage(1);
          const scale = 4.0;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (!context) throw new Error("2D Context not found");
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          // @ts-expect-error Type mismatch with older typings
          await page.render({ canvasContext: context, viewport }).promise;
          
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          
          const arr = dataUrl.split(",");
          const mime = arr[0].match(/:(.*?);/)?.[1];
          const bstr = atob(arr[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) u8arr[n] = bstr.charCodeAt(n);
          const blob = new Blob([u8arr], { type: mime });

          const fileName = `plans/${drawing.id}_${Date.now()}.jpg`;
          const publicUrl = await uploadToStorage(blob, fileName);
          await updateLevelMetadata(drawing.id, drawing.project_id, { plan_image_url: publicUrl, scale_ratio: null });
        } catch (error) {
          console.error("Errore parser PDF:", error);
          alert("Impossibile elaborare il PDF.");
        } finally {
          setIsProcessingFile(false);
          if (e.target) e.target.value = "";
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    setIsProcessingFile(true);
    const fileName = `plans/${drawing.id}_${Date.now()}_${file.name}`;
    uploadToStorage(file, fileName).then(async (publicUrl) => {
      await updateLevelMetadata(drawing.id, drawing.project_id, { plan_image_url: publicUrl, scale_ratio: null });
    }).catch(err => {
      console.error(err);
      alert("Errore upload immagine.");
    }).finally(() => {
      setIsProcessingFile(false);
      e.target.value = "";
    });
  };

  return (
    <>
      <div
        className="relative flex flex-col rounded-2xl p-5 transition-all duration-200 group"
        style={{
          background: "hsl(220 26% 14%)",
          border: "1px solid hsl(220 20% 20%)",
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "hsl(220 90% 56%)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.3)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "hsl(220 20% 20%)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
        }}
      >
        <div className="flex justify-between items-start mb-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
            style={{ background: gradient }}
          >
            {drawing.elevation_z}
          </div>
          <div className="flex gap-1">
             <button
                title="Modifica Nome/Elevazione"
                onClick={() => setIsEditing(true)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:bg-white/10 hover:text-white transition-colors"
             >
                ✏️
             </button>
             <button
                title="Aggiungi Piano sopra/sotto copiando il nome"
                onClick={() => onAddLevel(drawing)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:bg-white/10 hover:text-white transition-colors"
             >
                ➕
             </button>
             <button
                title="Elimina"
                onClick={handleDelete}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-red-500/50 hover:bg-red-500/20 hover:text-red-500 transition-colors"
             >
                🗑️
             </button>
          </div>
        </div>

        <div className="text-white font-semibold text-lg truncate" title={drawing.name}>{drawing.name}</div>
        <div className="text-xs mt-1" style={{ color: "hsl(215 15% 45%)" }}>
          Creato il {formatDate(drawing.created_at)}
        </div>

        <div className="mt-4 space-y-2 border-t pt-4" style={{ borderColor: "hsl(220 20% 20%)" }}>
           <div className="flex gap-2">
             <div className="relative flex-1">
               <input
                 type="file"
                 accept="image/png, image/jpeg, application/pdf"
                 className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                 onChange={handleImageUpload}
                 title="Carica Planimetria"
               />
               <div className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 text-white transition-colors text-center border border-white/10">
                 {isProcessingFile ? "⏳..." : (drawing.plan_image_url ? "🗺️ Sostituisci" : "🗺️ Planimetria")}
               </div>
             </div>
             <button
               onClick={() => {
                 if (!drawing.plan_image_url) {
                   alert("Carica prima una planimetria per calibrarla!");
                   return;
                 }
                 setIsCalibrating(true);
               }}
               className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors border ${
                 drawing.scale_ratio
                   ? "bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20"
                   : "bg-white/5 text-white hover:bg-white/10 border-white/10"
               }`}
             >
               📏 {drawing.scale_ratio ? "Scala Attiva" : "Calibra"}
             </button>
           </div>

           <div className="flex gap-2">
              <Link
                href={`/projects/${drawing.project_id}/levels/${drawing.id}/appunti`}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-[hsl(220_32%_20%)] text-[hsl(215_20%_75%)] hover:bg-[hsl(220_32%_25%)] border border-[hsl(220_20%_26%)] transition-colors"
              >
                📋 Note
              </Link>
           </div>
           
           <div className="flex gap-2">
              <Link
                href={`/projects/${drawing.project_id}/editor?levelId=${drawing.id}`}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-white transition-colors shadow-[0_4px_16px_hsl(220_90%_56%/_0.2)]"
                style={{
                  background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
                }}
              >
                📐 Editor 2D
              </Link>
              <button
                disabled
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-white/5 text-white/40 cursor-not-allowed border border-white/5"
              >
                🧊 Editor 3D
              </button>
           </div>
        </div>
      </div>

      {isEditing && (
        <CreateDrawingModal
          title="Modifica Disegno"
          submitLabel="Salva"
          defaultName={drawing.name}
          defaultElevation={drawing.elevation_z}
          onClose={() => setIsEditing(false)}
          onSubmit={handleEditSubmit}
        />
      )}

      {isCalibrating && drawing.plan_image_url && (
        <CalibrationModal
          imageUrl={drawing.plan_image_url}
          onClose={() => setIsCalibrating(false)}
          onSave={handleSaveCalibration}
        />
      )}
    </>
  );
}
