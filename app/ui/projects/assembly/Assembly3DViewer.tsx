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
  variant?: "con-giunto" | "senza-giunto";
}

export default function Assembly3DViewer({
  orientation,
  width,
  height,
  length,
  thickness,
  currentStep,
  variant = "con-giunto",
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

    // Posizioni Z per giunto e tappo in base all'orientamento
    const tappoZ = isVertical
      ? l / 2 + t / 2 + (currentStep === 5 ? explosionOffset : 0)
      : -l / 2 - t / 2 - (currentStep === 5 ? explosionOffset : 0);

    const collarZ = isVertical
      ? -l / 2 - (currentStep === 6 ? explosionOffset : 0)
      : l / 2 + (currentStep === 6 ? explosionOffset : 0);

    const collarBottomZ = isVertical
      ? l / 2 + (currentStep === (variant === "senza-giunto" ? 9 : 7) ? explosionOffset : 0)
      : 0;

    const isSenzaGiunto = variant === "senza-giunto";
    const baseZ = isSenzaGiunto ? (isVertical ? l / 4 : -l / 4) : 0;
    const leftZ = isSenzaGiunto ? (isVertical ? l / 4 : -l / 4) : 0;
    const rightZ = 0;
    const topZ = 0;

    // Secondo Segmento (solo se senza-giunto)
    const base2Z = isVertical ? -l / 2 : l / 2;
    const left2Z = isVertical ? -l / 2 : l / 2;
    const right2Z = isVertical ? -l : l;
    const top2Z = isVertical ? -l : l;

    return {
      base: [
        0,
        -h / 2 - t / 2 + (currentStep === 2 ? explosionOffset : 0),
        baseZ,
      ] as [number, number, number],
      leftSide: [
        -w / 2 - t / 2 - (currentStep === 3 ? explosionOffset : 0),
        0,
        leftZ,
      ] as [number, number, number],
      rightSide: [
        w / 2 + t / 2 + (currentStep === 3 ? explosionOffset : 0),
        0,
        rightZ,
      ] as [number, number, number],
      top: [
        0,
        h / 2 + t / 2 + (currentStep === 4 ? explosionOffset : 0),
        topZ,
      ] as [number, number, number],
      
      // Secondo Segmento
      base2: [
        0,
        -h / 2 - t / 2 + (currentStep === 6 ? explosionOffset : 0),
        base2Z,
      ] as [number, number, number],
      leftSide2: [
        -w / 2 - t / 2 - (currentStep === 7 ? explosionOffset : 0),
        0,
        left2Z,
      ] as [number, number, number],
      rightSide2: [
        w / 2 + t / 2 + (currentStep === 7 ? explosionOffset : 0),
        0,
        right2Z,
      ] as [number, number, number],
      top2: [
        0,
        h / 2 + t / 2 + (currentStep === 8 ? explosionOffset : 0),
        top2Z,
      ] as [number, number, number],

      tappo: [
        0,
        0,
        tappoZ,
      ] as [number, number, number],
      collarZ,
      collarBottomZ,
    };
  }, [w, h, t, l, currentStep, isVertical, variant]);

  // Posizioni Z per le barre asolate e i pendini in orizzontale
  const supportZPositions = useMemo(() => {
    if (variant === "senza-giunto") {
      return [-l / 2 + 0.3, 0, l / 2, l, 3 * l / 2 - 0.3];
    }
    return [-l / 2 + 0.3, 0, l / 2 - 0.3];
  }, [l, variant]);

  // Posizioni Z per le staffe a muro in verticale
  const verticalBracketZPositions = useMemo(() => {
    if (variant === "senza-giunto") {
      return [l / 2 - 0.3, 0, -l / 2, -l, -3 * l / 2 + 0.3];
    }
    return [l / 2 - 0.5, 0, -l / 2 + 0.5];
  }, [l, variant]);

  // Colori dei materiali
  const colors = {
    metalStructure: "#94a3b8", // grigio metallico
    metalHighlight: "#ef4444", // rosso evidenziato per le guide attive
    panelStandard: "#e2e8f0", // grigio chiaro per le lastre silicato
    panelActive: "#3b82f6", // blu elettrico per la lastra attiva nel passaggio
    tappoActive: "#10b981", // verde smeraldo per il tappo terminale attivo
    tappoStandard: "#e2e8f0",
  };

  return (
    <div className="w-full h-full relative">
      <Canvas
        camera={{
          position: isVertical ? [2, 1.6, 3] : [2, 1.8, 2.5],
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
          {/* STEP 1: Struttura di Sostegno (Barre asolate) */}
          {currentStep >= 1 && (
            <group>
              {/* Pendini / Aste di supporto metalliche (solo orizzontale) */}
              {!isVertical && (
                <group>
                  {supportZPositions.map((zPos, idx) => (
                    <group key={idx}>
                      {/* Barra asolata */}
                      <mesh
                        castShadow
                        receiveShadow
                        position={[0, -h / 2 - t - 0.02, zPos]}
                      >
                        <boxGeometry args={[w + 0.16, 0.04, 0.04]} />
                        <meshStandardMaterial
                          color={currentStep === 1 ? colors.metalHighlight : colors.metalStructure}
                          roughness={0.2}
                          metalness={0.8}
                        />
                      </mesh>

                      {/* Pendini di sospensione verticali (sinistra e destra) */}
                      <mesh position={[-w / 2 - 0.06, 0.5 - h / 2, zPos]}>
                        <cylinderGeometry args={[0.006, 0.006, 1.2]} />
                        <meshStandardMaterial color={colors.metalStructure} metalness={0.7} />
                      </mesh>
                      <mesh position={[w / 2 + 0.06, 0.5 - h / 2, zPos]}>
                        <cylinderGeometry args={[0.006, 0.006, 1.2]} />
                        <meshStandardMaterial color={colors.metalStructure} metalness={0.7} />
                      </mesh>
                    </group>
                  ))}
                </group>
              )}

              {/* Fissaggi verticali a muro / Staffe antiribaltamento (se verticale) */}
              {isVertical && (
                <group>
                  {verticalBracketZPositions.map((zPos, idx) => (
                    <group key={idx}>
                      {/* Barra asolata frontale */}
                      <mesh
                        castShadow
                        receiveShadow
                        position={[0, h / 2 + t + 0.02, zPos]}
                      >
                        <boxGeometry args={[w + 0.16, 0.04, 0.04]} />
                        <meshStandardMaterial
                          color={currentStep === 1 ? colors.metalHighlight : colors.metalStructure}
                          roughness={0.2}
                          metalness={0.8}
                        />
                      </mesh>

                      {/* Staffa laterale sinistra (antiribaltamento) */}
                      <mesh
                        castShadow
                        receiveShadow
                        position={[-w / 2 - t - 0.01, 0, zPos]}
                      >
                        <boxGeometry args={[0.02, h + 2 * t + 0.06, 0.02]} />
                        <meshStandardMaterial
                          color={currentStep === 1 ? colors.metalHighlight : colors.metalStructure}
                          roughness={0.2}
                          metalness={0.8}
                        />
                      </mesh>

                      {/* Staffa laterale destra (antiribaltamento) */}
                      <mesh
                        castShadow
                        receiveShadow
                        position={[w / 2 + t + 0.01, 0, zPos]}
                      >
                        <boxGeometry args={[0.02, h + 2 * t + 0.06, 0.02]} />
                        <meshStandardMaterial
                          color={currentStep === 1 ? colors.metalHighlight : colors.metalStructure}
                          roughness={0.2}
                          metalness={0.8}
                        />
                      </mesh>
                    </group>
                  ))}
                </group>
              )}
            </group>
          )}

          {/* STEP 2: Lastra di Fondo (Base / Schiena) */}
          {currentStep >= 2 && (
            <mesh castShadow receiveShadow position={positions.base}>
              <boxGeometry args={[w + 2 * t, t, variant === "senza-giunto" ? l / 2 : l]} />
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
                <boxGeometry args={[t, h, variant === "senza-giunto" ? l / 2 : l]} />
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

          {/* STEP 4: Lastra Superiore (Coperchio / Fronte) */}
          {currentStep >= 4 && (
            <mesh castShadow receiveShadow position={positions.top}>
              <boxGeometry args={[w + 2 * t, t, l]} />
              <meshStandardMaterial
                color={currentStep === 4 ? colors.panelActive : colors.panelStandard}
                roughness={0.8}
                transparent={currentStep === 4}
                opacity={currentStep === 4 ? 0.85 : 1}
              />
            </mesh>
          )}

           {/* STEP 5: Tappo terminale di chiusura */}
          {currentStep >= 5 && (
            <mesh castShadow receiveShadow position={positions.tappo}>
              <boxGeometry args={[w + 2 * t, h + 2 * t, t]} />
              <meshStandardMaterial
                color={currentStep === 5 ? colors.panelActive : colors.panelStandard}
                roughness={0.8}
                transparent={currentStep === 5}
                opacity={currentStep === 5 ? 0.85 : 1}
              />
            </mesh>
          )}

          {/* STEP 6 (variante senza-giunto): Secondo Fondo (Intero) */}
          {variant === "senza-giunto" && currentStep >= 6 && (
            <mesh castShadow receiveShadow position={positions.base2}>
              <boxGeometry args={[w + 2 * t, t, l]} />
              <meshStandardMaterial
                color={currentStep === 6 ? colors.panelActive : colors.panelStandard}
                roughness={0.8}
                transparent={currentStep === 6}
                opacity={currentStep === 6 ? 0.85 : 1}
              />
            </mesh>
          )}

          {/* STEP 7 (variante senza-giunto): Secondi Fianchi Laterali (Interi) */}
          {variant === "senza-giunto" && currentStep >= 7 && (
            <group>
              {/* Fianco Sinistro 2 */}
              <mesh castShadow receiveShadow position={positions.leftSide2}>
                <boxGeometry args={[t, h, l]} />
                <meshStandardMaterial
                  color={currentStep === 7 ? colors.panelActive : colors.panelStandard}
                  roughness={0.8}
                  transparent={currentStep === 7}
                  opacity={currentStep === 7 ? 0.85 : 1}
                />
              </mesh>
              {/* Fianco Destro 2 */}
              <mesh castShadow receiveShadow position={positions.rightSide2}>
                <boxGeometry args={[t, h, l]} />
                <meshStandardMaterial
                  color={currentStep === 7 ? colors.panelActive : colors.panelStandard}
                  roughness={0.8}
                  transparent={currentStep === 7}
                  opacity={currentStep === 7 ? 0.85 : 1}
                />
              </mesh>
            </group>
          )}

          {/* STEP 8 (variante senza-giunto): Secondo Coperchio (Intero) */}
          {variant === "senza-giunto" && currentStep >= 8 && (
            <mesh castShadow receiveShadow position={positions.top2}>
              <boxGeometry args={[w + 2 * t, t, l]} />
              <meshStandardMaterial
                color={currentStep === 8 ? colors.panelActive : colors.panelStandard}
                roughness={0.8}
                transparent={currentStep === 8}
                opacity={currentStep === 8 ? 0.85 : 1}
              />
            </mesh>
          )}

          {/* STEP 6+: Giunti coprigiunto esterno */}
          {((variant === "con-giunto" && currentStep >= 6) || (variant === "senza-giunto" && isVertical && currentStep >= 6)) && (
            <group>
              {/* Giunto 1 (all'estremità o in alto) - Solo per "con-giunto" */}
              {variant === "con-giunto" && (
                <group>
                  {/* Bottom collar piece */}
                  <mesh castShadow receiveShadow position={[0, -h / 2 - 1.5 * t, positions.collarZ]}>
                    <boxGeometry args={[w + 4 * t, t, 0.2]} />
                    <meshStandardMaterial
                      color={currentStep === 6 ? colors.panelActive : colors.panelStandard}
                      roughness={0.8}
                      transparent={currentStep === 6}
                      opacity={currentStep === 6 ? 0.85 : 1}
                    />
                  </mesh>
                  {/* Top collar piece */}
                  <mesh castShadow receiveShadow position={[0, h / 2 + 1.5 * t, positions.collarZ]}>
                    <boxGeometry args={[w + 4 * t, t, 0.2]} />
                    <meshStandardMaterial
                      color={currentStep === 6 ? colors.panelActive : colors.panelStandard}
                      roughness={0.8}
                      transparent={currentStep === 6}
                      opacity={currentStep === 6 ? 0.85 : 1}
                    />
                  </mesh>
                  {/* Left collar piece */}
                  <mesh castShadow receiveShadow position={[-w / 2 - 1.5 * t, 0, positions.collarZ]}>
                    <boxGeometry args={[t, h + 2 * t, 0.2]} />
                    <meshStandardMaterial
                      color={currentStep === 6 ? colors.panelActive : colors.panelStandard}
                      roughness={0.8}
                      transparent={currentStep === 6}
                      opacity={currentStep === 6 ? 0.85 : 1}
                    />
                  </mesh>
                  {/* Right collar piece */}
                  <mesh castShadow receiveShadow position={[w / 2 + 1.5 * t, 0, positions.collarZ]}>
                    <boxGeometry args={[t, h + 2 * t, 0.2]} />
                    <meshStandardMaterial
                      color={currentStep === 6 ? colors.panelActive : colors.panelStandard}
                      roughness={0.8}
                      transparent={currentStep === 6}
                      opacity={currentStep === 6 ? 0.85 : 1}
                    />
                  </mesh>
                </group>
              )}

              {/* Giunto 2 (di base a pavimento) */}
              {isVertical && (
                ((variant === "con-giunto" && currentStep >= 7) || (variant === "senza-giunto" && currentStep >= 6)) && (
                  <group>
                    {/* Bottom collar piece */}
                    <mesh castShadow receiveShadow position={[0, -h / 2 - 1.5 * t, positions.collarBottomZ]}>
                      <boxGeometry args={[w + 4 * t, t, 0.2]} />
                      <meshStandardMaterial
                        color={
                          currentStep === (variant === "senza-giunto" ? 6 : 7)
                            ? colors.panelActive
                            : colors.panelStandard
                        }
                        roughness={0.8}
                        transparent={currentStep === (variant === "senza-giunto" ? 6 : 7)}
                        opacity={currentStep === (variant === "senza-giunto" ? 6 : 7) ? 0.85 : 1}
                      />
                    </mesh>
                    {/* Top collar piece */}
                    <mesh castShadow receiveShadow position={[0, h / 2 + 1.5 * t, positions.collarBottomZ]}>
                      <boxGeometry args={[w + 4 * t, t, 0.2]} />
                      <meshStandardMaterial
                        color={
                          currentStep === (variant === "senza-giunto" ? 6 : 7)
                            ? colors.panelActive
                            : colors.panelStandard
                        }
                        roughness={0.8}
                        transparent={currentStep === (variant === "senza-giunto" ? 6 : 7)}
                        opacity={currentStep === (variant === "senza-giunto" ? 6 : 7) ? 0.85 : 1}
                      />
                    </mesh>
                    {/* Left collar piece */}
                    <mesh castShadow receiveShadow position={[-w / 2 - 1.5 * t, 0, positions.collarBottomZ]}>
                      <boxGeometry args={[t, h + 2 * t, 0.2]} />
                      <meshStandardMaterial
                        color={
                          currentStep === (variant === "senza-giunto" ? 6 : 7)
                            ? colors.panelActive
                            : colors.panelStandard
                        }
                        roughness={0.8}
                        transparent={currentStep === (variant === "senza-giunto" ? 6 : 7)}
                        opacity={currentStep === (variant === "senza-giunto" ? 6 : 7) ? 0.85 : 1}
                      />
                    </mesh>
                    {/* Right collar piece */}
                    <mesh castShadow receiveShadow position={[w / 2 + 1.5 * t, 0, positions.collarBottomZ]}>
                      <boxGeometry args={[t, h + 2 * t, 0.2]} />
                      <meshStandardMaterial
                        color={
                          currentStep === (variant === "senza-giunto" ? 6 : 7)
                            ? colors.panelActive
                            : colors.panelStandard
                        }
                        roughness={0.8}
                        transparent={currentStep === (variant === "senza-giunto" ? 6 : 7)}
                        opacity={currentStep === (variant === "senza-giunto" ? 6 : 7) ? 0.85 : 1}
                      />
                    </mesh>
                  </group>
                )
              )}
            </group>
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
