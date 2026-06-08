"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";

// --- COMPONENTI 3D DEI PEZZI SPECIALI ---

// 1. Tratto Dritto con Coprigiunto e Staffaggio
function DrittoViewer({ w, h, l, t, conSupporti, exploded }: { w: number; h: number; l: number; t: number; conSupporti: boolean; exploded: boolean }) {
  const w_outer = w + 2 * t;
  const h_outer = h + 2 * t;
  const offset = exploded ? 0.12 : 0;

  return (
    <group>
      {/* Fondo */}
      <mesh castShadow receiveShadow position={[0, -h / 2 - t / 2 - offset, 0]}>
        <boxGeometry args={[w_outer, t, l]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.8} />
      </mesh>

      {/* Coperchio */}
      <mesh castShadow receiveShadow position={[0, h / 2 + t / 2 + offset, 0]}>
        <boxGeometry args={[w_outer, t, l]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.8} />
      </mesh>

      {/* Fianco SX */}
      <mesh castShadow receiveShadow position={[-w / 2 - t / 2 - offset, 0, 0]}>
        <boxGeometry args={[t, h, l]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.8} />
      </mesh>

      {/* Fianco DX */}
      <mesh castShadow receiveShadow position={[w / 2 + t / 2 + offset, 0, 0]}>
        <boxGeometry args={[t, h, l]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.8} />
      </mesh>

      {/* Coprigiunti in Silicato (Bande esterne) */}
      <group position={[0, 0, 0]}>
        {/* Coprigiunto orizzontale superiore */}
        <mesh castShadow position={[0, h / 2 + 1.5 * t + offset * 1.5, 0]}>
          <boxGeometry args={[w_outer + 4 * t, t, 0.20]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.8} />
        </mesh>
        {/* Coprigiunto orizzontale inferiore */}
        <mesh castShadow position={[0, -h / 2 - 1.5 * t - offset * 1.5, 0]}>
          <boxGeometry args={[w_outer + 4 * t, t, 0.20]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.8} />
        </mesh>
        {/* Coprigiunto verticale sinistro */}
        <mesh castShadow position={[-w / 2 - 1.5 * t - offset * 1.5, 0, 0]}>
          <boxGeometry args={[t, h_outer, 0.20]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.8} />
        </mesh>
        {/* Coprigiunto verticale destro */}
        <mesh castShadow position={[w / 2 + 1.5 * t + offset * 1.5, 0, 0]}>
          <boxGeometry args={[t, h_outer, 0.20]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.8} />
        </mesh>
      </group>

      {/* Staffaggio asolato e pendini (visualizzati solo se richiesto) */}
      {conSupporti && (
        <group position={[0, 0, 0]}>
          {/* Barra asolata sotto il canale */}
          <mesh castShadow position={[0, -h / 2 - t - 0.03 - offset, 0]}>
            <boxGeometry args={[w_outer + 0.16, 0.04, 0.04]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.2} metalness={0.8} />
          </mesh>
          {/* Pendino SX */}
          <mesh position={[-w_outer / 2 - 0.06, 0.6 - h / 2, 0]}>
            <cylinderGeometry args={[0.006, 0.006, 1.4]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.7} />
          </mesh>
          {/* Pendino DX */}
          <mesh position={[w_outer / 2 + 0.06, 0.6 - h / 2, 0]}>
            <cylinderGeometry args={[0.006, 0.006, 1.4]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.7} />
          </mesh>
        </group>
      )}
    </group>
  );
}

