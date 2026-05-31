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
  id: string;
  vertices: [number, number, number][];
  height?: number;
  color?: string;
  isSelected?: boolean;
  activeTool: "navigate" | "polygon" | "rectangle" | "ellipse" | "extrude";
  onSelect: () => void;
  onExtrudeStart: (e: any, faceId: string, currentHeight: number) => void;
  onExtrudeMove: (e: any) => void;
  onExtrudeEnd: (e: any) => void;
}

/**
 * Componente per renderizzare una faccia 2D orizzontale (piano XZ) o un volume estruso 3D.
 * Supporta la selezione interattiva ed eventi Push/Pull tridimensionali.
 * 
 * 📐 Matematica di Mappatura:
 * Three.js crea la ShapeGeometry e la ExtrudeGeometry sul piano XY locale (X, Y).
 * Per disporla orizzontalmente sul nostro piano 3D di calpestio (XZ), applichiamo:
 * 1. Mappatura delle coordinate 3D (X, Z) dei vertici sui valori (X, Y) della forma 2D.
 * 2. Applicazione di una rotazione di -90 gradi (-PI/2) sull'asse X per adagiare la Mesh a terra.
 * 3. L'asse locale Z punterà così esattamente verso l'alto (asse Y globale positivo). L'estrusione
 *    avviene lungo Z locale, quindi il volume crescerà naturalmente in altezza!
 */
function Face2D({
  id,
  vertices,
  height = 0,
  color = "#0ea5e9",
  isSelected = false,
  activeTool,
  onSelect,
  onExtrudeStart,
  onExtrudeMove,
  onExtrudeEnd
}: Face2DProps) {
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

  const extrudeSettings = useMemo(() => {
    return {
      depth: height,
      bevelEnabled: false,
      steps: 1
    };
  }, [height]);

  if (!shape) return null;

  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    if (activeTool === "extrude") {
      onExtrudeStart(e, id, height);
    } else {
      onSelect();
    }
  };

  const handlePointerMove = (e: any) => {
    if (activeTool === "extrude") {
      e.stopPropagation();
      onExtrudeMove(e);
    }
  };

  const handlePointerUp = (e: any) => {
    if (activeTool === "extrude") {
      e.stopPropagation();
      onExtrudeEnd(e);
    }
  };

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.05, 0]}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {height === 0 ? (
        <shapeGeometry args={[shape]} />
      ) : (
        <extrudeGeometry args={[shape, extrudeSettings]} />
      )}
      <meshStandardMaterial
        color={isSelected ? "#f59e0b" : color}
        roughness={0.3}
        metalness={0.1}
        side={THREE.DoubleSide}
        transparent
        opacity={isSelected ? 0.8 : 0.5}
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

interface CompletedFace {
  id: string;
  type: "polygon" | "rectangle" | "ellipse";
  parameters: {
    origin?: [number, number, number];
    width?: number;
    depth?: number;
    center?: [number, number, number];
    radiusX?: number;
    radiusZ?: number;
  };
  vertices: [number, number, number][];
  height?: number;
}

