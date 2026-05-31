"use client";

import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import * as THREE from "three";

// --- HELPERS E COMPONENTI 3D ---

// Dimensione dello snap alla griglia (10 unità per disegno tecnico)
const SNAP_SIZE = 10;

interface Face2DProps {
  vertices: [number, number, number][];
  color?: string;
}

/**
 * Componente per renderizzare una faccia 2D orizzontale (piano XZ) a partire dai suoi vertici.
 * 
 * 📐 Matematica di Mappatura:
 * Three.js crea la ShapeGeometry sul piano XY bidimensionale (X, Y).
 * Per disporla orizzontalmente sul nostro piano 3D di calpestio (XZ), dobbiamo:
 * 1. Mappare le coordinate 3D (X, Z) dei nostri punti sui valori (X, Y) della forma 2D.
 * 2. Applicare una rotazione di -90 gradi (-PI/2) sull'asse X alla Mesh risultante per sdraiarla in orizzontale.
 */
function Face2D({ vertices, color = "#0ea5e9" }: Face2DProps) {
  const shape = useMemo(() => {
    if (vertices.length < 3) return null;
    
    const s = new THREE.Shape();
    // Utilizziamo X e Z come coordinate 2D bidimensionali
    s.moveTo(vertices[0][0], vertices[0][2]);
    for (let i = 1; i < vertices.length; i++) {
      s.lineTo(vertices[i][0], vertices[i][2]);
    }
    s.closePath();
    return s;
  }, [vertices]);

  if (!shape) return null;

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
      <shapeGeometry args={[shape]} />
      <meshStandardMaterial
        color={color}
        roughness={0.4}
        metalness={0.1}
        side={THREE.DoubleSide}
        transparent
        opacity={0.5}
      />
    </mesh>
  );
}

interface TempDrawLineProps {
  points: [number, number, number][];
  hoveredPoint: [number, number, number] | null;
  color?: string;
}

/**
 * Componente per tracciare la linea elastica provvisoria e i segmenti definitivi in corso di disegno.
 * Risolve l'errore di tipo TS2322 sul tag <line> usando una <primitive object={...} /> ed 
 * effettua lo smaltimento (dispose) della geometria e del materiale per evitare perdite di memoria.
 */
function TempDrawLine({ points, hoveredPoint, color = "#f43f5e" }: TempDrawLineProps) {
  const linePoints = useMemo(() => {
    if (points.length === 0) return [];
    
    // Converte i nostri array di coordinate in vettori Vector3 per Three.js
    const pts = points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    
    // Se c'è un punto correntemente hovered sotto il mouse, aggiunge l'elastico temporaneo alla fine
    if (hoveredPoint) {
      pts.push(new THREE.Vector3(hoveredPoint[0], hoveredPoint[1], hoveredPoint[2]));
    }
    
    return pts;
  }, [points, hoveredPoint]);

  const lineObject = useMemo(() => {
    if (linePoints.length < 2) return null;
    
    // Crea una geometria per la linea di tracciamento
    const geometry = new THREE.BufferGeometry().setFromPoints(linePoints);
    const material = new THREE.LineBasicMaterial({ color, linewidth: 3 });
    return new THREE.Line(geometry, material);
  }, [linePoints, color]);

  // Gestione della memoria: smaltisce la geometria e il materiale della linea quando cambia o viene rimossa
  useEffect(() => {
    return () => {
      if (lineObject) {
        lineObject.geometry.dispose();
        if (Array.isArray(lineObject.material)) {
          lineObject.material.forEach((m) => m.dispose());
        } else {
          lineObject.material.dispose();
        }
      }
    };
  }, [lineObject]);

  if (!lineObject) return null;

  return <primitive object={lineObject} />;
}

// --- MAIN COMPONENT ---

