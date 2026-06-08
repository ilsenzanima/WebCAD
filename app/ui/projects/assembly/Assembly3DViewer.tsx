"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";

function AnimatedSmokeParticle({ path, speed = 1.0, delay = 0 }: { path: THREE.Vector3[], speed?: number, delay?: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime() * speed + delay;
    const progress = (time % 2) / 2; // progress 0 to 1 every 2 seconds
    
    const numSegments = path.length - 1;
    const segmentIndex = Math.min(Math.floor(progress * numSegments), numSegments - 1);
    const segmentProgress = (progress * numSegments) - segmentIndex;
    
    const start = path[segmentIndex];
    const end = path[segmentIndex + 1];
    
    meshRef.current.position.lerpVectors(start, end, segmentProgress);
  });
  
  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.015, 16, 16]} />
      <meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={3} transparent opacity={0.9} />
    </mesh>
  );
}

interface ViewerProps {
  orientation: "orizzontale" | "verticale";
  width: number; // in mm
  height: number; // in mm
  length: number; // in mm
  thickness: number; // in mm
  currentStep: number; // 1 a 10
  variant?: "con-giunto" | "senza-giunto" | "pezzo-unico" | "derivata-dritte";
  itemType?: "dritte" | "curve" | "canne-shunt";
}

