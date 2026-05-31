"use client";

import { useState, useRef, useMemo } from "react";
import Link from "next/link";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, Center } from "@react-three/drei";
import * as THREE from "three";

// Componente interno per visualizzare la tubazione 3D solida tracciata
interface TubeMeshProps {
  points: [number, number, number][];
  diameter: number;
}

function TubeMesh({ points, diameter }: TubeMeshProps) {
  const radius = diameter / 2;

  // Costruisce la curva tridimensionale dai punti tracciati
  const tubeGeometry = useMemo(() => {
    if (points.length < 2) return null;

    const threePoints = points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    // Crea una curva spezzata lineare
    const curve = new THREE.CatmullRomCurve3(threePoints, false, "catmullrom", 0);
    
    // Genera la geometria del tubo: curve, tubularSegments, radius, radialSegments, closed
    return new THREE.TubeGeometry(curve, points.length * 8, radius, 12, false);
  }, [points, radius]);

  if (points.length < 2) {
    // Se c'è solo il punto iniziale, disegna una piccola sfera di partenza
    return (
      <mesh position={[points[0][0], points[0][1], points[0][2]]}>
        <sphereGeometry args={[radius * 1.5, 16, 16]} />
        <meshStandardMaterial color="#ef4444" roughness={0.2} metalness={0.8} />
      </mesh>
    );
  }

  return (
    <group>
      {/* 1. Il corpo tubolare della condotta */}
      {tubeGeometry && (
        <mesh geometry={tubeGeometry}>
          <meshStandardMaterial
            color="#94a3b8"
            roughness={0.3}
            metalness={0.8}
            envMapIntensity={1}
          />
        </mesh>
      )}

      {/* 2. Gomiti/Giunzioni sferiche in corrispondenza di ogni nodo di svolta */}
      {points.map((pt, idx) => {
        const isStart = idx === 0;
        const isEnd = idx === points.length - 1;
        return (
          <mesh key={idx} position={[pt[0], pt[1], pt[2]]}>
            <sphereGeometry args={[radius * 1.15, 16, 16]} />
            <meshStandardMaterial
              color={isStart ? "#10b981" : isEnd ? "#ef4444" : "#64748b"}
              roughness={0.2}
              metalness={0.8}
            />
          </mesh>
        );
      })}
    </group>
  );
}

// Visualizzatore degli assi cartesiani personalizzato 3D con frecce colorate
function CartesianAxes() {
  return (
    <group>
      {/* Asse X (Rosso) */}
      <mesh position={[150, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[1, 1, 300, 8]} />
        <meshBasicMaterial color="#ef4444" opacity={0.6} transparent />
      </mesh>
      {/* Asse Y (Verde) */}
      <mesh position={[0, 150, 0]}>
        <cylinderGeometry args={[1, 1, 300, 8]} />
        <meshBasicMaterial color="#22c55e" opacity={0.6} transparent />
      </mesh>
      {/* Asse Z (Blu) */}
      <mesh position={[0, 0, 150]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1, 1, 300, 8]} />
        <meshBasicMaterial color="#3b82f6" opacity={0.6} transparent />
      </mesh>
    </group>
  );
}