// 2. Gomito a 90 Gradi (Pezzo Unico Sagomato)
function GomitoViewer({ w, h, t, exploded }: { w: number; h: number; t: number; exploded: boolean }) {
  const w_outer = w + 2 * t;
  const h_outer = h + 2 * t;
  const offset = exploded ? 0.12 : 0;

  // L'ingombro della curva è pari a w_outer + un tratto rettilineo di innesto (es. 30cm)
  const L_leg = w_outer + 0.30;

  return (
    <group position={[-L_leg / 4, 0, -L_leg / 4]}>
      {/* Fondo a L (due box accoppiati) */}
      <group position={[0, -h / 2 - t / 2 - offset, 0]}>
        <mesh castShadow receiveShadow position={[0, 0, L_leg / 4]}>
          <boxGeometry args={[w_outer, t, L_leg]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.8} />
        </mesh>
        <mesh castShadow receiveShadow position={[L_leg / 2, 0, -w_outer / 2 + t / 2]}>
          <boxGeometry args={[L_leg - w_outer, t, w_outer]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.8} />
        </mesh>
      </group>

      {/* Coperchio a L */}
      <group position={[0, h / 2 + t / 2 + offset, 0]}>
        <mesh castShadow receiveShadow position={[0, 0, L_leg / 4]}>
          <boxGeometry args={[w_outer, t, L_leg]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.8} />
        </mesh>
        <mesh castShadow receiveShadow position={[L_leg / 2, 0, -w_outer / 2 + t / 2]}>
          <boxGeometry args={[L_leg - w_outer, t, w_outer]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.8} />
        </mesh>
      </group>

      {/* Fianco Interno Corto (angolo interno, due lastre verticali ad angolo) */}
      <mesh castShadow position={[w / 2 + t / 2 + offset, 0, L_leg / 4 - w_outer / 2]}>
        <boxGeometry args={[t, h, L_leg - w_outer]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.8} />
      </mesh>
      <mesh castShadow position={[L_leg / 2 + w_outer / 2 - t / 2, 0, -w / 2 - t / 2 - offset]}>
        <boxGeometry args={[L_leg - w_outer, h, t]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.8} />
      </mesh>

      {/* Fianco Esterno Lungo (faccia esterna, due lastre verticali ad angolo) */}
      <mesh castShadow position={[-w / 2 - t / 2 - offset, 0, L_leg / 4]}>
        <boxGeometry args={[t, h, L_leg]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.8} />
      </mesh>
      <mesh castShadow position={[L_leg / 2, 0, w / 2 + t / 2 + offset]}>
        <boxGeometry args={[L_leg + t, h, t]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.8} />
      </mesh>
    </group>
  );
}

// 3. Canna Shunt (Doppio Condotto con Deflettore)
function ShuntViewer({ w, h, l, t, spaccato, exploded }: { w: number; h: number; l: number; t: number; spaccato: boolean; exploded: boolean }) {
  const w_outer = w + 2 * t;
  const h_outer = h + 2 * t;
  const offset = exploded ? 0.10 : 0;

  return (
    <group position={[0, 0, 0]}>
      {/* ── CANALE COLLETORE (SINISTRO) ── */}
      <group position={[-w_outer / 2 - t / 2, 0, 0]}>
        {/* Fondo */}
        <mesh castShadow position={[0, -h / 2 - t / 2 - offset, 0]}>
          <boxGeometry args={[w_outer, t, l]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.8} />
        </mesh>
        {/* Coperchio */}
        {!spaccato && (
          <mesh castShadow position={[0, h / 2 + t / 2 + offset, 0]}>
            <boxGeometry args={[w_outer, t, l]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.8} />
          </mesh>
        )}
        {/* Fianco Sinistro (Esterno) */}
        <mesh castShadow position={[-w / 2 - t / 2 - offset, 0, 0]}>
          <boxGeometry args={[t, h, l]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.8} />
        </mesh>
        {/* Fianco Destro (Divisorio Centrale 1) */}
        <mesh castShadow position={[w / 2 + t / 2, 0, 0]}>
          <boxGeometry args={[t, h, l]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.8} />
        </mesh>
      </group>

      {/* ── CANALE DERIVATO / SHUNT (DESTRO) ── */}
      <group position={[w_outer / 2 + t / 2, 0, 0]}>
        {/* Fondo */}
        <mesh castShadow position={[0, -h / 2 - t / 2 - offset, 0]}>
          <boxGeometry args={[w_outer, t, l]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.8} />
        </mesh>
        {/* Coperchio */}
        <mesh castShadow position={[0, h / 2 + t / 2 + offset, 0]}>
          <boxGeometry args={[w_outer, t, l]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.8} />
        </mesh>
        {/* Fianco Destro (Esterno) */}
        {!spaccato && (
          <mesh castShadow position={[w / 2 + t / 2 + offset, 0, 0]}>
            <boxGeometry args={[t, h, l]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.8} />
          </mesh>
        )}
        {/* Fianco Sinistro (Divisorio Centrale 2) */}
        <mesh castShadow position={[-w / 2 - t / 2, 0, 0]}>
          <boxGeometry args={[t, h, l]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.8} />
        </mesh>

        {/* Deflettore Interno inclinato a 45 gradi */}
        <mesh position={[0, 0, -l / 6]} rotation={[0, -Math.PI / 4, 0]}>
          <boxGeometry args={[0.015, h - 0.02, w_outer * 0.8]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.7} />
        </mesh>
      </group>
    </group>
  );
}

