"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import Cassonetti3DViewer from "./assembly/Cassonetti3DViewer";

interface Project {
  id: string;
  name: string;
}

interface MaterialCategory {
  id: string;
  name: string;
  thickness_mm?: number;
}

interface CassonettiInstructionsClientProps {
  project: Project;
  catalogMaterials: MaterialCategory[];
}

export default function CassonettiInstructionsClient({
  project,
  catalogMaterials,
}: CassonettiInstructionsClientProps) {
  const [mounted, setMounted] = useState(false);

  // Stato materiale dal database
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>("");

  // Input testuali per inserimento manuale da form
  const [widthCmInput, setWidthCmInput] = useState<string>("40");
  const [heightCmInput, setHeightCmInput] = useState<string>("30");
  const [lengthCmInput, setLengthCmInput] = useState<string>("100");

  // Calcolo sicuro delle dimensioni per il motore 3D
  const widthCm = useMemo(() => Math.max(1, parseInt(widthCmInput) || 10), [widthCmInput]);
  const heightCm = useMemo(() => Math.max(1, parseInt(heightCmInput) || 10), [heightCmInput]);
  const lengthCm = useMemo(() => Math.max(1, parseInt(lengthCmInput) || 50), [lengthCmInput]);

  // Stato tipo di montaggio, configurazione lati e numero di strati
  const [positioning, setPositioning] = useState<"solaio" | "parete">("solaio");
  const [sides, setSides] = useState<"2-lati" | "3-lati" | "4-lati">("3-lati");
  const [layersCount, setLayersCount] = useState<number>(1); // Default 1 strato, max 3

  // Step attivo delle istruzioni
  const [currentStep, setCurrentStep] = useState(1);

  // Inizializza cercando per default "L500 sp.50"
  useEffect(() => {
    setMounted(true);
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

  // Materiale selezionato
  const activeMaterial = useMemo(() => {
    const mat = catalogMaterials.find((m) => m.id === selectedMaterialId);
    if (mat) {
      return {
        name: mat.name,
        thickness_mm: mat.thickness_mm ?? 50,
      };
    }
    return {
      name: "Silicato standard",
      thickness_mm: 50, // default 50mm
    };
  }, [catalogMaterials, selectedMaterialId]);

  const thicknessMm = activeMaterial.thickness_mm;
  const thicknessCm = thicknessMm * 0.1;
  const wMm = widthCm * 10;
  const hMm = heightCm * 10;
  const lMm = lengthCm * 10;

  // Gestione blur per validare i campi numerici
  const handleBlur = (val: string, setVal: (s: string) => void, min: number, max: number) => {
    const parsed = parseInt(val);
    if (isNaN(parsed) || val.trim() === "") {
      setVal(min.toString());
    } else if (parsed <= 0) {
      setVal("1");
    } else if (parsed > max) {
      setVal(max.toString());
    } else {
      setVal(parsed.toString());
    }
  };

  // Generazione dinamica dei passaggi didattici
  const steps = useMemo(() => {
    const isParete = positioning === "parete";
    const tCm = thicknessCm;
    const tMm = thicknessMm;

    // Descrizione plurilastre
    const layersText = layersCount > 1 ? ` (da ripetere per i ${layersCount} strati con sormonti alternati ad incrocio)` : "";

    // Calcolo dinamico dei pezzi strato per strato da mostrare negli step
    const listFianchi2Lati: string[] = [];
    const listFondo2Lati: string[] = [];
    const listTappi2Lati: string[] = [];

    const listFianchi3Lati: string[] = [];
    const listFondo3Lati: string[] = [];
    const listTappi3Lati: string[] = [];

    const listSchiena4Lati: string[] = [];
    const listFianchi4Lati: string[] = [];
    const listFondo4Lati: string[] = [];
    const listTappi4Lati: string[] = [];

    for (let k = 1; k <= layersCount; k++) {
      const isOdd = k % 2 !== 0;
      const labelStrato = layersCount === 1 ? "" : ` (Strato ${k} - ${isOdd ? "Interno" : "Esterno"})`;
      const labelTappo = layersCount === 1 ? "" : ` (Strato ${k})`;

      // 2 LATI
      const hFianco2 = isOdd ? heightCm + (layersCount + k - 1) * tCm : heightCm + (layersCount + k) * tCm;
      const wFondo2 = isOdd ? widthCm + (layersCount + k) * tCm : widthCm + (layersCount + k - 1) * tCm;
      const wTappo2 = widthCm + (layersCount + k) * tCm;
      const hTappo2 = heightCm + (layersCount + k) * tCm;

      listFianchi2Lati.push(`1x Lastra Fianco${labelStrato}: ${hFianco2.toFixed(1)} x ${lengthCm.toFixed(1)} cm (sp. ${tMm} mm)`);
      listFondo2Lati.push(`1x Lastra ${isParete ? "Frontale" : "Fondo"}${labelStrato}: ${wFondo2.toFixed(1)} x ${lengthCm.toFixed(1)} cm (sp. ${tMm} mm)`);
      listTappi2Lati.push(`2x Lastre Tappo${labelTappo}: ${wTappo2.toFixed(1)} x ${hTappo2.toFixed(1)} cm (sp. ${tMm} mm)`);

      // 3 LATI
      const hFianco3 = isOdd ? heightCm + (layersCount + k - 1) * tCm : heightCm + (layersCount + k) * tCm;
      const wFondo3 = isOdd ? widthCm + 2 * k * tCm : widthCm + 2 * (k - 1) * tCm;
      const wTappo3 = widthCm + 2 * k * tCm;
      const hTappo3 = heightCm + (layersCount + k) * tCm;

      listFianchi3Lati.push(`2x Lastre Fianchi (SX/DX)${labelStrato}: ${hFianco3.toFixed(1)} x ${lengthCm.toFixed(1)} cm (sp. ${tMm} mm)`);
      listFondo3Lati.push(`1x Lastra ${isParete ? "Frontale" : "Fondo"}${labelStrato}: ${wFondo3.toFixed(1)} x ${lengthCm.toFixed(1)} cm (sp. ${tMm} mm)`);
      listTappi3Lati.push(`2x Lastre Tappo${labelTappo}: ${wTappo3.toFixed(1)} x ${hTappo3.toFixed(1)} cm (sp. ${tMm} mm)`);

      // 4 LATI
      const wFondo4 = isOdd ? widthCm + 2 * k * tCm : widthCm + 2 * (k - 1) * tCm;
      const hFianco4 = isOdd ? heightCm + 2 * (k - 1) * tCm : heightCm + 2 * k * tCm;
      const wTappo4 = widthCm + 2 * k * tCm;
      const hTappo4 = heightCm + 2 * k * tCm;

      listSchiena4Lati.push(`1x Lastra ${isParete ? "Schiena" : "Coperchio"}${labelStrato}: ${wFondo4.toFixed(1)} x ${lengthCm.toFixed(1)} cm (sp. ${tMm} mm)`);
      listFianchi4Lati.push(`2x Lastre Fianchi (SX/DX)${labelStrato}: ${hFianco4.toFixed(1)} x ${lengthCm.toFixed(1)} cm (sp. ${tMm} mm)`);
      listFondo4Lati.push(`1x Lastra ${isParete ? "Frontale" : "Fondo"}${labelStrato}: ${wFondo4.toFixed(1)} x ${lengthCm.toFixed(1)} cm (sp. ${tMm} mm)`);
      listTappi4Lati.push(`2x Lastre Tappo${labelTappo}: ${wTappo4.toFixed(1)} x ${hTappo4.toFixed(1)} cm (sp. ${tMm} mm)`);
    }

    if (sides === "2-lati") {
      return [
        {
          num: 1,
          title: "🛠️ Struttura ed Orditura Metallica a U o a C",
          desc: isParete
            ? "Fissa verticalmente all'angolo tra le due pareti i profili metallici di guida (Orditura metallica a U o a C da 50x50 mm) utilizzando tasselli adatti alla muratura. Non utilizzare colla."
            : "Fissa a solaio e a parete i profili metallici di guida (Orditura metallica a U o a C da 50x50 mm) lungo l'angolo di scorrimento degli impianti. Fissaggio esclusivamente meccanico.",
          materials: ["Profili Orditura metallica a U o a C (50x50 mm)", "Tasselli e viti di fissaggio"],
        },
        {
          num: 2,
          title: `🧱 Lastre Fianco Esterno${layersText}`,
          desc: `Fissa meccanicamente la lastra (o lo strato di lastre) del fianco esterno all'orditura metallica tramite viti autoperforanti per silicato (passo max 20 cm). *NOTA: In caso di più strati, alternare l'incrocio delle lastre d'angolo per evitare giunti allineati.*`,
          materials: [
            ...listFianchi2Lati,
            "Viti",
          ],
        },
        {
          num: 3,
          title: isParete ? `🔒 Lastra Frontale di Chiusura${layersText}` : `🧱 Lastra Inferiore (Fondo)${layersText}`,
          desc: isParete
            ? `Avvita la lastra frontale di chiusura in battuta sullo spessore del fianco montato al passo precedente, ancorandola sull'altro lato all'orditura metallica fissata a parete.`
            : `Fissa la lastra inferiore (fondo) in sormonto sotto lo spessore del fianco laterale ed all'orditura metallica a parete.`,
          materials: [
            ...listFondo2Lati,
            "Viti",
          ],
        },
        {
          num: 4,
          title: "🛑 Tappi Terminali di Chiusura (Opzionali)",
          desc: `Applica i 2 tappi di chiusura alle estremità del cassonetto (inizio e fine tratta). Ciascun tappo copre l'intero ingombro esterno ed è composto da ${layersCount} strati fissati meccanicamente all'orditura interna. *SUGGERIMENTO: Inserire spezzoni di orditura metallica interna lungo il perimetro di giunzione dove necessario, così da garantire una solida tenuta meccanica e l'ancoraggio delle viti.*`,
          materials: [
            ...listTappi2Lati,
            "Viti",
          ],
        },
        {
          num: 5,
          title: "✅ Cassonetto Completato",
          desc: `Il cassonetto copri impianti a 2 lati ${isParete ? "a cavedio verticale" : "a solaio"} è ultimato ed assemblato interamente a secco con sole viti.`,
          materials: ["Cassonetto finito"],
        },
      ];
    } else if (sides === "3-lati") {
      return [
        {
          num: 1,
          title: "🛠️ Struttura ed Orditura Metallica a U o a C",
          desc: isParete
            ? "Tassella verticalmente a parete i due profili di guida paralleli (Orditura metallica a U o a C da 50x50 mm) che definiranno la larghezza del cavedio a 3 lati."
            : "Fissa a solaio i due profili metallici di guida paralleli (Orditura metallica a U o a C da 50x50 mm) per appendere i fianchi. Fissaggio solo meccanico tramite tasselli.",
          materials: ["Profili Orditura metallica a U o a C (50x50 mm)", "Tasselli e viti di fissaggio"],
        },
        {
          num: 2,
          title: `🧱 Fianchi Laterali (SX e DX)${layersText}`,
          desc: `Fissa le due lastre dei fianchi esterni all'orditura metallica tramite viti. Per configurazioni plurilastra, alternare lo sfalsamento d'angolo ad incastro tra i vari strati.`,
          materials: [
            ...listFianchi3Lati,
            "Viti",
          ],
        },
        {
          num: 3,
          title: isParete ? `🔒 Lastra Frontale di Chiusura${layersText}` : `🧱 Lastra Inferiore (Fondo)${layersText}`,
          desc: isParete
            ? `Avvita la lastra frontale di chiusura a sormonto sullo spessore di entrambi i fianchi laterali esterni, fissandola meccanicamente.`
            : `Fissa la lastra inferiore (fondo) a sormonto sotto lo spessore dei due fianchi. Fissaggio solo con viti.`,
          materials: [
            ...listFondo3Lati,
            "Viti",
          ],
        },
        {
          num: 4,
          title: "🛑 Tappi Terminali di Chiusura (Opzionali)",
          desc: `Applica i 2 tappi di chiusura sulle estremità. Ciascun tappo copre l'intero ingombro ed è composto da ${layersCount} strati fissati meccanicamente all'orditura metallica perimetrale. *SUGGERIMENTO: Inserire spezzoni di orditura metallica interna lungo il perimetro di giunzione dove necessario, così da garantire una solida tenuta meccanica e l'ancoraggio delle viti.*`,
          materials: [
            ...listTappi3Lati,
            "Viti",
          ],
        },
        {
          num: 5,
          title: "✅ Cassonetto Completato",
          desc: `Il cassonetto copri impianti a 3 lati ${isParete ? "a cavedio verticale" : "a solaio"} è ultimato, assemblato con sole viti senza uso di colla.`,
          materials: ["Cassonetto 3 lati completato"],
        },
      ];
    } else {
      // 4 LATI
      return [
        {
          num: 1,
          title: "🛠️ Orditura Metallica a U o a C & Supporti",
          desc: isParete
            ? "Installa le staffe metalliche di sostegno ed i profili di orditura interna a U o a C (50x50 mm) su tutti e quattro gli angoli interni del cavedio verticale."
            : "Installa i pendini di sospensione e le barre asolate di fondo (solo per 4 lati). Fissa l'orditura metallica interna a U o a C (50x50 mm) su tutti e quattro gli angoli interni del cassonetto.",
          materials: ["Profili Orditura a U o a C (50x50 mm)", "Pendini e barre asolate" , "Staffe a parete e tasselli"],
        },
        {
          num: 2,
          title: isParete ? `🧱 Schiena Posteriore${layersText}` : `🧱 Lastra Superiore (Coperchio)${layersText}`,
          desc: isParete
            ? `Fissa la schiena posteriore fissandola meccanicamente all'orditura ed alle staffe a parete.`
            : `Fissa la lastra superiore a ridosso del solaio ancorandola all'orditura metallica di supporto superiore.`,
          materials: [
            ...listSchiena4Lati,
            "Viti",
          ],
        },
        {
          num: 3,
          title: `📐 Fianchi Laterali (SX e DX) Sfalsati${layersText}`,
          desc: `Monta le due lastre dei fianchi laterali ortogonalmente alla schiena/coperchio. *IMPORTANTE: Per la versione a 4 lati, sfalsare longitudinalmente i giunti dei fianchi rispetto a fondo/coperchio. Fissaggio a secco con sole viti.*`,
          materials: [
            ...listFianchi4Lati,
            "Viti",
          ],
        },
        {
          num: 4,
          title: isParete ? `🔒 Lastra Frontale di Chiusura${layersText}` : `🧱 Lastra Inferiore (Fondo)${layersText}`,
          desc: isParete
            ? `Chiudi il cavedio montando la lastra frontale di chiusura ed avvitandola su tutta l'orditura d'angolo.`
            : `Avvita la lastra inferiore (fondo) per sigillare a scatola chiusa il cassonetto a 4 lati.`,
          materials: [
            ...listFondo4Lati,
            "Viti",
          ],
        },
        {
          num: 5,
          title: "🛑 Tappi Terminali di Chiusura (Opzionali)",
          desc: `Fissa i 2 tappi terminali di chiusura alle estremità della tratta. Ciascun tappo copre l'intero ingombro esterno ed è composto da ${layersCount} strati di lastre fissati all'orditura metallica interna. *SUGGERIMENTO: Inserire spezzoni di orditura metallica interna lungo il perimetro di giunzione dove necessario, così da garantire una solida tenuta meccanica e l'ancoraggio delle viti.*`,
          materials: [
            ...listTappi4Lati,
            "Viti",
          ],
        },
        {
          num: 6,
          title: "✅ Cassonetto Completato",
          desc: isParete
            ? "Il cassonetto isolato a 4 lati è completato. Per questa versione verticale (a parete), applicare il giunto coprigiunto di base a contatto con il pavimento nella parte inferiore per sigillare la base del cassonetto."
            : "Il cassonetto isolato a 4 lati è interamente montato con orditura interna a U o a C ed assemblato a secco con sole viti.",
          materials: isParete
            ? ["Cassonetto completato", "Giunto coprigiunto di base a pavimento"]
            : ["Cassonetto 4 lati completato"],
        },
      ];
    }
  }, [positioning, sides, widthCm, heightCm, lengthCm, thicknessCm, thicknessMm, layersCount]);

  // Calcoli distinta di taglio dinamica con plurilastre a sormonti incrociati
  const cutsList = useMemo(() => {
    const tCm = thicknessCm;
    const list = [];

    for (let k = 1; k <= layersCount; k++) {
      const isOdd = k % 2 !== 0;
      const layerName = layersCount === 1 ? "" : ` (Strato ${k} - ${isOdd ? "Interno" : "Esterno"})`;

      if (sides === "2-lati") {
        if (isOdd) {
          list.push({
            name: `• Lastra Fianco${layerName}:`,
            qty: 1,
            w: hMm + (layersCount + k - 1) * thicknessMm,
            l: lMm,
          });
          list.push({
            name: `• Lastra Frontale/Fondo${layerName}:`,
            qty: 1,
            w: wMm + (layersCount + k) * thicknessMm,
            l: lMm,
          });
        } else {
          list.push({
            name: `• Lastra Fianco${layerName}:`,
            qty: 1,
            w: hMm + (layersCount + k) * thicknessMm,
            l: lMm,
          });
          list.push({
            name: `• Lastra Frontale/Fondo${layerName}:`,
            qty: 1,
            w: wMm + (layersCount + k - 1) * thicknessMm,
            l: lMm,
          });
        }
      } else if (sides === "3-lati") {
        if (isOdd) {
          list.push({
            name: `• Lastre Fianchi (SX/DX)${layerName}:`,
            qty: 2,
            w: hMm + (layersCount + k - 1) * thicknessMm,
            l: lMm,
          });
          list.push({
            name: `• Lastra Frontale/Fondo${layerName}:`,
            qty: 1,
            w: wMm + 2 * k * thicknessMm,
            l: lMm,
          });
        } else {
          list.push({
            name: `• Lastre Fianchi (SX/DX)${layerName}:`,
            qty: 2,
            w: hMm + (layersCount + k) * thicknessMm,
            l: lMm,
          });
          list.push({
            name: `• Lastra Frontale/Fondo${layerName}:`,
            qty: 1,
            w: wMm + 2 * (k - 1) * thicknessMm,
            l: lMm,
          });
        }
      } else {
        // 4 LATI
        if (isOdd) {
          list.push({
            name: `• Lastre Fianchi (SX/DX)${layerName}:`,
            qty: 2,
            w: hMm + 2 * (k - 1) * thicknessMm,
            l: lMm,
          });
          list.push({
            name: `• Lastre Frontale/Retro (Fondo/Coperchio)${layerName}:`,
            qty: 2,
            w: wMm + 2 * k * thicknessMm,
            l: lMm,
          });
        } else {
          list.push({
            name: `• Lastre Fianchi (SX/DX)${layerName}:`,
            qty: 2,
            w: hMm + 2 * k * thicknessMm,
            l: lMm,
          });
          list.push({
            name: `• Lastre Frontale/Retro (Fondo/Coperchio)${layerName}:`,
            qty: 2,
            w: wMm + 2 * (k - 1) * thicknessMm,
            l: lMm,
          });
        }
      }
    }

    // Aggiunta Tappi terminali opzionali (sempre 2 tappi per ciascun strato)
    for (let k = 1; k <= layersCount; k++) {
      const layerName = layersCount === 1 ? "" : ` (Strato ${k})`;
      let wTappo = wMm + 2 * k * thicknessMm;
      let hTappo = hMm + 2 * k * thicknessMm;

      if (sides === "2-lati") {
        wTappo = wMm + (layersCount + k) * thicknessMm;
        hTappo = hMm + (layersCount + k) * thicknessMm;
      } else if (sides === "3-lati") {
        wTappo = wMm + 2 * k * thicknessMm;
        hTappo = hMm + (layersCount + k) * thicknessMm;
      }

      list.push({
        name: `• Tappi Terminali Opzionali${layerName}:`,
        qty: 2,
        w: wTappo,
        h: hTappo,
      });
    }

    return list;
  }, [sides, widthCm, heightCm, lengthCm, thicknessMm, layersCount]);

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
            className="flex-1 rounded-3xl overflow-hidden min-h-[350px] lg:min-h-[500px] relative border flex items-center justify-center bg-black/40"
            style={{
              borderColor: "hsl(220 20% 18%)",
            }}
          >
            {mounted ? (
              <Cassonetti3DViewer
                positioning={positioning}
                sides={sides}
                width={wMm}
                height={hMm}
                length={lMm}
                thickness={thicknessMm}
                currentStep={currentStep}
                layersCount={layersCount}
              />
            ) : (
              <div className="text-xs text-gray-500 font-bold animate-pulse">
                Caricamento motore 3D interattivo...
              </div>
            )}

            {/* Indicatori Overlay sul Canvas */}
            <div className="absolute top-4 left-4 p-3 rounded-xl bg-black/75 border border-white/10 text-[10px] space-y-1 font-mono">
              <p className="text-gray-400 font-bold">DIMENSIONI INTERNE (FORO):</p>
              <p className="text-white">Larghezza: <span className="text-amber-400 font-bold">{widthCm} cm</span></p>
              <p className="text-white">Altezza: <span className="text-amber-400 font-bold">{heightCm} cm</span></p>
              <p className="text-white">Lunghezza: <span className="text-amber-400 font-bold">{lengthCm} cm</span></p>
              <p className="text-gray-400 font-bold mt-2">STRATI LASTRE:</p>
              <p className="text-white">Numero lastre: <span className="text-amber-400 font-bold">{layersCount}</span></p>
              <p className="text-gray-400 font-bold mt-2">MATERIALE SELEZIONATO:</p>
              <p className="text-emerald-400 font-bold truncate max-w-[150px]">{activeMaterial.name} ({thicknessMm} mm)</p>
            </div>

            {/* Indicatore dello Step attivo sovrapposto in basso a sinistra */}
            <div className="absolute bottom-4 left-4 px-3.5 py-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-bold text-gray-300">
              PASSO {currentStep} DI {steps.length}
            </div>
          </div>
        </div>

        {/* LATO DESTRO: Configurazione Parametri, Distinta e Istruzioni (5 colonne) */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          {/* Box Parametri Form */}
          <div
            className="p-5 rounded-2xl space-y-4"
            style={{
              background: "hsl(220 26% 14% / 0.8)",
              border: "1px solid hsl(220 20% 20%)",
            }}
          >
            <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-white/5 pb-2">
              📐 Configura Geometria & Materiale
            </h3>

            {/* Dropdown Materiale */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Spessore Materiale Lastre</label>
              <select
                value={selectedMaterialId}
                onChange={(e) => setSelectedMaterialId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-xs outline-none bg-black/30 border border-white/10 text-white cursor-pointer font-bold"
              >
                {catalogMaterials.map((m) => (
                  <option key={m.id} value={m.id} className="bg-slate-900 text-white">
                    {m.name} ({m.thickness_mm ?? 50} mm)
                  </option>
                ))}
              </select>
            </div>

            {/* Selettore Numero Strati (Plurilastra) */}
            <div className="space-y-2 pt-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Numero di Lastre per Lato (Strati)</label>
              <div className="flex gap-2">
                {[1, 2, 3].map((val) => (
                  <button
                    key={val}
                    onClick={() => {
                      setLayersCount(val);
                      setCurrentStep(1);
                    }}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      layersCount === val
                        ? "bg-amber-500/20 border-amber-500 text-amber-400 font-extrabold"
                        : "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10"
                    }`}
                  >
                    {val} {val === 1 ? "Lastra" : "Lastre"}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-white/5">
              {/* Input Larghezza */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-gray-400 uppercase">Larghezza (W) cm</label>
                <input
                  type="number"
                  value={widthCmInput}
                  onChange={(e) => setWidthCmInput(e.target.value)}
                  onBlur={() => handleBlur(widthCmInput, setWidthCmInput, 10, 150)}
                  className="w-full px-3 py-2 rounded-xl text-xs outline-none bg-black/30 border border-white/10 text-white font-bold"
                />
              </div>

              {/* Input Altezza */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-gray-400 uppercase">Altezza (H) cm</label>
                <input
                  type="number"
                  value={heightCmInput}
                  onChange={(e) => setHeightCmInput(e.target.value)}
                  onBlur={() => handleBlur(heightCmInput, setHeightCmInput, 10, 150)}
                  className="w-full px-3 py-2 rounded-xl text-xs outline-none bg-black/30 border border-white/10 text-white font-bold"
                />
              </div>

              {/* Input Lunghezza */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-gray-400 uppercase">Lunghezza (L) cm</label>
                <input
                  type="number"
                  value={lengthCmInput}
                  onChange={(e) => setLengthCmInput(e.target.value)}
                  onBlur={() => handleBlur(lengthCmInput, setLengthCmInput, 50, 300)}
                  className="w-full px-3 py-2 rounded-xl text-xs outline-none bg-black/30 border border-white/10 text-white font-bold"
                />
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
              <div className="p-3.5 rounded-xl bg-black/20 border border-white/5 text-[10px] space-y-1.5 font-mono text-gray-400 max-h-[180px] overflow-y-auto">
                <div className="text-white font-bold mb-1">📐 DISTINTA DI TAGLIO PRECOMPILATA:</div>
                {cutsList.map((cut, idx) => (
                  <div key={idx} className="flex justify-between border-b border-white/5 pb-1 last:border-b-0">
                    <span>{cut.name}</span>
                    <span className="text-white font-bold">
                      {cut.qty}x {cut.w.toFixed(0)} x {cut.h !== undefined ? cut.h.toFixed(0) : (cut.l ?? 0).toFixed(0)} mm
                    </span>
                  </div>
                ))}
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