export default function Assembly3DViewer({
  orientation,
  width,
  height,
  length,
  thickness,
  currentStep,
  variant = "con-giunto",
  itemType = "dritte",
}: ViewerProps) {
  // Scala in metri per Three.js (1 unità = 1 metro)
  const w = width * 0.001;
  const h = height * 0.001;
  const l = length * 0.001;
  const t = thickness * 0.001;

  const isVertical = orientation === "verticale";

  // Percorsi per le particelle di fumo delle canne-shunt
  const path1 = useMemo(() => [
    new THREE.Vector3(w / 2 + t, h / 2 + t / 2 + 0.3, -0.1),
    new THREE.Vector3(w / 2 + t, 0, -0.1),
    new THREE.Vector3(w / 2 + t, 0, l / 4 - 0.2),
    new THREE.Vector3(-w / 2 - t, 0, l / 4 + 0.1),
    new THREE.Vector3(-w / 2 - t, 0, l / 2 + 0.15)
  ], [w, t, l, h]);

  const path2 = useMemo(() => [
    new THREE.Vector3(-w / 2 - t, 0, -l / 2 - 0.15),
    new THREE.Vector3(-w / 2 - t, 0, l / 2 + 0.15)
  ], [w, t, l]);

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

  const curvePositions = useMemo(() => {
    const L_in = l / 2;
    const L_out = l / 2;
    const explosionOffset = 0.15;

    const expFondo = (currentStep === 2) ? explosionOffset : 0;
    const expInterni = (currentStep === 3) ? explosionOffset : 0;
    const expEsterni = (currentStep === 4) ? explosionOffset : 0;
    const expCoperchio = (currentStep === 5) ? explosionOffset : 0;
    const expGiunti = (currentStep === 6) ? explosionOffset : 0;

    const expFiancoSX = (currentStep === 2) ? explosionOffset : 0;
    const expSchiena = (currentStep === 3) ? explosionOffset : 0;
    const expFronte = (currentStep === 4) ? explosionOffset : 0;
    const expFiancoDX = (currentStep === 5) ? explosionOffset : 0;
    const expGiuntiVert = (currentStep === 6) ? explosionOffset : 0;

    return {
      L_in,
      L_out,
      expFondo,
      expInterni,
      expEsterni,
      expCoperchio,
      expGiunti,
      expFiancoSX,
      expSchiena,
      expFronte,
      expFiancoDX,
      expGiuntiVert
    };
  }, [l, currentStep]);

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
          {itemType === "dritte" ? (
            <group>
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
          ) : itemType === "curve" ? (
            // CURVE 90°
            <group>
              {!isVertical ? (
                // CURVA ORIZZONTALE
                <group>
                  {/* STEP 1: Supporti a L */}
                  {currentStep >= 1 && (
                    <group>
                      {/* Barra asolata 1 (Ingresso, lungo Z) */}
                      <mesh castShadow receiveShadow position={[0, -h/2 - t - 0.02, -curvePositions.L_in / 2]}>
                        <boxGeometry args={[w + 0.16, 0.04, 0.04]} />
                        <meshStandardMaterial
                          color={currentStep === 1 ? colors.metalHighlight : colors.metalStructure}
                          roughness={0.2}
                          metalness={0.8}
                        />
                      </mesh>
                      {/* Barra asolata 2 (Uscita, lungo X) */}
                      <mesh castShadow receiveShadow position={[curvePositions.L_out / 2, -h/2 - t - 0.02, 0]} rotation={[0, Math.PI / 2, 0]}>
                        <boxGeometry args={[w + 0.16, 0.04, 0.04]} />
                        <meshStandardMaterial
                          color={currentStep === 1 ? colors.metalHighlight : colors.metalStructure}
                          roughness={0.2}
                          metalness={0.8}
                        />
                      </mesh>

                      {/* Pendini di sospensione */}
                      <mesh position={[-w/2 - 0.06, 0.5 - h/2, -curvePositions.L_in / 2]}>
                        <cylinderGeometry args={[0.006, 0.006, 1.2]} />
                        <meshStandardMaterial color={colors.metalStructure} metalness={0.7} />
                      </mesh>
                      <mesh position={[w/2 + 0.06, 0.5 - h/2, -curvePositions.L_in / 2]}>
                        <cylinderGeometry args={[0.006, 0.006, 1.2]} />
                        <meshStandardMaterial color={colors.metalStructure} metalness={0.7} />
                      </mesh>
                      <mesh position={[curvePositions.L_out / 2, 0.5 - h/2, -w/2 - 0.06]} rotation={[0, Math.PI / 2, 0]}>
                        <cylinderGeometry args={[0.006, 0.006, 1.2]} />
                        <meshStandardMaterial color={colors.metalStructure} metalness={0.7} />
                      </mesh>
                      <mesh position={[curvePositions.L_out / 2, 0.5 - h/2, w/2 + 0.06]} rotation={[0, Math.PI / 2, 0]}>
                        <cylinderGeometry args={[0.006, 0.006, 1.2]} />
                        <meshStandardMaterial color={colors.metalStructure} metalness={0.7} />
                      </mesh>
                    </group>
                  )}

                  {/* VARIANTI CURVA ORIZZONTALE */}
                  {variant === "pezzo-unico" ? (
                    // 1. PEZZO UNICO ORIZZONTALE
                    <group>
                      {/* STEP 2: Fondo a L */}
                      {currentStep >= 2 && (
                        <group position={[0, -curvePositions.expFondo, 0]}>
                          {/* Box A (ramo ingresso) */}
                          <mesh castShadow receiveShadow position={[0, -h / 2 - t / 2, -curvePositions.L_in / 2 + w / 4 + t / 2]}>
                            <boxGeometry args={[w + 2 * t, t, curvePositions.L_in + w / 2 + t]} />
                            <meshStandardMaterial
                              color={currentStep === 2 ? colors.panelActive : colors.panelStandard}
                              roughness={0.8}
                              transparent={currentStep === 2}
                              opacity={currentStep === 2 ? 0.85 : 1}
                            />
                          </mesh>
                          {/* Box B (ramo uscita) */}
                          <mesh castShadow receiveShadow position={[curvePositions.L_out / 2 + w / 4 + t / 2, -h / 2 - t / 2, 0]}>
                            <boxGeometry args={[curvePositions.L_out - w / 2 - t, t, w + 2 * t]} />
                            <meshStandardMaterial
                              color={currentStep === 2 ? colors.panelActive : colors.panelStandard}
                              roughness={0.8}
                              transparent={currentStep === 2}
                              opacity={currentStep === 2 ? 0.85 : 1}
                            />
                          </mesh>
                        </group>
                      )}

                      {/* STEP 3: Fianchi Interni (Corti) */}
                      {currentStep >= 3 && (
                        <group>
                          {/* Fianco Interno 1 (ingresso, corto) */}
                          <mesh castShadow receiveShadow position={[w / 2 + t / 2, 0, -curvePositions.L_in / 2 - w / 4 - t / 2 - curvePositions.expInterni]}>
                            <boxGeometry args={[t, h, curvePositions.L_in - w / 2 - t]} />
                            <meshStandardMaterial
                              color={currentStep === 3 ? colors.panelActive : colors.panelStandard}
                              roughness={0.8}
                              transparent={currentStep === 3}
                              opacity={currentStep === 3 ? 0.85 : 1}
                            />
                          </mesh>
                          {/* Fianco Interno 2 (uscita, corto) */}
                          <mesh castShadow receiveShadow position={[curvePositions.L_out / 2 + w / 4, 0, -w / 2 - t / 2 - curvePositions.expInterni]}>
                            <boxGeometry args={[curvePositions.L_out - w / 2, h, t]} />
                            <meshStandardMaterial
                              color={currentStep === 3 ? colors.panelActive : colors.panelStandard}
                              roughness={0.8}
                              transparent={currentStep === 3}
                              opacity={currentStep === 3 ? 0.85 : 1}
                            />
                          </mesh>
                        </group>
                      )}

                      {/* STEP 4: Fianchi Esterni (Lunghi) */}
                      {currentStep >= 4 && (
                        <group>
                          {/* Fianco Esterno 1 (ingresso, lungo) */}
                          <mesh castShadow receiveShadow position={[-w / 2 - t / 2 - curvePositions.expEsterni, 0, -curvePositions.L_in / 2 + w / 4 + t / 2]}>
                            <boxGeometry args={[t, h, curvePositions.L_in + w / 2 + t]} />
                            <meshStandardMaterial
                              color={currentStep === 4 ? colors.panelActive : colors.panelStandard}
                              roughness={0.8}
                              transparent={currentStep === 4}
                              opacity={currentStep === 4 ? 0.85 : 1}
                            />
                          </mesh>
                          {/* Fianco Esterno 2 (uscita, lungo) */}
                          <mesh castShadow receiveShadow position={[curvePositions.L_out / 2 - w / 4, 0, w / 2 + t / 2 + curvePositions.expEsterni]}>
                            <boxGeometry args={[curvePositions.L_out + w / 2, h, t]} />
                            <meshStandardMaterial
                              color={currentStep === 4 ? colors.panelActive : colors.panelStandard}
                              roughness={0.8}
                              transparent={currentStep === 4}
                              opacity={currentStep === 4 ? 0.85 : 1}
                            />
                          </mesh>
                        </group>
                      )}

                      {/* STEP 5: Coperchio a L */}
                      {currentStep >= 5 && (
                        <group position={[0, curvePositions.expCoperchio, 0]}>
                          {/* Box A (ramo ingresso) */}
                          <mesh castShadow receiveShadow position={[0, h / 2 + t / 2, -curvePositions.L_in / 2 + w / 4 + t / 2]}>
                            <boxGeometry args={[w + 2 * t, t, curvePositions.L_in + w / 2 + t]} />
                            <meshStandardMaterial
                              color={currentStep === 5 ? colors.panelActive : colors.panelStandard}
                              roughness={0.8}
                              transparent={currentStep === 5}
                              opacity={currentStep === 5 ? 0.85 : 1}
                            />
                          </mesh>
                          {/* Box B (ramo uscita) */}
                          <mesh castShadow receiveShadow position={[curvePositions.L_out / 2 + w / 4 + t / 2, h / 2 + t / 2, 0]}>
                            <boxGeometry args={[curvePositions.L_out - w / 2 - t, t, w + 2 * t]} />
                            <meshStandardMaterial
                              color={currentStep === 5 ? colors.panelActive : colors.panelStandard}
                              roughness={0.8}
                              transparent={currentStep === 5}
                              opacity={currentStep === 5 ? 0.85 : 1}
                            />
                          </mesh>
                        </group>
                      )}
                    </group>
                  ) : (
                    // 2. DERIVATA DA DRITTE ORIZZONTALE (Didattica a 7 step)
                    <group>
                      {/* STEP 2 e successivi: Tratto 1 (Ingresso) */}
                      {currentStep >= 2 && (
                        <group>
                          {/* Fondo Tratto 1 (Lungo) */}
                          <mesh castShadow receiveShadow position={[0, -h / 2 - t / 2 - (currentStep === 2 ? curvePositions.expFondo : 0), -curvePositions.L_in / 2 + w / 4 + t / 2]}>
                            <boxGeometry args={[w + 2 * t, t, curvePositions.L_in + w / 2 + t]} />
                            <meshStandardMaterial
                              color={currentStep === 2 ? colors.panelActive : colors.panelStandard}
                              roughness={0.8}
                              transparent={currentStep === 2}
                              opacity={currentStep === 2 ? 0.85 : 1}
                            />
                          </mesh>
                          {/* Coperchio Tratto 1 (Lungo) */}
                          <mesh castShadow receiveShadow position={[0, h / 2 + t / 2 + (currentStep === 2 ? curvePositions.expCoperchio : 0), -curvePositions.L_in / 2 + w / 4 + t / 2]}>
                            <boxGeometry args={[w + 2 * t, t, curvePositions.L_in + w / 2 + t]} />
                            <meshStandardMaterial
                              color={currentStep === 2 ? colors.panelActive : colors.panelStandard}
                              roughness={0.8}
                              transparent={currentStep === 2}
                              opacity={currentStep === 2 ? 0.85 : 1}
                            />
                          </mesh>
                          {/* Fianco Sinistro Tratto 1 (Esterno Lungo) */}
                          <mesh castShadow receiveShadow position={[-w / 2 - t / 2 - (currentStep === 2 ? curvePositions.expEsterni : 0), 0, -curvePositions.L_in / 2 + w / 4 + t / 2]}>
                            <boxGeometry args={[t, h, curvePositions.L_in + w / 2 + t]} />
                            <meshStandardMaterial
                              color={currentStep === 2 ? colors.panelActive : colors.panelStandard}
                              roughness={0.8}
                              transparent={currentStep === 2}
                              opacity={currentStep === 2 ? 0.85 : 1}
                            />
                          </mesh>
                          {/* Fianco Destro Tratto 1 (Interno Corto) */}
                          <mesh castShadow receiveShadow position={[w / 2 + t / 2 + (currentStep === 2 ? curvePositions.expInterni : 0), 0, -curvePositions.L_in / 2 - w / 4 - t / 2]}>
                            <boxGeometry args={[t, h, curvePositions.L_in - w / 2 - t]} />
                            <meshStandardMaterial
                              color={currentStep === 2 ? colors.panelActive : colors.panelStandard}
                              roughness={0.8}
                              transparent={currentStep === 2}
                              opacity={currentStep === 2 ? 0.85 : 1}
                            />
                          </mesh>
                        </group>
                      )}

                      {/* STEP 4 e successivi: Tratto 2 (Uscita) */}
                      {currentStep >= 4 && (
                        <group>
                          {/* Fondo Tratto 2 (Corto) */}
                          <mesh castShadow receiveShadow position={[curvePositions.L_out / 2 + w / 4 + t / 2, -h / 2 - t / 2 - (currentStep === 4 ? curvePositions.expFondo : 0), 0]}>
                            <boxGeometry args={[curvePositions.L_out - w / 2 - t, t, w + 2 * t]} />
                            <meshStandardMaterial
                              color={currentStep === 4 ? colors.panelActive : colors.panelStandard}
                              roughness={0.8}
                              transparent={currentStep === 4}
                              opacity={currentStep === 4 ? 0.85 : 1}
                            />
                          </mesh>
                          {/* Coperchio Tratto 2 (Corto) */}
                          <mesh castShadow receiveShadow position={[curvePositions.L_out / 2 + w / 4 + t / 2, h / 2 + t / 2 + (currentStep === 4 ? curvePositions.expCoperchio : 0), 0]}>
                            <boxGeometry args={[curvePositions.L_out - w / 2 - t, t, w + 2 * t]} />
                            <meshStandardMaterial
                              color={currentStep === 4 ? colors.panelActive : colors.panelStandard}
                              roughness={0.8}
                              transparent={currentStep === 4}
                              opacity={currentStep === 4 ? 0.85 : 1}
                            />
                          </mesh>
                          {/* Fianco Sinistro Tratto 2 (Esterno Lungo - Sormonto) */}
                          <mesh castShadow receiveShadow position={[curvePositions.L_out / 2 - w / 4 - t / 2, 0, w / 2 + t / 2 + (currentStep === 4 ? curvePositions.expEsterni : 0)]}>
                            <boxGeometry args={[curvePositions.L_out + w / 2 + t, h, t]} />
                            <meshStandardMaterial
                              color={currentStep === 4 ? colors.panelActive : colors.panelStandard}
                              roughness={0.8}
                              transparent={currentStep === 4}
                              opacity={currentStep === 4 ? 0.85 : 1}
                            />
                          </mesh>
                          {/* Fianco Destro Tratto 2 (Interno Corto - In Battuta) */}
                          <mesh castShadow receiveShadow position={[curvePositions.L_out / 2 + w / 4, 0, -w / 2 - t / 2 - (currentStep === 4 ? curvePositions.expInterni : 0)]}>
                            <boxGeometry args={[curvePositions.L_out - w / 2, h, t]} />
                            <meshStandardMaterial
                              color={currentStep === 4 ? colors.panelActive : colors.panelStandard}
                              roughness={0.8}
                              transparent={currentStep === 4}
                              opacity={currentStep === 4 ? 0.85 : 1}
                            />
                          </mesh>
                        </group>
                      )}
                    </group>
                  )}

                  {/* STEP 6: Coprigiunti (Ingresso e Uscita) */}
                  {currentStep >= 6 && (
                    <group>
                      {/* Coprigiunto Ingresso (Z = -L_in) */}
                      <group position={[0, 0, -curvePositions.L_in - (currentStep === 6 ? curvePositions.expGiunti : 0)]}>
                        <mesh castShadow receiveShadow position={[0, -h / 2 - 1.5 * t, 0]}>
                          <boxGeometry args={[w + 4 * t, t, 0.15]} />
                          <meshStandardMaterial color={currentStep === 6 ? colors.panelActive : colors.panelStandard} roughness={0.8} />
                        </mesh>
                        <mesh castShadow receiveShadow position={[0, h / 2 + 1.5 * t, 0]}>
                          <boxGeometry args={[w + 4 * t, t, 0.15]} />
                          <meshStandardMaterial color={currentStep === 6 ? colors.panelActive : colors.panelStandard} roughness={0.8} />
                        </mesh>
                        <mesh castShadow receiveShadow position={[-w / 2 - 1.5 * t, 0, 0]}>
                          <boxGeometry args={[t, h + 2 * t, 0.15]} />
                          <meshStandardMaterial color={currentStep === 6 ? colors.panelActive : colors.panelStandard} roughness={0.8} />
                        </mesh>
                        <mesh castShadow receiveShadow position={[w / 2 + 1.5 * t, 0, 0]}>
                          <boxGeometry args={[t, h + 2 * t, 0.15]} />
                          <meshStandardMaterial color={currentStep === 6 ? colors.panelActive : colors.panelStandard} roughness={0.8} />
                        </mesh>
                      </group>

                      {/* Coprigiunto Uscita (X = L_out) */}
                      <group position={[curvePositions.L_out + (currentStep === 6 ? curvePositions.expGiunti : 0), 0, 0]} rotation={[0, Math.PI / 2, 0]}>
                        <mesh castShadow receiveShadow position={[0, -h / 2 - 1.5 * t, 0]}>
                          <boxGeometry args={[w + 4 * t, t, 0.15]} />
                          <meshStandardMaterial color={currentStep === 6 ? colors.panelActive : colors.panelStandard} roughness={0.8} />
                        </mesh>
                        <mesh castShadow receiveShadow position={[0, h / 2 + 1.5 * t, 0]}>
                          <boxGeometry args={[w + 4 * t, t, 0.15]} />
                          <meshStandardMaterial color={currentStep === 6 ? colors.panelActive : colors.panelStandard} roughness={0.8} />
                        </mesh>
                        <mesh castShadow receiveShadow position={[-w / 2 - 1.5 * t, 0, 0]}>
                          <boxGeometry args={[t, h + 2 * t, 0.15]} />
                          <meshStandardMaterial color={currentStep === 6 ? colors.panelActive : colors.panelStandard} roughness={0.8} />
                        </mesh>
                        <mesh castShadow receiveShadow position={[w / 2 + 1.5 * t, 0, 0]}>
                          <boxGeometry args={[t, h + 2 * t, 0.15]} />
                          <meshStandardMaterial color={currentStep === 6 ? colors.panelActive : colors.panelStandard} roughness={0.8} />
                        </mesh>
                      </group>
                    </group>
                  )}
                </group>
              ) : (
                // CURVA VERTICALE (Pezzo Unico e Derivata)
                <group>
                  {/* STEP 1: Staffaggio a parete */}
                  {currentStep >= 1 && (
                    <group>
                      {/* --- Supporto Verticale (Tratto Ingresso) --- */}
                      {/* Barra di fondo a parete */}
                      <mesh castShadow receiveShadow position={[0, -h / 2 - t - 0.02, -curvePositions.L_in / 2]}>
                        <boxGeometry args={[w + 2 * t + 0.16, 0.04, 0.04]} />
                        <meshStandardMaterial
                          color={currentStep === 1 ? colors.metalHighlight : colors.metalStructure}
                          roughness={0.2}
                          metalness={0.8}
                        />
                      </mesh>
                      {/* Staffa laterale sinistra */}
                      <mesh castShadow receiveShadow position={[-w / 2 - t - 0.01, 0, -curvePositions.L_in / 2]}>
                        <boxGeometry args={[0.02, h + 2 * t + 0.06, 0.02]} />
                        <meshStandardMaterial
                          color={currentStep === 1 ? colors.metalHighlight : colors.metalStructure}
                          roughness={0.2}
                          metalness={0.8}
                        />
                      </mesh>
                      {/* Staffa laterale destra */}
                      <mesh castShadow receiveShadow position={[w / 2 + t + 0.01, 0, -curvePositions.L_in / 2]}>
                        <boxGeometry args={[0.02, h + 2 * t + 0.06, 0.02]} />
                        <meshStandardMaterial
                          color={currentStep === 1 ? colors.metalHighlight : colors.metalStructure}
                          roughness={0.2}
                          metalness={0.8}
                        />
                      </mesh>

                      {/* --- Supporto a Mensola Cantilever (Tratto Uscita) --- */}
                      {/* Braccio sinistro della mensola */}
                      <mesh castShadow receiveShadow position={[-w / 2 - t - 0.02, curvePositions.L_out / 2 - h / 4, -h / 2 - t - 0.02]}>
                        <boxGeometry args={[0.04, curvePositions.L_out + h / 2, 0.04]} />
                        <meshStandardMaterial
                          color={currentStep === 1 ? colors.metalHighlight : colors.metalStructure}
                          roughness={0.2}
                          metalness={0.8}
                        />
                      </mesh>
                      {/* Braccio destro della mensola */}
                      <mesh castShadow receiveShadow position={[w / 2 + t + 0.02, curvePositions.L_out / 2 - h / 4, -h / 2 - t - 0.02]}>
                        <boxGeometry args={[0.04, curvePositions.L_out + h / 2, 0.04]} />
                        <meshStandardMaterial
                          color={currentStep === 1 ? colors.metalHighlight : colors.metalStructure}
                          roughness={0.2}
                          metalness={0.8}
                        />
                      </mesh>
                      {/* Traverso di unione mensola */}
                      <mesh castShadow receiveShadow position={[0, curvePositions.L_out - 0.02, -h / 2 - t - 0.02]}>
                        <boxGeometry args={[w + 2 * t + 0.08, 0.04, 0.04]} />
                        <meshStandardMaterial
                          color={currentStep === 1 ? colors.metalHighlight : colors.metalStructure}
                          roughness={0.2}
                          metalness={0.8}
                        />
                      </mesh>
                    </group>
                  )}

                  {/* VARIANTI CURVA VERTICALE */}
                  {variant === "pezzo-unico" ? (
                    // 1. PEZZO UNICO VERTICALE
                    <group>
                      {/* STEP 2: Fianco SX a L */}
                      {currentStep >= 2 && (
                        <group position={[-w / 2 - t / 2 - curvePositions.expFiancoSX, 0, 0]}>
                          {/* Box A (ramo ingresso) */}
                          <mesh castShadow receiveShadow position={[0, 0, -curvePositions.L_in / 2 + h / 4 + t / 2]}>
                            <boxGeometry args={[t, h + 2 * t, curvePositions.L_in + h / 2 + t]} />
                            <meshStandardMaterial
                              color={currentStep === 2 ? colors.panelActive : colors.panelStandard}
                              roughness={0.8}
                              transparent={currentStep === 2}
                              opacity={currentStep === 2 ? 0.85 : 1}
                            />
                          </mesh>
                          {/* Box B (ramo uscita) */}
                          <mesh castShadow receiveShadow position={[0, curvePositions.L_out / 2 + h / 4 + t / 2, 0]}>
                            <boxGeometry args={[t, curvePositions.L_out - h / 2 - t, h + 2 * t]} />
                            <meshStandardMaterial
                              color={currentStep === 2 ? colors.panelActive : colors.panelStandard}
                              roughness={0.8}
                              transparent={currentStep === 2}
                              opacity={currentStep === 2 ? 0.85 : 1}
                            />
                          </mesh>
                        </group>
                      )}

                      {/* STEP 3: Schiene (Retro, esterno/interno) */}
                      {currentStep >= 3 && (
                        <group>
                          {/* Schiena Esterna (ingresso, lunga) */}
                          <mesh castShadow receiveShadow position={[0, -h / 2 - t / 2 - curvePositions.expSchiena, -curvePositions.L_in / 2 + h / 4 + t / 2]}>
                            <boxGeometry args={[w + 2 * t, t, curvePositions.L_in + h / 2 + t]} />
                            <meshStandardMaterial
                              color={currentStep === 3 ? colors.panelActive : colors.panelStandard}
                              roughness={0.8}
                              transparent={currentStep === 3}
                              opacity={currentStep === 3 ? 0.85 : 1}
                            />
                          </mesh>
                          {/* Schiena Interna (uscita, corta) */}
                          <mesh castShadow receiveShadow position={[0, curvePositions.L_out / 2 + h / 4, -h / 2 - t / 2 - curvePositions.expSchiena]}>
                            <boxGeometry args={[w + 2 * t, curvePositions.L_out - h / 2, t]} />
                            <meshStandardMaterial
                              color={currentStep === 3 ? colors.panelActive : colors.panelStandard}
                              roughness={0.8}
                              transparent={currentStep === 3}
                              opacity={currentStep === 3 ? 0.85 : 1}
                            />
                          </mesh>
                        </group>
                      )}

                      {/* STEP 4: Fronti (Fronte, esterno/interno) */}
                      {currentStep >= 4 && (
                        <group>
                          {/* Fronte Interno (ingresso, corto) */}
                          <mesh castShadow receiveShadow position={[0, h / 2 + t / 2 + curvePositions.expFronte, -curvePositions.L_in / 2 - h / 4 - t / 2]}>
                            <boxGeometry args={[w + 2 * t, t, curvePositions.L_in - h / 2 - t]} />
                            <meshStandardMaterial
                              color={currentStep === 4 ? colors.panelActive : colors.panelStandard}
                              roughness={0.8}
                              transparent={currentStep === 4}
                              opacity={currentStep === 4 ? 0.85 : 1}
                            />
                          </mesh>
                          {/* Fronte Esterno (uscita, lungo) */}
                          <mesh castShadow receiveShadow position={[0, curvePositions.L_out / 2 - h / 4 - t / 2, h / 2 + t / 2 + curvePositions.expFronte]}>
                            <boxGeometry args={[w + 2 * t, curvePositions.L_out + h / 2 + t, t]} />
                            <meshStandardMaterial
                              color={currentStep === 4 ? colors.panelActive : colors.panelStandard}
                              roughness={0.8}
                              transparent={currentStep === 4}
                              opacity={currentStep === 4 ? 0.85 : 1}
                            />
                          </mesh>
                        </group>
                      )}

                      {/* STEP 5: Secondo Fianco DX a L */}
                      {currentStep >= 5 && (
                        <group position={[w / 2 + t / 2 + curvePositions.expFiancoDX, 0, 0]}>
                          {/* Box A (ramo ingresso) */}
                          <mesh castShadow receiveShadow position={[0, 0, -curvePositions.L_in / 2 + h / 4 + t / 2]}>
                            <boxGeometry args={[t, h + 2 * t, curvePositions.L_in + h / 2 + t]} />
                            <meshStandardMaterial
                              color={currentStep === 5 ? colors.panelActive : colors.panelStandard}
                              roughness={0.8}
                              transparent={currentStep === 5}
                              opacity={currentStep === 5 ? 0.85 : 1}
                            />
                          </mesh>
                          {/* Box B (ramo uscita) */}
                          <mesh castShadow receiveShadow position={[0, curvePositions.L_out / 2 + h / 4 + t / 2, 0]}>
                            <boxGeometry args={[t, curvePositions.L_out - h / 2 - t, h + 2 * t]} />
                            <meshStandardMaterial
                              color={currentStep === 5 ? colors.panelActive : colors.panelStandard}
                              roughness={0.8}
                              transparent={currentStep === 5}
                              opacity={currentStep === 5 ? 0.85 : 1}
                            />
                          </mesh>
                        </group>
                      )}
                    </group>
                  ) : (
                    // 2. DERIVATA DA DRITTE VERTICALE (Didattica a 7 step)
                    <group>
                      {/* STEP 2 e successivi: Tratto 1 (Ingresso) */}
                      {currentStep >= 2 && (
                        <group>
                          {/* Fianco SX Tratto 1 (Lungo) */}
                          <mesh castShadow receiveShadow position={[-w / 2 - t / 2 - (currentStep === 2 ? curvePositions.expFiancoSX : 0), 0, -curvePositions.L_in / 2 + h / 4 + t / 2]}>
                            <boxGeometry args={[t, h + 2 * t, curvePositions.L_in + h / 2 + t]} />
                            <meshStandardMaterial
                              color={currentStep === 2 ? colors.panelActive : colors.panelStandard}
                              roughness={0.8}
                              transparent={currentStep === 2}
                              opacity={currentStep === 2 ? 0.85 : 1}
                            />
                          </mesh>
                          {/* Fianco DX Tratto 1 (Lungo, identico a SX) */}
                          <mesh castShadow receiveShadow position={[w / 2 + t / 2 + (currentStep === 2 ? curvePositions.expFiancoDX : 0), 0, -curvePositions.L_in / 2 + h / 4 + t / 2]}>
                            <boxGeometry args={[t, h + 2 * t, curvePositions.L_in + h / 2 + t]} />
                            <meshStandardMaterial
                              color={currentStep === 2 ? colors.panelActive : colors.panelStandard}
                              roughness={0.8}
                              transparent={currentStep === 2}
                              opacity={currentStep === 2 ? 0.85 : 1}
                            />
                          </mesh>
                          {/* Schiena Tratto 1 (Lunga) */}
                          <mesh castShadow receiveShadow position={[0, -h / 2 - t / 2 - (currentStep === 2 ? curvePositions.expSchiena : 0), -curvePositions.L_in / 2 + h / 4 + t / 2]}>
                            <boxGeometry args={[w + 2 * t, t, curvePositions.L_in + h / 2 + t]} />
                            <meshStandardMaterial
                              color={currentStep === 2 ? colors.panelActive : colors.panelStandard}
                              roughness={0.8}
                              transparent={currentStep === 2}
                              opacity={currentStep === 2 ? 0.85 : 1}
                            />
                          </mesh>
                          {/* Fronte Tratto 1 (Corto) */}
                          <mesh castShadow receiveShadow position={[0, h / 2 + t / 2 + (currentStep === 2 ? curvePositions.expFronte : 0), -curvePositions.L_in / 2 - h / 4 - t / 2]}>
                            <boxGeometry args={[w + 2 * t, t, curvePositions.L_in - h / 2 - t]} />
                            <meshStandardMaterial
                              color={currentStep === 2 ? colors.panelActive : colors.panelStandard}
                              roughness={0.8}
                              transparent={currentStep === 2}
                              opacity={currentStep === 2 ? 0.85 : 1}
                            />
                          </mesh>
                        </group>
                      )}

                      {/* STEP 4 e successivi: Tratto 2 (Uscita) */}
                      {currentStep >= 4 && (
                        <group>
                          {/* Fianco SX Tratto 2 (Corto) */}
                          <mesh castShadow receiveShadow position={[-w / 2 - t / 2 - (currentStep === 4 ? curvePositions.expFiancoSX : 0), curvePositions.L_out / 2 + h / 4 + t / 2, 0]}>
                            <boxGeometry args={[t, curvePositions.L_out - h / 2 - t, h + 2 * t]} />
                            <meshStandardMaterial
                              color={currentStep === 4 ? colors.panelActive : colors.panelStandard}
                              roughness={0.8}
                              transparent={currentStep === 4}
                              opacity={currentStep === 4 ? 0.85 : 1}
                            />
                          </mesh>
                          {/* Fianco DX Tratto 2 (Corto, identico a SX) */}
                          <mesh castShadow receiveShadow position={[w / 2 + t / 2 + (currentStep === 4 ? curvePositions.expFiancoDX : 0), curvePositions.L_out / 2 + h / 4 + t / 2, 0]}>
                            <boxGeometry args={[t, curvePositions.L_out - h / 2 - t, h + 2 * t]} />
                            <meshStandardMaterial
                              color={currentStep === 4 ? colors.panelActive : colors.panelStandard}
                              roughness={0.8}
                              transparent={currentStep === 4}
                              opacity={currentStep === 4 ? 0.85 : 1}
                            />
                          </mesh>
                          {/* Schiena Tratto 2 (Corta) */}
                          <mesh castShadow receiveShadow position={[0, curvePositions.L_out / 2 + h / 4, -h / 2 - t / 2 - (currentStep === 4 ? curvePositions.expSchiena : 0)]}>
                            <boxGeometry args={[w + 2 * t, curvePositions.L_out - h / 2, t]} />
                            <meshStandardMaterial
                              color={currentStep === 4 ? colors.panelActive : colors.panelStandard}
                              roughness={0.8}
                              transparent={currentStep === 4}
                              opacity={currentStep === 4 ? 0.85 : 1}
                            />
                          </mesh>
                          {/* Fronte Tratto 2 (Lungo) */}
                          <mesh castShadow receiveShadow position={[0, curvePositions.L_out / 2 - h / 4 - t / 2, h / 2 + t / 2 + (currentStep === 4 ? curvePositions.expFronte : 0)]}>
                            <boxGeometry args={[w + 2 * t, curvePositions.L_out + h / 2 + t, t]} />
                            <meshStandardMaterial
                              color={currentStep === 4 ? colors.panelActive : colors.panelStandard}
                              roughness={0.8}
                              transparent={currentStep === 4}
                              opacity={currentStep === 4 ? 0.85 : 1}
                            />
                          </mesh>
                        </group>
                      )}
                    </group>
                  )}

                  {/* STEP 6: Coprigiunti */}
                  {currentStep >= 6 && (
                    <group>
                      {/* Coprigiunto Ingresso (pavimento o estremità 1) */}
                      <group position={[0, 0, -curvePositions.L_in - (currentStep === 6 ? curvePositions.expGiuntiVert : 0)]}>
                        <mesh castShadow receiveShadow position={[0, -h / 2 - 1.5 * t, 0]}>
                          <boxGeometry args={[w + 4 * t, t, 0.2]} />
                          <meshStandardMaterial color={colors.panelStandard} roughness={0.8} />
                        </mesh>
                        <mesh castShadow receiveShadow position={[0, h / 2 + 1.5 * t, 0]}>
                          <boxGeometry args={[w + 4 * t, t, 0.2]} />
                          <meshStandardMaterial color={colors.panelStandard} roughness={0.8} />
                        </mesh>
                        <mesh castShadow receiveShadow position={[-w / 2 - 1.5 * t, 0, 0]}>
                          <boxGeometry args={[t, h + 2 * t, 0.2]} />
                          <meshStandardMaterial color={colors.panelStandard} roughness={0.8} />
                        </mesh>
                        <mesh castShadow receiveShadow position={[w / 2 + 1.5 * t, 0, 0]}>
                          <boxGeometry args={[t, h + 2 * t, 0.2]} />
                          <meshStandardMaterial color={colors.panelStandard} roughness={0.8} />
                        </mesh>
                      </group>

                      {/* Coprigiunto Uscita */}
                      <group position={[0, curvePositions.L_out + (currentStep === 6 ? curvePositions.expGiuntiVert : 0), 0]} rotation={[Math.PI / 2, 0, 0]}>
                        <mesh castShadow receiveShadow position={[0, -h / 2 - 1.5 * t, 0]}>
                          <boxGeometry args={[w + 4 * t, t, 0.2]} />
                          <meshStandardMaterial color={colors.panelStandard} roughness={0.8} />
                        </mesh>
                        <mesh castShadow receiveShadow position={[0, h / 2 + 1.5 * t, 0]}>
                          <boxGeometry args={[w + 4 * t, t, 0.2]} />
                          <meshStandardMaterial color={colors.panelStandard} roughness={0.8} />
                        </mesh>
                        <mesh castShadow receiveShadow position={[-w / 2 - 1.5 * t, 0, 0]}>
                          <boxGeometry args={[t, h + 2 * t, 0.2]} />
                          <meshStandardMaterial color={colors.panelStandard} roughness={0.8} />
                        </mesh>
                        <mesh castShadow receiveShadow position={[w / 2 + 1.5 * t, 0, 0]}>
                          <boxGeometry args={[t, h + 2 * t, 0.2]} />
                          <meshStandardMaterial color={colors.panelStandard} roughness={0.8} />
                        </mesh>
                      </group>
                    </group>
                  )}
                </group>
              )}
            </group>
          ) : (
            // 3. CANNE SHUNT (Doppio Canale Parallelo Affiancato con Spaccato e Percorso Fumo)
            <group>
              {/* STEP 1: Staffaggio a parete */}
              {currentStep >= 1 && (
                <group>
                  {/* Barra di fondo a parete (Larga per contenere entrambi i canali) */}
                  <mesh castShadow receiveShadow position={[0, -h / 2 - t - 0.02, 0]}>
                    <boxGeometry args={[2 * w + 4 * t + 0.16, 0.04, 0.04]} />
                    <meshStandardMaterial
                      color={currentStep === 1 ? colors.metalHighlight : colors.metalStructure}
                      roughness={0.2}
                      metalness={0.8}
                    />
                  </mesh>
                  {/* Staffa laterale sinistra */}
                  <mesh castShadow receiveShadow position={[-w - 1.5 * t - 0.01, 0, 0]}>
                    <boxGeometry args={[0.02, h + 2 * t + 0.06, 0.02]} />
                    <meshStandardMaterial
                      color={currentStep === 1 ? colors.metalHighlight : colors.metalStructure}
                      roughness={0.2}
                      metalness={0.8}
                    />
                  </mesh>
                  {/* Staffa laterale destra */}
                  <mesh castShadow receiveShadow position={[w + 1.5 * t + 0.01, 0, 0]}>
                    <boxGeometry args={[0.02, h + 2 * t + 0.06, 0.02]} />
                    <meshStandardMaterial
                      color={currentStep === 1 ? colors.metalHighlight : colors.metalStructure}
                      roughness={0.2}
                      metalness={0.8}
                    />
                  </mesh>
                </group>
              )}

              {/* STEP 2: Canale Dritto (Retro SX, Fianco SX e Parete Divisoria Centrale SX) */}
              {currentStep >= 2 && (
                <group>
                  {/* Schiena SX (Copre da -w - 2t a 0, quindi larghezza w + 2t) */}
                  <mesh castShadow receiveShadow position={[-w / 2 - t, -h / 2 - t / 2 - (currentStep === 2 ? 0.15 : 0), 0]}>
                    <boxGeometry args={[w + 2 * t, t, l]} />
                    <meshStandardMaterial
                      color={currentStep === 2 ? colors.panelActive : colors.panelStandard}
                      roughness={0.8}
                      transparent={currentStep === 2}
                      opacity={currentStep === 2 ? 0.85 : 1}
                    />
                  </mesh>
                  {/* Fianco SX Esterno */}
                  <mesh castShadow receiveShadow position={[-w - 1.5 * t - (currentStep === 2 ? 0.15 : 0), 0, 0]}>
                    <boxGeometry args={[t, h, l]} />
                    <meshStandardMaterial
                      color={currentStep === 2 ? colors.panelActive : colors.panelStandard}
                      roughness={0.8}
                      transparent={currentStep === 2}
                      opacity={currentStep === 2 ? 0.85 : 1}
                    />
                  </mesh>
                  {/* Parete Divisoria Centrale SX (con finestra di passaggio a 3/4 altezza: Z = l/4) */}
                  {/* Divisoria Inferiore SX */}
                  <mesh castShadow receiveShadow position={[-t / 2 - (currentStep === 2 ? 0.15 : 0), 0, -l / 8 - 0.05]}>
                    <boxGeometry args={[t, h, 0.75 * l - 0.1]} />
                    <meshStandardMaterial
                      color={currentStep === 2 ? colors.panelActive : colors.panelStandard}
                      roughness={0.8}
                      transparent={currentStep === 2}
                      opacity={currentStep === 2 ? 0.85 : 1}
                    />
                  </mesh>
                  {/* Divisoria Superiore SX */}
                  <mesh castShadow receiveShadow position={[-t / 2 - (currentStep === 2 ? 0.15 : 0), 0, 0.375 * l + 0.05]}>
                    <boxGeometry args={[t, h, 0.25 * l - 0.1]} />
                    <meshStandardMaterial
                      color={currentStep === 2 ? colors.panelActive : colors.panelStandard}
                      roughness={0.8}
                      transparent={currentStep === 2}
                      opacity={currentStep === 2 ? 0.85 : 1}
                    />
                  </mesh>
                </group>
              )}

              {/* STEP 3: Canale Shunt (Retro DX, Fianco DX, Divisoria Centrale DX e Setto Deviatore) */}
              {currentStep >= 3 && (
                <group>
                  {/* Schiena DX (Copre da 0 a w + 2t, larghezza w + 2t) */}
                  <mesh castShadow receiveShadow position={[w / 2 + t, -h / 2 - t / 2 - (currentStep === 3 ? 0.15 : 0), 0]}>
                    <boxGeometry args={[w + 2 * t, t, l]} />
                    <meshStandardMaterial
                      color={currentStep === 3 ? colors.panelActive : colors.panelStandard}
                      roughness={0.8}
                      transparent={currentStep === 3}
                      opacity={currentStep === 3 ? 0.85 : 1}
                    />
                  </mesh>
                  {/* Fianco DX Esterno */}
                  <mesh castShadow receiveShadow position={[w + 1.5 * t + (currentStep === 3 ? 0.15 : 0), 0, 0]}>
                    <boxGeometry args={[t, h, l]} />
                    <meshStandardMaterial
                      color={currentStep === 3 ? colors.panelActive : colors.panelStandard}
                      roughness={0.8}
                      transparent={currentStep === 3}
                      opacity={currentStep === 3 ? 0.85 : 1}
                    />
                  </mesh>
                  {/* Parete Divisoria Centrale DX (con finestra di passaggio, adiacente a quella SX, a 3/4 altezza) */}
                  {/* Divisoria Inferiore DX */}
                  <mesh castShadow receiveShadow position={[t / 2 + (currentStep === 3 ? 0.15 : 0), 0, -l / 8 - 0.05]}>
                    <boxGeometry args={[t, h, 0.75 * l - 0.1]} />
                    <meshStandardMaterial
                      color={currentStep === 3 ? colors.panelActive : colors.panelStandard}
                      roughness={0.8}
                      transparent={currentStep === 3}
                      opacity={currentStep === 3 ? 0.85 : 1}
                    />
                  </mesh>
                  {/* Divisoria Superiore DX */}
                  <mesh castShadow receiveShadow position={[t / 2 + (currentStep === 3 ? 0.15 : 0), 0, 0.375 * l + 0.05]}>
                    <boxGeometry args={[t, h, 0.25 * l - 0.1]} />
                    <meshStandardMaterial
                      color={currentStep === 3 ? colors.panelActive : colors.panelStandard}
                      roughness={0.8}
                      transparent={currentStep === 3}
                      opacity={currentStep === 3 ? 0.85 : 1}
                    />
                  </mesh>
                  {/* Setto Deviatore Interno (Antiriflusso inclinato a 3/4, ruotato solo su Y, complanare alle schiene) */}
                  <mesh
                    castShadow
                    receiveShadow
                    position={[w / 2 + t + (currentStep === 3 ? 0.15 : 0), 0, l / 4 - 0.1]}
                    rotation={[0, -Math.atan2(0.2, w), 0]}
                  >
                    <boxGeometry args={[Math.sqrt(w * w + 0.04), h, t]} />
                    <meshStandardMaterial
                      color={currentStep === 3 ? colors.panelActive : colors.panelStandard}
                      roughness={0.8}
                      transparent={currentStep === 3}
                      opacity={currentStep === 3 ? 0.85 : 1}
                    />
                  </mesh>
                </group>
              )}

              {/* STEP 4: Chiusura Canale Dritto (Fronte SX) */}
              {currentStep >= 4 && (
                <mesh
                  castShadow
                  receiveShadow
                  position={[-w / 2 - t, h / 2 + t / 2 + (currentStep === 4 ? 0.15 : 0), 0]}
                >
                  <boxGeometry args={[w + 2 * t, t, l]} />
                  <meshStandardMaterial
                    color={currentStep === 4 ? colors.panelActive : colors.panelStandard}
                    roughness={0.8}
                    transparent={currentStep === 4 || currentStep === 9}
                    opacity={currentStep === 4 ? 0.85 : (currentStep === 9 ? 0.25 : 1)}
                  />
                </mesh>
              )}

              {/* STEP 5: Chiusura Canale Shunt (Fronte DX Inferiore e Superiore) */}
              {currentStep >= 5 && (
                <group>
                  {/* Fronte DX Inferiore (Lascia libera l'altezza dell'innesto a Z = -0.1) */}
                  <mesh castShadow receiveShadow position={[w / 2 + t, h / 2 + t / 2 + (currentStep === 5 ? 0.15 : 0), -l / 4 - 0.1]}>
                    <boxGeometry args={[w + 2 * t, t, l / 2 - 0.2]} />
                    <meshStandardMaterial
                      color={currentStep === 5 ? colors.panelActive : colors.panelStandard}
                      roughness={0.8}
                      transparent={currentStep === 5 || currentStep === 9}
                      opacity={currentStep === 5 ? 0.85 : (currentStep === 9 ? 0.25 : 1)}
                    />
                  </mesh>
                  {/* Fronte DX Superiore */}
                  <mesh castShadow receiveShadow position={[w / 2 + t, h / 2 + t / 2 + (currentStep === 5 ? 0.15 : 0), l / 4]}>
                    <boxGeometry args={[w + 2 * t, t, l / 2]} />
                    <meshStandardMaterial
                      color={currentStep === 5 ? colors.panelActive : colors.panelStandard}
                      roughness={0.8}
                      transparent={currentStep === 5 || currentStep === 9}
                      opacity={currentStep === 5 ? 0.85 : (currentStep === 9 ? 0.25 : 1)}
                    />
                  </mesh>
                </group>
              )}

              {/* STEP 6: Coprigiunti Esterni (Avvolgono entrambi i canali assieme) */}
              {currentStep >= 6 && (
                <group>
                  {/* Coprigiunto Superiore (Z = l/2) */}
                  <group position={[0, 0, l / 2 + (currentStep === 6 ? 0.15 : 0)]}>
                    <mesh castShadow receiveShadow position={[0, -h / 2 - 1.5 * t, 0]}>
                      <boxGeometry args={[2 * w + 6 * t, t, 0.15]} />
                      <meshStandardMaterial color={colors.panelStandard} roughness={0.8} />
                    </mesh>
                    <mesh castShadow receiveShadow position={[0, h / 2 + 1.5 * t, 0]}>
                      <boxGeometry args={[2 * w + 6 * t, t, 0.15]} />
                      <meshStandardMaterial color={colors.panelStandard} roughness={0.8} />
                    </mesh>
                    <mesh castShadow receiveShadow position={[-w - 2.5 * t, 0, 0]}>
                      <boxGeometry args={[t, h + 2 * t, 0.15]} />
                      <meshStandardMaterial color={colors.panelStandard} roughness={0.8} />
                    </mesh>
                    <mesh castShadow receiveShadow position={[w + 2.5 * t, 0, 0]}>
                      <boxGeometry args={[t, h + 2 * t, 0.15]} />
                      <meshStandardMaterial color={colors.panelStandard} roughness={0.8} />
                    </mesh>
                  </group>

                  {/* Coprigiunto Inferiore (Z = -l/2) */}
                  <group position={[0, 0, -l / 2 - (currentStep === 6 ? 0.15 : 0)]}>
                    <mesh castShadow receiveShadow position={[0, -h / 2 - 1.5 * t, 0]}>
                      <boxGeometry args={[2 * w + 6 * t, t, 0.15]} />
                      <meshStandardMaterial color={colors.panelStandard} roughness={0.8} />
                    </mesh>
                    <mesh castShadow receiveShadow position={[0, h / 2 + 1.5 * t, 0]}>
                      <boxGeometry args={[2 * w + 6 * t, t, 0.15]} />
                      <meshStandardMaterial color={colors.panelStandard} roughness={0.8} />
                    </mesh>
                    <mesh castShadow receiveShadow position={[-w - 2.5 * t, 0, 0]}>
                      <boxGeometry args={[t, h + 2 * t, 0.15]} />
                      <meshStandardMaterial color={colors.panelStandard} roughness={0.8} />
                    </mesh>
                    <mesh castShadow receiveShadow position={[w + 2.5 * t, 0, 0]}>
                      <boxGeometry args={[t, h + 2 * t, 0.15]} />
                      <meshStandardMaterial color={colors.panelStandard} roughness={0.8} />
                    </mesh>
                  </group>
                </group>
              )}

              {/* STEP 7: Innesto Secondario (Collettore di piano facoltativo) */}
              {currentStep >= 7 && (
                <group>
                  {/* Fondo Innesto */}
                  <mesh castShadow receiveShadow position={[w / 2 + t, h / 2 + t / 2 + 0.15 + (currentStep === 7 ? 0.15 : 0), -0.2 - t / 2]}>
                    <boxGeometry args={[w + 2 * t, 0.3, t]} />
                    <meshStandardMaterial
                      color={currentStep === 7 ? colors.panelActive : colors.panelStandard}
                      roughness={0.8}
                      transparent={currentStep === 7 || currentStep === 9}
                      opacity={currentStep === 7 ? 0.85 : (currentStep === 9 ? 0.25 : 1)}
                    />
                  </mesh>
                  {/* Coperchio Innesto */}
                  <mesh castShadow receiveShadow position={[w / 2 + t, h / 2 + t / 2 + 0.15 + (currentStep === 7 ? 0.15 : 0), 0 + t / 2]}>
                    <boxGeometry args={[w + 2 * t, 0.3, t]} />
                    <meshStandardMaterial
                      color={currentStep === 7 ? colors.panelActive : colors.panelStandard}
                      roughness={0.8}
                      transparent={currentStep === 7 || currentStep === 9}
                      opacity={currentStep === 7 ? 0.85 : (currentStep === 9 ? 0.25 : 1)}
                    />
                  </mesh>
                  {/* Fianco SX Innesto */}
                  <mesh castShadow receiveShadow position={[t / 2 + (currentStep === 7 ? -0.05 : 0), h / 2 + t / 2 + 0.15 + (currentStep === 7 ? 0.15 : 0), -0.1]}>
                    <boxGeometry args={[t, 0.3, 0.2]} />
                    <meshStandardMaterial
                      color={currentStep === 7 ? colors.panelActive : colors.panelStandard}
                      roughness={0.8}
                      transparent={currentStep === 7 || currentStep === 9}
                      opacity={currentStep === 7 ? 0.85 : (currentStep === 9 ? 0.25 : 1)}
                    />
                  </mesh>
                  {/* Fianco DX Innesto */}
                  <mesh castShadow receiveShadow position={[w + 1.5 * t + (currentStep === 7 ? 0.05 : 0), h / 2 + t / 2 + 0.15 + (currentStep === 7 ? 0.15 : 0), -0.1]}>
                    <boxGeometry args={[t, 0.3, 0.2]} />
                    <meshStandardMaterial
                      color={currentStep === 7 ? colors.panelActive : colors.panelStandard}
                      roughness={0.8}
                      transparent={currentStep === 7 || currentStep === 9}
                      opacity={currentStep === 7 ? 0.85 : (currentStep === 9 ? 0.25 : 1)}
                    />
                  </mesh>
                </group>
              )}

              {/* STEP 9: Spaccato e Percorso del fumo animato (Solo al passo finale) */}
              {currentStep === 9 && (
                <group>
                  {/* Flusso 1 (Da innesto secondario): entra, sale a DX, devia a SX lungo il deflettore ed entra in SX */}
                  <AnimatedSmokeParticle path={path1} speed={1.2} delay={0.0} />
                  <AnimatedSmokeParticle path={path1} speed={1.2} delay={0.5} />
                  <AnimatedSmokeParticle path={path1} speed={1.2} delay={1.0} />
                  <AnimatedSmokeParticle path={path1} speed={1.2} delay={1.5} />

                  {/* Flusso 2 (Da dritto SX): sale verticale dritto nel canale dritto di sinistra */}
                  <AnimatedSmokeParticle path={path2} speed={1.2} delay={0.0} />
                  <AnimatedSmokeParticle path={path2} speed={1.2} delay={0.5} />
                  <AnimatedSmokeParticle path={path2} speed={1.2} delay={1.0} />
                  <AnimatedSmokeParticle path={path2} speed={1.2} delay={1.5} />
                </group>
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
