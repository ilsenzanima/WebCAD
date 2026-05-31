"use client";

import { Suspense, useRef, useState, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Stage, useGLTF, Html, ContactShadows } from "@react-three/drei";
import PhotoQuotaEditor from "./PhotoQuotaEditor";

// --- COMPONENTE DI CARICAMENTO ---
function Loader() {
  return (
    <Html center>
      <div className="text-white text-xs font-bold bg-black/50 px-4 py-2 rounded-full backdrop-blur-md whitespace-nowrap animate-pulse">
        ⏳ Caricamento Modello 3D...
      </div>
    </Html>
  );
}

// --- COMPONENTE DI CATTURA GL ---
// Permette al genitore di accedere al contesto WebGL del renderer di Three.js e gestisce la pulizia della memoria
function SnapshotGrabber({ onGlReady }: { onGlReady: (gl: any) => void }) {
  const { gl } = useThree();
  useEffect(() => {
    onGlReady(gl);
    return () => {
      // Dismette il renderer e libera le risorse della GPU al disassemblaggio del Canvas
      try {
        gl.dispose();
      } catch (err) {
        console.warn("Errore dismissione renderer Three.js:", err);
      }
    };
  }, [gl, onGlReady]);
  return null;
}

// --- COMPONENTE MODELLO ---
// Questo componente usa l'hook useGLTF per scaricare e parsare il file .glb/.gltf
function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  // primitive inserisce la scena importata all'interno del Canvas di Three.js
  return <primitive object={scene} />;
}

// --- COMPONENTE PRINCIPALE ---
interface ModelViewerProps {
  modelUrl?: string; // L'URL del file .glb o stringa Base64
  onSnapshotTaken?: (dataUrl: string) => void; // Callback opzionale per inviare lo snapshot al Report
}

