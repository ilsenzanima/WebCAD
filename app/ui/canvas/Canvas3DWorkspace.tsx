"use client";

import { useEffect, useState, useTransition } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Center } from "@react-three/drei";
import { useProjectStore } from "@/lib/stores/project-store";
import { save3DBox, get3DBox } from "@/app/actions/projects";
import DrawingNotesSidebar from "./DrawingNotesSidebar";
import Link from "next/link";

interface Props {
  projectId: string;
}

export default function Canvas3DWorkspace({ projectId }: Props) {
  const [isPending, startTransition] = useTransition();
  const { activeLevelId } = useProjectStore();

  // Parametri geometrici della scatola 3D (in mm)
  const [width, setWidth] = useState(1000); // W
  const [height, setHeight] = useState(2000); // H
  const [depth, setDepth] = useState(1000); // D
  const [thickness, setThickness] = useState(15); // spessore lastre

  // Appunti Sidebar
  const [isNotesOpen, setIsNotesOpen] = useState(false);

  // Caricamento dei dati dal database all'avvio
  useEffect(() => {
    if (!activeLevelId) return;
    startTransition(async () => {
      const box = await get3DBox(activeLevelId);
      if (box) {
        setWidth(box.w);
        setHeight(box.h);
        setDepth(box.d);
        setThickness(box.thickness);
      }
    });
  }, [activeLevelId]);


  // Salva il cavedio 3D su Supabase
  const handleSave3D = () => {
    if (!activeLevelId) return;
    startTransition(async () => {
      const res = await save3DBox(activeLevelId, projectId, {
        w: width,
        h: height,
        d: depth,
        thickness,
      });
      if (res.success) {
        alert("Modello 3D salvato con successo! ✓");
      } else {
        alert("Errore durante il salvataggio.");
      }
    });
  };

  // Converti le dimensioni in metri per Three.js
  const w_m = width / 1000;
  const h_m = height / 1000;
  const d_m = depth / 1000;
  const t_m = thickness / 1000; // spessore lastre in metri
  const p_m = 0.05; // spessore profilo angolare metallico (50 mm = 5 cm)

  return (
    <div className="w-full h-full bg-[hsl(228_39%_6%)] flex relative">
      
      {/* ── Scena 3D Canvas (Three.js) ── */}
      <div className="flex-1 h-full relative cursor-grab active:cursor-grabbing">
        <Canvas camera={{ position: [2.5, 2.5, 2.5], fov: 50 }}>
          <color attach="background" args={["#08090d"]} />
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 15, 10]} intensity={1.2} castShadow />
          <directionalLight position={[-10, 5, -10]} intensity={0.4} />

          <Center>
            {/* Griglia alla base del cavedio */}
            <gridHelper args={[10, 10, "#1e293b", "#0f172a"]} position={[0, -h_m / 2, 0]} />

            {/* ── RENDERING DEL CAVEDIO/SCATOLA PARAMETRICA ── */}
            <group>
              
              {/* 1. LASTRE DI RIVESTIMENTO (Semitrasparenti) */}
              {/* Lastra Frontale */}
              <mesh position={[0, 0, d_m / 2 + t_m / 2]}>
                <boxGeometry args={[w_m + t_m * 2, h_m, t_m]} />
                <meshStandardMaterial color="hsl(215, 30%, 75%)" transparent opacity={0.65} roughness={0.4} />
              </mesh>
              {/* Lastra Posteriore */}
              <mesh position={[0, 0, -(d_m / 2 + t_m / 2)]}>
                <boxGeometry args={[w_m + t_m * 2, h_m, t_m]} />
                <meshStandardMaterial color="hsl(215, 30%, 75%)" transparent opacity={0.65} roughness={0.4} />
              </mesh>
              {/* Lastra Sinistra */}
              <mesh position={[-(w_m / 2 + t_m / 2), 0, 0]}>
                <boxGeometry args={[t_m, h_m, d_m]} />
                <meshStandardMaterial color="hsl(215, 30%, 75%)" transparent opacity={0.65} roughness={0.4} />
              </mesh>
              {/* Lastra Destra */}
              <mesh position={[w_m / 2 + t_m / 2, 0, 0]}>
                <boxGeometry args={[t_m, h_m, d_m]} />
                <meshStandardMaterial color="hsl(215, 30%, 75%)" transparent opacity={0.65} roughness={0.4} />
              </mesh>
              {/* Lastra Superiore */}
              <mesh position={[0, h_m / 2 + t_m / 2, 0]}>
                <boxGeometry args={[w_m + t_m * 2, t_m, d_m + t_m * 2]} />
                <meshStandardMaterial color="hsl(215, 30%, 75%)" transparent opacity={0.65} roughness={0.4} />
              </mesh>
              {/* Lastra Inferiore */}
              <mesh position={[0, -(h_m / 2 + t_m / 2), 0]}>
                <boxGeometry args={[w_m + t_m * 2, t_m, d_m + t_m * 2]} />
                <meshStandardMaterial color="hsl(215, 30%, 75%)" transparent opacity={0.65} roughness={0.4} />
              </mesh>


              {/* 2. PROFILI ANGOLARI METALLICI DI SUPPORTO (Interni) */}
              {/* 4 Montanti Verticali di spigolo */}
              <mesh position={[-(w_m / 2 - p_m / 2), 0, d_m / 2 - p_m / 2]}>
                <boxGeometry args={[p_m, h_m - p_m * 2, p_m]} />
                <meshStandardMaterial color="hsl(16, 100%, 58%)" metalness={0.8} roughness={0.2} />
              </mesh>
              <mesh position={[w_m / 2 - p_m / 2, 0, d_m / 2 - p_m / 2]}>
                <boxGeometry args={[p_m, h_m - p_m * 2, p_m]} />
                <meshStandardMaterial color="hsl(16, 100%, 58%)" metalness={0.8} roughness={0.2} />
              </mesh>
              <mesh position={[-(w_m / 2 - p_m / 2), 0, -(d_m / 2 - p_m / 2)]}>
                <boxGeometry args={[p_m, h_m - p_m * 2, p_m]} />
                <meshStandardMaterial color="hsl(16, 100%, 58%)" metalness={0.8} roughness={0.2} />
              </mesh>
              <mesh position={[w_m / 2 - p_m / 2, 0, -(d_m / 2 - p_m / 2)]}>
                <boxGeometry args={[p_m, h_m - p_m * 2, p_m]} />
                <meshStandardMaterial color="hsl(16, 100%, 58%)" metalness={0.8} roughness={0.2} />
              </mesh>

              {/* 4 Profili Orizzontali Inferiori */}
              <mesh position={[0, -(h_m / 2 - p_m / 2), d_m / 2 - p_m / 2]}>
                <boxGeometry args={[w_m - p_m * 2, p_m, p_m]} />
                <meshStandardMaterial color="hsl(215, 20%, 50%)" metalness={0.8} roughness={0.2} />
              </mesh>
              <mesh position={[0, -(h_m / 2 - p_m / 2), -(d_m / 2 - p_m / 2)]}>
                <boxGeometry args={[w_m - p_m * 2, p_m, p_m]} />
                <meshStandardMaterial color="hsl(215, 20%, 50%)" metalness={0.8} roughness={0.2} />
              </mesh>
              <mesh position={[-(w_m / 2 - p_m / 2), -(h_m / 2 - p_m / 2), 0]}>
                <boxGeometry args={[p_m, p_m, d_m - p_m * 2]} />
                <meshStandardMaterial color="hsl(215, 20%, 50%)" metalness={0.8} roughness={0.2} />
              </mesh>
              <mesh position={[w_m / 2 - p_m / 2, -(h_m / 2 - p_m / 2), 0]}>
                <boxGeometry args={[p_m, p_m, d_m - p_m * 2]} />
                <meshStandardMaterial color="hsl(215, 20%, 50%)" metalness={0.8} roughness={0.2} />
              </mesh>

              {/* 4 Profili Orizzontali Superiori */}
              <mesh position={[0, h_m / 2 - p_m / 2, d_m / 2 - p_m / 2]}>
                <boxGeometry args={[w_m - p_m * 2, p_m, p_m]} />
                <meshStandardMaterial color="hsl(215, 20%, 50%)" metalness={0.8} roughness={0.2} />
              </mesh>
              <mesh position={[0, h_m / 2 - p_m / 2, -(d_m / 2 - p_m / 2)]}>
                <boxGeometry args={[w_m - p_m * 2, p_m, p_m]} />
                <meshStandardMaterial color="hsl(215, 20%, 50%)" metalness={0.8} roughness={0.2} />
              </mesh>
              <mesh position={[-(w_m / 2 - p_m / 2), h_m / 2 - p_m / 2, 0]}>
                <boxGeometry args={[p_m, p_m, d_m - p_m * 2]} />
                <meshStandardMaterial color="hsl(215, 20%, 50%)" metalness={0.8} roughness={0.2} />
              </mesh>
              <mesh position={[w_m / 2 - p_m / 2, h_m / 2 - p_m / 2, 0]}>
                <boxGeometry args={[p_m, p_m, d_m - p_m * 2]} />
                <meshStandardMaterial color="hsl(215, 20%, 50%)" metalness={0.8} roughness={0.2} />
              </mesh>

            </group>
          </Center>

          <OrbitControls enablePan={true} enableZoom={true} />
        </Canvas>

        {/* Informazioni d'uso 3D in sovraimpressione */}
        <div className="absolute top-16 left-6 pointer-events-none">
          <div className="text-white text-sm font-semibold bg-[hsl(220_32%_10%/0.8)] px-3 py-1.5 rounded-lg border border-white/5 backdrop-blur">
            🖱️ Trascina per Ruotare | 🖱️ Click Destro per Spostare | 📜 Rotellina per Zoom
          </div>
        </div>
      </div>

      {/* ── Pannello Configurazione Parametri 3D (Laterale Destra) ── */}
      <div
        className="w-80 border-l p-6 flex flex-col gap-6"
        style={{
          background: "hsl(220 26% 12% / 0.95)",
          borderColor: "hsl(220 20% 22%)",
          backdropFilter: "blur(10px)",
        }}
      >
        <div className="border-b pb-3" style={{ borderColor: "hsl(220 20% 20%)" }}>
          <h3 className="font-bold text-white text-base uppercase tracking-wider">
            Parametri Cavedio 3D
          </h3>
          <p className="text-xs mt-1" style={{ color: "hsl(215 15% 45%)" }}>
            Configura le dimensioni reali del cavedio o scatola protettiva in mm.
          </p>
        </div>

        <div className="flex flex-col gap-4 flex-1">
          <div>
            <label className="text-[11px] font-semibold text-gray-400 block mb-1.5 uppercase tracking-wider">
              Larghezza W (mm)
            </label>
            <input
              type="number"
              value={width}
              onChange={(e) => setWidth(Math.max(100, parseInt(e.target.value, 10) || 0))}
              className="w-full bg-[hsl(220_32%_8%)] border border-[hsl(220_20%_20%)] text-white text-sm px-3.5 py-2.5 rounded-xl focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-gray-400 block mb-1.5 uppercase tracking-wider">
              Altezza H (mm)
            </label>
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(Math.max(100, parseInt(e.target.value, 10) || 0))}
              className="w-full bg-[hsl(220_32%_8%)] border border-[hsl(220_20%_20%)] text-white text-sm px-3.5 py-2.5 rounded-xl focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-gray-400 block mb-1.5 uppercase tracking-wider">
              Profondità D (mm)
            </label>
            <input
              type="number"
              value={depth}
              onChange={(e) => setDepth(Math.max(100, parseInt(e.target.value, 10) || 0))}
              className="w-full bg-[hsl(220_32%_8%)] border border-[hsl(220_20%_20%)] text-white text-sm px-3.5 py-2.5 rounded-xl focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-gray-400 block mb-1.5 uppercase tracking-wider">
              Spessore Lastra (mm)
            </label>
            <input
              type="number"
              value={thickness}
              onChange={(e) => setThickness(Math.max(5, parseInt(e.target.value, 10) || 0))}
              className="w-full bg-[hsl(220_32%_8%)] border border-[hsl(220_20%_20%)] text-white text-sm px-3.5 py-2.5 rounded-xl focus:border-blue-500 outline-none"
            />
          </div>
          
          <div className="border-t pt-4 mt-2" style={{ borderColor: "hsl(220 20% 20%)" }}>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Sfrido & Tagli Stimati
            </h4>
            <div className="text-xs text-gray-400 flex justify-between">
              <span>Lastre totali (6 facce):</span>
              <span className="font-semibold text-white">6 pezzi</span>
            </div>
            <div className="text-xs text-gray-400 flex justify-between mt-1.5">
              <span>Profili angolari (12 spigoli):</span>
              <span className="font-semibold text-orange-400">12 pezzi</span>
            </div>
          </div>
        </div>

        {/* Pulsanti Azioni */}
        <div className="flex flex-col gap-2 mt-auto">
          <button
            onClick={() => setIsNotesOpen(true)}
            className="w-full py-2.5 rounded-xl text-xs font-semibold text-[hsl(215_20%_75%)] hover:bg-white/5 border border-white/10 transition-colors cursor-pointer text-center"
          >
            📋 Leggi Appunti Progetto
          </button>

          <Link
            href={`/projects/${projectId}/report`}
            className="w-full py-2.5 rounded-xl text-xs font-semibold text-white bg-green-600 hover:bg-green-700 text-center transition-colors shadow-lg cursor-pointer"
          >
            🖨️ Vai al Report Stampabile
          </Link>

          <button
            onClick={handleSave3D}
            disabled={isPending}
            className="w-full py-3 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg cursor-pointer"
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
