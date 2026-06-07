"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import { useMemo } from "react";

interface ViewerProps {
  orientation: "orizzontale" | "verticale";
  width: number; // in mm
  height: number; // in mm
  length: number; // in mm
  thickness: number; // in mm
  currentStep: number; // 1 a 5
}

export default function Assembly3DViewer({
  orientation,
  width,
  height,
  length,
  thickness,
  currentStep,
}: ViewerProps) {
  // Scala in metri per Three.js (1 unità = 1 metro)
  const w = width * 0.001;
  const h = height * 0.001;
  const l = length * 0.001;
  const t = thickness * 0.001;

  const isVertical = orientation === "verticale";

  // Posizioni calcolate con offset di "esplosione" se lo step è attivo
  const positions = useMemo(() => {
    const explosionOffset = 0.15; // 15 cm di distacco per lo step attivo

    return {
      base: [
        0,
        -h / 2 - t / 2 - (currentStep === 2 ? explosionOffset : 0),
        0,
      ] as [number, number, number],
      leftSide: [
        -w / 2 - t / 2 - (currentStep === 3 ? explosionOffset : 0),
        0,
        0,
      ] as [number, number, number],
      rightSide: [
        w / 2 + t / 2 + (currentStep === 3 ? explosionOffset : 0),
        0,
        0,
      ] as [number, number, number],
      insulation: [
        0,
        0,
        0,
      ] as [number, number, number],
      top: [
        0,
        h / 2 + t / 2 + (currentStep === 5 ? explosionOffset : 0),
        0,
      ] as [number, number, number],
    };
  }, [w, h, t, currentStep]);

  // Colori dei materiali
  const colors = {
    metalStructure: "#94a3b8", // grigio metallico
    metalHighlight: "#ef4444", // rosso evidenziato per le guide attive
    panelStandard: "#e2e8f0", // grigio chiaro per le lastre silicato
    panelActive: "#3b82f6", // blu elettrico per la lastra attiva nel passaggio
    insulationActive: "#eab308", // giallo/arancio per la lana di roccia attiva
    insulationStandard: "#854d0e", // marrone/giallo scuro per lana inserita
  };

  return (
    <div className="w-full h-full relative">
      <Canvas
        camera={{
          position: isVertical ? [2, 2.5, 3] : [2, 1.8, 2.5],
          fov: 50,
        }}
        shadows
      >
        <ambientLight intensity={1.2} />
        <directionalLight position={[10, 10, 5]} intensity={1.5} castShadow />
        <directionalLight position={[-10, 8, -5]} intensity={0.6} />
        
        {/* Scena principale con rotazione e traslazione se verticale */}
        <group
          position={isVertical ? [0, l / 2 - 0.5, 0] : [0, 0, 0]}
          rotation={isVertical ? [Math.PI / 2, 0, 0] : [0, 0, 0]}
        >
          {/* STEP 1: Guide a U e profili di supporto */}
          {currentStep >= 1 && (
            <group>
              {/* Profilo guida inferiore (soffitto/struttura) */}
              <mesh castShadow receiveShadow position={[0, -h / 2 - 0.01, 0]}>
                <boxGeometry args={[w + 0.04, 0.02, l]} />
                <meshStandardMaterial
                  color={currentStep === 1 ? colors.metalHighlight : colors.metalStructure}
                  roughness={0.2}
                  metalness={0.8}
                />
              </mesh>

              {/* Pendini / Aste di supporto metalliche (solo orizzontale) */}
              {!isVertical && (
                <group>
                  {/* Pendino Sinistro Anteriore */}
                  <mesh position={[-w / 2 - 0.05, 0.5 - h / 2, -l / 2 + 0.2]}>
                    <cylinderGeometry args={[0.006, 0.006, 1.0]} />
                    <meshStandardMaterial color={colors.metalStructure} metalness={0.7} />
                  </mesh>
                  {/* Pendino Destro Anteriore */}
                  <mesh position={[w / 2 + 0.05, 0.5 - h / 2, -l / 2 + 0.2]}>
                    <cylinderGeometry args={[0.006, 0.006, 1.0]} />
                    <meshStandardMaterial color={colors.metalStructure} metalness={0.7} />
                  </mesh>
                  {/* Pendino Sinistro Posteriore */}
                  <mesh position={[-w / 2 - 0.05, 0.5 - h / 2, l / 2 - 0.2]}>
                    <cylinderGeometry args={[0.006, 0.006, 1.0]} />
                    <meshStandardMaterial color={colors.metalStructure} metalness={0.7} />
                  </mesh>
                  {/* Pendino Destro Posteriore */}
                  <mesh position={[w / 2 + 0.05, 0.5 - h / 2, l / 2 - 0.2]}>
                    <cylinderGeometry args={[0.006, 0.006, 1.0]} />
                    <meshStandardMaterial color={colors.metalStructure} metalness={0.7} />
                  </mesh>

                  {/* Traversine di supporto a C (sotto il cavedio) */}
                  <mesh position={[0, -h / 2 - 0.025, -l / 2 + 0.2]}>
                    <boxGeometry args={[w + 0.14, 0.02, 0.04]} />
                    <meshStandardMaterial color={colors.metalStructure} metalness={0.8} />
                  </mesh>
                  <mesh position={[0, -h / 2 - 0.025, l / 2 - 0.2]}>
                    <boxGeometry args={[w + 0.14, 0.02, 0.04]} />
                    <meshStandardMaterial color={colors.metalStructure} metalness={0.8} />
                  </mesh>
                </group>
              )}

              {/* Fissaggi verticali a muro (se verticale) */}
              {isVertical && (
                <group>
                  {/* Staffa di ancoraggio parete 1 */}
                  <mesh position={[-w / 2 - 0.03, -0.2, -l / 2 + 0.5]}>
                    <boxGeometry args={[0.06, 0.02, 0.1]} />
                    <meshStandardMaterial color={colors.metalStructure} metalness={0.7} />
                  </mesh>
                  {/* Staffa di ancoraggio parete 2 */}
                  <mesh position={[w / 2 + 0.03, -0.2, l / 2 - 0.5]}>
                    <boxGeometry args={[0.06, 0.02, 0.1]} />
                    <meshStandardMaterial color={colors.metalStructure} metalness={0.7} />
                  </mesh>
                </group>
              )}
            </group>
          )}

          {/* STEP 2: Lastra di Fondo (Base / Schiena) */}
          {currentStep >= 2 && (
            <mesh castShadow receiveShadow position={positions.base}>
              <boxGeometry args={[w + 2 * t, t, l]} />
              <meshStandardMaterial
                color={currentStep === 2 ? colors.panelActive : colors.panelStandard}
                roughness={0.8}
                transparent={currentStep === 2}
                opacity={currentStep === 2 ? 0.85 : 1}
              />
            </mesh>
          )}

          {/* STEP 3: Lastre Fianchi Laterali */}
          {currentStep >= 3 && (
            <group>
              {/* Fianco Sinistro */}
              <mesh castShadow receiveShadow position={positions.leftSide}>
                <boxGeometry args={[t, h, l]} />
                <meshStandardMaterial
                  color={currentStep === 3 ? colors.panelActive : colors.panelStandard}
                  roughness={0.8}
                  transparent={currentStep === 3}
                  opacity={currentStep === 3 ? 0.85 : 1}
                />
              </mesh>
              {/* Fianco Destro */}
              <mesh castShadow receiveShadow position={positions.rightSide}>
                <boxGeometry args={[t, h, l]} />
                <meshStandardMaterial
                  color={currentStep === 3 ? colors.panelActive : colors.panelStandard}
                  roughness={0.8}
                  transparent={currentStep === 3}
                  opacity={currentStep === 3 ? 0.85 : 1}
                />
              </mesh>
            </group>
          )}

          {/* STEP 4: Isolamento interno (Lana di Roccia) */}
          {currentStep >= 4 && (
            <mesh position={positions.insulation}>
              {/* Leggermente più piccolo per non clippare le lastre esterne */}
              <boxGeometry args={[w - 0.004, h - 0.004, l - 0.01]} />
              <meshStandardMaterial
                color={currentStep === 4 ? colors.insulationActive : colors.insulationStandard}
                transparent
                opacity={currentStep === 4 ? 0.75 : 0.45}
                roughness={0.9}
              />
            </mesh>
          )}

          {/* STEP 5: Lastra Superiore (Coperchio / Fronte) */}
          {currentStep >= 5 && (
            <mesh castShadow receiveShadow position={positions.top}>
              <boxGeometry args={[w + 2 * t, t, l]} />
              <meshStandardMaterial
                color={currentStep === 5 ? colors.panelActive : colors.panelStandard}
                roughness={0.8}
                transparent={currentStep === 5}
                opacity={currentStep === 5 ? 0.85 : 1}
              />
            </mesh>
          )}
        </group>

        {/* Griglia a terra */}
        <Grid
          position={[0, -1, 0]}
          args={[10, 10]}
          cellSize={0.5}
          cellThickness={0.8}
          cellColor="#334155"
          sectionSize={2.5}
          sectionThickness={1.5}
          sectionColor="#475569"
          fadeDistance={25}
          infiniteGrid
        />

        <OrbitControls makeDefault enablePan={true} enableZoom={true} enableRotate={true} />
      </Canvas>
    </div>
  );
}
