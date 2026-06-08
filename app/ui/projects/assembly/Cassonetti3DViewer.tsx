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
  layersCount: number; // 1, 2, 3
}

export default function Cassonetti3DViewer({
  positioning,
  sides,
  width,
  height,
  length,
  thickness,
  currentStep,
  layersCount,
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

  const exp = 0.15; // offset esplosione 15 cm

  // Determinazione dello step in cui si montano i tappi
  const stepTappi = sides === "4-lati" ? 5 : 4;

  const ySign = positioning === "solaio" ? -1 : 1;

  return (
    <div className="w-full h-full relative">
      <Canvas
        camera={{
          position: isVertical
            ? [2, 1.8, 3]
            : [2, -0.6, 2.5], // Vista dal basso per la versione a solaio (appesa)
          fov: 50,
        }}
        shadows
      >
        <ambientLight intensity={1.2} />
        <directionalLight position={[10, 10, 5]} intensity={1.5} castShadow />
        <directionalLight position={[-10, 8, -5]} intensity={0.6} />

        {/* Gruppo principale ruotato se a parete (verticale) */}
        <group
          position={isVertical ? [0, l / 2 - 1.2, 0] : [0, 0, 0]}
          rotation={isVertical ? [Math.PI / 2, 0, 0] : [0, 0, 0]}
        >
          {/* PARETI DI SUPPORTO (MURATURA ESISTENTE) */}
          {/* Parete di Fondo (Solaio superiore se orizzontale, muro posteriore se verticale) */}
          {sides !== "4-lati" && (
            <mesh position={[0, (-h / 2 - (layersCount * t) - 0.02) * ySign, 0]} receiveShadow>
              <boxGeometry args={[w + 0.8, 0.04, l + 0.4]} />
              <meshStandardMaterial color={colors.wallBackground} roughness={0.9} />
            </mesh>
          )}

          {/* Parete Laterale Sinistra (solo se 2 lati, a rappresentare l'angolo) */}
          {sides === "2-lati" && (
            <mesh
              position={[
                -w / 2 - (layersCount * t) - 0.02,
                (0.055 - (layersCount * t) / 2) * ySign,
                0
              ]}
              receiveShadow
            >
              <boxGeometry args={[0.04, h + layersCount * t + 0.19, l + 0.4]} />
              <meshStandardMaterial color={colors.wallBackground} roughness={0.9} />
            </mesh>
          )}

          {/* STEP 1: Orditura metallica a U o a C (50x50 mm) */}
          {currentStep >= 1 && (
            <group>
              {/* --- PROFILI DI GUIDA (A contatto con solai o pareti) --- */}
              {/* Profilo guida DX a solaio/parete (per 2-lati e 3-lati) */}
              {sides !== "4-lati" && (
                <mesh castShadow receiveShadow position={[w / 2 - 0.025, (-h / 2 + 0.025 - (layersCount * t)) * ySign, 0]}>
                  <boxGeometry args={[0.05, 0.05, l]} />
                  <meshStandardMaterial
                    color={currentStep === 1 ? colors.metalHighlight : colors.metalStructure}
                    roughness={0.4}
                    metalness={0.8}
                  />
                </mesh>
              )}

              {/* Profilo guida SX a solaio (solo per 3-lati) */}
              {sides === "3-lati" && (
                <mesh castShadow receiveShadow position={[-w / 2 + 0.025, (-h / 2 + 0.025 - (layersCount * t)) * ySign, 0]}>
                  <boxGeometry args={[0.05, 0.05, l]} />
                  <meshStandardMaterial
                    color={currentStep === 1 ? colors.metalHighlight : colors.metalStructure}
                    roughness={0.4}
                    metalness={0.8}
                  />
                </mesh>
              )}

              {/* Profilo guida a parete SX (solo per 2-lati) */}
              {sides === "2-lati" && (
                <mesh castShadow receiveShadow position={[-w / 2 + 0.025 - (layersCount * t), (h / 2 - 0.025) * ySign, 0]}>
                  <boxGeometry args={[0.05, 0.05, l]} />
                  <meshStandardMaterial
                    color={currentStep === 1 ? colors.metalHighlight : colors.metalStructure}
                    roughness={0.4}
                    metalness={0.8}
                  />
                </mesh>
              )}

              {/* --- PROFILI INTERNI (Negli angoli formati dalle lastre) --- */}
              {/* Angolo SX Inferiore (solo per 4-lati) */}
              {sides === "4-lati" && (
                <mesh castShadow receiveShadow position={[-w / 2 + 0.025, (-h / 2 + 0.025) * ySign, 0]}>
                  <boxGeometry args={[0.05, 0.05, l]} />
                  <meshStandardMaterial
                    color={currentStep === 1 ? colors.metalHighlight : colors.metalStructure}
                    roughness={0.4}
                    metalness={0.8}
                  />
                </mesh>
              )}

              {/* Angolo DX Inferiore (solo per 4-lati) */}
              {sides === "4-lati" && (
                <mesh castShadow receiveShadow position={[w / 2 - 0.025, (-h / 2 + 0.025) * ySign, 0]}>
                  <boxGeometry args={[0.05, 0.05, l]} />
                  <meshStandardMaterial
                    color={currentStep === 1 ? colors.metalHighlight : colors.metalStructure}
                    roughness={0.4}
                    metalness={0.8}
                  />
                </mesh>
              )}

              {/* Angolo SX Superiore (per 3-lati e 4-lati) */}
              {(sides === "3-lati" || sides === "4-lati") && (
                <mesh castShadow receiveShadow position={[-w / 2 + 0.025, (h / 2 - 0.025) * ySign, 0]}>
                  <boxGeometry args={[0.05, 0.05, l]} />
                  <meshStandardMaterial
                    color={currentStep === 1 ? colors.metalHighlight : colors.metalStructure}
                    roughness={0.4}
                    metalness={0.8}
                  />
                </mesh>
              )}

              {/* Angolo DX Superiore (per tutti i lati: 2, 3, 4 lati) */}
              <mesh castShadow receiveShadow position={[w / 2 - 0.025, (h / 2 - 0.025) * ySign, 0]}>
                <boxGeometry args={[0.05, 0.05, l]} />
                <meshStandardMaterial
                  color={currentStep === 1 ? colors.metalHighlight : colors.metalStructure}
                  roughness={0.4}
                  metalness={0.8}
                />
              </mesh>

              {/* Pendinaggio di Sospensione e Barra Asolata (Solo per 4 Lati) */}
              {sides === "4-lati" && (
                <group>
                  {/* Barra asolata inferiore (sempre sotto il cassonetto, assoluto) */}
                  <mesh castShadow receiveShadow position={[0, -h / 2 - (layersCount * t) - 0.02, 0]}>
                    <boxGeometry args={[w + 2 * layersCount * t + 0.16, 0.04, 0.04]} />
                    <meshStandardMaterial
                      color={currentStep === 1 ? colors.metalHighlight : colors.metalStructure}
                      roughness={0.2}
                      metalness={0.8}
                    />
                  </mesh>
                  {/* Pendini filettati verticali (DX e SX, sempre appesi dal soffitto) */}
                  {!isVertical && (
                    <group>
                      <mesh position={[-w / 2 - layersCount * t - 0.06, 0.48 - h / 4 - layersCount * t * 0.5, 0]}>
                        <cylinderGeometry args={[0.006, 0.006, 1.04 + h / 2 + layersCount * t]} />
                        <meshStandardMaterial color={colors.metalStructure} roughness={0.2} metalness={0.9} />
                      </mesh>
                      <mesh position={[w / 2 + layersCount * t + 0.06, 0.48 - h / 4 - layersCount * t * 0.5, 0]}>
                        <cylinderGeometry args={[0.006, 0.006, 1.04 + h / 2 + layersCount * t]} />
                        <meshStandardMaterial color={colors.metalStructure} roughness={0.2} metalness={0.9} />
                      </mesh>
                    </group>
                  )}
                </group>
              )}
            </group>
          )}

          {/* DISEGNO DELLE LASTRE IN SILICATO (Plurilastre con sormonti alternati) */}

          {/* CONFIGURAZIONE: 4 LATI */}
          {sides === "4-lati" && (
            <group>
              {/* Loop per ciascuno strato k */}
              {Array.from({ length: layersCount }).map((_, idx) => {
                const k = idx + 1;
                const isOdd = k % 2 !== 0;
                const showStep2 = currentStep >= 2;
                const showStep3 = currentStep >= 3;
                const showStep4 = currentStep >= 4;

                // Spessori e quote in base allo strato
                const layerOffset = (k - 1) * t;

                return (
                  <group key={k}>
                    {/* Retro / Schiena (Step 2) */}
                    {showStep2 && (
                      <mesh
                        castShadow
                        receiveShadow
                        position={[0, (-h / 2 - t / 2 - layerOffset) * ySign - (currentStep === 2 ? exp * k * ySign : 0), 0]}
                      >
                        <boxGeometry args={[isOdd ? w + 2 * k * t : w + 2 * (k - 1) * t, t, l]} />
                        <meshStandardMaterial
                          color={currentStep === 2 ? colors.panelActive : colors.panelStandard}
                          roughness={0.8}
                          transparent={currentStep === 2}
                          opacity={currentStep === 2 ? 0.85 : 1}
                        />
                      </mesh>
                    )}

                    {/* Fianchi SX e DX (Step 3) con sfalsamento longitudinali per il primo strato */}
                    {showStep3 && (
                      <group>
                        {/* Fianco SX */}
                        <mesh
                          castShadow
                          receiveShadow
                          position={[-w / 2 - t / 2 - layerOffset - (currentStep === 3 ? exp * k : 0), 0, 0]}
                        >
                          <boxGeometry
                            args={[
                              t,
                              isOdd ? h + 2 * (k - 1) * t : h + 2 * k * t,
                              l,
                            ]}
                          />
                          <meshStandardMaterial
                            color={currentStep === 3 ? colors.panelActive : colors.panelStandard}
                            roughness={0.8}
                            transparent={currentStep === 3}
                            opacity={currentStep === 3 ? 0.85 : 1}
                          />
                        </mesh>

                        {/* Fianco DX */}
                        <mesh
                          castShadow
                          receiveShadow
                          position={[w / 2 + t / 2 + layerOffset + (currentStep === 3 ? exp * k : 0), 0, 0]}
                        >
                          <boxGeometry
                            args={[
                              t,
                              isOdd ? h + 2 * (k - 1) * t : h + 2 * k * t,
                              l,
                            ]}
                          />
                          <meshStandardMaterial
                            color={currentStep === 3 ? colors.panelActive : colors.panelStandard}
                            roughness={0.8}
                            transparent={currentStep === 3}
                            opacity={currentStep === 3 ? 0.85 : 1}
                          />
                        </mesh>
                      </group>
                    )}

                    {/* Fronte (Step 4) */}
                    {showStep4 && (
                      <mesh
                        castShadow
                        receiveShadow
                        position={[0, (h / 2 + t / 2 + layerOffset) * ySign + (currentStep === 4 ? exp * k * ySign : 0), 0]}
                      >
                        <boxGeometry args={[isOdd ? w + 2 * k * t : w + 2 * (k - 1) * t, t, l]} />
                        <meshStandardMaterial
                          color={currentStep === 4 ? colors.panelActive : colors.panelStandard}
                          roughness={0.8}
                          transparent={currentStep === 4}
                          opacity={currentStep === 4 ? 0.85 : 1}
                        />
                      </mesh>
                    )}
                  </group>
                );
              })}
            </group>
          )}

          {/* CONFIGURAZIONE: 3 LATI */}
          {sides === "3-lati" && (
            <group>
              {Array.from({ length: layersCount }).map((_, idx) => {
                const k = idx + 1;
                const isOdd = k % 2 !== 0;
                const showStep2 = currentStep >= 2;
                const showStep3 = currentStep >= 3;

                const layerOffset = (k - 1) * t;
                const hFianco = isOdd ? h + (layersCount + k - 1) * t : h + (layersCount + k) * t;
                const yFianco = isOdd
                  ? ((k - 1 - layersCount) * t / 2) * ySign
                  : ((k - layersCount) * t / 2) * ySign;

                return (
                  <group key={k}>
                    {/* Fianco SX (Step 2) */}
                    {showStep2 && (
                      <mesh
                        castShadow
                        receiveShadow
                        position={[
                          -w / 2 - t / 2 - layerOffset - (currentStep === 2 ? exp * k : 0),
                          yFianco,
                          0
                        ]}
                      >
                        <boxGeometry args={[t, hFianco, l]} />
                        <meshStandardMaterial
                          color={currentStep === 2 ? colors.panelActive : colors.panelStandard}
                          roughness={0.8}
                          transparent={currentStep === 2}
                          opacity={currentStep === 2 ? 0.85 : 1}
                        />
                      </mesh>
                    )}

                    {/* Fianco DX (Step 2) */}
                    {showStep2 && (
                      <mesh
                        castShadow
                        receiveShadow
                        position={[
                          w / 2 + t / 2 + layerOffset + (currentStep === 2 ? exp * k : 0),
                          yFianco,
                          0
                        ]}
                      >
                        <boxGeometry args={[t, hFianco, l]} />
                        <meshStandardMaterial
                          color={currentStep === 2 ? colors.panelActive : colors.panelStandard}
                          roughness={0.8}
                          transparent={currentStep === 2}
                          opacity={currentStep === 2 ? 0.85 : 1}
                        />
                      </mesh>
                    )}

                    {/* Fronte (Step 3) */}
                    {showStep3 && (
                      <mesh
                        castShadow
                        receiveShadow
                        position={[0, (h / 2 + t / 2 + layerOffset) * ySign + (currentStep === 3 ? exp * k * ySign : 0), 0]}
                      >
                        <boxGeometry args={[isOdd ? w + 2 * k * t : w + 2 * (k - 1) * t, t, l]} />
                        <meshStandardMaterial
                          color={currentStep === 3 ? colors.panelActive : colors.panelStandard}
                          roughness={0.8}
                          transparent={currentStep === 3}
                          opacity={currentStep === 3 ? 0.85 : 1}
                        />
                      </mesh>
                    )}
                  </group>
                );
              })}
            </group>
          )}

          {/* CONFIGURAZIONE: 2 LATI */}
          {sides === "2-lati" && (
            <group>
              {Array.from({ length: layersCount }).map((_, idx) => {
                const k = idx + 1;
                const isOdd = k % 2 !== 0;
                const showStep2 = currentStep >= 2;
                const showStep3 = currentStep >= 3;

                const layerOffset = (k - 1) * t;
                const hFianco = isOdd ? h + (layersCount + k - 1) * t : h + (layersCount + k) * t;
                const yFianco = isOdd
                  ? ((k - 1 - layersCount) * t / 2) * ySign
                  : ((k - layersCount) * t / 2) * ySign;
                const xFondo = (isOdd ? k : k - 1) * t / 2;

                return (
                  <group key={k}>
                    {/* Fianco DX (Step 2) */}
                    {showStep2 && (
                      <mesh
                        castShadow
                        receiveShadow
                        position={[
                          w / 2 + t / 2 + layerOffset + (currentStep === 2 ? exp * k : 0),
                          yFianco,
                          0
                        ]}
                      >
                        <boxGeometry args={[t, hFianco, l]} />
                        <meshStandardMaterial
                          color={currentStep === 2 ? colors.panelActive : colors.panelStandard}
                          roughness={0.8}
                          transparent={currentStep === 2}
                          opacity={currentStep === 2 ? 0.85 : 1}
                        />
                      </mesh>
                    )}

                    {/* Fronte (Step 3) - sormonta solo il fianco DX, a SX va in battuta a muro */}
                    {showStep3 && (
                      <mesh
                        castShadow
                        receiveShadow
                        position={[
                          xFondo,
                          (h / 2 + t / 2 + layerOffset) * ySign + (currentStep === 3 ? exp * k * ySign : 0),
                          0
                        ]}
                      >
                        <boxGeometry args={[isOdd ? w + k * t : w + (k - 1) * t, t, l]} />
                        <meshStandardMaterial
                          color={currentStep === 3 ? colors.panelActive : colors.panelStandard}
                          roughness={0.8}
                          transparent={currentStep === 3}
                          opacity={currentStep === 3 ? 0.85 : 1}
                        />
                      </mesh>
                    )}
                  </group>
                );
              })}
            </group>
          )}

          {/* STEP TAPPI OPZIONALI (Due Tappi, uno per lato terminale) */}
          {currentStep >= stepTappi && (
            <group>
              {Array.from({ length: layersCount }).map((_, idx) => {
                const k = idx + 1;

                let wTappo = w + 2 * k * t;
                let hTappo = h + 2 * k * t;
                let xTappo = 0;
                let yTappo = 0;

                if (sides === "2-lati") {
                  wTappo = w + k * t;
                  hTappo = h + k * t;
                  xTappo = k * t / 2;
                  yTappo = (k * t / 2) * ySign;
                } else if (sides === "3-lati") {
                  wTappo = w + 2 * k * t;
                  hTappo = h + k * t;
                  yTappo = (k * t / 2) * ySign;
                }

                return (
                  <group key={k}>
                    {/* Tappo Anteriore (Z = l/2) */}
                    <mesh
                      castShadow
                      receiveShadow
                      position={[xTappo, yTappo, l / 2 + (k - 0.5) * t + (currentStep === stepTappi ? exp * k : 0)]}
                    >
                      <boxGeometry args={[wTappo, hTappo, t]} />
                      <meshStandardMaterial
                        color={currentStep === stepTappi ? colors.panelActive : colors.panelStandard}
                        roughness={0.8}
                        transparent={currentStep === stepTappi}
                        opacity={currentStep === stepTappi ? 0.85 : 1}
                      />
                    </mesh>

                    {/* Tappo Posteriore (Z = -l/2) */}
                    <mesh
                      castShadow
                      receiveShadow
                      position={[xTappo, yTappo, -l / 2 - (k - 0.5) * t - (currentStep === stepTappi ? exp * k : 0)]}
                    >
                      <boxGeometry args={[wTappo, hTappo, t]} />
                      <meshStandardMaterial
                        color={currentStep === stepTappi ? colors.panelActive : colors.panelStandard}
                        roughness={0.8}
                        transparent={currentStep === stepTappi}
                        opacity={currentStep === stepTappi ? 0.85 : 1}
                      />
                    </mesh>
                  </group>
                );
              })}
            </group>
          )}
        </group>

        {/* Zoccolo / Giunto di base a contatto con il pavimento (solo per 4-lati verticale al passo completato) */}
        {sides === "4-lati" && isVertical && currentStep >= 6 && (
          <group position={[0, -1.2, 0]}>
            {/* Frontale */}
            <mesh castShadow receiveShadow position={[0, 0, h / 2 + layersCount * t + 0.002]}>
              <boxGeometry args={[w + 2 * layersCount * t + 0.05, 0.15, 0.01]} />
              <meshStandardMaterial color={colors.panelStandard} roughness={0.8} />
            </mesh>
            {/* Posteriore */}
            <mesh castShadow receiveShadow position={[0, 0, -h / 2 - layersCount * t - 0.002]}>
              <boxGeometry args={[w + 2 * layersCount * t + 0.05, 0.15, 0.01]} />
              <meshStandardMaterial color={colors.panelStandard} roughness={0.8} />
            </mesh>
            {/* Destra */}
            <mesh castShadow receiveShadow position={[w / 2 + layersCount * t + 0.002, 0, 0]}>
              <boxGeometry args={[0.01, 0.15, h + 2 * layersCount * t]} />
              <meshStandardMaterial color={colors.panelStandard} roughness={0.8} />
            </mesh>
            {/* Sinistra */}
            <mesh castShadow receiveShadow position={[-w / 2 - layersCount * t - 0.002, 0, 0]}>
              <boxGeometry args={[0.01, 0.15, h + 2 * layersCount * t]} />
              <meshStandardMaterial color={colors.panelStandard} roughness={0.8} />
            </mesh>
          </group>
        )}

        {/* Griglia a terra */}
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
