"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Assembly3DViewer from "./assembly/Assembly3DViewer";

interface Material {
  id: string;
  name: string;
  thickness_mm?: number;
}

interface Props {
  project: {
    id: string;
    name: string;
  };
  catalogMaterials: Material[];
  variant?: "con-giunto" | "senza-giunto";
}

export default function AssemblyInstructionsClient({ project, catalogMaterials, variant: initialVariant = "con-giunto" }: Props) {
  const [mounted, setMounted] = useState(false);

  // Stati del configuratore
  const [variant, setVariant] = useState<"con-giunto" | "senza-giunto">(initialVariant);
  const [subgroup, setSubgroup] = useState<"orizzontali" | "verticali">("orizzontali");
  const [itemType, setItemType] = useState<"dritte" | "curve">("dritte");
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>("");
  
  // Input testuali per consentire la cancellazione temporanea delle cifre
  const [widthCmInput, setWidthCmInput] = useState<string>("30");
  const [heightCmInput, setHeightCmInput] = useState<string>("30");
  const [lengthCmInput, setLengthCmInput] = useState<string>("250");

  // Calcolo delle dimensioni effettive (numericamente sicure per il motore 3D e i calcoli)
  const widthCm = useMemo(() => Math.max(10, parseInt(widthCmInput) || 10), [widthCmInput]);
  const heightCm = useMemo(() => Math.max(10, parseInt(heightCmInput) || 10), [heightCmInput]);
  const lengthCm = useMemo(() => Math.max(50, parseInt(lengthCmInput) || 50), [lengthCmInput]);

  // Step attivo delle istruzioni
  const [currentStep, setCurrentStep] = useState<number>(1);

  const handleBlur = (val: string, setVal: (s: string) => void, min: number, max: number) => {
    const parsed = parseInt(val);
    if (isNaN(parsed) || parsed < min) {
      setVal(min.toString());
    } else if (parsed > max) {
      setVal(max.toString());
    } else {
      setVal(parsed.toString());
    }
  };

  useEffect(() => {
    setMounted(true);
    // Inizializza cercando per default "L500 sp.50"
    if (catalogMaterials.length > 0) {
      const defaultMat = catalogMaterials.find((m) =>
        m.name.toLowerCase().includes("l500 sp.50")
      );
      if (defaultMat) {
        setSelectedMaterialId(defaultMat.id);
      } else {
        setSelectedMaterialId(catalogMaterials[0].id);
      }
    }
  }, [catalogMaterials]);

  // Materiale selezionato e spessore di default (50mm per L500 sp.50) se non impostato
  const activeMaterial = useMemo(() => {
    const mat = catalogMaterials.find((m) => m.id === selectedMaterialId);
    if (mat) {
      return {
        name: mat.name,
        thickness_mm: mat.thickness_mm ?? 50,
      };
    }
    // Fallback standard
    return {
      name: "L500 sp.50",
      thickness_mm: 50,
    };
  }, [selectedMaterialId, catalogMaterials]);

  const thicknessMm = activeMaterial.thickness_mm;
  const thicknessCm = thicknessMm / 10;

  // Conversione delle dimensioni impostate in mm
  const wMm = widthCm * 10;
  const hMm = heightCm * 10;
  const lMm = lengthCm * 10;

  // Calcolo delle lastre necessarie
  const isHorizontal = subgroup === "orizzontali";

  const fianchiText = isHorizontal ? "Fianchi (Laterali)" : "Fianchi (Laterali)";
  const coperchiText = isHorizontal ? "Coperchi (Fondo/Soffitto)" : "Lastre (Retro/Fronte)";

  // Dimensioni calcolate per la distinta di taglio
  const dimFianchi = {
    w: hMm, // i fianchi coprono l'altezza interna del foro
    l: lMm,
    q: 2,
  };

  const dimCoperchi = {
    w: wMm + 2 * thicknessMm, // il fondo e coperchio sormontano i fianchi
    l: lMm,
    q: 2,
  };

  // Definizione dei passaggi in base all'orientamento e alla variante (con-giunto o senza-giunto)
  const steps = useMemo(() => {
    const isWithJoint = variant === "con-giunto";

    if (isHorizontal) {
      if (isWithJoint) {
        return [
          {
            num: 1,
            title: "🛠️ Struttura di Sostegno",
            desc: "Fissa i pendini di sospensione a soffitto/parete adeguate al peso e posiziona le barre asolate di supporto livellandole accuratamente per l'appoggio della canalizzazione.",
            materials: ["Barre asolate di supporto", "Pendini filettati di sospensione (max 1 metro di distanza)", "Tasselli e ancoranti per calcestruzzo/laterizio"],
          },
          {
            num: 2,
            title: "🧱 Lastra Inferiore (Fondo)",
            desc: `Taglia la lastra di fondo con larghezza pari a ${widthCm + 2 * thicknessCm} cm (Foro interno ${widthCm} cm + 2 spessori da ${thicknessCm} cm) e lunghezza ${lengthCm} cm. Appoggiala e fissala sulle barre asolate di supporto.`,
            materials: [`1x Lastra Fondo: ${widthCm + 2 * thicknessCm} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`],
          },
          {
            num: 3,
            title: "📐 Lastre Fianchi (Laterali)",
            desc: `Taglia le 2 lastre dei fianchi laterali con altezza pari a ${heightCm} cm e lunghezza ${lengthCm} cm. Posizionale sopra la lastra di fondo e fissale meccanicamente con viti adeguate.`,
            materials: [`2x Lastre Fianchi: ${heightCm} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`],
          },
          {
            num: 4,
            title: "🔒 Chiusura Superiore (Coperchio)",
            desc: `Taglia la lastra superiore (coperchio alto) con larghezza pari a ${widthCm + 2 * thicknessCm} cm e lunghezza ${lengthCm} cm. Posizionala a chiusura superiore del canale e avvitala stabilmente per sigillare la canalizzazione.`,
            materials: [`1x Lastra Coperchio: ${widthCm + 2 * thicknessCm} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`],
          },
          {
            num: 5,
            title: "🛑 Tappo Terminale di Chiusura (Facoltativo)",
            desc: `Taglia il tappo di chiusura terminale con larghezza pari a ${widthCm + 2 * thicknessCm} cm e altezza pari a ${heightCm + 2 * thicknessCm} cm. Posizionalo all'estremità del canale per completare la chiusura e sigillare il lavoro.`,
            materials: [`1x Tappo Terminale: ${widthCm + 2 * thicknessCm} x ${heightCm + 2 * thicknessCm} cm (Spessore: ${thicknessMm} mm)`],
          },
          {
            num: 6,
            title: "🔗 Giunto Coprigiunto Esterno",
            desc: "Applica il giunto esterno largo da 10 a 20 cm a cavallo dell'estremità di uscita per unire le tratte della canalizzazione. Taglia i 4 pezzi coprigiunto dallo stesso materiale per fare tutto il giro esterno.",
            materials: [
              `2x Coprigiunto Orizzontale (Sopra/Sotto): ${widthCm + 4 * thicknessCm} x da 10 a 20 cm (Spessore: ${thicknessMm} mm)`,
              `2x Coprigiunto Verticale (Fianchi): ${heightCm + 2 * thicknessCm} x da 10 a 20 cm (Spessore: ${thicknessMm} mm)`,
            ],
          },
          {
            num: 7,
            title: "✅ Canalizzazione Completata",
            desc: "La canalizzazione è ora completata con tutte le staffe, i pannelli di rivestimento sigillati, il tappo di chiusura e la cornice del giunto esterno montata in posizione definitiva.",
            materials: ["Canalizzazione assemblata e pronta all'uso"],
          },
        ];
      } else {
        // Orizzontale senza giunto (sfalsato) - Esteso a due segmenti
        return [
          {
            num: 1,
            title: "🛠️ Struttura di Sostegno",
            desc: "Fissa i pendini di sospensione a soffitto/parete adeguate al peso e posiziona le barre asolate di supporto livellandole accuratamente per l'appoggio della canalizzazione.",
            materials: ["Barre asolate di supporto", "Pendini filettati di sospensione (max 1 metro di distanza)", "Tasselli e ancoranti per calcestruzzo/laterizio"],
          },
          {
            num: 2,
            title: "🧱 Primo Fondo Sfalsato (Dimezzato)",
            desc: `Taglia la prima lastra di fondo a metà lunghezza pari a ${lengthCm / 2} cm e larghezza ${widthCm + 2 * thicknessCm} cm. Appoggiala e fissala sulle barre asolate.`,
            materials: [`1x Primo Fondo (Mezzo): ${widthCm + 2 * thicknessCm} x ${lengthCm / 2} cm (Spessore: ${thicknessMm} mm)`],
          },
          {
            num: 3,
            title: "📐 Primi Fianchi Sfalsati (Laterali)",
            desc: `Taglia il fianco sinistro a metà lunghezza pari a ${lengthCm / 2} cm. Il fianco destro va tagliato e montato a lunghezza intera pari a ${lengthCm} cm. Questa disposizione sfalsata garantisce l'overlap strutturale.`,
            materials: [
              `1x Fianco SX 1 (Mezzo): ${heightCm} x ${lengthCm / 2} cm (Spessore: ${thicknessMm} mm)`,
              `1x Fianco DX 1 (Intero): ${heightCm} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`,
            ],
          },
          {
            num: 4,
            title: "🔒 Primo Coperchio (Intero)",
            desc: `Taglia il coperchio superiore del primo segmento a lunghezza intera pari a ${lengthCm} cm e larghezza ${widthCm + 2 * thicknessCm} cm. Posizionalo a chiusura del canale a cavallo dei giunti inferiori.`,
            materials: [`1x Coperchio 1 (Intero): ${widthCm + 2 * thicknessCm} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`],
          },
          {
            num: 5,
            title: "🛑 Tappo Terminale di Chiusura (Facoltativo)",
            desc: `Taglia il tappo di chiusura terminale con larghezza pari a ${widthCm + 2 * thicknessCm} cm e altezza pari a ${heightCm + 2 * thicknessCm} cm. Posizionalo all'estremità iniziale per chiudere la testa della canalizzazione.`,
            materials: [`1x Tappo Terminale: ${widthCm + 2 * thicknessCm} x ${heightCm + 2 * thicknessCm} cm (Spessore: ${thicknessMm} mm)`],
          },
          {
            num: 6,
            title: "🧱 Secondo Fondo (Intero)",
            desc: `Taglia la seconda lastra di fondo a lunghezza intera pari a ${lengthCm} cm. Posizionala a partire dal giunto del primo fondo, sormontando il fianco destro e il coperchio del primo segmento per creare l'incastro sfalsato.`,
            materials: [`1x Secondo Fondo (Intero): ${widthCm + 2 * thicknessCm} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`],
          },
          {
            num: 7,
            title: "📐 Secondi Fianchi (Interi)",
            desc: `Taglia e monta le due lastre dei fianchi laterali del secondo segmento, entrambe a lunghezza intera pari a ${lengthCm} cm. Si posizioneranno a scavalco dei giunti dei pannelli sottostanti.`,
            materials: [
              `1x Fianco SX 2 (Intero): ${heightCm} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`,
              `1x Fianco DX 2 (Intero): ${heightCm} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`,
            ],
          },
          {
            num: 8,
            title: "🔒 Secondo Coperchio (Intero)",
            desc: `Taglia e fissa il secondo coperchio superiore a lunghezza intera pari a ${lengthCm} cm per sigillare il secondo segmento della canalizzazione.`,
            materials: [`1x Coperchio 2 (Intero): ${widthCm + 2 * thicknessCm} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`],
          },
          {
            num: 9,
            title: "✅ Canalizzazione Completata",
            desc: "La canalizzazione con giunti sfalsati (senza coprigiunti esterni) è completata per due segmenti, mostrando l'incastro autobloccante dei pannelli.",
            materials: ["Canalizzazione assemblata e pronta all'uso"],
          },
        ];
      }
    } else {
      // Verticale
      if (isWithJoint) {
        return [
          {
            num: 1,
            title: "🛠️ Staffaggio a Parete",
            desc: "Traccia la linea di sviluppo verticale a parete. Installa le barre asolate di supporto a parete per fissare saldamente la canalizzazione.",
            materials: ["Barre asolate di supporto", "Tasselli di ancoraggio e staffe di supporto"],
          },
          {
            num: 2,
            title: "🧱 Lastra Posteriore (Schiena)",
            desc: `Taglia la lastra posteriore (schiena) con larghezza pari a ${widthCm + 2 * thicknessCm} cm (Foro interno ${widthCm} cm + 2 spessori da ${thicknessCm} cm) e altezza ${lengthCm} cm. Fissala sulle barre asolate di supporto.`,
            materials: [`1x Lastra Schiena: ${widthCm + 2 * thicknessCm} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`],
          },
          {
            num: 3,
            title: "📐 Lastre Fianchi (Laterali)",
            desc: `Taglia le 2 lastre laterali dei fianchi con larghezza pari a ${heightCm} cm e altezza ${lengthCm} cm. Fissale a sormonto sulla lastra posteriore.`,
            materials: [`2x Lastre Laterali: ${heightCm} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`],
          },
          {
            num: 4,
            title: "🔒 Chiusura Anteriore (Fronte)",
            desc: `Taglia la lastra frontale con larghezza pari a ${widthCm + 2 * thicknessCm} cm e altezza ${lengthCm} cm. Posizionala sul lato anteriore e avvitala per chiudere e sigillare la canalizzazione verticale.`,
            materials: [`1x Lastra Frontale: ${widthCm + 2 * thicknessCm} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`],
          },
          {
            num: 5,
            title: "🛑 Tappo Terminale di Chiusura (Facoltativo)",
            desc: `Taglia il tappo di chiusura terminale con larghezza pari a ${widthCm + 2 * thicknessCm} cm e altezza pari a ${heightCm + 2 * thicknessCm} cm. Posizionalo all'estremità superiore per chiudere la testa della canalizzazione.`,
            materials: [`1x Tappo Terminale: ${widthCm + 2 * thicknessCm} x ${heightCm + 2 * thicknessCm} cm (Spessore: ${thicknessMm} mm)`],
          },
          {
            num: 6,
            title: "🔗 Giunto Coprigiunto in Alto",
            desc: "Applica il giunto esterno superiore largo da 10 a 20 cm a cavallo dell'estremità superiore per unire le tratte della canalizzazione verticale. Taglia i 4 pezzi coprigiunto dallo stesso materiale per fare tutto il giro esterno.",
            materials: [
              `2x Coprigiunto Fronte/Retro: ${widthCm + 4 * thicknessCm} x da 10 a 20 cm (Spessore: ${thicknessMm} mm)`,
              `2x Coprigiunto Laterale (Fianchi): ${heightCm + 2 * thicknessCm} x da 10 a 20 cm (Spessore: ${thicknessMm} mm)`,
            ],
          },
          {
            num: 7,
            title: "🔗 Giunto di Sostegno a Pavimento",
            desc: "Installa il giunto di base a contatto con il pavimento (nella parte inferiore) in modo da distribuire il carico e dare stabilità e sostegno alla base della canalizzazione.",
            materials: [
              `2x Coprigiunto Fronte/Retro: ${widthCm + 4 * thicknessCm} x da 10 a 20 cm (Spessore: ${thicknessMm} mm)`,
              `2x Coprigiunto Laterale (Fianchi): ${heightCm + 2 * thicknessCm} x da 10 a 20 cm (Spessore: ${thicknessMm} mm)`,
            ],
          },
          {
            num: 8,
            title: "✅ Canalizzazione Completata",
            desc: "La canalizzazione verticale è ora completata con lo staffaggio a parete, le lastre sigillate, il tappo inferiore di chiusura e i due giunti esterni montati in posizione definitiva.",
            materials: ["Canalizzazione assemblata e pronta all'uso"],
          },
        ];
      } else {
        // Verticale senza giunto (sfalsato) - Esteso a due segmenti
        return [
          {
            num: 1,
            title: "🛠️ Staffaggio a Parete",
            desc: "Traccia la linea di sviluppo verticale a parete. Installa le barre asolate di supporto a parete per fissare saldamente la canalizzazione.",
            materials: ["Barre asolate di supporto", "Tasselli di ancoraggio e staffe di supporto"],
          },
          {
            num: 2,
            title: "🧱 Prima Schiena Sfalsata (Dimezzata)",
            desc: `Taglia la prima lastra posteriore (schiena) a metà altezza pari a ${lengthCm / 2} cm e larghezza ${widthCm + 2 * thicknessCm} cm. Fissala sulle barre asolate.`,
            materials: [`1x Schiena 1 (Mezza): ${widthCm + 2 * thicknessCm} x ${lengthCm / 2} cm (Spessore: ${thicknessMm} mm)`],
          },
          {
            num: 3,
            title: "📐 Primi Fianchi Sfalsati (Laterali)",
            desc: `Taglia il fianco sinistro a metà altezza pari a ${lengthCm / 2} cm. Il fianco destro va tagliato e montato ad altezza intera pari a ${lengthCm} cm. Questa disposição sfalsata garantisce la stabilità meccanica.`,
            materials: [
              `1x Fianco SX 1 (Mezzo): ${heightCm} x ${lengthCm / 2} cm (Spessore: ${thicknessMm} mm)`,
              `1x Fianco DX 1 (Intero): ${heightCm} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`,
            ],
          },
          {
            num: 4,
            title: "🔒 Primo Fronte (Intero)",
            desc: `Taglia la prima lastra frontale ad altezza intera pari a ${lengthCm} cm e larghezza ${widthCm + 2 * thicknessCm} cm. Avvitala sul lato anteriore per chiudere il cavedio verticale.`,
            materials: [`1x Fronte 1 (Intero): ${widthCm + 2 * thicknessCm} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`],
          },
          {
            num: 5,
            title: "🛑 Tappo Terminale di Chiusura (Facoltativo)",
            desc: `Taglia il tappo di chiusura terminale con larghezza pari a ${widthCm + 2 * thicknessCm} cm e altezza pari a ${heightCm + 2 * thicknessCm} cm. Posizionalo all'estremità inferiore per chiudere la testa della canalizzazione.`,
            materials: [`1x Tappo Terminale: ${widthCm + 2 * thicknessCm} x ${heightCm + 2 * thicknessCm} cm (Spessore: ${thicknessMm} mm)`],
          },
          {
            num: 6,
            title: "🧱 Seconda Schiena (Intera)",
            desc: `Taglia la seconda lastra posteriore (schiena) ad altezza intera pari a ${lengthCm} cm. Posizionala a prolungamento della prima schiena.`,
            materials: [`1x Schiena 2 (Intera): ${widthCm + 2 * thicknessCm} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`],
          },
          {
            num: 7,
            title: "📐 Secondi Fianchi (Interi)",
            desc: `Taglia e monta le due lastre dei fianchi laterali del secondo segmento, entrambe ad altezza intera pari a ${lengthCm} cm.`,
            materials: [
              `1x Fianco SX 2 (Intero): ${heightCm} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`,
              `1x Fianco DX 2 (Intero): ${heightCm} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`,
            ],
          },
          {
            num: 8,
            title: "🔒 Secondo Fronte (Intero)",
            desc: `Taglia e fissa il secondo pannello frontale ad altezza intera pari a ${lengthCm} cm per chiudere e completare il secondo segmento.`,
            materials: [`1x Fronte 2 (Intero): ${widthCm + 2 * thicknessCm} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`],
          },
          {
            num: 9,
            title: "🔗 Giunto di Sostegno a Pavimento",
            desc: "Installa il giunto di base a contatto con il pavimento (nella parte inferiore) in modo da distribuire il carico e dare stabilità e sostegno alla base della canalizzazione verticale.",
            materials: [
              `2x Coprigiunto Fronte/Retro: ${widthCm + 4 * thicknessCm} x da 10 a 20 cm (Spessore: ${thicknessMm} mm)`,
              `2x Coprigiunto Laterale (Fianchi): ${heightCm + 2 * thicknessCm} x da 10 a 20 cm (Spessore: ${thicknessMm} mm)`,
            ],
          },
          {
            num: 10,
            title: "✅ Canalizzazione Completata",
            desc: "La canalizzazione verticale con giunti sfalsati (senza coprigiunto superiore) è ora completata con lo staffaggio, il tappo inferiore e il giunto di stabilizzazione a pavimento.",
            materials: ["Canalizzazione verticale assemblata e pronta all'uso"],
          },
        ];
      }
    }
  }, [isHorizontal, variant, widthCm, heightCm, lengthCm, thicknessCm, thicknessMm]);

  return (
    <div className="min-h-screen w-full flex flex-col p-4 md:p-6 text-white"
      style={{
        background: "radial-gradient(circle at top, hsl(220 35% 12%), hsl(220 35% 6%))",
      }}>
      
      {/* Header navigazione */}
      <div className="w-full flex items-center justify-between pb-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <Link href="/projects/istruzioni" className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-white transition-colors">
            ← Torna alle Istruzioni
          </Link>
          <span className="text-gray-500">/</span>
          <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Archivio Istruzioni di Montaggio</span>
        </div>
        <div className="text-sm font-bold text-orange-400">
          🚧 Sezione Test Parametrico
        </div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 pt-6">
        
        {/* LATO SINISTRO: Configurazione e Visualizzatore 3D (7 colonne) */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          
          {/* Selettori Tab e Categorie */}
          <div className="p-4 rounded-2xl space-y-4" style={{ background: "hsl(220 26% 14% / 0.8)", border: "1px solid hsl(220 20% 20%)" }}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">📁 Catalogo Canalizzazioni</h2>
              <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
                <button
                  onClick={() => { setSubgroup("orizzontali"); setCurrentStep(1); }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    subgroup === "orizzontali" ? "bg-white text-black" : "text-gray-400 hover:text-white"
                  }`}
                >
                  Orizzontali
                </button>
                <button
                  onClick={() => { setSubgroup("verticali"); setCurrentStep(1); }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    subgroup === "verticali" ? "bg-white text-black" : "text-gray-400 hover:text-white"
                  }`}
                >
                  Verticali
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setItemType("dritte")}
                className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  itemType === "dritte" ? "bg-orange-500/20 border-orange-500 text-orange-400" : "bg-white/5 border-white/5 text-gray-400"
                }`}
              >
                ▬ Dritte
              </button>
              <button
                disabled
                className="px-4 py-2 rounded-xl text-xs font-semibold border bg-white/5 border-white/5 text-gray-600 cursor-not-allowed"
                title="Prossimamente nell'archivio"
              >
                ↳ Curve 90° (Prossimamente)
              </button>
            </div>
          </div>

          {/* Canvas 3D */}
          <div className="flex-1 min-h-[350px] md:min-h-[450px] rounded-2xl overflow-hidden border relative flex items-center justify-center bg-black/40"
            style={{ borderColor: "hsl(220 20% 20%)" }}>
            
            {mounted ? (
              <Assembly3DViewer
                orientation={subgroup === "orizzontali" ? "orizzontale" : "verticale"}
                width={wMm}
                height={hMm}
                length={lMm}
                thickness={thicknessMm}
                currentStep={currentStep}
                variant={variant}
              />
            ) : (
              <div className="text-xs text-gray-500 font-bold animate-pulse">
                Caricamento motore 3D interattivo...
              </div>
            )}

            {/* Indicatori Overlay sul Canvas */}
            <div className="absolute top-4 left-4 p-3 rounded-xl bg-black/75 border border-white/10 text-[10px] space-y-1 font-mono">
              <p className="text-gray-400 font-bold">DIMENSIONI INTERNE (FORO):</p>
              <p className="text-white">Larghezza: <span className="text-orange-400 font-bold">{widthCm} cm</span></p>
              <p className="text-white">Altezza: <span className="text-orange-400 font-bold">{heightCm} cm</span></p>
              <p className="text-white">Lunghezza: <span className="text-blue-400 font-bold">{lengthCm} cm</span></p>
              <p className="text-gray-400 font-bold mt-2">MATERIALE SELEZIONATO:</p>
              <p className="text-emerald-400 font-bold truncate max-w-[150px]">{activeMaterial.name} ({thicknessMm} mm)</p>
            </div>
          </div>

        </div>

        {/* LATO DESTRO: Configurazione Parametri, Distinta e Istruzioni (5 colonne) */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          
          {/* Configurazione Parametrica */}
          <div className="p-5 rounded-2xl space-y-4" style={{ background: "hsl(220 26% 14% / 0.8)", border: "1px solid hsl(220 20% 20%)" }}>
            <h3 className="text-xs font-bold text-orange-400 uppercase tracking-wider">📐 Configura Misure Foro & Lastra</h3>
            
            <div className="space-y-3">
              {/* Dropdown Materiale */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Spessore Materiale Lastre</label>
                {catalogMaterials.length === 0 ? (
                  <div className="p-3.5 rounded-xl text-xs bg-amber-500/10 border border-amber-500/20 text-amber-300">
                    Nessun materiale configurato nelle impostazioni. Uso spessore predefinito 15mm.
                    <div className="mt-2">
                      <Link href="/settings" className="underline font-bold text-white">Configura Materiali →</Link>
                    </div>
                  </div>
                ) : (
                  <select
                    value={selectedMaterialId}
                    onChange={(e) => setSelectedMaterialId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-xs outline-none bg-black/30 border border-white/10 text-white cursor-pointer font-bold"
                  >
                    {catalogMaterials.map((m) => (
                      <option key={m.id} value={m.id} style={{ background: "hsl(220 32% 10%)" }}>
                        {m.name} ({m.thickness_mm ?? 15} mm)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Tecnica di Montaggio */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Tecnica di Montaggio</label>
                <select
                  value={variant}
                  onChange={(e) => {
                    setVariant(e.target.value as "con-giunto" | "senza-giunto");
                    setCurrentStep(1);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl text-xs outline-none bg-black/30 border border-white/10 text-white cursor-pointer font-bold"
                >
                  <option value="con-giunto" style={{ background: "hsl(220 32% 10%)" }}>
                    ▬ Dritte con Giunto
                  </option>
                  <option value="senza-giunto" style={{ background: "hsl(220 32% 10%)" }}>
                    ⎵ Dritte senza Giunto (Giunti Sfalsati)
                  </option>
                </select>
              </div>

              {/* Dimensioni */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Foro W (cm)</label>
                  <input
                    type="text"
                    value={widthCmInput}
                    onChange={(e) => setWidthCmInput(e.target.value)}
                    onBlur={() => handleBlur(widthCmInput, setWidthCmInput, 10, 300)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-black/30 border border-white/10 text-white font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Foro H (cm)</label>
                  <input
                    type="text"
                    value={heightCmInput}
                    onChange={(e) => setHeightCmInput(e.target.value)}
                    onBlur={() => handleBlur(heightCmInput, setHeightCmInput, 10, 300)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-black/30 border border-white/10 text-white font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Lunghezza L (cm)</label>
                  <input
                    type="text"
                    value={lengthCmInput}
                    onChange={(e) => setLengthCmInput(e.target.value)}
                    onBlur={() => handleBlur(lengthCmInput, setLengthCmInput, 50, 1000)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-black/30 border border-white/10 text-white font-bold"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Dettaglio del Passo Attivo */}
          <div className="flex-1 p-5 rounded-2xl flex flex-col justify-between space-y-6"
            style={{ background: "hsl(220 26% 14% / 0.8)", border: "1px solid hsl(220 20% 20%)" }}>
            
            {/* Contenuto Passo */}
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 uppercase">
                  PASSAGGIO {currentStep} DI {steps.length}
                </span>
                <span className="text-xs text-gray-400">
                  {isHorizontal ? "Canalizzazione Orizzontale" : "Canalizzazione Verticale"}
                </span>
              </div>

              <div className="space-y-2">
                <h4 className="text-base font-extrabold text-white leading-tight">
                  {steps[currentStep - 1].title}
                </h4>
                <p className="text-xs text-gray-300 leading-relaxed">
                  {steps[currentStep - 1].desc}
                </p>
              </div>

              {/* Distinta Materiali dello Step */}
              <div className="space-y-2 pt-2">
                <h5 className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">📋 MATERIALI DA TAGLIARE / USARE:</h5>
                <ul className="space-y-1.5">
                  {steps[currentStep - 1].materials.map((mat, idx) => (
                    <li key={idx} className="text-xs text-emerald-400 font-semibold flex items-start gap-1.5">
                      <span>✓</span>
                      <span>{mat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Controlli di Navigazione dei Passi */}
            <div className="space-y-3 pt-4 border-t border-white/5">
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
                  disabled={currentStep === 1}
                  className="flex-1 py-3 px-4 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-all cursor-pointer text-center"
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
                {variant === "senza-giunto" ? (
                  <>
                    <div className="flex justify-between">
                      <span>• Fianco SX (Dimezzato):</span>
                      <span className="text-white font-bold">1x {dimFianchi.w} x {dimFianchi.l / 2} mm</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• Fianco SX (Intero):</span>
                      <span className="text-white font-bold">1x {dimFianchi.w} x {dimFianchi.l} mm</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• Fianco DX (Intero):</span>
                      <span className="text-white font-bold">2x {dimFianchi.w} x {dimFianchi.l} mm</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• Fondo / Schiena (Dimezzato):</span>
                      <span className="text-white font-bold">1x {dimCoperchi.w} x {dimCoperchi.l / 2} mm</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• Fondo / Schiena (Intero):</span>
                      <span className="text-white font-bold">1x {dimCoperchi.w} x {dimCoperchi.l} mm</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• Coperchio / Fronte (Intero):</span>
                      <span className="text-white font-bold">2x {dimCoperchi.w} x {dimCoperchi.l} mm</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span>• Fianchi (Laterali):</span>
                      <span className="text-white font-bold">{dimFianchi.q}x {dimFianchi.w} x {dimFianchi.l} mm</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• Coperchi (Fondo/Soffitto):</span>
                      <span className="text-white font-bold">{dimCoperchi.q}x {dimCoperchi.w} x {dimCoperchi.l} mm</span>
                    </div>
                  </>
                )}
                <div className="text-[9px] text-gray-500 italic mt-1.5">
                  Nota: calcolo basato su foro {widthCm}x{heightCm}cm, spessore {thicknessMm}mm.
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
