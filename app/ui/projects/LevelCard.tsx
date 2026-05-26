"use client";

import { useState } from "react";
import Link from "next/link";
import { updateLevelDetails, deleteLevel } from "@/app/actions/projects";
import CreateDrawingModal from "./CreateDrawingModal";

interface Drawing {
  id: string;
  project_id: string;
  name: string;
  elevation_z: number;
  drawing_type?: "2d_wall" | "3d_box";
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

  const handleEditSubmit = async (name: string, elevationZ: number, drawingType: "2d_wall" | "3d_box") => {
    // Al momento updateLevelDetails rinomina solo, estendiamolo implicitamente per supportare il tipo se necessario
    await updateLevelDetails(drawing.id, drawing.project_id, name, elevationZ);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (confirm(`Sei sicuro di voler eliminare il disegno "${drawing.name}" e tutti i suoi dati associati?`)) {
      await deleteLevel(drawing.id, drawing.project_id);
    }
  };

  const is3D = drawing.drawing_type === "3d_box";

  return (
    <>
      <div
        className="relative flex flex-col rounded-2xl p-5 transition-all duration-200 group"
        style={{
          background: "hsl(220 26% 14%)",
          border: "1px solid hsl(220 20% 20%)",
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLDivElement).style.borderColor = is3D ? "hsl(24 100% 50%)" : "hsl(220 90% 56%)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.3)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "hsl(220 20% 20%)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
        }}
      >
        <div className="flex justify-between items-start mb-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-bold"
            style={{ 
              background: is3D 
                ? "linear-gradient(135deg, hsl(24 100% 58%), hsl(0 84% 55%))" 
                : "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))" 
            }}
          >
            {is3D ? "📦" : "📏"}
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
                title="Copia disegno"
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

        <div className="text-white font-semibold text-base truncate" title={drawing.name}>
          {drawing.name}
        </div>
        
        <div className="text-xs mt-1" style={{ color: "hsl(215 15% 45%)" }}>
          {is3D ? "Cavedio 3D Parametrico" : `Parete 2D (Elev. Z: ${drawing.elevation_z})`}
        </div>

        <div className="text-[11px] mt-1" style={{ color: "hsl(215 15% 35%)" }}>
          Creato: {formatDate(drawing.created_at)}
        </div>

        <div className="mt-4 border-t pt-4" style={{ borderColor: "hsl(220 20% 20%)" }}>
           <div className="flex gap-2">
              {is3D ? (
                <Link
                  href={`/projects/${drawing.project_id}/editor-3d?levelId=${drawing.id}`}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold text-white transition-all shadow-[0_4px_16px_hsl(24_100%_50%/_0.2)] hover:opacity-90"
                  style={{
                    background: "linear-gradient(135deg, hsl(24 100% 50%), hsl(0 84% 50%))",
                  }}
                >
                  🧊 Editor 3D
                </Link>
              ) : (
                <Link
                  href={`/projects/${drawing.project_id}/editor?levelId=${drawing.id}`}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold text-white transition-all shadow-[0_4px_16px_hsl(220_90%_56%/_0.2)] hover:opacity-90"
                  style={{
                    background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
                  }}
                >
                  📐 Editor 2D
                </Link>
              )}
              <Link
                href={`/projects/${drawing.project_id}/levels/${drawing.id}/appunti`}
                className="px-3 flex items-center justify-center rounded-xl text-xs font-semibold text-white transition-colors hover:bg-white/10"
                style={{
                  border: "1px solid hsl(220 20% 24%)",
                  background: "hsl(220 26% 18%)",
                }}
                title="Appunti e Note"
              >
                📋
              </Link>
           </div>
        </div>
      </div>

      {isEditing && (
        <CreateDrawingModal
          title="Modifica Disegno"
          submitLabel="Salva"
          defaultName={drawing.name}
          defaultElevation={drawing.elevation_z}
          defaultType={drawing.drawing_type || "2d_wall"}
          onClose={() => setIsEditing(false)}
          onSubmit={handleEditSubmit}
        />
      )}
    </>
  );
}