export default function ModelViewer({ modelUrl, onSnapshotTaken }: ModelViewerProps) {
  const glRef = useRef<any>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [showFlash, setShowFlash] = useState(false);
  const [isEditingSnapshot, setIsEditingSnapshot] = useState(false);

  // Gestore per catturare lo snapshot della vista corrente
  const handleTakeSnapshot = () => {
    if (glRef.current) {
      try {
        // Forza un frame di render per assicurare che il buffer contenga l'immagine aggiornata
        const gl = glRef.current;
        const dataUrl = gl.domElement.toDataURL("image/png");
        
        setSnapshot(dataUrl);
        
        // Attiva effetto flash fotografico
        setShowFlash(true);
        setTimeout(() => setShowFlash(false), 200);

        if (onSnapshotTaken) {
          onSnapshotTaken(dataUrl);
        }
      } catch (err) {
        console.error("Errore durante la cattura dello snapshot 3D:", err);
      }
    }
  };

  return (
    <div className="w-full h-[60vh] md:h-screen bg-[#090b11] relative rounded-xl overflow-hidden shadow-2xl border border-white/10 transition-all duration-300">
      
      {/* Effetto Flash Fotografico */}
      {showFlash && (
        <div className="absolute inset-0 bg-white z-50 animate-ping pointer-events-none opacity-80" />
      )}

      {/* Intestazione UI */}
      <div className="absolute top-4 left-4 z-10">
        <div className="px-4 py-2 bg-black/60 backdrop-blur-md rounded-xl text-white text-xs border border-white/10 shadow-lg">
          <span className="font-bold text-sky-400">👀 Visualizzatore 3D</span>
          <p className="text-[10px] text-white/50 mt-0.5 animate-pulse">Trascina per ruotare · Pizzica per zoomare</p>
        </div>
      </div>

      {/* Pulsante Snapshot */}
      <div className="absolute top-4 right-4 z-10">
        <button
          type="button"
          onClick={handleTakeSnapshot}
          className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 active:scale-95 text-white text-xs font-bold rounded-xl border border-sky-400/20 shadow-lg flex items-center gap-1.5 transition-all duration-150 backdrop-blur-md"
          title="Scatta foto della vista attuale per i report"
        >
          <span>📸</span>
          <span>Scatta Foto Vista</span>
        </button>
      </div>

      {/* Canvas 3D */}
      <Canvas 
        shadows 
        camera={{ position: [0, 2, 5], fov: 50 }}
        gl={{ preserveDrawingBuffer: true }} // Fondamentale per estrarre lo snapshot senza schermate nere
      >
        {/* Sfondo chiaro e tecnico per migliorare il contrasto con modelli scuri */}
        <color attach="background" args={["#e2e8f0"]} />
        
        {/* Helper per catturare il riferimento WebGLRenderer */}
        <SnapshotGrabber onGlReady={(gl) => { glRef.current = gl; }} />

        {/* Suspense per il caricamento asincrono del modello */}
        <Suspense fallback={<Loader />}>
          {modelUrl ? (
            /* Stage centra, scala e illumina automaticamente qualsiasi modello. 
               Usiamo environment "warehouse" per riflessi tecnici ad alto contrasto. */
            <Stage environment="warehouse" intensity={0.8} adjustCamera={1.2} shadows={false}>
              <Model url={modelUrl} />
            </Stage>
          ) : (
            /* Placeholder visivo se non c'è nessun file */
            <mesh>
              <boxGeometry args={[1.5, 1.5, 1.5]} />
              <meshStandardMaterial color="#38bdf8" wireframe />
            </mesh>
          )}

          {/* Ombra di contatto soffusa sul pavimento per dare profondità e realismo */}
          <ContactShadows 
            position={[0, -0.9, 0]} 
            opacity={0.65} 
            scale={10} 
            blur={2} 
            far={2} 
          />
        </Suspense>
        
        {/* Controlli completi della telecamera per l'ispezione */}
        <OrbitControls makeDefault autoRotate autoRotateSpeed={0.3} />
      </Canvas>

      {/* Anteprima Snapshot Fluttuante in Basso a Destra */}
      {snapshot && (
        <div className="absolute bottom-4 right-4 z-20 p-2.5 bg-black/75 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl flex flex-col gap-2 max-w-[150px] animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="relative group rounded-lg overflow-hidden border border-white/10 bg-white">
            <img 
              src={snapshot} 
              alt="Snapshot 3D" 
              className="w-full h-24 object-contain"
            />
            <button
              type="button"
              onClick={() => setSnapshot(null)}
              className="absolute top-1 right-1 bg-red-500/90 hover:bg-red-600 text-white text-[9px] font-bold h-4 w-4 rounded-full flex items-center justify-center shadow-md transition-colors"
              title="Chiudi anteprima"
            >
              ✕
            </button>
          </div>
          
          <div className="flex gap-1 w-full">
            <button
              type="button"
              onClick={() => setIsEditingSnapshot(true)}
              className="flex-1 py-1 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-white text-[10px] font-bold rounded transition-colors text-center"
              title="Aggiungi quote o note grafiche sopra lo snapshot"
            >
              📐 Quota
            </button>
            <a
              href={snapshot}
              download="vista-prospettica-3d.png"
              className="px-2 py-1 bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-white text-[10px] font-bold rounded text-center transition-colors"
              title="Salva l'immagine sul dispositivo"
            >
              Scarica
            </a>
          </div>
          
          <button
            type="button"
            onClick={() => {
              alert("Snapshot pronto per l'inclusione nel report PDF!");
            }}
            className="w-full py-1 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white text-[10px] font-semibold rounded transition-colors text-center"
            title="Usa questa foto per il report di cantiere"
          >
            Usa nel Report
          </button>
        </div>
      )}

      {/* Modale PhotoQuotaEditor per Annotare lo Snapshot */}
      {isEditingSnapshot && snapshot && (
        <div className="absolute inset-0 z-30 bg-[#090b11]">
          <PhotoQuotaEditor
            imageUrl={snapshot}
            onSave={(newUrl) => {
              setSnapshot(newUrl);
              setIsEditingSnapshot(false);
              if (onSnapshotTaken) {
                onSnapshotTaken(newUrl);
              }
            }}
            onClose={() => setIsEditingSnapshot(false)}
          />
        </div>
      )}
    </div>
  );
}
