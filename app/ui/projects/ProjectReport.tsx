"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useProjectStore } from "@/lib/stores/project-store";
import { getWalls, get3DBox } from "@/app/actions/projects";

interface Props {
  projectId: string;
}

// Interfacce per Distinta Materiali (BoM)
interface LinearMaterialRequest {
  length: number; // in mm
  label: string;
}

interface SheetMaterialRequest {
  width: number; // in mm
  height: number; // in mm
  label: string;
}

export default function ProjectReport({ projectId }: Props) {
  const [isPending, startTransition] = useTransition();
  const [projectData, setProjectData] = useState<any>(null);
  
  // Dati geometrici raccolti dai disegni del progetto
  const [allWalls, setAllWalls] = useState<any[]>([]);
  const [all3DBoxes, setAll3DBoxes] = useState<any[]>([]);

  // Caricamento asincrono di tutti i disegni e geometrie del progetto
  useEffect(() => {
    if (!projectId) return;

    const loadData = async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      // 1. Carica info progetto
      const { data: proj } = await supabase
        .from("projects")
        .select("name, notes, created_at, updated_at")
        .eq("id", projectId)
        .single();
      if (proj) setProjectData(proj);

      // 2. Carica tutti i disegni (levels)
      const { data: levels } = await supabase
        .from("levels")
        .select("id, name, drawing_type")
        .eq("project_id", projectId);

      if (levels && levels.length > 0) {
        const loadedWalls: any[] = [];
        const loaded3D: any[] = [];

        for (const lvl of levels) {
          if (lvl.drawing_type === "3d_box") {
            const box = await get3DBox(lvl.id);
            if (box) loaded3D.push({ ...box, levelName: lvl.name });
          } else {
            const walls = await getWalls(lvl.id);
            if (walls && walls.length > 0) {
              loadedWalls.push(...walls.map((w: any) => ({ ...w, levelName: lvl.name })));
            }
          }
        }
        setAllWalls(loadedWalls);
        setAll3DBoxes(loaded3D);
      }
    };

    loadData();
  }, [projectId]);

  // ============================================================
  // CALCOLO DISTINTA BASE (BoM)
  // ============================================================
  
  const commercialProfileLen = 3000; // Profilo standard da 3m (3000mm)
  const commercialSheetW = 1200; // Lastra standard 1200mm
  const commercialSheetH = 2000; // Lastra standard 2000mm
  const bladeThickness = 3; // Spessore lama (Kerf) in mm

  const linearRequests: LinearMaterialRequest[] = [];
  const sheetRequests: SheetMaterialRequest[] = [];

  // A. Estrazione materiali dalle Pareti 2D
  allWalls.forEach((w) => {
    const dx = w.x2 - w.x1;
    const dy = w.y2 - w.y1;
    const lenMm = Math.round(Math.sqrt(dx * dx + dy * dy) * 10); // in mm (1px = 10mm)
    
    // 1. Montanti verticali (ognuno lungo quanto l'altezza della parete)
    // Il numero di montanti è dato dalla lista o calcolato dal passo
    const pitchPx = w.pitch / 10;
    const lenPx = Math.sqrt(dx * dx + dy * dy);
    const numStuds = lenPx > pitchPx ? Math.floor(lenPx / pitchPx) + 2 : 2;

    for (let i = 0; i < numStuds; i++) {
      linearRequests.push({ length: w.height, label: `Montante H (Parete ${w.levelName})` });
    }

    // 2. Guide orizzontali (superiore e inferiore, ognuna lunga quanto la parete)
    linearRequests.push({ length: lenMm, label: `Guida inf. L (Parete ${w.levelName})` });
    linearRequests.push({ length: lenMm, label: `Guida sup. L (Parete ${w.levelName})` });

    // 3. Lastre di rivestimento (2 lati, quindi copriamo Area = L x H x 2)
    // Una lastra commerciale ha larghezza 1200mm. Dividiamo la parete in lastre verticali.
    const numSheetsNeeded = Math.ceil(lenMm / commercialSheetW) * 2;
    for (let i = 0; i < numSheetsNeeded; i++) {
      sheetRequests.push({
        width: Math.min(lenMm, commercialSheetW),
        height: w.height,
        label: `Lastra Parete (Parete ${w.levelName})`,
      });
    }
  });

  // B. Estrazione materiali dai Cavedi 3D
  all3DBoxes.forEach((box) => {
    // 12 spigoli metallici (angolari):
    // - 4 montanti verticali di altezza h
    for (let i = 0; i < 4; i++) {
      linearRequests.push({ length: box.h, label: `Angolare Vert. H (Cavedio ${box.levelName})` });
    }
    // - 4 profili di larghezza w
    for (let i = 0; i < 4; i++) {
      linearRequests.push({ length: box.w, label: `Angolare Orizz. W (Cavedio ${box.levelName})` });
    }
    // - 4 profili di profondità d
    for (let i = 0; i < 4; i++) {
      linearRequests.push({ length: box.d, label: `Angolare Orizz. D (Cavedio ${box.levelName})` });
    }

    // Lastre per le 6 facce:
    // 2x W x H
    sheetRequests.push({ width: box.w, height: box.h, label: `Lastra Front. (Cavedio ${box.levelName})` });
    sheetRequests.push({ width: box.w, height: box.h, label: `Lastra Post. (Cavedio ${box.levelName})` });
    // 2x D x H
    sheetRequests.push({ width: box.d, height: box.h, label: `Lastra Lat. SX (Cavedio ${box.levelName})` });
    sheetRequests.push({ width: box.d, height: box.h, label: `Lastra Lat. DX (Cavedio ${box.levelName})` });
    // 2x W x D
    sheetRequests.push({ width: box.w, height: box.d, label: `Lastra Inf. (Cavedio ${box.levelName})` });
    sheetRequests.push({ width: box.w, height: box.d, label: `Lastra Sup. (Cavedio ${box.levelName})` });
  });

  // ============================================================
  // ALGORITMO NESTING 1D (FIRST FIT DECREASING)
  // ============================================================
  
  interface PackedBar {
    cuts: number[];
    labels: string[];
    usedLength: number;
    remLen: number;
  }

  const pack1D = (): PackedBar[] => {
    // Ordina richieste in modo decrescente
    const sorted = [...linearRequests].sort((a, b) => b.length - a.length);
    const bars: PackedBar[] = [];

    sorted.forEach((req) => {
      // Se il pezzo supera i 3m, lo tagliamo a pezzi commerciali e avanziamo avviso
      let remainingToCut = req.length;
      while (remainingToCut > 0) {
        const currentCut = Math.min(remainingToCut, commercialProfileLen - bladeThickness);
        remainingToCut -= currentCut;

        let placed = false;
        // Cerca una barra esistente
        for (const bar of bars) {
          if (bar.remLen >= currentCut + bladeThickness) {
            bar.cuts.push(currentCut);
            bar.labels.push(req.label);
            bar.usedLength += currentCut + bladeThickness;
            bar.remLen -= currentCut + bladeThickness;
            placed = true;
            break;
          }
        }

        // Se non trova spazio, crea nuova barra
        if (!placed) {
          bars.push({
            cuts: [currentCut],
            labels: [req.label],
            usedLength: currentCut + bladeThickness,
            remLen: commercialProfileLen - (currentCut + bladeThickness),
          });
        }
      }
    });

    return bars;
  };

  const packedBars = pack1D();

  // ============================================================
  // ALGORITMO NESTING 2D (SEMPLIFICATO GRIGLIA / GHIGLIOTTINA)
  // ============================================================

  interface PlacedSheet {
    x: number;
    y: number;
    w: number;
    h: number;
    label: string;
  }

  interface PackedBoard {
    placed: PlacedSheet[];
    usedArea: number;
  }

  const pack2D = (): PackedBoard[] => {
    // Ordina lastre richieste per area decrescente
    const sorted = [...sheetRequests].sort((a, b) => (b.width * b.height) - (a.width * a.height));
    const boards: PackedBoard[] = [];

    sorted.forEach((req) => {
      // Se un pezzo è più grande del pannello standard, lo forziamo a stare dentro
      const reqW = Math.min(req.width, commercialSheetW);
      const reqH = Math.min(req.height, commercialSheetH);

      let placed = false;

      // Cerca spazio nei pannelli esistenti
      for (const board of boards) {
        // Algoritmo euristico ad accostamento laterale semplice (a righe)
        let currentY = 0;
        let currentX = 0;
        let maxRowHeight = 0;
        let canPlace = true;

        // Tenta di posizionarlo cercando un punto x, y vuoto
        // In una versione MVP, accostiamo da sinistra a destra, salendo in alto per righe
        while (currentY + reqH <= commercialSheetH) {
          currentX = 0;
          maxRowHeight = 0;
          
          while (currentX + reqW <= commercialSheetW) {
            // Controlla se si sovrappone a qualche lastra già posizionata
            const overlaps = board.placed.some(
              (p) =>
                currentX < p.x + p.w + bladeThickness &&
                currentX + reqW + bladeThickness > p.x &&
                currentY < p.y + p.h + bladeThickness &&
                currentY + reqH + bladeThickness > p.y
            );

            if (!overlaps) {
              board.placed.push({
                x: currentX,
                y: currentY,
                w: reqW,
                h: reqH,
                label: req.label,
              });
              board.usedArea += reqW * reqH;
              placed = true;
              break;
            }

            // Sposta a destra
            currentX += 50; // incrementi di 5cm per ricerca
          }

          if (placed) break;
          currentY += 50;
        }

        if (placed) break;
      }

      // Se non posizionato, crea un nuovo pannello commerciale
      if (!placed) {
        boards.push({
          placed: [
            {
              x: 0,
              y: 0,
              w: reqW,
              h: reqH,
              label: req.label,
            },
          ],
          usedArea: reqW * reqH,
        });
      }
    });

    return boards;
  };

  const packedBoards = pack2D();

  // Statistiche finali
  const totalProfilesCount = packedBars.length;
  const totalSheetsCount = packedBoards.length;

  const totalUsedProfileMm = packedBars.reduce((acc, b) => acc + (commercialProfileLen - b.remLen), 0);
  const totalProfileSfrido = totalProfilesCount > 0 
    ? Math.round(((totalProfilesCount * commercialProfileLen - totalUsedProfileMm) / (totalProfilesCount * commercialProfileLen)) * 100)
    : 0;

  const totalBoardArea = commercialSheetW * commercialSheetH;
  const totalUsedSheetArea = packedBoards.reduce((acc, b) => acc + b.usedArea, 0);
  const totalSheetSfrido = totalSheetsCount > 0
    ? Math.round(((totalSheetsCount * totalBoardArea - totalUsedSheetArea) / (totalSheetsCount * totalBoardArea)) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-[hsl(228_39%_6%)] text-white p-4 sm:p-8 w-full overflow-y-auto">
      
      {/* ── Navbar Report ── */}
      <div 
        className="max-w-5xl mx-auto flex items-center justify-between mb-8 pb-4 border-b print:hidden"
        style={{ borderColor: "hsl(220 20% 16%)" }}
      >
        <div className="flex items-center gap-3">
          <Link
            href={`/projects/${projectId}`}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-white transition-colors"
          >
            ← Torna al Progetto
          </Link>
          <span className="text-gray-400">/</span>
          <span className="text-sm font-semibold text-gray-300">Report & Nesting di Taglio</span>
        </div>

        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-colors shadow-lg cursor-pointer"
        >
          🖨️ Stampa Report / Salva PDF
        </button>
      </div>

      {/* ── CONTENITORE STAMPABILE DEL REPORT ── */}
      <div className="max-w-5xl mx-auto space-y-8 print:text-black print:bg-white">
        
        {/* Intestazione / Header Report */}
        <div 
          className="p-6 sm:p-8 rounded-3xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-6 print:border-none print:p-0"
          style={{
            background: "hsl(220 26% 12% / 0.4)",
            borderColor: "hsl(220 20% 20%)",
          }}
        >
          <div>
            <span className="text-xs uppercase font-bold text-orange-400 tracking-wider">Report Ufficiale Progetto</span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1 print:text-black">
              {projectData?.name ?? "Caricamento..."}
            </h1>
            <p className="text-xs text-gray-400 mt-2 print:text-gray-600">
              ID Progetto: {projectId} | Rilevato il: {new Date().toLocaleDateString("it-IT")}
            </p>
          </div>
          
          <div className="text-left md:text-right text-xs text-gray-400 print:text-gray-600">
            <p className="font-semibold text-white print:text-black">WebCAD Antincendio Optimizer</p>
            <p className="mt-1">Calcoli basati su standard commerciali Europei</p>
            <p className="mt-1">Kerf (Lama): {bladeThickness} mm</p>
          </div>
        </div>

        {/* Sezione Note / Appunti di Cantiere */}
        {projectData?.notes && (
          <div 
            className="p-6 rounded-3xl border print:border-none print:p-0"
            style={{
              background: "hsl(220 26% 12% / 0.2)",
              borderColor: "hsl(220 20% 16%)",
            }}
          >
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-3 print:text-black">
              📋 Note & Appunti di Cantiere
            </h3>
            <p className="text-sm leading-relaxed text-gray-300 whitespace-pre-wrap print:text-gray-800">
              {projectData.notes}
            </p>
          </div>
        )}

        {/* Sintesi Computo Metrico (BoM) */}
        <div 
          className="p-6 rounded-3xl border print:border-none print:p-0"
          style={{
            background: "hsl(220 26% 12% / 0.2)",
            borderColor: "hsl(220 20% 16%)",
          }}
        >
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4 print:text-black">
            📊 Sintesi Quantità & Computo Materiali
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Profili Lineari */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5 print:border-gray-200 print:text-black">
              <span className="text-xs uppercase font-bold text-gray-400">Profili & Montanti (1D)</span>
              <div className="text-3xl font-extrabold text-orange-400 mt-1">{totalProfilesCount} <span className="text-lg font-medium text-white print:text-black">Barre</span></div>
              <p className="text-xs text-gray-400 mt-2 print:text-gray-600">
                Lunghezza singola: 3000 mm | Sfrido Stimato: <span className="font-bold text-white print:text-black">{totalProfileSfrido}%</span>
              </p>
            </div>
            
            {/* Lastre di Rivestimento */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5 print:border-gray-200 print:text-black">
              <span className="text-xs uppercase font-bold text-gray-400">Lastre di Rivestimento (2D)</span>
              <div className="text-3xl font-extrabold text-blue-400 mt-1">{totalSheetsCount} <span className="text-lg font-medium text-white print:text-black">Pannelli</span></div>
              <p className="text-xs text-gray-400 mt-2 print:text-gray-600">
                Dimensione standard: 2000 x 1200 mm | Sfrido Stimato: <span className="font-bold text-white print:text-black">{totalSheetSfrido}%</span>
              </p>
            </div>
          </div>
        </div>

        {/* ── OTTIMIZZATORE DI TAGLIO 1D (Barre) ── */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 print:text-black">
            ✂️ Nesting di Taglio 1D: Barre Profili & Montanti (3000mm)
          </h3>

          <div className="space-y-4">
            {packedBars.map((bar, barIdx) => {
              let currentLeft = 0;
              return (
                <div 
                  key={barIdx} 
                  className="p-5 rounded-2xl border bg-white/5 border-white/5 print:border-gray-300 print:text-black"
                >
                  <div className="flex justify-between items-center text-xs font-semibold text-gray-400 mb-3 print:text-black">
                    <span>BARRA COMMERCIALE #{barIdx + 1}</span>
                    <span>Sfrido residuo: {bar.remLen} mm</span>
                  </div>

                  {/* Barra visualizzata graficamente */}
                  <div className="w-full h-8 bg-white/10 rounded-lg overflow-hidden flex relative border border-white/10">
                    {bar.cuts.map((cut, cutIdx) => {
                      const widthPct = (cut / commercialProfileLen) * 100;
                      const segment = (
                        <div
                          key={cutIdx}
                          className="h-full flex items-center justify-center text-[10px] font-bold border-r border-black/40 text-white truncate"
                          style={{
                            width: `${widthPct}%`,
                            background: "linear-gradient(180deg, hsl(16, 100%, 58%), hsl(0, 84%, 50%))",
                          }}
                          title={`${bar.labels[cutIdx]}: ${cut}mm`}
                        >
                          {Math.round(cut)}mm
                        </div>
                      );
                      return segment;
                    })}
                    {/* Quota sfrido grigia a fine barra */}
                    <div 
                      className="h-full bg-white/5 text-gray-500 flex items-center justify-center text-[9px] font-bold"
                      style={{ width: `${(bar.remLen / commercialProfileLen) * 100}%` }}
                    >
                      {bar.remLen > 0 ? `${bar.remLen}mm` : ""}
                    </div>
                  </div>

                  {/* Dettaglio tagli */}
                  <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-gray-400 print:text-gray-700">
                    {bar.cuts.map((cut, idx) => (
                      <span key={idx} className="bg-white/5 px-2.5 py-1 rounded-md border border-white/5">
                        📍 {bar.labels[idx]}: <strong className="text-white print:text-black">{Math.round(cut)} mm</strong>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── OTTIMIZZATORE DI TAGLIO 2D (Lastre) ── */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 print:text-black">
            ✂️ Nesting di Taglio 2D: Lastre Silicato / Cartongesso (2000x1200mm)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {packedBoards.map((board, boardIdx) => (
              <div 
                key={boardIdx}
                className="p-5 rounded-3xl border bg-white/5 border-white/5 flex flex-col items-center print:border-gray-300 print:text-black"
              >
                <div className="w-full flex justify-between items-center text-xs font-semibold text-gray-400 mb-4 print:text-black">
                  <span>PANNELLO COMMERCIALE #{boardIdx + 1}</span>
                  <span>Sfrido: {Math.round(((totalBoardArea - board.usedArea) / totalBoardArea) * 100)}%</span>
                </div>

                {/* Rappresentazione grafica in scala del pannello 2000x1200 */}
                {/* Usiamo un aspect ratio coerente per il disegno: W=1200, H=2000 -> scala 0.15 */}
                <div 
                  className="relative bg-white/5 rounded-2xl overflow-hidden border border-white/10"
                  style={{
                    width: `${commercialSheetW * 0.18}px`,
                    height: `${commercialSheetH * 0.18}px`,
                  }}
                >
                  {board.placed.map((p, idx) => (
                    <div
                      key={idx}
                      className="absolute border border-black/45 flex flex-col items-center justify-center p-1 text-[9px] font-bold text-white leading-tight overflow-hidden truncate"
                      style={{
                        left: `${p.x * 0.18}px`,
                        top: `${p.y * 0.18}px`,
                        width: `${p.w * 0.18}px`,
                        height: `${p.h * 0.18}px`,
                        background: "linear-gradient(135deg, hsl(220, 90%, 56%), hsl(215, 85% 45%))",
                      }}
                      title={`${p.label}: ${p.w}x${p.h}mm`}
                    >
                      <span className="truncate max-w-full">{p.w}x{p.h}</span>
                      <span className="text-[7px] opacity-60 truncate max-w-full">{p.label.split(" ")[0]}</span>
                    </div>
                  ))}
                </div>

                {/* Lista pezzi tagliati in questo pannello */}
                <div className="w-full mt-4 space-y-1.5 text-[10px] text-gray-400 border-t pt-3 border-white/5 print:text-gray-700">
                  {board.placed.map((p, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span>• {p.label}:</span>
                      <span className="font-semibold text-white print:text-black">{p.w} x {p.h} mm</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
