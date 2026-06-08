"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Cassonetti3DViewer from "./assembly/Cassonetti3DViewer";

interface Project {
  id: string;
  name: string;
}

interface MaterialCategory {
  id: string;
  name: string;
  tags?: string[];
}

interface CassonettiInstructionsClientProps {
  project: Project;
  catalogMaterials: MaterialCategory[];
}

export default function CassonettiInstructionsClient({
  project,
  catalogMaterials,
}: CassonettiInstructionsClientProps) {
  // Stato parametri dimensionali (in cm)
  const [widthCm, setWidthCm] = useState(40);
  const [heightCm, setHeightCm] = useState(30);
  const [lengthCm, setLengthCm] = useState(100);
  const [thicknessCm, setThicknessCm] = useState(3); // default 30mm

  // Stato tipo di montaggio e configurazione lati
  const [positioning, setPositioning] = useState<"solaio" | "parete">("solaio");
  const [sides, setSides] = useState<"2-lati" | "3-lati" | "4-lati">("3-lati");

  // Step attivo delle istruzioni
  const [currentStep, setCurrentStep] = useState(1);

  // Spessori in mm per comodità
  const thicknessMm = thicknessCm * 10;
  const wMm = widthCm * 10;
  const hMm = heightCm * 10;
  const lMm = lengthCm * 10;

  // Generazione dinamica dei passaggi in base a posizionamento e lati
  const steps = useMemo(() => {
    const isParete = positioning === "parete";

    if (sides === "2-lati") {
      return [
        {
          num: 1,
          title: "🛠️ Struttura e Guide di Ancoraggio",
          desc: isParete
            ? "Fissa verticalmente all'angolo tra le due pareti i profili metallici di supporto ad L utilizzando tasselli adatti alla muratura."
            : "Fissa a solaio e a parete gli angolari metallici di supporto ad L lungo l'angolo di scorrimento degli impianti.",
          materials: ["Profili metallici ad L", "Tasselli di ancoraggio e viti"],
        },
        {
          num: 2,
          title: "🧱 Lastra Fianco Esterno",
          desc: `Monta la lastra del fianco esterno da ${heightCm} x ${lengthCm} cm fissandola meccanicamente alle guide metalliche. *IMPORTANTE: Applicare il collante tagliafuoco su tutti i bordi di contatto.*`,
          materials: [
            `1x Lastra Fianco: ${heightCm} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`,
            "Collante e viti per silicato",
          ],
        },
        {
          num: 3,
          title: isParete ? "🔒 Lastra Frontale di Chiusura" : "🧱 Lastra Inferiore (Fondo)",
          desc: isParete
            ? `Posiziona e fissa la lastra frontale larga ${(widthCm + thicknessCm).toFixed(1)} cm in battuta sullo spessore del fianco precedentemente montato, sigillando il lato opposto direttamente a parete.`
            : `Fissa la lastra inferiore (fondo) larga ${(widthCm + thicknessCm).toFixed(1)} x ${lengthCm} cm. La lastra si sormonta in battuta sotto lo spessore del fianco e tocca a parete sul lato opposto.`,
          materials: [
            `1x Lastra ${isParete ? "Frontale" : "Fondo"}: ${(widthCm + thicknessCm).toFixed(1)} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`,
            "Viti e collante tagliafuoco",
          ],
        },
        {
          num: 4,
          title: "🔗 Giunti Coprigiunto Esterni",
          desc: "Applica le strisce coprigiunto esterne in silicato (larghezza 15 cm) a cavallo di tutte le giunzioni trasversali tra i pannelli per garantire la tenuta all'aria e al fuoco.",
          materials: ["Coprigiunti esterni in silicato (larghezza 15 cm)", "Viti e collante tagliafuoco"],
        },
        {
          num: 5,
          title: "✅ Cassonetto Completato",
          desc: `L'assemblaggio del cassonetto copri impianti a 2 lati ${isParete ? "a parete" : "a solaio"} è ultimato. Sigillare eventuali fessure residue con sigillante tagliafuoco intumescente.`,
          materials: ["Sigillante intumescente tagliafuoco"],
        },
      ];
    } else if (sides === "3-lati") {
      return [
        {
          num: 1,
          title: "🛠️ Tracciamento e Fissaggio Guide",
          desc: isParete
            ? "Tassella verticalmente a parete i due profili metallici di supporto ad L paralleli che guideranno l'ancoraggio dei fianchi."
            : "Traccia sul soffitto la larghezza del cassonetto e fissa i due profili metallici di supporto paralleli per appendere i fianchi.",
          materials: ["Profili metallici di supporto", "Tasselli di ancoraggio e viti"],
        },
        {
          num: 2,
          title: "🧱 Fianchi Laterali (SX e DX)",
          desc: `Monta le due lastre dei fianchi esterni da ${heightCm} x ${lengthCm} cm fissandole alle guide metalliche. *IMPORTANTE: Applicare il collante sui bordi superiori.*`,
          materials: [
            `2x Lastre Fianchi: ${heightCm} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`,
            "Collante e viti per silicato",
          ],
        },
        {
          num: 3,
          title: isParete ? "🔒 Lastra Frontale di Chiusura" : "🧱 Lastra Inferiore (Fondo)",
          desc: isParete
            ? `Monta la lastra frontale di chiusura larga ${(widthCm + 2 * thicknessCm).toFixed(1)} cm fissandola a sormonto sullo spessore di entrambi i fianchi laterali.`
            : `Fissa la lastra inferiore (fondo) larga ${(widthCm + 2 * thicknessCm).toFixed(1)} x ${lengthCm} cm a sormonto sotto lo spessore di entrambi i fianchi laterali.`,
          materials: [
            `1x Lastra ${isParete ? "Frontale" : "Fondo"}: ${(widthCm + 2 * thicknessCm).toFixed(1)} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`,
            "Viti e collante tagliafuoco",
          ],
        },
        {
          num: 4,
          title: "🔗 Giunti Coprigiunto Esterni",
          desc: "Applica le strisce coprigiunto in silicato (larghezza 15 cm) a cavallo di tutte le giunzioni esterne per assicurare la perfetta continuità tagliafuoco.",
          materials: ["Coprigiunti esterni in silicato", "Viti e collante tagliafuoco"],
        },
        {
          num: 5,
          title: "✅ Cassonetto Completato",
          desc: `Il cassonetto copri impianti a 3 lati ${isParete ? "a parete (U)" : "a solaio (U)"} è ultimato e pronto per la sigillatura dei giunti perimetrali a muro.`,
          materials: ["Sigillante intumescente tagliafuoco"],
        },
      ];
    } else {
      // 4 LATI
      return [
        {
          num: 1,
          title: "🛠️ Struttura di Sostegno e Sospensione",
          desc: isParete
            ? "Fissa a parete le staffe metalliche di sostegno posizionandole lungo la linea di sviluppo verticale del cavedio."
            : "Installa i pendini filettati a soffitto e livella le barre asolate di fondo per creare l'appoggio per il cassonetto sospeso.",
          materials: ["Pendini e barre asolate" , "Staffe a parete e tasselli"],
        },
        {
          num: 2,
          title: isParete ? "🧱 Schiena Posteriore" : "🧱 Lastra Superiore (Coperchio)",
          desc: isParete
            ? `Fissa la schiena posteriore larga ${(widthCm + 2 * thicknessCm).toFixed(1)} x ${lengthCm} cm alle staffe a parete prima di assemblare gli altri lati.`
            : `Posiziona la lastra superiore larga ${(widthCm + 2 * thicknessCm).toFixed(1)} x ${lengthCm} cm a ridosso del solaio appoggiandola sulla parte alta della struttura.`,
          materials: [
            `1x Lastra ${isParete ? "Schiena" : "Coperchio"}: ${(widthCm + 2 * thicknessCm).toFixed(1)} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`,
            "Viti e collante tagliafuoco",
          ],
        },
        {
          num: 3,
          title: "📐 Fianchi Laterali (SX e DX)",
          desc: `Fissa le due lastre dei fianchi laterali da ${heightCm} x ${lengthCm} cm ortogonalmente alla schiena/coperchio. *IMPORTANTE: Incollare e avvitare lungo tutti i bordi di contatto.*`,
          materials: [
            `2x Lastre Fianchi: ${heightCm} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`,
            "Viti e collante tagliafuoco",
          ],
        },
        {
          num: 4,
          title: isParete ? "🔒 Lastra Frontale di Chiusura" : "🧱 Lastra Inferiore (Fondo)",
          desc: isParete
            ? `Monta la lastra frontale di chiusura larga ${(widthCm + 2 * thicknessCm).toFixed(1)} cm per sigillare ermeticamente il cavedio a 4 lati.`
            : `Fissa la lastra inferiore (fondo) larga ${(widthCm + 2 * thicknessCm).toFixed(1)} x ${lengthCm} cm per completare la chiusura della condotta sospesa.`,
          materials: [
            `1x Lastra ${isParete ? "Frontale" : "Fondo"}: ${(widthCm + 2 * thicknessCm).toFixed(1)} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`,
            "Viti e collante tagliafuoco",
          ],
        },
        {
          num: 5,
          title: "🔗 Giunti Coprigiunto Esterni",
          desc: "Applica i coprigiunti in silicato sulle giunzioni perimetrali tra i segmenti, avvolgendo l'intero cassonetto su tutti i lati per garantire l'isolamento continuo.",
          materials: ["Coprigiunti esterni in silicato", "Viti e collante tagliafuoco"],
        },
        {
          num: 6,
          title: "✅ Cassonetto Completato",
          desc: `Il cassonetto isolato a 4 lati ${isParete ? "verticale" : "orizzontale"} è completato con successo.`,
          materials: ["Cassonetto 4 lati assemblato"],
        },
      ];
    }
  }, [positioning, sides, widthCm, heightCm, lengthCm, thicknessCm, thicknessMm]);

  return (
    <div
      className="min-h-screen w-full flex flex-col p-4 md:p-6 text-white"
      style={{
        background: "radial-gradient(circle at top, hsl(220 35% 12%), hsl(220 35% 6%))",
      }}
    >
      {/* Header navigazione */}
      <div className="w-full flex items-center justify-between pb-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <Link
            href="/projects/istruzioni"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-white transition-colors"
          >
            ← Torna alle Istruzioni
          </Link>
          <span className="text-gray-500">/</span>
          <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">
            {project.name}
          </span>
        </div>
        <div className="text-sm font-bold text-orange-400">🚧 Sezione Cassonetti Parametrici</div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 pt-6">
        {/* LATO SINISTRO: Configurazione e Visualizzatore 3D (7 colonne) */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          {/* Selettori Tab e Categorie */}
          <div
            className="p-4 rounded-2xl space-y-4"
            style={{
              background: "hsl(220 26% 14% / 0.8)",
              border: "1px solid hsl(220 20% 20%)",
            }}
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                📦 Configurazione Cassonetto
              </h2>
              {/* Tab Posizionamento */}
              <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
                <button
                  onClick={() => {
                    setPositioning("solaio");
                    setCurrentStep(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    positioning === "solaio"
                      ? "bg-white text-black shadow-lg"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  A Solaio (Oriz.)
                </button>
                <button
                  onClick={() => {
                    setPositioning("parete");
                    setCurrentStep(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    positioning === "parete"
                      ? "bg-white text-black shadow-lg"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  A Parete (Vert.)
                </button>
              </div>
            </div>

            {/* Selezione Lati */}
            <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-white/5">
              <span className="text-xs text-gray-400 font-semibold">Lati da Realizzare:</span>
              <div className="flex gap-2">
                {(["2-lati", "3-lati", "4-lati"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setSides(s);
                      setCurrentStep(1);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      sides === s
                        ? "bg-amber-500/20 border-amber-500 text-amber-400 font-extrabold"
                        : "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10"
                    }`}
                  >
                    {s === "2-lati" ? "2 Lati (Angolo)" : s === "3-lati" ? "3 Lati (A U)" : "4 Lati (Chiuso)"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Visualizzatore 3D (Canvas) */}
          <div
            className="flex-1 rounded-3xl overflow-hidden min-h-[350px] lg:min-h-[500px] relative border"
            style={{
              background: "radial-gradient(circle at center, hsl(220 25% 10%), hsl(220 30% 4%))",
              borderColor: "hsl(220 20% 18%)",
            }}
          >
            <Cassonetti3DViewer
              positioning={positioning}
              sides={sides}
              width={widthCm * 10}
              height={heightCm * 10}
              length={lengthCm * 10}
              thickness={thicknessCm * 10}
              currentStep={currentStep}
            />

            {/* Indicatore dello Step attivo sovrapposto in basso a sinistra */}
            <div className="absolute bottom-4 left-4 px-3.5 py-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-bold text-gray-300">
              PASSO {currentStep} DI {steps.length}
            </div>
          </div>
        </div>

        {/* LATO DESTRO: Configurazione Parametri, Distinta e Istruzioni (5 colonne) */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          {/* Box Parametri Slider */}
          <div
            className="p-5 rounded-2xl space-y-4"
            style={{
              background: "hsl(220 26% 14% / 0.8)",
              border: "1px solid hsl(220 20% 20%)",
            }}
          >
            <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-white/5 pb-2">
              📐 Parametri Geometria (cm)
            </h3>

            {/* Slider Larghezza */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Larghezza Interna (W):</span>
                <span className="text-amber-400 font-bold">{widthCm} cm</span>
              </div>
              <input
                type="range"
                min="20"
                max="120"
                step="5"
                value={widthCm}
                onChange={(e) => setWidthCm(Number(e.target.value))}
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>

            {/* Slider Altezza */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Altezza Interna (H):</span>
                <span className="text-amber-400 font-bold">{heightCm} cm</span>
              </div>
              <input
                type="range"
                min="20"
                max="100"
                step="5"
                value={heightCm}
                onChange={(e) => setHeightCm(Number(e.target.value))}
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>

            {/* Slider Lunghezza */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Lunghezza Segmento (L):</span>
                <span className="text-amber-400 font-bold">{lengthCm} cm</span>
              </div>
              <input
                type="range"
                min="50"
                max="150"
                step="10"
                value={lengthCm}
                onChange={(e) => setLengthCm(Number(e.target.value))}
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>

            {/* Selettore Spessore */}
            <div className="space-y-2 pt-2 border-t border-white/5">
              <span className="text-xs text-gray-400">Spessore Lastra Silicato:</span>
              <div className="flex gap-2">
                {[3, 4, 5].map((val) => (
                  <button
                    key={val}
                    onClick={() => setThicknessCm(val)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      thicknessCm === val
                        ? "bg-white text-black font-extrabold border-white"
                        : "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10"
                    }`}
                  >
                    {val * 10} mm
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Dettaglio del Passo Attivo */}
          {steps[currentStep - 1] && (
            <div
              className="p-5 rounded-2xl flex-1 flex flex-col justify-between space-y-4"
              style={{
                background: "hsl(220 26% 14% / 0.8)",
                border: "1px solid hsl(220 20% 20%)",
              }}
            >
              <div className="space-y-3">
                <div className="text-[10px] font-extrabold text-amber-400 uppercase tracking-widest">
                  Passo {currentStep} di {steps.length}
                </div>
                <h3 className="text-lg font-bold text-white">
                  {steps[currentStep - 1].title}
                </h3>
                <p className="text-xs text-gray-300 leading-relaxed font-sans">
                  {steps[currentStep - 1].desc}
                </p>

                {/* Materiali del passo */}
                <div className="pt-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                    📦 Componenti Necessari per il passo:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {steps[currentStep - 1].materials.map((mat, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-lg text-[9px] font-semibold bg-white/5 border border-white/5 text-gray-300"
                      >
                        {mat}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottoni di navigazione passi */}
              <div className="flex gap-3 pt-4 border-t border-white/5">
                <button
                  onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
                  disabled={currentStep === 1}
                  className="flex-1 py-3 px-4 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-all cursor-pointer text-center text-white"
                >
                  ◀ Precedente
                </button>
                <button
                  onClick={() => setCurrentStep((prev) => Math.min(steps.length, prev + 1))}
                  disabled={currentStep === steps.length}
                  className="flex-1 py-3 px-4 rounded-xl text-xs font-bold bg-white text-black hover:bg-white/95 disabled:opacity-30 transition-all cursor-pointer text-center"
                >
                  Successivo ▶
                </button>
              </div>

              {/* Distinta Taglio di Sintesi */}
              <div className="p-3.5 rounded-xl bg-black/20 border border-white/5 text-[10px] space-y-1.5 font-mono text-gray-400">
                <div className="text-white font-bold mb-1">📐 DISTINTA DI TAGLIO PRECOMPILATA:</div>
                {sides === "2-lati" ? (
                  <>
                    <div className="flex justify-between">
                      <span>• Fianco Esterno:</span>
                      <span className="text-white font-bold">1x {hMm} x {lMm} mm</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• Frontale / Fondo:</span>
                      <span className="text-white font-bold">1x {wMm + thicknessMm} x {lMm} mm</span>
                    </div>
                  </>
                ) : sides === "3-lati" ? (
                  <>
                    <div className="flex justify-between">
                      <span>• Fianchi Laterali (SX/DX):</span>
                      <span className="text-white font-bold">2x {hMm} x {lMm} mm</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• Frontale / Fondo:</span>
                      <span className="text-white font-bold">1x {wMm + 2 * thicknessMm} x {lMm} mm</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span>• Fianchi Laterali (SX/DX):</span>
                      <span className="text-white font-bold">2x {hMm} x {lMm} mm</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• Frontale / Retro (Fondo/Coperchio):</span>
                      <span className="text-white font-bold">2x {wMm + 2 * thicknessMm} x {lMm} mm</span>
                    </div>
                  </>
                )}
                <div className="text-[9px] text-gray-500 italic mt-1.5">
                  Nota: calcolo basato su ingombro {widthCm}x{heightCm}cm, spessore {thicknessMm}mm.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
