"use client";

import { useEffect, useState, useMemo, useTransition } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Center } from "@react-three/drei";
import { useProjectStore } from "@/lib/stores/project-store";
import { useCanvasStore, PIXELS_TO_MM } from "@/lib/stores/canvas-store";
import { saveWalls } from "@/app/actions/projects";
import DrawingNotesSidebar from "./DrawingNotesSidebar";
import Link from "next/link";
import * as THREE from "three";

interface Props {
  projectId: string;
}

export default function Canvas3DWorkspace({ projectId }: Props) {
  const [isPending, startTransition] = useTransition();
  const { activeLevelId } = useProjectStore();

  // Dati dallo store canvas
  const {
    walls,
    globalExtrusionLength,
    setGlobalExtrusionLength,
    selectedWallId,
    setSelectedWallId,
    hasUnsavedChanges,
    setHasUnsavedChanges
  } = useCanvasStore();

  // Appunti Sidebar
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [materials, setMaterials] = useState<any[]>([]);

  // Caricamento dei materiali dal database per associare i nomi
  useEffect(() => {
    const loadMaterials = async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data } = await supabase.from("materials").select("id,name,category,thickness_mm").eq("is_active", true);
      setMaterials(data ?? []);
    };
    loadMaterials();
  }, []);

  // Salva le lastre su Supabase
  const handleSave3D = () => {
    if (!activeLevelId) return;
    startTransition(async () => {
      const res = await saveWalls(activeLevelId, projectId, walls);
      if (res.success) {
        setHasUnsavedChanges(false);
        alert("Modello salvato con successo nel database! ✓");
      } else {
        alert("Errore durante il salvataggio.");
      }
    });
  };

  // Calcola la distinta dei pannelli da tagliare
  const panelCuts = useMemo(() => {
    return walls.map((w) => {
      const dx = w.x2 - w.x1;
      const dy = w.y2 - w.y1;
      const lengthMm = Math.round(Math.hypot(dx, dy) * PIXELS_TO_MM);
      const mat = materials.find((m) => m.id === w.materialId);
      const materialName = mat ? mat.name : "Lastra Standard";

      return {
        id: w.id,
        materialName,
        thickness: w.thickness,
        length: lengthMm, // Larghezza del pannello nel 2D
        extrusion: globalExtrusionLength, // Lunghezza di estrusione
        areaSqm: (lengthMm * globalExtrusionLength) / 1000000
      };
    });
  }, [walls, globalExtrusionLength, materials]);

  // Calcola i metri quadrati totali delle lastre
  const totalSqm = useMemo(() => {
    return panelCuts.reduce((acc, p) => acc + p.areaSqm, 0);
  }, [panelCuts]);

  return (
    <div className="w-full h-full bg-[hsl(228_39%_6%)] flex relative">
      
      {/* ── Scena 3D Canvas (Three.js) ── */}
      <div className="flex-1 h-full relative cursor-grab active:cursor-grabbing">
        <Canvas camera={{ position: [0.8, 1.2, 1.8], fov: 45 }}>
          <color attach="background" args={["#08090d"]} />
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 15, 10]} intensity={1.2} castShadow />
          <directionalLight position={[-10, 5, -10]} intensity={0.4} />

          <Center>
            {/* Griglia di riferimento alla base */}
            <gridHelper args={[6, 12, "#1e293b", "#0f172a"]} position={[0, -0.4, 0]} />

            <group>
              {/* Rendering dinamico delle Lastre estruse */}
              {walls.map((wall) => {
                const dx = wall.x2 - wall.x1;
                const dy = wall.y2 - wall.y1;
                const lenPx = Math.sqrt(dx * dx + dy * dy);
                if (lenPx === 0) return null;

                const lenM = (lenPx * PIXELS_TO_MM) / 1000;
                const thickM = wall.thickness / 1000;
                const extM = globalExtrusionLength / 1000;

                // Angolo nel piano XY (in Konva l'asse Y cresce verso il basso, invertiamo dy per Three.js)
                const angle = Math.atan2(-dy, dx);

                // Punto medio (scalato e centrato)
                // Centriamo la vista dividendo per 100 per mantenere il rendering ad una scala Three.js ottimale
                let mx = ((wall.x1 + wall.x2) / 2 * PIXELS_TO_MM) / 1000;
                let my = (-(wall.y1 + wall.y2) / 2 * PIXELS_TO_MM) / 1000;

                // Applica l'offset laterale dello spessore
                const offsetSide = wall.offsetSide || "left";
                if (offsetSide !== "center") {
                  const nx = -Math.sin(angle);
                  const ny = Math.cos(angle);
                  const mult = offsetSide === "left" ? 1 : -1;
                  mx += (thickM / 2) * nx * mult;
                  my += (thickM / 2) * ny * mult;
                }

                const isSel = wall.id === selectedWallId;

                return (
                  <group key={wall.id} position={[mx, my, 0]} rotation={[0, 0, angle]}>
                    <mesh 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedWallId(wall.id);
                      }}
                    >
                      <boxGeometry args={[lenM, thickM, extM]} />
                      <meshStandardMaterial 
                        color={isSel ? "#3b82f6" : "#cbd5e1"} 
                        transparent 
                        opacity={0.8} 
                        roughness={0.4} 
                        metalness={0.1}
                      />
                    </mesh>
                    
                    {/* Bordi evidenziati della lastra */}
                    <lineSegments>
                      <edgesGeometry attach="geometry" args={[new THREE.BoxGeometry(lenM, thickM, extM)]} />
                      <lineBasicMaterial color={isSel ? "#60a5fa" : "#475569"} linewidth={isSel ? 2 : 1} />
                    </lineSegments>
                  </group>
                );
              })}
            </group>
          </Center>

          <OrbitControls enablePan={true} enableZoom={true} />
        </Canvas>

        {/* Informazioni d'uso 3D in sovraimpressione */}
        <div className="absolute top-4 left-4 pointer-events-none z-10">
          <div className="text-white text-xs font-semibold bg-[hsl(220_32%_10%/0.85)] px-3 py-2 rounded-xl border border-white/5 backdrop-blur-md">
            🖱️ Trascina per Ruotare | 🖱️ Click Destro per Spostare | 📜 Zoom
          </div>
        </div>
      </div>

      {/* ── Pannello Configurazione Parametri 3D (Laterale Destra) ── */}
      <div
        className="w-80 border-l p-5 flex flex-col gap-5 overflow-y-auto scrollbar-thin"
        style={{
          background: "hsl(220 26% 12% / 0.95)",
          borderColor: "hsl(220 20% 22%)",
          backdropFilter: "blur(10px)",
        }}
      >
        <div className="border-b pb-3" style={{ borderColor: "hsl(220 20% 20%)" }}>
          <h3 className="font-bold text-white text-xs uppercase tracking-wider">
            Parametri Cassonetto 3D
          </h3>
          <p className="text-[10px] mt-1" style={{ color: "hsl(215 15% 45%)" }}>
            Configura la lunghezza complessiva ed esamina la distinta di taglio.
          </p>
        </div>

        <div className="flex flex-col gap-4 flex-1">
          <div>
            <label className="text-[10px] font-semibold text-gray-400 block mb-1.5 uppercase tracking-wider">
              Lunghezza di Estrusione Globale (mm)
            </label>
            <input
              type="number"
              value={globalExtrusionLength}
              onChange={(e) => setGlobalExtrusionLength(Math.max(100, parseInt(e.target.value, 10) || 0))}
              className="w-full bg-[hsl(220_32%_8%)] border border-[hsl(220_20%_20%)] text-white text-xs px-3 py-2 rounded-xl focus:border-blue-500 outline-none"
            />
          </div>

          <div className="border-t pt-4" style={{ borderColor: "hsl(220 20% 20%)" }}>
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2.5">
              ✂️ Distinta Taglio Lastre
            </h4>
            {panelCuts.length === 0 ? (
              <p className="text-[11px] text-gray-500 italic py-2">Nessuna lastra disegnata in 2D. Disegna una faccia per iniziare.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
                {panelCuts.map((cut, idx) => (
                  <div key={cut.id} className="p-2.5 rounded-lg bg-[hsl(220_32%_8%)] border border-white/5 flex flex-col gap-0.5">
                    <div className="flex justify-between items-center text-[10px] font-semibold text-white">
                      <span>Faccia #{idx + 1}</span>
                      <span className="text-[9px] text-gray-500">sp. {cut.thickness}mm</span>
                    </div>
                    <div className="text-[11px] text-orange-400 font-mono mt-0.5">
                      {cut.extrusion} x {cut.length} mm
                    </div>
                    <div className="text-[9px] text-gray-400 mt-0.5">
                      {cut.materialName} ({cut.areaSqm.toFixed(2)} m²)
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {panelCuts.length > 0 && (
            <div className="border-t pt-3 mt-1" style={{ borderColor: "hsl(220 20% 20%)" }}>
              <div className="text-[11px] text-gray-400 flex justify-between font-semibold">
                <span>Lastre Totali:</span>
                <span className="text-white font-bold">{walls.length} pezzi</span>
              </div>
              <div className="text-[11px] text-gray-400 flex justify-between mt-1 font-semibold">
                <span>Superficie Totale lastre:</span>
                <span className="text-green-400 font-bold">{totalSqm.toFixed(2)} m²</span>
              </div>
            </div>
          )}
        </div>

        {/* Pulsanti Azioni */}
        <div className="flex flex-col gap-2 mt-auto pt-4 border-t" style={{ borderColor: "hsl(220 20% 20%)" }}>
          <button
            onClick={() => setIsNotesOpen(true)}
            className="w-full py-2 rounded-xl text-[11px] font-semibold text-[hsl(215_20%_75%)] hover:bg-white/5 border border-white/10 transition-colors cursor-pointer text-center"
          >
            📋 Appunti Cantiere
          </button>

          <Link
            href={`/projects/${projectId}/report`}
            className="w-full py-2 rounded-xl text-[11px] font-semibold text-white bg-green-600 hover:bg-green-700 text-center transition-colors shadow-lg cursor-pointer"
          >
            🖨️ Report Stampabile
          </Link>

          <button
            onClick={handleSave3D}
            disabled={isPending || !hasUnsavedChanges}
            className="w-full py-2.5 rounded-xl text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg cursor-pointer"
          >
            {isPending ? "Salvataggio..." : "Salva nel Cloud ✓"}
          </button>
        </div>
      </div>

      {/* Sidebar Note */}
      {activeLevelId && (
        <DrawingNotesSidebar
          levelId={activeLevelId}
          isOpen={isNotesOpen}
          onClose={() => setIsNotesOpen(false)}
        />
      )}
    </div>
  );
}