export default function ThreeDSketchupDesigner() {
  // Lista delle facce 2D completate con dati strutturati e parametrici
  const [completedFaces, setCompletedFaces] = useState<CompletedFace[]>([]);
  
  // Vertici temporanei o punti di ancoraggio per il disegno in corso
  const [tempVertices, setTempVertices] = useState<[number, number, number][]>([]);
  
  // Coordinata proiettata del mouse sulla griglia (con snap) per l'anteprima elastica
  const [hoveredPoint, setHoveredPoint] = useState<[number, number, number] | null>(null);
  
  // Strumento di disegno attivo
  const [activeTool, setActiveTool] = useState<"navigate" | "polygon" | "rectangle" | "ellipse" | "extrude">("polygon");
  
  // Riferimento per memorizzare i dettagli del trascinamento (drag) durante l'estrusione Push/Pull
  const dragInfo = useRef<{ faceId: string; startY: number; startHeight: number } | null>(null);
  
  // ID della faccia correntemente selezionata per l'ispettore delle misure
  const [selectedFaceId, setSelectedFaceId] = useState<string | null>(null);
  
  // Toggle per attivare/disattivare lo snap magnetico alla griglia
  const [useSnap, setUseSnap] = useState(true);

  // Trova la faccia attualmente selezionata per l'ispettore di proprietà
  const selectedFace = useMemo(() => {
    return completedFaces.find((f) => f.id === selectedFaceId) || null;
  }, [completedFaces, selectedFaceId]);

  // --- 📐 MATEMATICA E LOGICA DI RAYCASTING & ANTEPRIMA ---

  /**
   * Converte le coordinate del mouse in un punto tridimensionale sulla griglia (Piano XZ, quota Y=0).
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

  // Calcola dinamicamente i punti temporanei dell'anteprima elastica in base al tool e ai nodi inseriti
  const tempDrawPoints = useMemo<[number, number, number][]>(() => {
    if (tempVertices.length === 0) return [];
    
    if (activeTool === "polygon") {
      return tempVertices;
    }
    
    if (activeTool === "rectangle" && tempVertices.length === 1 && hoveredPoint) {
      const A = tempVertices[0];
      const B = hoveredPoint;
      // Perimetro rettangolare temporaneo chiuso (5 punti)
      return [
        A,
        [B[0], 0, A[2]],
        B,
        [A[0], 0, B[2]],
        A
      ];
    }
    
    if (activeTool === "ellipse" && tempVertices.length === 1 && hoveredPoint) {
      const C = tempVertices[0];
      const B = hoveredPoint;
      const rx = Math.abs(B[0] - C[0]);
      const rz = Math.abs(B[2] - C[2]);
      
      const pts: [number, number, number][] = [];
      const segments = 64;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        pts.push([
          C[0] + rx * Math.cos(theta),
          0,
          C[2] + rz * Math.sin(theta)
        ]);
      }
      return pts;
    }
    
    return tempVertices;
  }, [tempVertices, hoveredPoint, activeTool]);

  // Aggiorna l'anteprima elastica durante lo spostamento del mouse
  const handlePointerMove = (e: any) => {
    e.stopPropagation();
    if (activeTool === "navigate") return;
    const pt = getGridPoint(e);
    setHoveredPoint(pt);
  };

  // Gestore per i clic e il posizionamento dei nodi/disegno di forme
  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    if (e.button !== 0) return; // Gestisce solo il click sinistro
    
    // Se lo strumento attivo è 'navigate', cliccare sul piano deseleziona l'oggetto corrente
    if (activeTool === "navigate") {
      setSelectedFaceId(null);
      return;
    }

    const pt = getGridPoint(e);

    // --- LOGICA DISEGNO POLIGONO ---
    if (activeTool === "polygon") {
      if (tempVertices.length >= 3) {
        const first = tempVertices[0];
        const dist = Math.hypot(pt[0] - first[0], pt[2] - first[2]);
        
        // Se clicca vicino al primo vertice, chiude la figura
        if (dist < 15) {
          closePolygon();
          return;
        }
      }
      setTempVertices((prev) => [...prev, pt]);
    }
    
    // --- LOGICA DISEGNO RETTANGOLO ---
    else if (activeTool === "rectangle") {
      if (tempVertices.length === 0) {
        setTempVertices([pt]);
      } else {
        // Secondo clic: finalizza il rettangolo
        const A = tempVertices[0];
        const B = pt;
        const width = B[0] - A[0];
        const depth = B[2] - A[2];
        
        if (Math.abs(width) > 2 && Math.abs(depth) > 2) {
          const newFace: CompletedFace = {
            id: "face_" + Math.random().toString(36).substring(2, 11),
            type: "rectangle",
            parameters: { origin: A, width, depth },
            vertices: [
              [A[0], 0, A[2]],
              [A[0] + width, 0, A[2]],
              [A[0] + width, 0, A[2] + depth],
              [A[0], 0, A[2] + depth]
            ]
          };
          setCompletedFaces((prev) => [...prev, newFace]);
          setSelectedFaceId(newFace.id);
        }
        
        setTempVertices([]);
        setHoveredPoint(null);
      }
    }
    
    // --- LOGICA DISEGNO ELLISSE ---
    else if (activeTool === "ellipse") {
      if (tempVertices.length === 0) {
        setTempVertices([pt]);
      } else {
        // Secondo clic: finalizza l'ellisse
        const C = tempVertices[0];
        const B = pt;
        const radiusX = Math.abs(B[0] - C[0]);
        const radiusZ = Math.abs(B[2] - C[2]);
        
        if (radiusX > 2 && radiusZ > 2) {
          const verts: [number, number, number][] = [];
          const segments = 64;
          for (let i = 0; i < segments; i++) {
            const theta = (i / segments) * Math.PI * 2;
            verts.push([
              C[0] + radiusX * Math.cos(theta),
              0,
              C[2] + radiusZ * Math.sin(theta)
            ]);
          }
          
          const newFace: CompletedFace = {
            id: "face_" + Math.random().toString(36).substring(2, 11),
            type: "ellipse",
            parameters: { center: C, radiusX, radiusZ },
            vertices: verts
          };
          setCompletedFaces((prev) => [...prev, newFace]);
          setSelectedFaceId(newFace.id);
        }
        
        setTempVertices([]);
        setHoveredPoint(null);
      }
    }
  };

  // Crea una faccia a partire dal poligono in corso
  const closePolygon = () => {
    if (tempVertices.length < 3) {
      alert("⚠️ Un poligono deve avere almeno 3 vertici per formare una faccia chiusa!");
      return;
    }

    const newFace: CompletedFace = {
      id: "face_" + Math.random().toString(36).substring(2, 11),
      type: "polygon",
      parameters: {},
      vertices: tempVertices
    };
    
    setCompletedFaces((prev) => [...prev, newFace]);
    setSelectedFaceId(newFace.id);
    setTempVertices([]);
    setHoveredPoint(null);
  };

  // Aggiorna le misure di un rettangolo dall'Ispettore Parametrico
  const updateRectangleDimensions = (width: number, depth: number) => {
    setCompletedFaces((prev) =>
      prev.map((f) => {
        if (f.id === selectedFaceId && f.type === "rectangle") {
          const org = f.parameters.origin || [0, 0, 0];
          return {
            ...f,
            parameters: { ...f.parameters, width, depth },
            vertices: [
              [org[0], 0, org[2]],
              [org[0] + width, 0, org[2]],
              [org[0] + width, 0, org[2] + depth],
              [org[0], 0, org[2] + depth]
            ]
          };
        }
        return f;
      })
    );
  };

  // Aggiorna i raggi di un'ellisse dall'Ispettore Parametrico
  const updateEllipseDimensions = (radiusX: number, radiusZ: number) => {
    setCompletedFaces((prev) =>
      prev.map((f) => {
        if (f.id === selectedFaceId && f.type === "ellipse") {
          const cnt = f.parameters.center || [0, 0, 0];
          const verts: [number, number, number][] = [];
          const segments = 64;
          for (let i = 0; i < segments; i++) {
            const theta = (i / segments) * Math.PI * 2;
            verts.push([
              cnt[0] + radiusX * Math.cos(theta),
              0,
              cnt[2] + radiusZ * Math.sin(theta)
            ]);
          }
          return {
            ...f,
            parameters: { ...f.parameters, radiusX, radiusZ },
            vertices: verts
          };
        }
        return f;
      })
    );
  };

  // Aggiorna l'altezza di un solido dall'Ispettore Parametrico o da trascinamento
  const updateFaceHeight = (faceId: string, height: number) => {
    setCompletedFaces((prev) =>
      prev.map((f) => {
        if (f.id === faceId) {
          return { ...f, height };
        }
        return f;
      })
    );
  };

  // Inizia il trascinamento dell'estrusione (Push/Pull)
  const handleExtrudeStart = useCallback((e: any, faceId: string, currentHeight: number) => {
    e.stopPropagation();
    // Cattura il puntatore per tracciare il drag ovunque sul display
    e.target.setPointerCapture(e.pointerId);
    dragInfo.current = {
      faceId,
      startY: e.clientY,
      startHeight: currentHeight
    };
    setSelectedFaceId(faceId);
  }, []);

  // Aggiorna l'altezza in tempo reale durante il trascinamento (Push/Pull)
  const handleExtrudeMove = useCallback((e: any) => {
    if (!dragInfo.current) return;
    e.stopPropagation();
    
    // Calcoliamo lo spostamento Y del mouse sullo schermo (salendo clientY diminuisce, quindi startY - clientY è positivo)
    const deltaY = dragInfo.current.startY - e.clientY;
    
    // Scala unità: 1 pixel = 0.8 unità 3D
    let newHeight = dragInfo.current.startHeight + deltaY * 0.8;
    
    // Snap magnetico se abilitato
    if (useSnap) {
      newHeight = Math.round(newHeight / SNAP_SIZE) * SNAP_SIZE;
    }
    
    // Limitiamo l'estrusione per scopi prototipali (es. tra -100 e 600)
    newHeight = Math.max(-100, Math.min(600, newHeight));
    
    updateFaceHeight(dragInfo.current.faceId, newHeight);
  }, [useSnap]);

  // Termina l'operazione di estrusione
  const handleExtrudeEnd = useCallback((e: any) => {
    if (!dragInfo.current) return;
    e.stopPropagation();
    e.target.releasePointerCapture(e.pointerId);
    dragInfo.current = null;
  }, []);

  // Cancella l'ultimo nodo tracciato
  const handleUndoVertex = () => {
    if (tempVertices.length === 0) return;
    setTempVertices((prev) => prev.slice(0, -1));
  };

  // Resetta il disegno corrente
  const handleResetDraw = () => {
    setTempVertices([]);
    setHoveredPoint(null);
  };

  // Pulisce l'intero ambiente di lavoro
  const handleClearAll = () => {
    if (confirm("Sei sicuro di voler cancellare tutto?")) {
      setCompletedFaces([]);
      setTempVertices([]);
      setHoveredPoint(null);
      setSelectedFaceId(null);
    }
  };

  return (
    <div className="h-[calc(100vh-60px)] md:h-screen w-full flex flex-col md:flex-row relative bg-[#090b11] overflow-hidden select-none">
      
      {/* 💻 AREA VISUALIZZAZIONE 3D */}
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
                Modellatore SketchUp (v0.3.6)
              </h2>
              <p className="text-[9px] text-white/50">Disegno Parametrico 2D e Controllo Telecamera Avanzato</p>
            </div>
          </div>

          <button
            onClick={() => setUseSnap(!useSnap)}
            className="px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer select-none"
            style={{
              background: useSnap ? "hsl(220 90% 56% / 0.2)" : "hsl(220 26% 14% / 0.8)",
              border: "1px solid " + (useSnap ? "hsl(220 90% 56% / 0.4)" : "hsl(220 20% 18%)"),
              color: useSnap ? "hsl(220 90% 70%)" : "white/60",
            }}
          >
            🧲 Calamita: {useSnap ? "ATTIVA" : "DISATTIVA"}
          </button>
        </div>

        {/* 🛠️ BARRA DEGLI STRUMENTI PREMIUM */}
        <div className="absolute top-20 left-4 z-20 flex gap-1 p-1 rounded-2xl shadow-lg border"
          style={{
            background: "hsl(220 35% 12% / 0.85)",
            backdropFilter: "blur(12px)",
            borderColor: "hsl(220 20% 16%)",
          }}>
          {[
            { id: "navigate", label: "🧭 Naviga", desc: "Ruota ed esplora la scena 3D" },
            { id: "polygon", label: "✍ Poligono", desc: "Disegna un profilo cliccando nodo dopo nodo" },
            { id: "rectangle", label: "▱ Rettangolo", desc: "Clicca due punti per formare un rettangolo" },
            { id: "ellipse", label: "◯ Ellisse", desc: "Clicca il centro e poi definisci i raggi" },
            { id: "extrude", label: "⇡ Push/Pull", desc: "Clicca e trascina una faccia in verticale per estruderla" },
          ].map((tool) => (
            <button
              key={tool.id}
              onClick={() => {
                setActiveTool(tool.id as any);
                setTempVertices([]);
                setHoveredPoint(null);
              }}
              title={tool.desc}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTool === tool.id
                  ? "bg-sky-500 text-white shadow-md shadow-sky-500/25 scale-[1.03]"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              {tool.label}
            </button>
          ))}
        </div>

        {/* Canvas 3D */}
        <Canvas camera={{ position: [150, 200, 250], fov: 50 }}>
          <color attach="background" args={["#090b11"]} />
          
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

          {/* Piano Raycast Invisibile */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0, 0]}
            onPointerMove={handlePointerMove}
            onPointerDown={handlePointerDown}
            visible={false}
          >
            <planeGeometry args={[2000, 2000]} />
          </mesh>

          {/* Segmenti temporanei di anteprima in corso di tracciamento */}
          <TempDrawLine
            points={tempDrawPoints}
            hoveredPoint={activeTool === "polygon" ? hoveredPoint : null}
          />

          {/* Sferette di ancoraggio sui nodi di disegno attivi */}
          {tempVertices.map((vertex, idx) => {
            const isFirst = idx === 0;
            return (
              <mesh key={idx} position={[vertex[0], vertex[1] + 0.1, vertex[2]]}>
                <sphereGeometry args={[isFirst ? 3.5 : 2.5, 16, 16]} />
                <meshBasicMaterial color={isFirst ? "#10b981" : "#f43f5e"} />
              </mesh>
            );
          })}

          {/* Facce Poligonali Completate e Chiuse (e solidi estrusi) */}
          {completedFaces.map((face) => (
            <Face2D
              key={face.id}
              id={face.id}
              vertices={face.vertices}
              height={face.height}
              color="#38bdf8"
              isSelected={face.id === selectedFaceId}
              activeTool={activeTool}
              onSelect={() => setSelectedFaceId(face.id)}
              onExtrudeStart={handleExtrudeStart}
              onExtrudeMove={handleExtrudeMove}
              onExtrudeEnd={handleExtrudeEnd}
            />
          ))}

          {/* Griglia Infinita */}
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

          {/* OrbitControls abilitati SOLO in modalità Navigazione per evitare conflitti con il mouse */}
          <OrbitControls
            makeDefault
            enabled={activeTool === "navigate"}
            maxPolarAngle={Math.PI / 2.1}
            minDistance={50}
            maxDistance={600}
          />
        </Canvas>

        {/* Guida Istruzioni in sovrimpressione */}
        <div className="absolute bottom-4 left-4 z-20 p-4 rounded-2xl border text-[10px] leading-relaxed text-white/70 max-w-xs space-y-2"
          style={{
            background: "hsl(220 35% 12% / 0.85)",
            backdropFilter: "blur(12px)",
            borderColor: "hsl(220 20% 16%)",
          }}>
          <h4 className="font-bold text-white uppercase tracking-wider text-xs">📖 Istruzioni Disegno 2D</h4>
          <ol className="list-decimal list-inside space-y-1.5 pl-0.5 text-white/60">
            {activeTool === "navigate" && (
              <>
                <li>Sei in modalità **Navigazione**.</li>
                <li>Ruota con il **tasto sinistro** del mouse.</li>
                <li>Fai pan con il **tasto destro** e zoom con la **rotella**.</li>
                <li>Clicca su una faccia 2D per aprirne l&apos;**Ispettore** a destra.</li>
              </>
            )}
            {activeTool === "polygon" && (
              <>
                <li>Fai click sulla **griglia** per iniziare a tracciare i nodi.</li>
                <li>Muovi il mouse e clicca per aggiungere nuovi segmenti.</li>
                <li>Chiudi la forma cliccando sul **nodo iniziale (verde)** o premendo **&quot;Chiudi Profilo&quot;**.</li>
              </>
            )}
            {activeTool === "rectangle" && (
              <>
                <li>Fai click sulla griglia per posizionare il **primo angolo**.</li>
                <li>Sposta il mouse per regolare larghezza e profondità del rettangolo.</li>
                <li>Fai click per **fissare la forma** e completarla.</li>
              </>
            )}
            {activeTool === "ellipse" && (
              <>
                <li>Fai click sulla griglia per fissare il **centro dell&apos;ellisse**.</li>
                <li>Sposta il mouse allontanandoti dal centro per allungare i raggi.</li>
                <li>Fai click per **fissare la forma** e completarla.</li>
              </>
            )}
            {activeTool === "extrude" && (
              <>
                <li>Sei in modalità **Push/Pull (Estrusione 3D)**.</li>
                <li>Fai clic su una faccia a terra e **trascina il mouse verso l&apos;alto/basso** per estruderla.</li>
                <li>Gli OrbitControls sono bloccati per consentire il disegno.</li>
              </>
            )}
          </ol>
        </div>
      </div>

      {/* 🛠️ PANNELLO STRUMENTI LATERALE & ISPETTORE MISURE */}
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
              Disegna o seleziona una forma geometrica bidimensionale.
            </p>
          </div>

          {/* 🔍 ISPETTORE DI PROPRIETÀ PARAMETRICHE (Faccia Selezionata) */}
          {selectedFace ? (
            <div className="space-y-3 border-t border-sky-500/20 pt-4 bg-sky-500/5 p-3 rounded-2xl border border-sky-500/10">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-amber-400 font-extrabold uppercase tracking-wider">🔍 Ispettore Faccia</span>
                <button
                  onClick={() => setSelectedFaceId(null)}
                  className="text-[10px] text-white/40 hover:text-white transition-all cursor-pointer"
                >
                  Deseleziona
                </button>
              </div>
              
              <div className="space-y-1">
                <p className="text-xs font-bold text-white uppercase">{selectedFace.type === "polygon" ? "✍ Poligono Libero" : selectedFace.type === "rectangle" ? "▱ Rettangolo" : "◯ Ellisse"}</p>
                <p className="text-[10px] text-white/40 font-mono">ID: {selectedFace.id}</p>
              </div>

              {/* Parametro Comune: Altezza Estrusione (Y) */}
              <div className="space-y-1 border-t border-white/5 pt-2">
                <label className="text-[10px] text-sky-400 font-bold uppercase block">Altezza Solido (Y)</label>
                <input
                  type="number"
                  step="10"
                  value={Math.round(selectedFace.height || 0)}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    updateFaceHeight(selectedFace.id, val);
                  }}
                  className="w-full bg-[#0d0f17] text-white text-xs font-bold p-2.5 rounded-xl border border-white/10 focus:border-sky-500 outline-none"
                />
              </div>

              {/* INPUT SPECIFICI PER RETTANGOLO */}
              {selectedFace.type === "rectangle" && (
                <div className="space-y-3 border-t border-white/5 pt-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-white/50 font-bold uppercase block">Larghezza (X)</label>
                    <input
                      type="number"
                      step="5"
                      value={Math.round(selectedFace.parameters.width || 0)}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        updateRectangleDimensions(val, selectedFace.parameters.depth || 0);
                      }}
                      className="w-full bg-[#0d0f17] text-white text-xs font-bold p-2.5 rounded-xl border border-white/10 focus:border-sky-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-white/50 font-bold uppercase block">Profondità (Z)</label>
                    <input
                      type="number"
                      step="5"
                      value={Math.round(selectedFace.parameters.depth || 0)}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        updateRectangleDimensions(selectedFace.parameters.width || 0, val);
                      }}
                      className="w-full bg-[#0d0f17] text-white text-xs font-bold p-2.5 rounded-xl border border-white/10 focus:border-sky-500 outline-none"
                    />
                  </div>
                  <p className="text-[9px] text-white/40 italic leading-relaxed pt-1">
                    Modifica questi valori numerici per ridimensionare il rettangolo in tempo reale.
                  </p>
                </div>
              )}

              {/* INPUT SPECIFICI PER ELLISSE */}
              {selectedFace.type === "ellipse" && (
                <div className="space-y-3 border-t border-white/5 pt-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-white/50 font-bold uppercase block">Raggio X</label>
                    <input
                      type="number"
                      step="5"
                      value={Math.round(selectedFace.parameters.radiusX || 0)}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        updateEllipseDimensions(val, selectedFace.parameters.radiusZ || 0);
                      }}
                      className="w-full bg-[#0d0f17] text-white text-xs font-bold p-2.5 rounded-xl border border-white/10 focus:border-sky-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-white/50 font-bold uppercase block">Raggio Z</label>
                    <input
                      type="number"
                      step="5"
                      value={Math.round(selectedFace.parameters.radiusZ || 0)}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        updateEllipseDimensions(selectedFace.parameters.radiusX || 0, val);
                      }}
                      className="w-full bg-[#0d0f17] text-white text-xs font-bold p-2.5 rounded-xl border border-white/10 focus:border-sky-500 outline-none"
                    />
                  </div>
                  <p className="text-[9px] text-white/40 italic leading-relaxed pt-1">
                    Imposta i raggi uguali per ottenere un cerchio perfetto.
                  </p>
                </div>
              )}

              {/* INFO PER POLIGONO */}
              {selectedFace.type === "polygon" && (
                <div className="pt-2 border-t border-white/5 text-[10px] text-white/60 space-y-1.5 font-semibold">
                  <p>✓ Nodi del perimetro: <span className="text-sky-400 font-extrabold">{selectedFace.vertices.length}</span></p>
                  <p className="text-[9px] text-white/40 italic font-normal leading-relaxed">
                    Il poligono a mano libera non supporta la modifica parametrica di larghezza o raggio. Puoi modificarlo ricreandolo.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Vertici Correnti del Profilo in Disegno */}
              {activeTool === "polygon" && (
                <div className="space-y-2 border-t border-white/5 pt-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white/50 uppercase tracking-wider">Nodi Profilo Attivo</label>
                    {tempVertices.length > 0 && (
                      <span className="text-[9px] text-rose-400 font-extrabold animate-pulse">
                        Disegno ({tempVertices.length} nodi)
                      </span>
                    )}
                  </div>
                  {tempVertices.length === 0 ? (
                    <p className="text-[10px] text-white/30 italic py-2 text-center">Nessun punto tracciato. Inizia cliccando sulla griglia.</p>
                  ) : (
                    <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1 scrollbar-thin">
                      {tempVertices.map((v, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5 text-[9px]">
                          <span className="text-white/60">Vertice #{idx + 1}</span>
                          <span className="font-mono text-white/80">X: {Math.round(v[0])} · Z: {Math.round(v[2])}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Rettangolo/Ellisse in attesa del secondo clic */}
              {(activeTool === "rectangle" || activeTool === "ellipse") && tempVertices.length === 1 && (
                <div className="p-3 rounded-2xl bg-amber-500/5 border border-amber-500/10 text-xs text-amber-300/80 leading-relaxed font-semibold space-y-1">
                  <p>✨ Primo punto ancorato!</p>
                  <p className="text-[10px] text-white/50 font-normal">
                    {activeTool === "rectangle" ? "Sposta il mouse per calcolare il rettangolo e fai clic per confermare la forma." : "Sposta il mouse per definire i raggi dell'ellisse e fai clic per completarla."}
                  </p>
                </div>
              )}
            </>
          )}

          {/* Facce 2D Completate */}
          <div className="space-y-2 border-t border-white/5 pt-3">
            <label className="text-xs font-bold text-white/50 uppercase tracking-wider block">Facce Realizzate ({completedFaces.length})</label>
            {completedFaces.length === 0 ? (
              <p className="text-[10px] text-white/30 italic py-2 text-center">Nessuna faccia completata. Usa gli strumenti grafici per crearne una.</p>
            ) : (
              <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1 scrollbar-thin">
                {completedFaces.map((face) => (
                  <button
                    key={face.id}
                    onClick={() => setSelectedFaceId(face.id)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-[10px] text-left transition-all ${
                      face.id === selectedFaceId
                        ? "bg-amber-500/10 border-amber-500/40 text-amber-300"
                        : "bg-sky-500/5 border-sky-500/10 text-white/70 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center font-bold text-[8px] ${face.id === selectedFaceId ? "bg-amber-500/20 text-amber-400" : "bg-sky-500/10 text-sky-400"}`}>
                        {face.type === "polygon" ? "✍" : face.type === "rectangle" ? "▱" : "◯"}
                      </span>
                      <span className="capitalize font-semibold">{face.type}</span>
                    </div>
                    <span className="font-extrabold text-[9px] opacity-80">{face.vertices.length} vertici</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Azioni di Controllo del Disegno */}
        <div className="flex flex-col gap-2 border-t border-white/10 pt-3">
          {activeTool === "polygon" && tempVertices.length >= 3 && (
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
              disabled={tempVertices.length === 0 || activeTool !== "polygon"}
              className="py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/80 active:scale-95 transition-all disabled:opacity-40 cursor-pointer text-center"
              title="Annulla ultimo vertice"
            >
              ↩ Annulla
            </button>
            <button
              onClick={handleResetDraw}
              disabled={tempVertices.length === 0}
              className="py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/80 active:scale-95 transition-all disabled:opacity-40 cursor-pointer text-center"
              title="Resetta disegno in corso"
            >
              Resetta
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
