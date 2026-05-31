"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stage, useGLTF, Html } from "@react-three/drei";

// --- COMPONENTE DI CARICAMENTO ---
function Loader() {
  return (
    <Html center>
      <div className="text-white text-xs font-bold bg-black/50 px-4 py-2 rounded-full backdrop-blur-md whitespace-nowrap">
        ⏳ Caricamento Modello 3D...
      </div>
    </Html>
  );
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
}

export default function ModelViewer({ modelUrl }: ModelViewerProps) {
  return (
    <div className="w-full h-[60vh] md:h-screen bg-[#090b11] relative rounded-xl overflow-hidden shadow-2xl border border-white/10">
      
      {/* Intestazione UI */}
      <div className="absolute top-4 left-4 z-10">
        <div className="px-4 py-2 bg-black/60 backdrop-blur-md rounded-xl text-white text-xs border border-white/10 shadow-lg">
          <span className="font-bold text-sky-400">👀 Visualizzatore 3D</span>
          <p className="text-[10px] text-white/50 mt-0.5">Trascina per ruotare · Pizzica per zoomare</p>
        </div>
      </div>

      {/* Canvas 3D */}
      <Canvas shadows camera={{ position: [0, 2, 5], fov: 50 }}>
        {/* Suspense permette di mostrare il Loader mentre il file 3D viene scaricato dalla rete */}
        <Suspense fallback={<Loader />}>
          {modelUrl ? (
            /* Stage è una utility di Drei che centra automaticamente qualsiasi modello 3D importato, 
               lo scala per farlo entrare nello schermo e imposta luci e ombre ultra-realistiche */
            <Stage environment="city" intensity={0.8} adjustCamera={1.2}>
              <Model url={modelUrl} />
            </Stage>
          ) : (
            /* Placeholder visivo se non c'è nessun file */
            <mesh>
              <boxGeometry args={[1.5, 1.5, 1.5]} />
              <meshStandardMaterial color="#38bdf8" wireframe />
            </mesh>
          )}
        </Suspense>
        
        {/* Controlli completi della telecamera per l'ispezione */}
        <OrbitControls makeDefault autoRotate autoRotateSpeed={0.5} />
      </Canvas>
    </div>
  );
}
