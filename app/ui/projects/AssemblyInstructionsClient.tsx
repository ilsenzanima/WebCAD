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
  variant?: "con-giunto" | "senza-giunto" | "pezzo-unico" | "derivata-dritte";
}

export default function AssemblyInstructionsClient({ project, catalogMaterials, variant: initialVariant = "con-giunto" }: Props) {
  const [mounted, setMounted] = useState(false);

  // Stati del configuratore
  const [variant, setVariant] = useState<"con-giunto" | "senza-giunto" | "pezzo-unico" | "derivata-dritte">(initialVariant);
  const [subgroup, setSubgroup] = useState<"orizzontali" | "verticali">("orizzontali");
  const [itemType, setItemType] = useState<"dritte" | "curve" | "canne-shunt">("dritte");
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

  // Definizione dei passaggi in base all'orientamento, tipo di pezzo e variante
  const steps = useMemo(() => {
    const isWithJoint = variant === "con-giunto";
    const isPezzoUnico = variant === "pezzo-unico";

    if (itemType === "dritte") {
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
              desc: `Taglia la lastra di fondo con larghezza pari a ${widthCm + 2 * thicknessCm} cm (Foro interno ${widthCm} cm + 2 spessori da ${thicknessCm} cm) e lunghezza ${lengthCm} cm. Appoggiala e fissala sulle barre asolate di supporto. *IMPORTANTE: Applicare il collante idoneo sui bordi prima del montaggio dei fianchi.*`,
              materials: [`1x Lastra Fondo: ${widthCm + 2 * thicknessCm} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`, "Collante certificato per lastre tagliafuoco"],
            },
            {
              num: 3,
              title: "📐 Lastre Fianchi (Laterali)",
              desc: `Taglia le 2 lastre dei fianchi laterali con altezza pari a ${heightCm} cm e lunghezza ${lengthCm} cm. Posizionale sopra la lastra di fondo. *IMPORTANTE: Applicare il collante su tutti i bordi di contatto e fissare meccanicamente con viti adeguate.*`,
              materials: [`2x Lastre Fianchi: ${heightCm} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`, "Viti e collante tagliafuoco"],
            },
            {
              num: 4,
              title: "🔒 Chiusura Superiore (Coperchio)",
              desc: `Taglia la lastra superiore (coperchio alto) con larghezza pari a ${widthCm + 2 * thicknessCm} cm e lunghezza ${lengthCm} cm. Posizionala a chiusura superiore del canale. *IMPORTANTE: Applicare il collante su tutti i bordi prima di avvitarla.*`,
              materials: [`1x Lastra Coperchio: ${widthCm + 2 * thicknessCm} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`, "Viti e collante tagliafuoco"],
            },
            {
              num: 5,
              title: "🛑 Tappo Terminale di Chiusura (Facoltativo)",
              desc: `Taglia il tappo di chiusura terminale con larghezza pari a ${widthCm + 2 * thicknessCm} cm e altezza pari a ${heightCm + 2 * thicknessCm} cm. Posizionalo all'estremità del canale per completare la chiusura. *IMPORTANTE: Incollare e avvitare.*`,
              materials: [`1x Tappo Terminale: ${widthCm + 2 * thicknessCm} x ${heightCm + 2 * thicknessCm} cm (Spessore: ${thicknessMm} mm)`, "Viti e collante tagliafuoco"],
            },
            {
              num: 6,
              title: "🔗 Giunto Coprigiunto Esterno",
              desc: "Applica il giunto esterno largo da 10 a 20 cm a cavallo dell'estremità di uscita per unire le tratte della canalizzazione. Taglia i 4 pezzi coprigiunto dallo stesso materiale. *IMPORTANTE: Incollare e avvitare.*",
              materials: [
                `2x Coprigiunto Orizzontale (Sopra/Sotto): ${widthCm + 4 * thicknessCm} x da 10 a 20 cm (Spessore: ${thicknessMm} mm)`,
                `2x Coprigiunto Verticale (Fianchi): ${heightCm + 2 * thicknessCm} x da 10 a 20 cm (Spessore: ${thicknessMm} mm)`,
                "Viti e collante tagliafuoco",
              ],
            },
            {
              num: 7,
              title: "✅ Canalizzazione Completata",
              desc: "La canalizzazione è ora completata con tutte le staffe, i pannelli di rivestimento incollati e avvitati, il tappo di chiusura e la cornice del giunto esterno montata.",
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
              desc: `Taglia la prima lastra di fondo a metà lunghezza pari a ${lengthCm / 2} cm e larghezza ${widthCm + 2 * thicknessCm} cm. Appoggiala e fissala sulle barre asolate. *IMPORTANTE: Applicare il collante prima di avvitare.*`,
              materials: [`1x Primo Fondo (Mezzo): ${widthCm + 2 * thicknessCm} x ${lengthCm / 2} cm (Spessore: ${thicknessMm} mm)`, "Collante tagliafuoco"],
            },
            {
              num: 3,
              title: "📐 Primi Fianchi Sfalsati (Laterali)",
              desc: `Taglia il fianco sinistro a metà lunghezza pari a ${lengthCm / 2} cm. Il fianco destro va tagliato e montato a lunghezza intera pari a ${lengthCm} cm. Questa disposizione sfalsata garantisce l'overlap strutturale. *IMPORTANTE: Incollare e avvitare lungo tutti i bordi di contatto.*`,
              materials: [
                `1x Fianco SX 1 (Mezzo): ${heightCm} x ${lengthCm / 2} cm (Spessore: ${thicknessMm} mm)`,
                `1x Fianco DX 1 (Intero): ${heightCm} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`,
                "Viti e collante tagliafuoco",
              ],
            },
            {
              num: 4,
              title: "🔒 Primo Coperchio (Intero)",
              desc: `Taglia il coperchio superiore del primo segmento a lunghezza intera pari a ${lengthCm} cm e larghezza ${widthCm + 2 * thicknessCm} cm. Posizionalo a chiusura del canale. *IMPORTANTE: Incollare e avvitare.*`,
              materials: [`1x Coperchio 1 (Intero): ${widthCm + 2 * thicknessCm} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`, "Viti e collante tagliafuoco"],
            },
            {
              num: 5,
              title: "🛑 Tappo Terminale di Chiusura (Facoltativo)",
              desc: `Taglia il tappo di chiusura terminale con larghezza pari a ${widthCm + 2 * thicknessCm} cm e altezza pari a ${heightCm + 2 * thicknessCm} cm. Posizionalo all'estremità iniziale per chiudere la testa della canalizzazione. *IMPORTANTE: Incollare e avvitare.*`,
              materials: [`1x Tappo Terminale: ${widthCm + 2 * thicknessCm} x ${heightCm + 2 * thicknessCm} cm (Spessore: ${thicknessMm} mm)`, "Viti e collante tagliafuoco"],
            },
            {
              num: 6,
              title: "🧱 Secondo Fondo (Intero)",
              desc: `Taglia la seconda lastra di fondo a lunghezza intera pari a ${lengthCm} cm. Posizionala a partir del giunto del primo fondo, sormontando il fianco destro e il coperchio del primo segmento per creare l'incastro sfalsato. *IMPORTANTE: Applicare il collante sui giunti.*`,
              materials: [`1x Secondo Fondo (Intero): ${widthCm + 2 * thicknessCm} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`, "Viti e collante tagliafuoco"],
            },
            {
              num: 7,
              title: "📐 Secondi Fianchi (Interi)",
              desc: `Taglia e monta le due lastre dei fianchi laterali del secondo segmento, entrambe a lunghezza intera pari a ${lengthCm} cm. Si posizioneranno a scavalco dei giunti dei pannelli sottostanti. *IMPORTANTE: Incollare e avvitare.*`,
              materials: [
                `1x Fianco SX 2 (Intero): ${heightCm} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`,
                `1x Fianco DX 2 (Intero): ${heightCm} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`,
                "Viti e collante tagliafuoco",
              ],
            },
            {
              num: 8,
              title: "🔒 Secondo Coperchio (Intero)",
              desc: `Taglia e fissa il secondo coperchio superiore a lunghezza intera pari a ${lengthCm} cm per sigillare il secondo segmento della canalizzazione. *IMPORTANTE: Incollare e avvitare.*`,
              materials: [`1x Coperchio 2 (Intero): ${widthCm + 2 * thicknessCm} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`, "Viti e collante tagliafuoco"],
            },
            {
              num: 9,
              title: "✅ Canalizzazione Completata",
              desc: "La canalizzazione con giunti sfalsati (senza coprigiunti esterni) è completata per due segmenti, mostrando l'incastro autobloccante dei pannelli incollati e avvitati.",
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
              desc: `Taglia la lastra posteriore (schiena) con larghezza pari a ${widthCm + 2 * thicknessCm} cm (Foro interno ${widthCm} cm + 2 spessori da ${thicknessCm} cm) e altezza ${lengthCm} cm. Fissala sulle barre asolate di supporto. *IMPORTANTE: Incollare e avvitare.*`,
              materials: [`1x Lastra Schiena: ${widthCm + 2 * thicknessCm} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`, "Collante tagliafuoco"],
            },
            {
              num: 3,
              title: "📐 Lastre Fianchi (Laterali)",
              desc: `Taglia le 2 lastre laterali dei fianchi con larghezza pari a ${heightCm} cm e altezza ${lengthCm} cm. Fissale a sormonto sulla lastra posteriore. *IMPORTANTE: Applicare il collante su tutti i bordi prima di avvitare.*`,
              materials: [`2x Lastre Laterali: ${heightCm} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`, "Viti e collante tagliafuoco"],
            },
            {
              num: 4,
              title: "🔒 Chiusura Anteriore (Fronte)",
              desc: `Taglia la lastra frontale con larghezza pari a ${widthCm + 2 * thicknessCm} cm e altezza ${lengthCm} cm. Posizionala sul lato anteriore. *IMPORTANTE: Incollare e avvitare per sigillare la canalizzazione verticale.*`,
              materials: [`1x Lastra Frontale: ${widthCm + 2 * thicknessCm} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`, "Viti e collante tagliafuoco"],
            },
            {
              num: 5,
              title: "🛑 Tappo Terminale di Chiusura (Facoltativo)",
              desc: `Taglia il tappo di chiusura terminale con larghezza pari a ${widthCm + 2 * thicknessCm} cm e altezza pari a ${heightCm + 2 * thicknessCm} cm. Posizionalo all'estremità inferiore per chiudere la testa della canalizzazione. *IMPORTANTE: Incollare e avvitare.*`,
              materials: [`1x Tappo Terminale: ${widthCm + 2 * thicknessCm} x ${heightCm + 2 * thicknessCm} cm (Spessore: ${thicknessMm} mm)`, "Viti e collante tagliafuoco"],
            },
            {
              num: 6,
              title: "🔗 Giunto Coprigiunto in Alto",
              desc: "Applica il giunto esterno superiore largo da 10 a 20 cm a cavallo dell'estremità superiore per unire le tratte della canalizzazione verticale. *IMPORTANTE: Incollare e avvitare.*",
              materials: [
                `2x Coprigiunto Fronte/Retro: ${widthCm + 4 * thicknessCm} x da 10 a 20 cm (Spessore: ${thicknessMm} mm)`,
                `2x Coprigiunto Laterale (Fianchi): ${heightCm + 2 * thicknessCm} x da 10 a 20 cm (Spessore: ${thicknessMm} mm)`,
                "Viti e collante tagliafuoco",
              ],
            },
            {
              num: 7,
              title: "🔗 Giunto di Sostegno a Pavimento",
              desc: "Installa il giunto di base a contatto con il pavimento (nella parte inferiore) in modo da distribuire il carico e dare stabilità e sostegno alla base della canalizzazione. *IMPORTANTE: Incollare e avvitare.*",
              materials: [
                `2x Coprigiunto Fronte/Retro: ${widthCm + 4 * thicknessCm} x da 10 a 20 cm (Spessore: ${thicknessMm} mm)`,
                `2x Coprigiunto Laterale (Fianchi): ${heightCm + 2 * thicknessCm} x da 10 a 20 cm (Spessore: ${thicknessMm} mm)`,
                "Viti e collante tagliafuoco",
              ],
            },
            {
              num: 8,
              title: "✅ Canalizzazione Completata",
              desc: "La canalizzazione verticale è ora completata con lo staffaggio a parete, le lastre incollate, avvitate, il tappo inferiore di chiusura e i due giunti esterni montati.",
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
              desc: `Taglia la prima lastra posteriore (schiena) a metà altezza pari a ${lengthCm / 2} cm e larghezza ${widthCm + 2 * thicknessCm} cm. Fissala sulle barre asolate. *IMPORTANTE: Applicare il collante prima di avvitare.*`,
              materials: [`1x Schiena 1 (Mezza): ${widthCm + 2 * thicknessCm} x ${lengthCm / 2} cm (Spessore: ${thicknessMm} mm)`, "Collante tagliafuoco"],
            },
            {
              num: 3,
              title: "📐 Primi Fianchi Sfalsati (Laterali)",
              desc: `Taglia il fianco sinistro a metà altezza pari a ${lengthCm / 2} cm. Il fianco destro va tagliato e montato ad altezza intera pari a ${lengthCm} cm. Questa disposizione sfalsata garantisce la stabilità. *IMPORTANTE: Incollare e avvitare.*`,
              materials: [
                `1x Fianco SX 1 (Mezzo): ${heightCm} x ${lengthCm / 2} cm (Spessore: ${thicknessMm} mm)`,
                `1x Fianco DX 1 (Intero): ${heightCm} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`,
                "Viti e collante tagliafuoco",
              ],
            },
            {
              num: 4,
              title: "🔒 Primo Fronte (Intero)",
              desc: `Taglia la prima lastra frontale ad altezza intera pari a ${lengthCm} cm e larghezza ${widthCm + 2 * thicknessCm} cm. Avvitala sul lato anteriore. *IMPORTANTE: Incollare e avvitare.*`,
              materials: [`1x Fronte 1 (Intero): ${widthCm + 2 * thicknessCm} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`, "Viti e collante tagliafuoco"],
            },
            {
              num: 5,
              title: "🛑 Tappo Terminale di Chiusura (Facoltativo)",
              desc: `Taglia il tappo di chiusura terminale con larghezza pari a ${widthCm + 2 * thicknessCm} cm e altezza pari a ${heightCm + 2 * thicknessCm} cm. Posizionalo all'estremità inferiore per chiudere la testa della canalizzazione. *IMPORTANTE: Incollare e avvitare.*`,
              materials: [`1x Tappo Terminale: ${widthCm + 2 * thicknessCm} x ${heightCm + 2 * thicknessCm} cm (Spessore: ${thicknessMm} mm)`, "Viti e collante tagliafuoco"],
            },
            {
              num: 6,
              title: "🧱 Seconda Schiena (Intera)",
              desc: `Taglia la seconda lastra posteriore (schiena) ad altezza intera pari a ${lengthCm} cm. Posizionala a prolungamento della prima. *IMPORTANTE: Incollare e avvitare.*`,
              materials: [`1x Schiena 2 (Intera): ${widthCm + 2 * thicknessCm} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`, "Viti e collante tagliafuoco"],
            },
            {
              num: 7,
              title: "📐 Secondi Fianchi (Interi)",
              desc: `Taglia e monta le due lastre dei fianchi laterali del secondo segmento, entrambe ad altezza intera pari a ${lengthCm} cm. *IMPORTANTE: Incollare e avvitare.*`,
              materials: [
                `1x Fianco SX 2 (Intero): ${heightCm} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`,
                `1x Fianco DX 2 (Intero): ${heightCm} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`,
                "Viti e collante tagliafuoco",
              ],
            },
            {
              num: 8,
              title: "🔒 Secondo Fronte (Intero)",
              desc: `Taglia e fissa il secondo pannello frontale ad altezza intera pari a ${lengthCm} cm per chiudere e completare il secondo segmento. *IMPORTANTE: Incollare e avvitare.*`,
              materials: [`1x Fronte 2 (Intero): ${widthCm + 2 * thicknessCm} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`, "Viti e collante tagliafuoco"],
            },
            {
              num: 9,
              title: "🔗 Giunto di Sostegno a Pavimento",
              desc: "Installa il giunto di base a contatto con il pavimento (nella parte inferiore) in modo da distribuire il carico e dare stabilità e sostegno alla base della canalizzazione verticale. *IMPORTANTE: Incollare e avvitare.*",
              materials: [
                `2x Coprigiunto Fronte/Retro: ${widthCm + 4 * thicknessCm} x da 10 a 20 cm (Spessore: ${thicknessMm} mm)`,
                `2x Coprigiunto Laterale (Fianchi): ${heightCm + 2 * thicknessCm} x da 10 a 20 cm (Spessore: ${thicknessMm} mm)`,
                "Viti e collante tagliafuoco",
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
    } else if (itemType === "curve") {
      // CURVE 90°
      const L_in = lengthCm / 2;
      const L_out = lengthCm / 2;
      if (isHorizontal) {
        if (isPezzoUnico) {
          return [
            {
              num: 1,
              title: "🛠️ Struttura di Sostegno a L",
              desc: "Fissa i pendini di sospensione e posiziona le barre asolate di supporto disposte ad angolo di 90 gradi per sostenere la curva orizzontale.",
              materials: ["Barre asolate di supporto disposte a 90°", "Pendini filettati di sospensione (max 1 metro di distanza)", "Tasselli e ancoranti"],
            },
            {
              num: 2,
              title: "🧱 Lastra Inferiore (Fondo a L)",
              desc: `Prepara la lastra di fondo a forma di L (in pezzo unico, formata dall'unione del tratto di innesto e di uscita). Dimensioni d'ingombro: ${(L_in + widthCm/2 + thicknessCm).toFixed(1)} x ${(L_out + widthCm/2 + thicknessCm).toFixed(1)} cm, larghezza ${(widthCm + 2 * thicknessCm).toFixed(1)} cm. Appoggiala e fissala sulle barre asolate. *IMPORTANTE: Applicare il collante idoneo sui bordi prima del montaggio dei fianchi.*`,
              materials: [`1x Fondo a L (Pezzo Unico, sagomato): spessore ${thicknessMm} mm`, "Collante certificato per lastre tagliafuoco"],
            },
            {
              num: 3,
              title: "📐 Fianco Interno (Laterale Corto)",
              desc: `Taglia e monta le due lastre verticali corte per il fianco interno della curva. Ingressi: ${(L_in - widthCm/2).toFixed(1)} cm, Uscita: ${(L_out - widthCm/2).toFixed(1)} cm, Altezza: ${heightCm} cm. Incontrale ad angolo retto sulla giunzione interna. *IMPORTANTE: Applicare il collante su tutti i bordi di contatto e fissare meccanicamente con viti.*`,
              materials: [`2x Lastre Fianchi Interni: spessore ${thicknessMm} mm`, "Viti e collante tagliafuoco"],
            },
            {
              num: 4,
              title: "📐 Fianco Esterno (Laterale Lungo)",
              desc: `Taglia e monta le due lastre verticali lunghe per il fianco esterno della curva. Ingresso: ${(L_in + widthCm/2 + thicknessCm).toFixed(1)} cm, Uscita: ${(L_out + widthCm/2).toFixed(1)} cm (in battuta), Altezza: ${heightCm} cm. Sormontale sull'angolo esterno di testa per incrociare lo spessore. *IMPORTANTE: Incollare e avvitare.*`,
              materials: [`2x Lastre Fianchi Esterni: spessore ${thicknessMm} mm`, "Viti e collante tagliafuoco"],
            },
            {
              num: 5,
              title: "🔒 Chiusura Superiore (Coperchio a L)",
              desc: `Prepara la lastra superiore a L identica a quella di fondo. Ingombro: ${(L_in + widthCm/2 + thicknessCm).toFixed(1)} x ${(L_out + widthCm/2 + thicknessCm).toFixed(1)} cm. *IMPORTANTE: Spalmare il collante sui bordi superiori dei fianchi prima di posizionarla e avvitarla.*`,
              materials: [`1x Coperchio a L (Pezzo Unico, sagomato): spessore ${thicknessMm} mm`, "Viti e collante tagliafuoco"],
            },
            {
              num: 6,
              title: "🔗 Giunti Coprigiunto (Ingresso e Uscita)",
              desc: "Applica i due giunti esterni larghi da 10 a 20 cm a cavallo delle due estremità libere (ingresso e uscita) per connettere la curva alle tratte dritte adiacenti. *IMPORTANTE: Incollare e avvitare.*",
              materials: [
                "Coprigiunti esterni (larghi da 10 a 20 cm)",
                "Viti e collante tagliafuoco",
              ],
            },
            {
              num: 7,
              title: "✅ Curva Orizzontale Completata",
              desc: "La curva orizzontale a pezzo unico sagomata è completata, con tutte le giunzioni incollate, avvitate e i due coprigiunti montati in posizione definitiva.",
              materials: ["Curva orizzontale a pezzo unico completata"],
            },
          ];
        } else {
          // Curva derivata da dritte (sormonti rettilinei)
          return [
            {
              num: 1,
              title: "🛠️ Struttura di Sostegno a L",
              desc: "Fissa i pendini di sospensione e posiziona le barre asolate di supporto disposte a L per accogliere i due tratti di canale dritto.",
              materials: ["Barre asolate", "Pendini filettati (max 1 metro di distanza)", "Tasselli"],
            },
            {
              num: 2,
              title: "🧱 Costruzione del Tratto d'Ingresso (Tratto 1)",
              desc: `Prepara a terra le lastre del Tratto 1 (ingresso). Taglia il fondo, il coperchio e il fianco sinistro (esterno lungo) alla lunghezza intera di ${(L_in + widthCm/2 + thicknessCm).toFixed(1)} cm. Taglia il fianco destro (interno corto) a ${(L_in - widthCm/2 - thicknessCm).toFixed(1)} cm per lasciare aperta la luce del canale. *IMPORTANTE: Applicare il collante tagliafuoco e le viti sui bordi di contatto.*`,
              materials: [
                `2x Fondo/Coperchio Tratto 1 (Lungo): ${(widthCm + 2 * thicknessCm).toFixed(1)} x ${(L_in + widthCm/2 + thicknessCm).toFixed(1)} cm (Spessore: ${thicknessMm} mm)`,
                `1x Fianco Esterno Tratto 1 (Lungo): ${heightCm} x ${(L_in + widthCm/2 + thicknessCm).toFixed(1)} cm (Spessore: ${thicknessMm} mm)`,
                `1x Fianco Interno Tratto 1 (Corto): ${heightCm} x ${(L_in - widthCm/2 - thicknessCm).toFixed(1)} cm (Spessore: ${thicknessMm} mm)`,
                "Viti e collante certificato tagliafuoco"
              ],
            },
            {
              num: 3,
              title: "📐 Posizionamento del Tratto d'Ingresso",
              desc: "Assembla il Tratto 1 incollando e avvitando le lastre (fianchi, fondo e coperchio). Posiziona il segmento di canale così assemblato sulle barre asolate di supporto.",
              materials: ["Tratto 1 assemblato in posizione", "Viti e collante tagliafuoco"],
            },
            {
              num: 4,
              title: "🧱 Costruzione del Tratto d'Uscita (Tratto 2)",
              desc: `Prepara le lastre per il Tratto 2 (uscita). Taglia il fondo, il coperchio e il fianco destro (interno corto) a ${(L_out - widthCm/2).toFixed(1)} cm per andare in battuta sul Tratto 1. Taglia il fianco sinistro (esterno lungo) a ${(L_out + widthCm/2 + thicknessCm).toFixed(1)} cm per sormontare la testa del Tratto 1 e chiudere la curva sul retro. *IMPORTANTE: Applicare il collante tagliafuoco e le viti.*`,
              materials: [
                `2x Fondo/Coperchio Tratto 2 (Corto): ${(widthCm + 2 * thicknessCm).toFixed(1)} x ${(L_out - widthCm/2).toFixed(1)} cm (Spessore: ${thicknessMm} mm)`,
                `1x Fianco Esterno Tratto 2 (Lungo): ${heightCm} x ${(L_out + widthCm/2 + thicknessCm).toFixed(1)} cm (Spessore: ${thicknessMm} mm)`,
                `1x Fianco Interno Tratto 2 (Corto): ${heightCm} x ${(L_out - widthCm/2).toFixed(1)} cm (Spessore: ${thicknessMm} mm)`,
                "Viti e collante tagliafuoco",
              ],
            },
            {
              num: 5,
              title: "📐 Unione delle Tratte (Curva Assemblata)",
              desc: "Spalma il collante tagliafuoco sui bordi di testa a contatto del Tratto 1. Inserisci il Tratto 2 in posizione, mandando in battuta il fondo, il coperchio e il fianco interno, e sormontando il fianco esterno sulla testa del Tratto 1. Fissa meccanicamente con viti.",
              materials: ["Curva assemblata a 90°", "Viti e collante tagliafuoco"],
            },
            {
              num: 6,
              title: "🔗 Giunti Coprigiunto (Ingresso e Uscita)",
              desc: "Applica i coprigiunti sulle estremità libere di ingresso e uscita per la connessione alle tratte rettilinee adiacenti. *IMPORTANTE: Incollare e avvitare.*",
              materials: ["Coprigiunti esterni (larghi da 10 a 20 cm)", "Viti e collante tagliafuoco"],
            },
            {
              num: 7,
              title: "✅ Curva da Dritte Completata",
              desc: "La curva derivata da canali dritti con sormonti incrociati rettilinei (senza tagli a 45°) è completata, interamente incollata e avvitata.",
              materials: ["Curva da dritte completata"],
            },
          ];
        }
      } else {
        // Verticale
        if (isPezzoUnico) {
          return [
            {
              num: 1,
              title: "🛠️ Staffaggio a Parete ad Angolo",
              desc: "Installa le barre asolate e le staffe di supporto a parete disposte ad angolo per il fissaggio e il sostegno della curva verticale.",
              materials: ["Barre asolate", "Staffe a parete e tasselli"],
            },
            {
              num: 2,
              title: "📐 Fianchi Laterali (a L)",
              desc: `Prepara le due lastre laterali (fianchi) sagomate a L. Ingombro esterno: ${(L_in + heightCm/2 + thicknessCm).toFixed(1)} x ${(L_out + heightCm/2 + thicknessCm).toFixed(1)} cm, larghezza ${(heightCm + 2 * thicknessCm).toFixed(1)} cm. Fissa il primo fianco (sinistro) alle staffe a parete. *IMPORTANTE: Incollare e avvitare.*`,
              materials: [`2x Lastre Fianchi a L: spessore ${thicknessMm} mm`, "Viti e collante tagliafuoco"],
            },
            {
              num: 3,
              title: "🧱 Lastre Posteriori (Schiena)",
              desc: `Monta le lastre posteriori (schiena) per coprire il retro della curva. Sono composte da due pannelli rettilinei sormontati. Esterno: ${(L_in + heightCm/2 + thicknessCm).toFixed(1)} cm, Interno: ${(L_out - heightCm/2).toFixed(1)} cm. *IMPORTANTE: Applicare il collante sui bordi di contatto prima di avvitare.*`,
              materials: ["2x Lastre Schiena (tratto ingresso e uscita)", "Viti e collante tagliafuoco"],
            },
            {
              num: 4,
              title: "🔒 Chiusura Anteriore (Fronte)",
              desc: `Monta le lastre anteriori (fronte) per chiudere il cavedio della curva. Composte da due pannelli rettilinei. Esterno: ${(L_in + heightCm/2 + thicknessCm).toFixed(1)} cm, Interno: ${(L_out - heightCm/2).toFixed(1)} cm. *IMPORTANTE: Incollare e avvitare.*`,
              materials: ["2x Lastre Fronte (tratto ingresso e uscita)", "Viti e collante tagliafuoco"],
            },
            {
              num: 5,
              title: "📐 Secondo Fianco Laterale (a L)",
              desc: "Posiziona e avvita il secondo fianco a L (destro) per sigillare l'intera curva. *IMPORTANTE: Spalmare il collante su tutti i bordi di contatto.*",
              materials: [`1x Fianco DX a L (Sagomato): spessore ${thicknessMm} mm`, "Viti e collante tagliafuoco"],
            },
            {
              num: 6,
              title: "🔗 Giunti Coprigiunto (Ingresso e Uscita)",
              desc: "Applica i due giunti esterni larghi da 10 a 20 cm a cavallo delle due estremità per connettere la curva verticale. *IMPORTANTE: Incollare e avvitare.*",
              materials: [
                "Coprigiunti esterni (larghi da 10 a 20 cm)",
                "Viti e collante tagliafuoco",
              ],
            },
            {
              num: 7,
              title: "✅ Curva Verticale Completata",
              desc: "La curva verticale a pezzo unico sagomata è completata, incollata, avvitata e provvista di giunti di connessione.",
              materials: ["Curva verticale a pezzo unico completata"],
            },
          ];
        } else {
          // Verticale derivata da dritte
          return [
            {
              num: 1,
              title: "🛠️ Staffaggio a Parete ad Angolo",
              desc: "Installa le barre asolate e le staffe di supporto a parete disposte ad angolo per il sostegno dei due tratti di canale dritto verticali.",
              materials: ["Barre asolate", "Staffe e tasselli"],
            },
            {
              num: 2,
              title: "📐 Costruzione del Tratto d'Ingresso (Tratto 1)",
              desc: `Prepara a terra le lastre del Tratto 1 (ingresso). Taglia i fianchi sinistro e destro e la schiena (esterno lungo) a lunghezza intera pari a ${(L_in + heightCm/2 + thicknessCm).toFixed(1)} cm. Taglia il fronte (interno corto) a ${(L_in - heightCm/2 - thicknessCm).toFixed(1)} cm per lasciare aperta la luce. *IMPORTANTE: Incollare e avvitare lungo tutti i bordi con collante tagliafuoco e viti.*`,
              materials: [
                `1x Schiena Tratto 1 (Lunga): ${(widthCm + 2 * thicknessCm).toFixed(1)} x ${(L_in + heightCm/2 + thicknessCm).toFixed(1)} cm (Spessore: ${thicknessMm} mm)`,
                `1x Fronte Tratto 1 (Corta): ${(widthCm + 2 * thicknessCm).toFixed(1)} x ${(L_in - heightCm/2 - thicknessCm).toFixed(1)} cm (Spessore: ${thicknessMm} mm)`,
                `2x Fianchi Tratto 1 (Lunghi): ${(heightCm + 2 * thicknessCm).toFixed(1)} x ${(L_in + heightCm/2 + thicknessCm).toFixed(1)} cm (Spessore: ${thicknessMm} mm)`,
                "Viti e collante tagliafuoco"
              ],
            },
            {
              num: 3,
              title: "📐 Posizionamento del Tratto d'Ingresso",
              desc: "Assembla il Tratto 1 incollando e avvitando le lastre. Fissalo verticalmente a parete sulle staffe di supporto.",
              materials: ["Tratto 1 assemblato in posizione", "Viti e collante tagliafuoco"],
            },
            {
              num: 4,
              title: "🧱 Costruzione del Tratto d'Uscita (Tratto 2)",
              desc: `Prepara le lastre per il Tratto 2 (uscita). Taglia i due fianchi laterali a ${(L_out - heightCm/2 - thicknessCm).toFixed(1)} cm e la schiena (interno corto) a ${(L_out - heightCm/2).toFixed(1)} cm per andare in battuta sul Tratto 1. Taglia il fronte (esterno lungo) a ${(L_out + heightCm/2 + thicknessCm).toFixed(1)} cm in modo da sormontare la testa del Tratto 1 e chiudere l'angolo esterno della curva. *IMPORTANTE: Applicare il collante tagliafuoco e le viti.*`,
              materials: [
                `1x Fronte Tratto 2 (Lungo): ${(widthCm + 2 * thicknessCm).toFixed(1)} x ${(L_out + heightCm/2 + thicknessCm).toFixed(1)} cm (Spessore: ${thicknessMm} mm)`,
                `1x Schiena Tratto 2 (Corto): ${(widthCm + 2 * thicknessCm).toFixed(1)} x ${(L_out - heightCm/2).toFixed(1)} cm (Spessore: ${thicknessMm} mm)`,
                `2x Fianchi Tratto 2 (Corti): ${(heightCm + 2 * thicknessCm).toFixed(1)} x ${(L_out - heightCm/2 - thicknessCm).toFixed(1)} cm (Spessore: ${thicknessMm} mm)`,
                "Viti e collante tagliafuoco",
              ],
            },
            {
              num: 5,
              title: "📐 Unione delle Tratte (Curva Assemblata)",
              desc: "Spalma il collante tagliafuoco sui bordi di testa a contatto del Tratto 1. Posiziona il Tratto 2 mandando in battuta i fianchi e il fronte, mentre la schiena esterna sormonta lo spessore del Tratto 1. Fissa meccanicamente con viti.",
              materials: ["Curva verticale assemblata", "Viti e collante tagliafuoco"],
            },
            {
              num: 6,
              title: "🔗 Giunti Coprigiunto (Ingresso e Uscita)",
              desc: "Applica i coprigiunti sulle estremità libere di ingresso e uscita per la connessione alle tratte verticali adiacenti. *IMPORTANTE: Incollare e avvitare.*",
              materials: ["Coprigiunti esterni (larghi da 10 a 20 cm)", "Viti e collante tagliafuoco"],
            },
            {
              num: 7,
              title: "✅ Curva Verticale Completata",
              desc: "La curva verticale derivata da dritte è completata con sormonti e battute verticali, interamente incollata e avvitata.",
              materials: ["Curva verticale derivata da dritte completata"],
            },
          ];
        }
      }
    } else if (itemType === "canne-shunt") {
      return [
        {
          num: 1,
          title: "🛠️ Staffaggio e Sostegno",
          desc: "Fissa a parete le staffe metalliche laterali allineate e la barra asolata di fondo, che ha larghezza estesa per supportare entrambi i canali paralleli affiancati.",
          materials: ["Barre asolate di supporto (larghezza doppia)", "Staffe a parete e tasselli"],
        },
        {
          num: 2,
          title: "🧱 Corpo dei Canali (Schiena, Fianchi e Divisoria)",
          desc: `Posiziona la schiena posteriore larga ${(2 * widthCm + 3 * thicknessCm).toFixed(1)} cm. Fissa i due fianchi esterni da ${heightCm} cm e la parete divisoria centrale da ${heightCm} cm a X = 0 (la quale presenta una finestra di passaggio fumo da 20 cm tra Z = 0 e Z = 0.2). *IMPORTANTE: Applicare il collante e le viti sui bordi.*`,
          materials: [
            `1x Lastra Schiena (Doppia): ${(2 * widthCm + 3 * thicknessCm).toFixed(1)} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`,
            `2x Lastre Fianchi Esterni: ${heightCm} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`,
            `1x Parete Divisoria Centrale: ${heightCm} x ${lengthCm} cm (con finestra passaggio fumo) (Spessore: ${thicknessMm} mm)`,
            "Viti e collante tagliafuoco"
          ],
        },
        {
          num: 3,
          title: "📐 Setto Deviatore Interno (Antiriflusso)",
          desc: `Taglia e posiziona la lastra del setto deviatore interno inclinato a 45° all'interno del canale di destra (shunt). Deve convogliare il fumo dall'innesto verso la finestra centrale della parete divisoria. *IMPORTANTE: Sigillare accuratamente con collante.*`,
          materials: [`1x Setto Deviatore Interno: ${widthCm} x 35 cm (Spessore: ${thicknessMm} mm)`, "Collante tagliafuoco"],
        },
        {
          num: 4,
          title: "🧱 Innesto Secondario (Collettore di Piano)",
          desc: `Prepara e fissa frontalmente le lastre dell'innesto secondario sporgente del canale di destra (shunt). *IMPORTANTE: Incollare e avvitare.*`,
          materials: [
            `Lastre per canale secondario (innesto): spessore ${thicknessMm} mm`,
            "Viti e collante tagliafuoco"
          ],
        },
        {
          num: 5,
          title: "🔒 Chiusura Anteriore (Fronte SX e DX)",
          desc: `Monta la lastra frontale sinistra intera (per il canale dritto) e le due lastre frontali destre (inferiore e superiore per il canale shunt) per chiudere ermeticamente entrambi i canali lasciando libera la luce dell'innesto. *IMPORTANTE: Incollare e avvitare.*`,
          materials: [
            `1x Lastra Frontale SX (Intera): ${(widthCm + 1.5 * thicknessCm).toFixed(1)} x ${lengthCm} cm (Spessore: ${thicknessMm} mm)`,
            `1x Lastra Frontale DX Inf. (Forata): ${(widthCm + 1.5 * thicknessCm).toFixed(1)} x ${(lengthCm / 2 - 20).toFixed(0)} cm (Spessore: ${thicknessMm} mm)`,
            `1x Lastra Frontale DX Sup.: ${(widthCm + 1.5 * thicknessCm).toFixed(1)} x ${(lengthCm / 2).toFixed(0)} cm (Spessore: ${thicknessMm} mm)`,
            "Viti e collante tagliafuoco"
          ],
        },
        {
          num: 6,
          title: "🔗 Giunti Coprigiunto Esterni",
          desc: "Applica i coprigiunti sulle estremità superiore e inferiore che avvolgono ed uniscono entrambi i canali contemporaneamente in un unico pezzo unificato, per la connessione alle canne dei piani adiacenti.",
          materials: ["Coprigiunti esterni avvolgenti unici", "Viti e collante tagliafuoco"],
        },
        {
          num: 7,
          title: "✅ Spaccato e Percorso del Fumo",
          desc: "La canna shunt a doppio canale parallelo è completata. Nello spaccato si osserva il funzionamento dell'antiriflusso: il fumo entra dal canale destro, risale il deviatore ed entra nel canale dritto principale di sinistra tramite la finestra.",
          materials: ["Canna Shunt a doppio canale parallelo completata"],
        },
      ];
    }
    return [];
  }, [itemType, isHorizontal, variant, widthCm, heightCm, lengthCm, thicknessCm, thicknessMm]);

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
                  disabled={itemType === "canne-shunt"}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    itemType === "canne-shunt" ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                  } ${
                    subgroup === "orizzontali" ? "bg-white text-black" : "text-gray-400 hover:text-white"
                  }`}
                >
                  Orizzontali
                </button>
                <button
                  onClick={() => { setSubgroup("verticali"); setCurrentStep(1); }}
                  disabled={itemType === "canne-shunt"}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    itemType === "canne-shunt" ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                  } ${
                    subgroup === "verticali" ? "bg-white text-black" : "text-gray-400 hover:text-white"
                  }`}
                >
                  Verticali
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setItemType("dritte");
                  setVariant("con-giunto");
                  setCurrentStep(1);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  itemType === "dritte" ? "bg-orange-500/20 border-orange-500 text-orange-400" : "bg-white/5 border-white/5 text-gray-400"
                }`}
              >
                ▬ Dritte
              </button>
              <button
                onClick={() => {
                  setItemType("curve");
                  setVariant("pezzo-unico");
                  setCurrentStep(1);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  itemType === "curve" ? "bg-orange-500/20 border-orange-500 text-orange-400" : "bg-white/5 border-white/5 text-gray-400"
                }`}
              >
                ↳ Curve 90°
              </button>
              <button
                onClick={() => {
                  setItemType("canne-shunt");
                  setSubgroup("verticali");
                  setVariant("pezzo-unico"); // riusiamo pezzo-unico come stato di default per evitare errori di tipo
                  setCurrentStep(1);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  itemType === "canne-shunt" ? "bg-orange-500/20 border-orange-500 text-orange-400" : "bg-white/5 border-white/5 text-gray-400"
                }`}
              >
                ⑂ Canne Shunt
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
                itemType={itemType}
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
                    setVariant(e.target.value as any);
                    setCurrentStep(1);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl text-xs outline-none bg-black/30 border border-white/10 text-white cursor-pointer font-bold"
                >
                  {itemType === "dritte" ? (
                    <>
                      <option value="con-giunto" style={{ background: "hsl(220 32% 10%)" }}>
                        ▬ Dritte con Giunto
                      </option>
                      <option value="senza-giunto" style={{ background: "hsl(220 32% 10%)" }}>
                        ⎵ Dritte senza Giunto (Giunti Sfalsati)
                      </option>
                    </>
                  ) : itemType === "curve" ? (
                    <>
                      <option value="pezzo-unico" style={{ background: "hsl(220 32% 10%)" }}>
                        📐 Pezzo Unico (Sagomato)
                      </option>
                      <option value="derivata-dritte" style={{ background: "hsl(220 32% 10%)" }}>
                        ⎵ Derivata da Dritte (Sormonti)
                      </option>
                    </>
                  ) : (
                    <>
                      <option value="pezzo-unico" style={{ background: "hsl(220 32% 10%)" }}>
                        ⑂ Standard Antiriflusso
                      </option>
                    </>
                  )}
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
                {itemType === "dritte" ? (
                  variant === "senza-giunto" ? (
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
                  )
                ) : itemType === "curve" ? (
                  // Curve 90°
                  variant === "pezzo-unico" ? (
                    isHorizontal ? (
                      <>
                        <div className="flex justify-between">
                          <span>• Fondo + Coperchio a L (Sagomati):</span>
                          <span className="text-white font-bold">2x Ingombro {(lengthCm/2 + widthCm/2 + thicknessCm).toFixed(0)}x{(lengthCm/2 + widthCm/2 + thicknessCm).toFixed(0)} cm (W: {widthCm + 2*thicknessCm} cm)</span>
                        </div>
                        <div className="flex justify-between">
                          <span>• Fianchi Interni (Corti):</span>
                          <span className="text-white font-bold">2x {heightCm * 10} x {((lengthCm/2 - widthCm/2) * 10).toFixed(0)} mm</span>
                        </div>
                        <div className="flex justify-between">
                          <span>• Fianco Esterno Lungo 1:</span>
                          <span className="text-white font-bold">1x {heightCm * 10} x {((lengthCm/2 + widthCm/2 + thicknessCm) * 10).toFixed(0)} mm</span>
                        </div>
                        <div className="flex justify-between">
                          <span>• Fianco Esterno Lungo 2:</span>
                          <span className="text-white font-bold">1x {heightCm * 10} x {((lengthCm/2 + widthCm/2) * 10).toFixed(0)} mm</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between">
                          <span>• Fianchi SX + DX a L (Sagomati):</span>
                          <span className="text-white font-bold">2x Ingombro {(lengthCm/2 + heightCm/2 + thicknessCm).toFixed(0)}x{(lengthCm/2 + heightCm/2 + thicknessCm).toFixed(0)} cm (W: {heightCm + 2*thicknessCm} cm)</span>
                        </div>
                        <div className="flex justify-between">
                          <span>• Schiena/Fronte Interna (Corta):</span>
                          <span className="text-white font-bold">2x {widthCm + 2*thicknessCm} x {((lengthCm/2 - heightCm/2) * 10).toFixed(0)} mm</span>
                        </div>
                        <div className="flex justify-between">
                          <span>• Schiena/Fronte Esterna Lunga 1:</span>
                          <span className="text-white font-bold">2x {widthCm + 2*thicknessCm} x {((lengthCm/2 + heightCm/2 + thicknessCm) * 10).toFixed(0)} mm</span>
                        </div>
                        <div className="flex justify-between">
                          <span>• Schiena/Fronte Esterna Lunga 2:</span>
                          <span className="text-white font-bold">2x {widthCm + 2*thicknessCm} x {((lengthCm/2 + heightCm/2) * 10).toFixed(0)} mm</span>
                        </div>
                      </>
                    )
                  ) : (
                    // derivata-dritte
                    isHorizontal ? (
                      <>
                        <div className="flex justify-between">
                          <span>• Fondo/Coperchio Tratto 1 (Lungo):</span>
                          <span className="text-white font-bold">2x {((widthCm + 2*thicknessCm)*10).toFixed(0)} x {((lengthCm/2 + widthCm/2 + thicknessCm)*10).toFixed(0)} mm</span>
                        </div>
                        <div className="flex justify-between">
                          <span>• Fondo/Coperchio Tratto 2 (Corto):</span>
                          <span className="text-white font-bold">2x {((widthCm + 2*thicknessCm)*10).toFixed(0)} x {((lengthCm/2 - widthCm/2)*10).toFixed(0)} mm</span>
                        </div>
                        <div className="flex justify-between">
                          <span>• Fianco Esterno Tratto 1 (Lungo):</span>
                          <span className="text-white font-bold">1x {heightCm * 10} x {((lengthCm/2 + widthCm/2 + thicknessCm)*10).toFixed(0)} mm</span>
                        </div>
                        <div className="flex justify-between">
                          <span>• Fianco Esterno Tratto 2 (Corto):</span>
                          <span className="text-white font-bold">1x {heightCm * 10} x {((lengthCm/2 + widthCm/2)*10).toFixed(0)} mm</span>
                        </div>
                        <div className="flex justify-between">
                          <span>• Fianchi Interni:</span>
                          <span className="text-white font-bold">2x {heightCm * 10} x {((lengthCm/2 - widthCm/2)*10).toFixed(0)} mm</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between">
                          <span>• Fianchi Tratto 1 (Lungo):</span>
                          <span className="text-white font-bold">2x {((heightCm + 2*thicknessCm)*10).toFixed(0)} x {((lengthCm/2 + heightCm/2 + thicknessCm)*10).toFixed(0)} mm</span>
                        </div>
                        <div className="flex justify-between">
                          <span>• Fianchi Tratto 2 (Corto):</span>
                          <span className="text-white font-bold">2x {((heightCm + 2*thicknessCm)*10).toFixed(0)} x {((lengthCm/2 - heightCm/2)*10).toFixed(0)} mm</span>
                        </div>
                        <div className="flex justify-between">
                          <span>• Schiena/Fronte Esterna 1:</span>
                          <span className="text-white font-bold">2x {((widthCm + 2*thicknessCm)*10).toFixed(0)} x {((lengthCm/2 + heightCm/2 + thicknessCm)*10).toFixed(0)} mm</span>
                        </div>
                        <div className="flex justify-between">
                          <span>• Schiena/Fronte Esterna 2:</span>
                          <span className="text-white font-bold">2x {((widthCm + 2*thicknessCm)*10).toFixed(0)} x {((lengthCm/2 + heightCm/2)*10).toFixed(0)} mm</span>
                        </div>
                        <div className="flex justify-between">
                          <span>• Schiene/Fronti Interne:</span>
                          <span className="text-white font-bold">4x {((widthCm + 2*thicknessCm)*10).toFixed(0)} x {((lengthCm/2 - heightCm/2)*10).toFixed(0)} mm</span>
                        </div>
                      </>
                    )
                  )
                ) : (
                  // canne-shunt
                  <>
                    <div className="flex justify-between font-bold text-white mb-0.5">
                      <span>• Struttura Canali (Doppio):</span>
                    </div>
                    <div className="flex justify-between pl-2">
                      <span>- 1x Schiena Posteriore (Doppia):</span>
                      <span className="text-white font-bold">{((2 * widthCm + 3 * thicknessCm) * 10).toFixed(0)} x {(lengthCm * 10).toFixed(0)} mm</span>
                    </div>
                    <div className="flex justify-between pl-2">
                      <span>- 2x Fianchi Esterni SX/DX:</span>
                      <span className="text-white font-bold">{(heightCm * 10).toFixed(0)} x {(lengthCm * 10).toFixed(0)} mm</span>
                    </div>
                    <div className="flex justify-between pl-2">
                      <span>- 1x Parete Divisoria Centrale:</span>
                      <span className="text-white font-bold">{(heightCm * 10).toFixed(0)} x {(lengthCm * 10).toFixed(0)} mm</span>
                    </div>
                    <div className="flex justify-between font-bold text-white mt-1 mb-0.5">
                      <span>• Setto Interno:</span>
                    </div>
                    <div className="flex justify-between pl-2">
                      <span>- 1x Setto Deviatore:</span>
                      <span className="text-white font-bold">{(widthCm * 10).toFixed(0)} x 350 mm</span>
                    </div>
                    <div className="flex justify-between font-bold text-white mt-1 mb-0.5">
                      <span>• Innesto Secondario:</span>
                    </div>
                    <div className="flex justify-between pl-2">
                      <span>- 2x Fondo / Coperchio:</span>
                      <span className="text-white font-bold">{((widthCm + 2 * thicknessCm) * 10).toFixed(0)} x 300 mm</span>
                    </div>
                    <div className="flex justify-between pl-2">
                      <span>- 2x Fianchi:</span>
                      <span className="text-white font-bold">200 x 300 mm</span>
                    </div>
                    <div className="flex justify-between font-bold text-white mt-1 mb-0.5">
                      <span>• Chiusura Anteriore:</span>
                    </div>
                    <div className="flex justify-between pl-2">
                      <span>- 1x Fronte SX (Dritto - Intero):</span>
                      <span className="text-white font-bold">{((widthCm + 1.5 * thicknessCm) * 10).toFixed(0)} x {(lengthCm * 10).toFixed(0)} mm</span>
                    </div>
                    <div className="flex justify-between pl-2">
                      <span>- 1x Fronte DX Inf. (Shunt - Inf.):</span>
                      <span className="text-white font-bold">{((widthCm + 1.5 * thicknessCm) * 10).toFixed(0)} x {((lengthCm / 2 - 20) * 10).toFixed(0)} mm</span>
                    </div>
                    <div className="flex justify-between pl-2">
                      <span>- 1x Fronte DX Sup. (Shunt - Sup.):</span>
                      <span className="text-white font-bold">{((widthCm + 1.5 * thicknessCm) * 10).toFixed(0)} x {((lengthCm / 2) * 10).toFixed(0)} mm</span>
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