export default function RenderDisegnoPage() {
  const [mounted, setMounted] = useState(false);

  // Stati dei parametri dimensionali
  const [pezzoTipo, setPezzoTipo] = useState<"dritto" | "gomito" | "shunt">("dritto");
  const [wInput, setWInput] = useState<string>("40");
  const [hInput, setHInput] = useState<string>("30");
  const [lInput, setLInput] = useState<string>("120");
  const [tInput, setTInput] = useState<string>("50");

  const [conSupporti, setConSupporti] = useState<boolean>(true);
  const [exploded, setExploded] = useState<boolean>(false);
  const [spaccato, setSpaccato] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Calcolo delle quote reali (numericamente sicure per Three.js)
  const w = useMemo(() => Math.max(1, parseFloat(wInput) || 40) * 0.01, [wInput]);
  const h = useMemo(() => Math.max(1, parseFloat(hInput) || 30) * 0.01, [hInput]);
  const l = useMemo(() => Math.max(1, parseFloat(lInput) || 120) * 0.01, [lInput]);
  const t = useMemo(() => Math.max(1, parseFloat(tInput) || 50) * 0.001, [tInput]);

  if (!mounted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white/50 space-y-3">
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        <p className="text-sm">Caricamento Vista 3D...</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen w-full flex flex-col p-4 md:p-6 text-white"
      style={{
        background: "radial-gradient(circle at top, hsl(220 35% 12%), hsl(220 35% 6%))",
      }}
    >
      {/* Header */}
      <div className="w-full flex items-center justify-between pb-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <Link
            href="/settings"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-white transition-colors"
          >
            ← Impostazioni
          </Link>
          <span className="text-gray-500">/</span>
          <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">
            Libreria Render per Disegno
          </span>
        </div>
      </div>

      {/* Titolo e Descrizione */}
      <div className="pt-6 pb-4 space-y-2">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
          🎨 Visualizzatore Pezzi Speciali Parametrici
        </h1>
        <p className="text-xs md:text-sm text-gray-400 max-w-3xl leading-relaxed">
          Consulta ed esporta viste 3D ad alta definizione dei singoli componenti speciali (Gomiti a 90°, Innesti Shunt, Tratti Dritti con Coprigiunti). Questo strumento permette di visualizzare i dettagli di sovrapposizione e spessore pronti per essere raffigurati nelle tavole di cantiere.
        </p>
      </div>

      {/* Sezione Layout a due colonne */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start mt-4">
        {/* Colonna SX: Configurazione Dimensioni */}
        <div className="lg:col-span-4 space-y-6">
          <div className="p-5 bg-white/[0.015] border border-white/5 rounded-2xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-white/5 pb-2.5">
              <span>📐</span> Parametri Pezzo Speciale
            </h3>

            {/* Selezione Pezzo */}
            <div className="space-y-1.5">
              <label className="text-xs text-white/50 block font-bold">Tipo di Pezzo</label>
              <select
                value={pezzoTipo}
                onChange={(e) => setPezzoTipo(e.target.value as any)}
                className="w-full px-3 py-2.5 rounded-xl bg-bg border border-border text-sm text-white focus:border-brand outline-none cursor-pointer"
                style={{ background: "hsl(220 26% 14%)", border: "1px solid hsl(220 20% 22%)" }}
              >
                <option value="dritto">Tratto Dritto con Coprigiunto</option>
                <option value="gomito">Gomito a 90° (Curva)</option>
                <option value="shunt">Canna Shunt (Doppio Condotto)</option>
              </select>
            </div>

            {/* Inputs dimensionali */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-white/50 block">Foro Larghezza W (cm)</label>
                <input
                  type="text"
                  value={wInput}
                  onChange={(e) => setWInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm text-white outline-none"
                  style={{ background: "hsl(220 26% 14%)", border: "1px solid hsl(220 20% 22%)" }}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-white/50 block">Foro Altezza H (cm)</label>
                <input
                  type="text"
                  value={hInput}
                  onChange={(e) => setHInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm text-white outline-none"
                  style={{ background: "hsl(220 26% 14%)", border: "1px solid hsl(220 20% 22%)" }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-white/50 block">Lunghezza L (cm)</label>
                <input
                  type="text"
                  value={lInput}
                  disabled={pezzoTipo === "gomito"}
                  className="w-full px-3 py-2 rounded-xl text-sm text-white outline-none disabled:opacity-40"
                  style={{ background: "hsl(220 26% 14%)", border: "1px solid hsl(220 20% 22%)" }}
                  onChange={(e) => setLInput(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-white/50 block">Spessore Silicato (mm)</label>
                <input
                  type="text"
                  value={tInput}
                  className="w-full px-3 py-2 rounded-xl text-sm text-white outline-none"
                  style={{ background: "hsl(220 26% 14%)", border: "1px solid hsl(220 20% 22%)" }}
                  onChange={(e) => setTInput(e.target.value)}
                />
              </div>
            </div>

            {/* Opzioni Visualizzatore */}
            <div className="border-t border-white/5 pt-3 space-y-3.5">
              <span className="text-xs font-bold text-white block">🔧 Opzioni di Vista</span>
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/70">Esploso Sormonti (Gaps)</span>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={exploded}
                    onChange={(e) => setExploded(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[hsl(220,90%,56%)]"></div>
                </label>
              </div>

              {pezzoTipo === "dritto" && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/70">Mostra Pendini & Staffe</span>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={conSupporti}
                      onChange={(e) => setConSupporti(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[hsl(220,90%,56%)]"></div>
                  </label>
                </div>
              )}

              {pezzoTipo === "shunt" && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/70">Vista Spaccata Interna</span>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={spaccato}
                      onChange={(e) => setSpaccato(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[hsl(220,90%,56%)]"></div>
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Colonna DX: Visualizzatore 3D */}
        <div className="lg:col-span-8 space-y-4">
          <div className="p-5 bg-white/[0.015] border border-white/5 rounded-2xl space-y-4 flex flex-col">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>📐</span> Vista 3D Interattiva
              </h3>
              <span className="text-xs text-gray-500 font-mono">
                {pezzoTipo === "gomito" 
                  ? `Curve L_leg: ${((w + 2 * t) * 100 + 30).toFixed(0)}cm` 
                  : `Sezione: ${(w * 100).toFixed(0)}x${(h * 100).toFixed(0)}cm`}
              </span>
            </div>

            <div
              className="w-full h-[480px] rounded-xl overflow-hidden relative border border-white/5"
              style={{ background: "hsl(228, 39%, 8%)" }}
            >
              <Canvas camera={{ position: [1.2, 1.2, 1.4], fov: 45 }} shadows>
                <ambientLight intensity={1.1} />
                <directionalLight position={[5, 10, 5]} intensity={1.5} castShadow />
                <directionalLight position={[-5, 5, -5]} intensity={0.5} />

                {pezzoTipo === "dritto" && (
                  <DrittoViewer w={w} h={h} l={l} t={t} conSupporti={conSupporti} exploded={exploded} />
                )}

                {pezzoTipo === "gomito" && (
                  <GomitoViewer w={w} h={h} t={t} exploded={exploded} />
                )}

                {pezzoTipo === "shunt" && (
                  <ShuntViewer w={w} h={h} l={l} t={t} spaccato={spaccato} exploded={exploded} />
                )}

                <Grid
                  renderOrder={-1}
                  position={[0, -h / 2 - t - 0.05, 0]}
                  args={[10, 10]}
                  cellSize={0.2}
                  cellThickness={0.5}
                  cellColor="hsl(220, 20%, 20%)"
                  sectionSize={1.0}
                  sectionThickness={1}
                  sectionColor="hsl(220, 20%, 32%)"
                  fadeDistance={10}
                />

                <OrbitControls />
              </Canvas>

              <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-[10px] text-white/50 pointer-events-none select-none border border-white/5">
                Trascina per ruotare lo spazio 3D • Pizzica/Rotella per zoomare
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-blue-500/5 border border-blue-500/10 text-xs text-blue-300/80 leading-relaxed">
              💡 <strong>Consiglio di disegno:</strong> I coprigiunti esterni in silicato (visibili nel pezzo dritto) sormontano la giunzione di 10-20 cm e sono avvitati con passo parametrizzato. Nella vista "Gomito", l'incrocio delle lastre è alternato sugli spigoli per assicurare la massima tenuta ai fumi e al calore.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