export default function ThreeDSketchupDesigner() {
  // Lista dei poligoni 2D già completati (facce piane chiuse sul piano XZ)
  const [completedFaces, setCompletedFaces] = useState<[number, number, number][][]>([]);
  
  // Vertici del poligono attualmente in corso di disegno
  const [tempVertices, setTempVertices] = useState<[number, number, number][]>([]);
  
  // Coordinata proiettata del mouse sulla griglia (con snap) per l'effetto linea elastica
  const [hoveredPoint, setHoveredPoint] = useState<[number, number, number] | null>(null);
  
  // Toggle per attivare/disattivare lo snap alla griglia
  const [useSnap, setUseSnap] = useState(true);

  // --- 📐 MATEMATICA E LOGICA DI RAYCASTING & INTERAZIONE ---

  /**
   * Converte le coordinate del mouse in un punto tridimensionale sulla griglia (Piano XZ, quota Y=0).
   * 
   * 🎯 Raycasting Spiegato:
   * In Three.js, un raggio (Ray) viene proiettato dalla telecamera passante per la posizione del cursore.
   * Riconosciamo l'intersezione del raggio con un piano invisibile sdraiato a Y=0.
   * La coordinata risultante e.point ci restituisce l'esatta posizione 3D (X, 0, Z) puntata.
   */
  const getGridPoint = useCallback((e: any): [number, number, number] => {
    const pt = e.point; // Intersezione 3D del Raycast
    
    if (useSnap) {
      // Arrotonda le coordinate al blocco di snap (es. ogni 10 unità) per disegno geometrico preciso
      const snappedX = Math.round(pt.x / SNAP_SIZE) * SNAP_SIZE;
      const snappedZ = Math.round(pt.z / SNAP_SIZE) * SNAP_SIZE;
      return [snappedX, 0, snappedZ];
    }
    
    return [pt.x, 0, pt.z];
  }, [useSnap]);

  // Aggiorna la linea elastica quando il mouse si sposta sul piano interattivo
  const handlePointerMove = (e: any) => {
    e.stopPropagation();
    const pt = getGridPoint(e);
    setHoveredPoint(pt);
  };

  // Posiziona un vertice quando l'utente fa clic sul piano
  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    if (e.button !== 0) return; // Gestisce solo il click sinistro

    const pt = getGridPoint(e);

    // 🔒 Chiusura Poligono Automatizzata:
    // Se ci sono già almeno 3 punti e l'utente clicca vicino al primo punto tracciato, chiude il poligono!
    if (tempVertices.length >= 3) {
      const first = tempVertices[0];
      const dist = Math.hypot(pt[0] - first[0], pt[2] - first[2]);
      
      // Se clicca entro un raggio di 15 unità dal punto iniziale, chiude il poligono
      if (dist < 15) {
        closePolygon();
        return;
      }
    }

    // Altrimenti aggiunge un nuovo vertice al tratto
    setTempVertices((prev) => [...prev, pt]);
  };

  // Funzione esplicita per chiudere il poligono e formare una faccia solida
  const closePolygon = () => {
    if (tempVertices.length < 3) {
      alert("⚠️ Un poligono deve avere almeno 3 vertici per formare una faccia chiusa!");
      return;
    }

    // Aggiunge la faccia all'elenco dei completati e resetta il buffer temporaneo
    setCompletedFaces((prev) => [...prev, tempVertices]);
    setTempVertices([]);
    setHoveredPoint(null);
  };

  // Rimuove l'ultimo vertice inserito (Undo)
  const handleUndoVertex = () => {
    if (tempVertices.length === 0) return;
    setTempVertices((prev) => prev.slice(0, -1));
  };

  // Cancella il disegno corrente
  const handleResetDraw = () => {
    setTempVertices([]);
    setHoveredPoint(null);
  };

  // Cancella tutte le facce create
  const handleClearAll = () => {
    if (confirm("Sei sicuro di voler cancellare tutte le facce 2D create?")) {
      setCompletedFaces([]);
      setTempVertices([]);
      setHoveredPoint(null);
    }
  };

  return (
    <div className="h-[calc(100vh-60px)] md:h-screen w-full flex flex-col md:flex-row relative bg-[#090b11] overflow-hidden select-none">
      
      {/* 💻 AREA VISUALIZZAZIONE 3D (Three.js Canvas, copre lo sfondo) */}
      <div className="flex-1 w-full h-[60vh] md:h-full relative cursor-crosshair">
        {/* Barra Superiore Informativa */}
        <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between gap-3">
          <div className="px-4 py-3 rounded-2xl border flex items-center gap-3 shadow-lg"
            style={{
              background: "hsl(220 35% 12% / 0.9)",
              backdropFilter: "blur(12px)",
              borderColor: "hsl(220 20% 16%)",
            }}>
            <Link href="/3d" className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 border border-white/5 text-white/80 hover:bg-white/10 transition-all text-xs">
              ⬅
            </Link>
            <div>
              <h2 className="text-white font-extrabold text-xs md:text-sm tracking-wide">
                Modellatore SketchUp (Fasi 1 &amp; 2)
              </h2>
              <p className="text-[9px] text-white/50">Fase 1: Scena di base | Fase 2: Strumento disegno planimetria 2D</p>
            </div>
          </div>

          {/* Toggle Snap Griglia */}
          <button
            onClick={() => setUseSnap(!useSnap)}
            className="px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer select-none"
            style={{
              background: useSnap ? "hsl(220 90% 56% / 0.2)" : "hsl(220 26% 14% / 0.8)",
              border: "1px solid " + (useSnap ? "hsl(220 90% 56% / 0.4)" : "hsl(220 20% 18%)"),
              color: useSnap ? "hsl(220 90% 70%)" : "white/60",
            }}
          >
            🧲 Calamita Griglia: {useSnap ? "ATTIVA" : "DISATTIVA"}
          </button>
        </div>

        {/* Canvas 3D */}
        <Canvas camera={{ position: [150, 200, 250], fov: 50 }}>
          <color attach="background" args={["#090b11"]} />
          
          {/* Illuminazione premium con ombre morbide */}
          <ambientLight intensity={0.65} />
          <directionalLight
            position={[100, 250, 100]}
            intensity={1.2}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
            shadow-bias={-0.0001}
          />
          <pointLight position={[-150, 150, -150]} intensity={0.5} />

          {/* 1. Piano Raycast Invisibile (Cattura i Pointer Events sulla griglia XZ a quota Y=0) */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0, 0]}
            onPointerMove={handlePointerMove}
            onPointerDown={handlePointerDown}
            visible={false}
          >
            <planeGeometry args={[2000, 2000]} />
          </mesh>

          {/* 2. Disegni in tempo reale */}
          {/* Segmenti temporanei in corso di tracciamento */}
          <TempDrawLine points={tempVertices} hoveredPoint={hoveredPoint} />

          {/* Sferette di ancoraggio sui vertici temporanei */}
          {tempVertices.map((vertex, idx) => {
            const isFirst = idx === 0;
            return (
              <mesh key={idx} position={[vertex[0], vertex[1] + 0.1, vertex[2]]}>
                <sphereGeometry args={[isFirst ? 3.5 : 2.5, 16, 16]} />
                <meshBasicMaterial color={isFirst ? "#10b981" : "#f43f5e"} />
              </mesh>
            );
          })}

          {/* 3. Facce Poligonali Completate e Chiuse */}
          {completedFaces.map((face, idx) => (
            <Face2D key={idx} vertices={face} color="#38bdf8" />
          ))}

          {/* Griglia Infinita di Riferimento Premium */}
          <Grid
            renderOrder={-1}
            position={[0, 0, 0]}
            args={[600, 600]}
            cellSize={20}
            cellThickness={0.8}
            cellColor="#1e293b"
            sectionSize={100}
            sectionThickness={1.5}
            sectionColor="#38bdf8"
            fadeDistance={500}
            infiniteGrid
          />

          {/* OrbitControls per pan, zoom e rotazione fluida */}
          <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.1} minDistance={50} maxDistance={600} />
        </Canvas>

        {/* Guida Istruzioni in sovrimpressione in basso a sinistra */}
        <div className="absolute bottom-4 left-4 z-20 p-4 rounded-2xl border text-[10px] leading-relaxed text-white/70 max-w-xs space-y-2"
          style={{
            background: "hsl(220 35% 12% / 0.85)",
            backdropFilter: "blur(12px)",
            borderColor: "hsl(220 20% 16%)",
          }}>
          <h4 className="font-bold text-white uppercase tracking-wider text-xs">📖 Istruzioni Disegno 2D</h4>
          <ol className="list-decimal list-inside space-y-1.5 pl-0.5 text-white/60">
            <li>Fai click sulla **griglia** per iniziare a posizionare i punti del tuo profilo.</li>
            <li>Sposta il mouse per vedere l&apos;elastico temporaneo e clicca per fissare nuovi nodi.</li>
            <li>Chiudi la figura cliccando di nuovo sul **punto iniziale (verde)** o premendo **&quot;Chiudi Profilo&quot;** a destra.</li>
            <li>Ruota la vista con il **tasto sinistro** del mouse, trascina con il **tasto destro** ed effettua lo zoom con la **rotella**.</li>
          </ol>
        </div>
      </div>

      {/* 🛠️ PANNELLO STRUMENTI LATERALE (Controllo e riepilogo poligoni) */}
      <div className="w-full md:w-80 h-[40vh] md:h-full flex flex-col justify-between border-t md:border-t-0 md:border-l relative z-30 p-4 space-y-4"
        style={{
          background: "hsl(220 32% 8%)",
          borderColor: "hsl(220 20% 16%)",
        }}>
        
        <div className="space-y-4 flex-1 overflow-y-auto pr-1 scrollbar-thin">
          <div className="space-y-1">
            <span className="text-[10px] text-sky-400 font-extrabold uppercase tracking-wider">Editor Planimetrie</span>
            <h3 className="text-base font-bold text-white">Disegno Profili 2D</h3>
            <p className="text-xs text-white/50 leading-relaxed">
              Traccia il perimetro delle pareti o delle zone prima di effettuare l&apos;estrusione volumetrica in 3D.
            </p>
          </div>

          {/* Vertici Correnti del Profilo */}
          <div className="space-y-2 border-t border-white/5 pt-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white/50 uppercase tracking-wider">Nodi Profilo Attivo</label>
              {tempVertices.length > 0 && (
                <span className="text-[9px] text-rose-400 font-extrabold animate-pulse">
                  In corso ({tempVertices.length} nodi)
                </span>
              )}
            </div>
            {tempVertices.length === 0 ? (
              <p className="text-[10px] text-white/30 italic py-2 text-center">Nessun punto tracciato. Inizia cliccando sulla griglia.</p>
            ) : (
              <div className="space-y-1 max-h-[140px] overflow-y-auto pr-1 scrollbar-thin">
                {tempVertices.map((v, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5 text-[9px]">
                    <span className="text-white/60">Vertice #{idx + 1}</span>
                    <span className="font-mono text-white/80">X: {Math.round(v[0])} · Z: {Math.round(v[2])}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Facce 2D Completate */}
          <div className="space-y-2 border-t border-white/5 pt-3">
            <label className="text-xs font-bold text-white/50 uppercase tracking-wider block">Facce Realizzate ({completedFaces.length})</label>
            {completedFaces.length === 0 ? (
              <p className="text-[10px] text-white/30 italic py-2 text-center">Nessuna faccia completata. Chiudi un profilo per crearne una.</p>
            ) : (
              <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1 scrollbar-thin">
                {completedFaces.map((face, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-sky-500/5 border border-sky-500/10 text-[10px]">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-sky-500/10 flex items-center justify-center font-bold text-sky-400 text-[8px]">#{idx + 1}</span>
                      <span className="text-white/60">Poligono Faccia</span>
                    </div>
                    <span className="font-extrabold text-sky-400">{face.length} vertici</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Azioni di Controllo del Disegno */}
        <div className="flex flex-col gap-2 border-t border-white/10 pt-3">
          {tempVertices.length >= 3 && (
            <button
              onClick={closePolygon}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-extrabold text-xs active:scale-95 transition-all shadow-lg shadow-emerald-500/10 cursor-pointer text-center"
            >
              ✓ Chiudi Profilo e Crea Faccia
            </button>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
            <button
              onClick={handleUndoVertex}
              disabled={tempVertices.length === 0}
              className="py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/80 active:scale-95 transition-all disabled:opacity-40 cursor-pointer text-center"
              title="Cancella l'ultimo vertice tracciato"
            >
              ↩ Annulla Vertice
            </button>
            <button
              onClick={handleResetDraw}
              disabled={tempVertices.length === 0}
              className="py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/80 active:scale-95 transition-all disabled:opacity-40 cursor-pointer text-center"
              title="Resetta il profilo in corso di disegno"
            >
              Resetta Profilo
            </button>
          </div>

          <button
            onClick={handleClearAll}
            disabled={completedFaces.length === 0 && tempVertices.length === 0}
            className="w-full py-2.5 rounded-xl bg-rose-600/10 border border-rose-500/15 text-rose-400 active:scale-95 transition-all disabled:opacity-40 cursor-pointer text-center text-xs font-bold"
          >
            🗑️ Cancella Tutto
          </button>
        </div>
      </div>
    </div>
  );
}
