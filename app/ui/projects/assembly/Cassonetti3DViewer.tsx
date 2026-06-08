"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

interface CassonettiViewerProps {
  positioning: "solaio" | "parete";
  sides: "2-lati" | "3-lati" | "4-lati";
  width: number; // in mm
  height: number; // in mm
  length: number; // in mm
  thickness: number; // in mm
  currentStep: number;
}

export default function Cassonetti3DViewer({
  positioning,
  sides,
  width,
  height,
  length,
  thickness,
  currentStep,
}: CassonettiViewerProps) {
  // Scala in metri per Three.js
  const w = width * 0.001;
  const h = height * 0.001;
  const l = length * 0.001;
  const t = thickness * 0.001;

  const isVertical = positioning === "parete";

  // Palette colori premium
  const colors = {
    metalStructure: "#94a3b8", // grigio metallico
    metalHighlight: "#3b82f6", // azzurro per guide montate
    panelStandard: "#e2e8f0", // grigio chiaro silicato
    panelActive: "#f59e0b", // giallo/arancio per pannello attivo
    wallBackground: "#475569", // grigio scuro per pareti in muratura
  };

  // Calcolo delle posizioni con esplosione didattica
  const exp = 0.15; // offset esplosione 15 cm

  return (
    <div className="w-full h-full relative">
      <Canvas
        camera={{
          position: isVertical ? [1.8, 1.5, 2.5] : [1.8, 1.5, 2.5],
          fov: 50,
        }}
        shadows
      >
        <ambientLight intensity={1.2} />
        <directionalLight position={[10, 10, 5]} intensity={1.5} castShadow />
        <directionalLight position={[-10, 8, -5]} intensity={0.6} />

        {/* Gruppo principale ruotato se a parete (verticale) */}
        <group
          position={isVertical ? [0, l / 2 - 0.4, 0] : [0, 0, 0]}
          rotation={isVertical ? [Math.PI / 2, 0, 0] : [0, 0, 0]}
        >
          {/* PARETI DI SUPPORTO (MURATURA ESISTENTE) */}
          {/* Parete di Fondo (Solaio superiore se orizzontale, muro posteriore se verticale) */}
          {sides !== "4-lati" && (
            <mesh position={[0, -h / 2 - t - 0.02, 0]} receiveShadow>
              <boxGeometry args={[w + 0.6, 0.04, l + 0.4]} />
              <meshStandardMaterial color={colors.wallBackground} roughness={0.9} />
            </mesh>
          )}

          {/* Parete Laterale Sinistra (solo se 2 lati, a rappresentare l'angolo) */}
          {sides === "2-lati" && (
            <mesh position={[-w / 2 - t - 0.02, 0, 0]} receiveShadow>
              <boxGeometry args={[0.04, h + 0.2, l + 0.4]} />
              <meshStandardMaterial color={colors.wallBackground} roughness={0.9} />
            </mesh>
          )}

          {/* STEP 1: Guide metalliche di ancoraggio */}
          {currentStep >= 1 && (
            <group>
              {/* Profilo guida DX a parete/soffitto */}
              <mesh castShadow receiveShadow position={[w / 2, -h / 2 - t / 2, 0]}>
                <boxGeometry args={[0.03, 0.03, l]} />
                <meshStandardMaterial
                  color={currentStep === 1 ? colors.metalHighlight : colors.metalStructure}
                  roughness={0.4}
                  metalness={0.8}
                />
              </mesh>

              {/* Profilo guida SX a parete/soffitto (solo per 3 e 4 lati, per 2 lati c'è l'angolo a muro) */}
              {sides !== "2-lati" && sides !== "4-lati" && (
                <mesh castShadow receiveShadow position={[-w / 2, -h / 2 - t / 2, 0]}>
                  <boxGeometry args={[0.03, 0.03, l]} />
                  <meshStandardMaterial
                    color={currentStep === 1 ? colors.metalHighlight : colors.metalStructure}
                    roughness={0.4}
                    metalness={0.8}
                  />
                </mesh>
              )}

              {/* Se 4 lati, usiamo staffaggio a barra asolata inferiore di supporto */}
              {sides === "4-lati" && (
                <group>
                  <mesh castShadow receiveShadow position={[0, -h / 2 - t - 0.02, 0]}>
                    <boxGeometry args={[w + 2 * t + 0.1, 0.03, 0.03]} />
                    <meshStandardMaterial
                      color={currentStep === 1 ? colors.metalHighlight : colors.metalStructure}
                      roughness={0.4}
                      metalness={0.8}
                    />
                  </mesh>
                </group>
              )}
            </group>
          )}

          {/* LASTRE IN SILICATO */}

          {/* CONFIGURAZIONE: 4 LATI */}
          {sides === "4-lati" && (
            <group>
              {/* Retro / Schiena (Step 2) */}
              {currentStep >= 2 && (
                <mesh
                  castShadow
                  receiveShadow
                  position={[0, -h / 2 - t / 2 - (currentStep === 2 ? exp : 0), 0]}
                >
                  <boxGeometry args={[w + 2 * t, t, l]} />
                  <meshStandardMaterial
                    color={currentStep === 2 ? colors.panelActive : colors.panelStandard}
                    roughness={0.8}
                    transparent={currentStep === 2}
                    opacity={currentStep === 2 ? 0.85 : 1}
                  />
                </mesh>
              )}

              {/* Fianco SX (Step 3) */}
              {currentStep >= 3 && (
                <mesh
                  castShadow
                  receiveShadow
                  position={[-w / 2 - t / 2 - (currentStep === 3 ? exp : 0), 0, 0]}
                >
                  <boxGeometry args={[t, h, l]} />
                  <meshStandardMaterial
                    color={currentStep === 3 ? colors.panelActive : colors.panelStandard}
                    roughness={0.8}
                    transparent={currentStep === 3}
                    opacity={currentStep === 3 ? 0.85 : 1}
                  />
                </mesh>
              )}

              {/* Fianco DX (Step 3) */}
              {currentStep >= 3 && (
                <mesh
                  castShadow
                  receiveShadow
                  position={[w / 2 + t / 2 + (currentStep === 3 ? exp : 0), 0, 0]}
                >
                  <boxGeometry args={[t, h, l]} />
                  <meshStandardMaterial
                    color={currentStep === 3 ? colors.panelActive : colors.panelStandard}
                    roughness={0.8}
                    transparent={currentStep === 3}
                    opacity={currentStep === 3 ? 0.85 : 1}
                  />
                </mesh>
              )}

              {/* Fronte / Coperchio (Step 4) */}
              {currentStep >= 4 && (
                <mesh
                  castShadow
                  receiveShadow
                  position={[0, h / 2 + t / 2 + (currentStep === 4 ? exp : 0), 0]}
                >
                  <boxGeometry args={[w + 2 * t, t, l]} />
                  <meshStandardMaterial
                    color={currentStep === 4 ? colors.panelActive : colors.panelStandard}
                    roughness={0.8}
                    transparent={currentStep === 4}
                    opacity={currentStep === 4 ? 0.85 : 1}
                  />
                </mesh>
              )}
            </group>
          )}

          {/* CONFIGURAZIONE: 3 LATI */}
          {sides === "3-lati" && (
            <group>
              {/* Fianco SX (Step 2) */}
              {currentStep >= 2 && (
                <mesh
                  castShadow
                  receiveShadow
                  position={[-w / 2 - t / 2 - (currentStep === 2 ? exp : 0), 0, 0]}
                >
                  <boxGeometry args={[t, h, l]} />
                  <meshStandardMaterial
                    color={currentStep === 2 ? colors.panelActive : colors.panelStandard}
                    roughness={0.8}
                    transparent={currentStep === 2}
                    opacity={currentStep === 2 ? 0.85 : 1}
                  />
                </mesh>
              )}

              {/* Fianco DX (Step 2) */}
              {currentStep >= 2 && (
                <mesh
                  castShadow
                  receiveShadow
                  position={[w / 2 + t / 2 + (currentStep === 2 ? exp : 0), 0, 0]}
                >
                  <boxGeometry args={[t, h, l]} />
                  <meshStandardMaterial
                    color={currentStep === 2 ? colors.panelActive : colors.panelStandard}
                    roughness={0.8}
                    transparent={currentStep === 2}
                    opacity={currentStep === 2 ? 0.85 : 1}
                  />
                </mesh>
              )}

              {/* Fronte (Step 3) */}
              {currentStep >= 3 && (
                <mesh
                  castShadow
                  receiveShadow
                  position={[0, h / 2 + t / 2 + (currentStep === 3 ? exp : 0), 0]}
                >
                  <boxGeometry args={[w + 2 * t, t, l]} />
                  <meshStandardMaterial
                    color={currentStep === 3 ? colors.panelActive : colors.panelStandard}
                    roughness={0.8}
                    transparent={currentStep === 3}
                    opacity={currentStep === 3 ? 0.85 : 1}
                  />
                </mesh>
              )}
            </group>
          )}

          {/* CONFIGURAZIONE: 2 LATI */}
          {sides === "2-lati" && (
            <group>
              {/* Fianco DX (Step 2) - l'unico fianco esterno, a SX c'è l'angolo a muro */}
              {currentStep >= 2 && (
                <mesh
                  castShadow
                  receiveShadow
                  position={[w / 2 + t / 2 + (currentStep === 2 ? exp : 0), 0, 0]}
                >
                  <boxGeometry args={[t, h, l]} />
                  <meshStandardMaterial
                    color={currentStep === 2 ? colors.panelActive : colors.panelStandard}
                    roughness={0.8}
                    transparent={currentStep === 2}
                    opacity={currentStep === 2 ? 0.85 : 1}
                  />
                </mesh>
              )}

              {/* Fronte (Step 3) - sormonta solo il fianco DX, a SX va in battuta a muro */}
              {currentStep >= 3 && (
                <mesh
                  castShadow
                  receiveShadow
                  position={[t / 2, h / 2 + t / 2 + (currentStep === 3 ? exp : 0), 0]}
                >
                  <boxGeometry args={[w + t, t, l]} />
                  <meshStandardMaterial
                    color={currentStep === 3 ? colors.panelActive : colors.panelStandard}
                    roughness={0.8}
                    transparent={currentStep === 3}
                    opacity={currentStep === 3 ? 0.85 : 1}
                  />
                </mesh>
              )}
            </group>
          )}

          {/* STEP 4/5 (in base ai lati): Giunti Coprigiunti Esterni */}
          {((sides === "4-lati" && currentStep >= 5) || (sides !== "4-lati" && currentStep >= 4)) && (
            <group>
              {/* Coprigiunto superiore a Z = l/2 */}
              <group position={[0, 0, l / 2]}>
                <mesh castShadow receiveShadow position={[0, h / 2 + t + 0.005, 0]}>
                  <boxGeometry args={[w + 4 * t, 0.01, 0.15]} />
                  <meshStandardMaterial color={colors.panelStandard} roughness={0.8} />
                </mesh>
                {sides === "4-lati" && (
                  <mesh castShadow receiveShadow position={[0, -h / 2 - t - 0.005, 0]}>
                    <boxGeometry args={[w + 4 * t, 0.01, 0.15]} />
                    <meshStandardMaterial color={colors.panelStandard} roughness={0.8} />
                  </mesh>
                )}
                <mesh castShadow receiveShadow position={[w / 2 + t + 0.005, 0, 0]}>
                  <boxGeometry args={[0.01, h + 2 * t, 0.15]} />
                  <meshStandardMaterial color={colors.panelStandard} roughness={0.8} />
                </mesh>
                {sides !== "2-lati" && (
                  <mesh castShadow receiveShadow position={[-w / 2 - t - 0.005, 0, 0]}>
                    <boxGeometry args={[0.01, h + 2 * t, 0.15]} />
                    <meshStandardMaterial color={colors.panelStandard} roughness={0.8} />
                  </mesh>
                )}
              </group>

              {/* Coprigiunto inferiore a Z = -l/2 */}
              <group position={[0, 0, -l / 2]}>
                <mesh castShadow receiveShadow position={[0, h / 2 + t + 0.005, 0]}>
                  <boxGeometry args={[w + 4 * t, 0.01, 0.15]} />
                  <meshStandardMaterial color={colors.panelStandard} roughness={0.8} />
                </mesh>
                {sides === "4-lati" && (
                  <mesh castShadow receiveShadow position={[0, -h / 2 - t - 0.005, 0]}>
                    <boxGeometry args={[w + 4 * t, 0.01, 0.15]} />
                    <meshStandardMaterial color={colors.panelStandard} roughness={0.8} />
                  </mesh>
                )}
                <mesh castShadow receiveShadow position={[w / 2 + t + 0.005, 0, 0]}>
                  <boxGeometry args={[0.01, h + 2 * t, 0.15]} />
                  <meshStandardMaterial color={colors.panelStandard} roughness={0.8} />
                </mesh>
                {sides !== "2-lati" && (
                  <mesh castShadow receiveShadow position={[-w / 2 - t - 0.005, 0, 0]}>
                    <boxGeometry args={[0.01, h + 2 * t, 0.15]} />
                    <meshStandardMaterial color={colors.panelStandard} roughness={0.8} />
                  </mesh>
                )}
              </group>
            </group>
          )}
        </group>

        {/* Griglia di appoggio */}
        <Grid
          position={[0, -1.2, 0]}
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