export default function ThreeDDesigner() {
  // Lista dei punti 3D tracciati (in centimetri reali)
  // Il punto di partenza è (0, 0, 0)
  const [points, setPoints] = useState<[number, number, number][]>([[0, 0, 0]]);
  const [length, setLength] = useState<number>(100); // Lunghezza segmento in cm
  const [diameter, setDiameter] = useState<number>(12); // Diametro del tubo in cm

  const lastPoint = points[points.length - 1];

  // Aggiunge un segmento in una specifica direzione cartesiana
  const addSegment = (dir: "+x" | "-x" | "+y" | "-y" | "+z" | "-z") => {
    if (length <= 0) return;

    let newX = lastPoint[0];
    let newY = lastPoint[1];
    let newZ = lastPoint[2];

    switch (dir) {
      case "+x":
        newX += length;
        break;
      case "-x":
        newX -= length;
        break;
      case "+y":
        newY += length;
        break;
      case "-y":
        newY -= length;
        break;
      case "+z":
        newZ += length;
        break;
      case "-z":
        newZ -= length;
        break;
    }

    setPoints((prev) => [...prev, [newX, newY, newZ]]);
  };

  // Rimuove l'ultimo segmento tracciato (Undo)
  const handleUndo = () => {
    if (points.length <= 1) return;
    setPoints((prev) => prev.slice(0, -1));
  };

  // Resetta il modellatore e riparte dall'origine
  const handleReset = () => {
    if (confirm("Vuoi azzerare il disegno 3D e ripartire dall'origine (0, 0, 0)?")) {
      setPoints([[0, 0, 0]]);
    }
  };

  // Calcola la distinta di taglio / lunghezze totali dei pezzi tracciati
  const segmentsList = useMemo(() => {
    const list = [];
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];
      const dz = p2[2] - p1[2];
      const len = Math.round(Math.sqrt(dx * dx + dy * dy + dz * dz));
      
      let dirText = "";
      if (dx !== 0) dirText = dx > 0 ? "Asse X (Destra)" : "Asse X (Sinistra)";
      else if (dy !== 0) dirText = dy > 0 ? "Asse Y (Su)" : "Asse Y (Giù)";
      else if (dz !== 0) dirText = dz > 0 ? "Asse Z (Indietro)" : "Asse Z (Avanti)";

      list.push({ id: i + 1, length: len, dir: dirText });
    }
    return list;
  }, [points]);

  return (
    <div className="h-[calc(100vh-60px)] md:h-screen w-full flex flex-col md:flex-row relative bg-[#090b11] overflow-hidden select-none">
      
      {/* 1. VISUALIZZATORE 3D (Canvas Three.js interattivo, occupa lo sfondo/sinistra) */}
      <div className="flex-1 w-full h-[50vh] md:h-full relative cursor-grab active:cursor-grabbing">
        {/* Intestazione Fluttuante */}
        <div className="absolute top-4 left-4 z-20 px-4 py-3 rounded-2xl border flex items-center gap-3 shadow-lg"
          style={{
            background: "hsl(220 35% 12% / 0.9)",
            backdropFilter: "blur(12px)",
            borderColor: "hsl(220 20% 16%)",
          }}>
          <Link href="/dashboard" className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 border border-white/5 text-white/80 hover:bg-white/10 transition-all text-xs">
            ⬅
          </Link>
          <div>
            <h2 className="text-white font-extrabold text-xs md:text-sm tracking-wide">
              Modellatore Condotte 3D (Test)
            </h2>
            <p className="text-[9px] text-white/50">Disegno cartesiano direzionale ad assi vincolati</p>
          </div>
        </div>

        {/* Canvas 3D */}
        <Canvas camera={{ position: [200, 200, 300], fov: 45 }}>
          <color attach="background" args={["#090b11"]} />
          <ambientLight intensity={0.7} />
          <pointLight position={[300, 300, 300]} intensity={1.5} />
          <directionalLight position={[-100, 200, 100]} intensity={0.8} />

          <Center>
            {/* Tubazione solida */}
            <TubeMesh points={points} diameter={diameter} />
            {/* Assi Cartesiani (X=Rosso, Y=Verde, Z=Blu) */}
            <CartesianAxes />
          </Center>

          {/* Griglia Tecnica di base */}
          <Grid
            renderOrder={-1}
            position={[0, -2, 0]}
            args={[500, 500]}
            cellSize={20}
            cellThickness={0.75}
            cellColor="#1e293b"
            sectionSize={100}
            sectionThickness={1.5}
            sectionColor="#38bdf8"
            fadeDistance={600}
            infiniteGrid
          />

          <OrbitControls makeDefault maxPolarAngle={Math.PI / 1.5} minDistance={100} maxDistance={800} />
        </Canvas>

        {/* Info Legenda Assi in basso a sinistra */}
        <div className="absolute bottom-4 left-4 z-20 p-3 rounded-xl border flex flex-col gap-1.5 text-[9px] font-semibold text-white/70"
          style={{
            background: "hsl(220 35% 12% / 0.8)",
            backdropFilter: "blur(12px)",
            borderColor: "hsl(220 20% 16%)",
          }}>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" /> X (Rosso) - Orizzontale
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e]" /> Y (Verde) - Verticale
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]" /> Z (Blu) - Profondità
          </div>
        </div>
      </div>

      {/* 2. PANNELLO CONTROLLI (Destra/Basso, per inserire misure e tracciare) */}
      <div className="w-full md:w-80 h-[50vh] md:h-full flex flex-col justify-between border-t md:border-t-0 md:border-l relative z-30 p-4 space-y-4"
        style={{
          background: "hsl(220 32% 8%)",
          borderColor: "hsl(220 20% 16%)",
        }}>
        
        {/* Sezione Input Misure */}
        <div className="space-y-4 flex-1 overflow-y-auto pr-1 scrollbar-thin">
          <div className="space-y-2">
            <label className="text-xs font-bold text-white/50 uppercase tracking-wider">Impostazioni Dimensioni</label>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
                <span className="text-[9px] text-white/40 block leading-none">Lunghezza Segmento (cm)</span>
                <input
                  type="number"
                  value={length}
                  onChange={(e) => setLength(Math.max(5, parseInt(e.target.value) || 0))}
                  className="w-full bg-transparent text-sm font-bold text-white outline-none border-b border-white/10 focus:border-blue-500 pt-1"
                />
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
                <span className="text-[9px] text-white/40 block leading-none">Diametro Tubo (cm)</span>
                <input
                  type="number"
                  value={diameter}
                  onChange={(e) => setDiameter(Math.max(2, parseInt(e.target.value) || 0))}
                  className="w-full bg-transparent text-sm font-bold text-white outline-none border-b border-white/10 focus:border-blue-500 pt-1"
                />
              </div>
            </div>
          </div>

          {/* Tastiera Direzionale 3D Cartesiana */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-white/50 uppercase tracking-wider">Tracciamento Condotta</label>
            <div className="grid grid-cols-3 gap-2">
              {/* Bottone X- */}
              <button
                onClick={() => addSegment("-x")}
                className="py-3.5 px-1 rounded-xl bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 active:scale-95 transition-all text-xs font-extrabold text-red-400 flex flex-col items-center gap-1 cursor-pointer"
              >
                <span>⬅</span>
                <span className="text-[9px]">-X Sinistra</span>
              </button>
              
              {/* Bottone Y+ */}
              <button
                onClick={() => addSegment("+y")}
                className="py-3.5 px-1 rounded-xl bg-green-500/10 border border-green-500/30 hover:bg-green-500/20 active:scale-95 transition-all text-xs font-extrabold text-green-400 flex flex-col items-center gap-1 cursor-pointer"
              >
                <span>⬆</span>
                <span className="text-[9px]">+Y Su</span>
              </button>

              {/* Bottone X+ */}
              <button
                onClick={() => addSegment("+x")}
                className="py-3.5 px-1 rounded-xl bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 active:scale-95 transition-all text-xs font-extrabold text-red-400 flex flex-col items-center gap-1 cursor-pointer"
              >
                <span>➡</span>
                <span className="text-[9px]">+X Destra</span>
              </button>

              {/* Bottone Z- (Profondità Avanti) */}
              <button
                onClick={() => addSegment("-z")}
                className="py-3.5 px-1 rounded-xl bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 active:scale-95 transition-all text-xs font-extrabold text-blue-400 flex flex-col items-center gap-1 cursor-pointer"
              >
                <span>↙</span>
                <span className="text-[9px]">-Z Avanti</span>
              </button>

              {/* Bottone Y- */}
              <button
                onClick={() => addSegment("-y")}
                className="py-3.5 px-1 rounded-xl bg-green-500/10 border border-green-500/30 hover:bg-green-500/20 active:scale-95 transition-all text-xs font-extrabold text-green-400 flex flex-col items-center gap-1 cursor-pointer"
              >
                <span>⬇</span>
                <span className="text-[9px]">-Y Giù</span>
              </button>

              {/* Bottone Z+ (Profondità Indietro) */}
              <button
                onClick={() => addSegment("+z")}
                className="py-3.5 px-1 rounded-xl bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 active:scale-95 transition-all text-xs font-extrabold text-blue-400 flex flex-col items-center gap-1 cursor-pointer"
              >
                <span>↗</span>
                <span className="text-[9px]">+Z Indietro</span>
              </button>
            </div>
          </div>

          {/* Elenco dei Segmenti Tracciati (Distinte di Taglio) */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white/50 uppercase tracking-wider">Distinte Pezzi ({segmentsList.length})</label>
              {points.length > 1 && (
                <span className="text-[9px] text-blue-400 font-extrabold">
                  Tot: {segmentsList.reduce((acc, curr) => acc + curr.length, 0)} cm
                </span>
              )}
            </div>
            {segmentsList.length === 0 ? (
              <p className="text-[10px] text-white/30 italic py-4 text-center">Nessun pezzo disegnato. Usa le frecce sopra per tracciare.</p>
            ) : (
              <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                {segmentsList.map((seg) => (
                  <div key={seg.id} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5 text-[10px]">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center font-bold text-[8px]">{seg.id}</span>
                      <span className="text-white/60">{seg.dir}</span>
                    </div>
                    <span className="font-extrabold text-white">{seg.length} cm</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Azioni di Annullamento e Reset */}
        <div className="flex flex-col gap-2 border-t border-white/10 pt-3">
          <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
            <button
              onClick={handleUndo}
              disabled={points.length <= 1}
              className="py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/80 active:scale-95 transition-all disabled:opacity-40 cursor-pointer text-center"
            >
              ↩ Annulla Segmento
            </button>
            <button
              onClick={handleReset}
              disabled={points.length <= 1}
              className="py-2.5 rounded-xl bg-red-600/10 border border-red-500/15 text-red-400 active:scale-95 transition-all disabled:opacity-40 cursor-pointer text-center"
            >
              🗑️ Resetta Tutto
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
