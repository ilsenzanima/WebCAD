"use client";

interface LinearMaterialRequest {
  length: number; // in mm
  label: string;
}

interface SheetMaterialRequest {
  width: number; // in mm
  height: number; // in mm
  label: string;
}

import type { FieldNote } from "@/app/actions/field-notes";

interface Props {
  allWalls: any[];
  all3DBoxes: any[];
  notes?: FieldNote[];
}

export default function ReportNesting({ allWalls, all3DBoxes, notes = [] }: Props) {
  const commercialProfileLen = 3000; // Profilo standard da 3m (3000mm)
  const commercialSheetW = 1200; // Lastra standard 1200mm
  const commercialSheetH = 2000; // Lastra standard 2000mm
  const bladeThickness = 3; // Spessore lama (Kerf) in mm

  const linearRequests: LinearMaterialRequest[] = [];
  const sheetRequests: SheetMaterialRequest[] = [];

  // A. Estrazione materiali dalle Lastre 2D estruse in 3D
  allWalls.forEach((w) => {
    const dx = w.x2 - w.x1;
    const dy = w.y2 - w.y1;
    const lenMm = Math.round(Math.sqrt(dx * dx + dy * dy) * 10); // in mm (1px = 10mm)
    
    // Le lastre del cassonetto sono caratterizzate da:
    // - Una larghezza pari a lenMm (sezione frontale)
    // - Una lunghezza pari alla profondità di estrusione w.height (es: 3000mm)
    // Se la lunghezza di estrusione supera l'altezza del pannello commerciale (commercialSheetH = 2000mm),
    // spezziamo il pezzo longitudinalmente (es. un pezzo da 2000mm e uno da 1000mm).
    let remainingLength = w.height || 3000;
    while (remainingLength > 0) {
      const currentPieceLen = Math.min(remainingLength, commercialSheetH);
      remainingLength -= currentPieceLen;
      sheetRequests.push({
        width: lenMm,
        height: currentPieceLen,
        label: `Lastra ${w.levelName || "Cassonetto"} (${lenMm}x${currentPieceLen}mm)`,
      });
    }
  });

  // A.2 Estrazione materiali dalle Note di Cantiere ("Pezzi da Tagliare")
  notes.forEach((note) => {
    (note.field_note_items ?? []).forEach((item) => {
      if (item.item_type === "dim_quadrata" && item.value_text) {
        try {
          const parsed = JSON.parse(item.value_text);
          const b = parseFloat(parsed.b);
          const h = parseFloat(parsed.h);
          const q = parseInt(parsed.q) || 1;
          const unit = parsed.unit || "cm";

          if (!isNaN(b) && !isNaN(h) && b > 0 && h > 0) {
            // Conversione in mm (1 cm = 10 mm)
            const factor = unit === "cm" ? 10 : 1;
            const wMm = Math.round(b * factor);
            const hMm = Math.round(h * factor);

            for (let i = 0; i < q; i++) {
              sheetRequests.push({
                width: wMm,
                height: hMm,
                label: `Nota #${note.note_number} (${wMm}x${hMm}mm)`,
              });
            }
          }
        } catch (e) {
          // Ignora errori di parsing o valori malformati
        }
      }
    });
  });

  // B. Algoritmo Nesting 1D (First Fit Decreasing)
  interface PackedBar {
    cuts: number[];
    labels: string[];
    usedLength: number;
    remLen: number;
  }

  const pack1D = (): PackedBar[] => {
    const sorted = [...linearRequests].sort((a, b) => b.length - a.length);
    const bars: PackedBar[] = [];

    sorted.forEach((req) => {
      let remainingToCut = req.length;
      while (remainingToCut > 0) {
        const currentCut = Math.min(remainingToCut, commercialProfileLen - bladeThickness);
        remainingToCut -= currentCut;

        let placed = false;
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

  // C. Algoritmo Nesting 2D (Semplificato Ghigliottina)
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

  interface FreeRect {
    x: number;
    y: number;
    w: number;
    h: number;
  }

  interface PlacementCandidate {
    boardIndex: number;
    freeRectIndex: number;
    rotated: boolean;
    x: number;
    y: number;
    w: number;
    h: number;
  }

  const pack2D = (): PackedBoard[] => {
    const sorted = [...sheetRequests].sort((a, b) => (b.width * b.height) - (a.width * a.height));
    const boards: PackedBoard[] = [];
    const freeRectsByBoard: FreeRect[][] = [];

    const createBoard = (): number => {
      boards.push({
        placed: [],
        usedArea: 0,
      });
      freeRectsByBoard.push([
        { x: 0, y: 0, w: commercialSheetW, h: commercialSheetH },
      ]);
      return boards.length - 1;
    };

    const tryMakeCandidate = (
      reqW: number,
      reqH: number,
      boardIndex: number,
      freeRectIndex: number,
      freeRect: FreeRect,
      rotated: boolean
    ): PlacementCandidate | null => {
      const pieceW = rotated ? reqH : reqW;
      const pieceH = rotated ? reqW : reqH;

      if (pieceW > freeRect.w || pieceH > freeRect.h) {
        return null;
      }

      return {
        boardIndex,
        freeRectIndex,
        rotated,
        x: freeRect.x,
        y: freeRect.y,
        w: pieceW,
        h: pieceH,
      };
    };

    const isBetterBottomLeft = (a: PlacementCandidate, b: PlacementCandidate): boolean => {
      if (a.y !== b.y) return a.y < b.y;
      if (a.x !== b.x) return a.x < b.x;
      const aShortSide = Math.min(a.w, a.h);
      const bShortSide = Math.min(b.w, b.h);
      return aShortSide > bShortSide;
    };

    const splitFreeRectGuillotine = (freeRect: FreeRect, piece: PlacementCandidate): FreeRect[] => {
      const rightStrip: FreeRect | null = freeRect.w - piece.w > 0
        ? {
            x: freeRect.x + piece.w + bladeThickness,
            y: freeRect.y,
            w: freeRect.w - piece.w - bladeThickness,
            h: piece.h,
          }
        : null;

      const bottomStrip: FreeRect | null = freeRect.h - piece.h > 0
        ? {
            x: freeRect.x,
            y: freeRect.y + piece.h + bladeThickness,
            w: freeRect.w,
            h: freeRect.h - piece.h - bladeThickness,
          }
        : null;

      const leftovers: FreeRect[] = [];
      if (rightStrip && rightStrip.w > 0 && rightStrip.h > 0) leftovers.push(rightStrip);
      if (bottomStrip && bottomStrip.w > 0 && bottomStrip.h > 0) leftovers.push(bottomStrip);
      return leftovers;
    };

    sorted.forEach((req) => {
      const reqW = Math.min(req.width, commercialSheetW);
      const reqH = Math.min(req.height, commercialSheetH);
      let bestCandidate: PlacementCandidate | null = null;

      for (let bIdx = 0; bIdx < freeRectsByBoard.length; bIdx++) {
        const freeRects = freeRectsByBoard[bIdx];
        for (let rIdx = 0; rIdx < freeRects.length; rIdx++) {
          const fr = freeRects[rIdx];
          const candidates = [
            tryMakeCandidate(reqW, reqH, bIdx, rIdx, fr, false),
            tryMakeCandidate(reqW, reqH, bIdx, rIdx, fr, true),
          ].filter((c): c is PlacementCandidate => c !== null);

          for (const cand of candidates) {
            if (!bestCandidate || isBetterBottomLeft(cand, bestCandidate)) {
              bestCandidate = cand;
            }
          }
        }
      }

      if (!bestCandidate) {
        const newBoardIndex = createBoard();
        const baseFreeRect = freeRectsByBoard[newBoardIndex][0];
        bestCandidate =
          tryMakeCandidate(reqW, reqH, newBoardIndex, 0, baseFreeRect, false) ??
          tryMakeCandidate(reqW, reqH, newBoardIndex, 0, baseFreeRect, true);
      }

      if (!bestCandidate) {
        return;
      }

      const board = boards[bestCandidate.boardIndex];
      const freeRects = freeRectsByBoard[bestCandidate.boardIndex];
      const targetFreeRect = freeRects[bestCandidate.freeRectIndex];
      if (!board || !targetFreeRect) {
        return;
      }

      board.placed.push({
        x: bestCandidate.x,
        y: bestCandidate.y,
        w: bestCandidate.w,
        h: bestCandidate.h,
        label: req.label,
      });
      board.usedArea += bestCandidate.w * bestCandidate.h;

      freeRects.splice(bestCandidate.freeRectIndex, 1);
      freeRects.push(...splitFreeRectGuillotine(targetFreeRect, bestCandidate));
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
    <div className="space-y-8">
      {/* Riepilogo Computo */}
      <div 
        className="p-6 rounded-3xl border print:border-none print:p-0"
        style={{
          background: "hsl(220 26% 12% / 0.2)",
          borderColor: "hsl(220 20% 16%)",
        }}
      >
        <h3 className="text-xs font-bold uppercase tracking-wider text-orange-400 mb-4 print:text-black print:font-bold">
          📊 Sintesi Fabbisogno & Computo Materiali
        </h3>
        
        <div className={`grid grid-cols-1 ${totalProfilesCount > 0 ? "md:grid-cols-2" : ""} gap-6`}>
          {/* Profili Lineari */}
          {totalProfilesCount > 0 && (
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5 print:border-gray-200 print:text-black">
              <span className="text-[10px] uppercase font-bold text-gray-400">Profili & Montanti (1D)</span>
              <div className="text-3xl font-extrabold text-orange-400 mt-1">
                {totalProfilesCount} <span className="text-sm font-medium text-white print:text-black">Barre</span>
              </div>
              <p className="text-xs text-gray-400 mt-2 print:text-gray-600">
                Lunghezza standard: 3000 mm | Sfrido Stimato: <span className="font-bold text-white print:text-black">{totalProfileSfrido}%</span>
              </p>
            </div>
          )}
          
          {/* Lastre */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/5 print:border-gray-200 print:text-black">
            <span className="text-[10px] uppercase font-bold text-gray-400">Lastre di Rivestimento (2D)</span>
            <div className="text-3xl font-extrabold text-blue-400 mt-1">
              {totalSheetsCount} <span className="text-sm font-medium text-white print:text-black">Pannelli</span>
            </div>
            <p className="text-xs text-gray-400 mt-2 print:text-gray-600">
              Dimensione standard: 2000 x 1200 mm | Sfrido Stimato: <span className="font-bold text-white print:text-black">{totalSheetSfrido}%</span>
            </p>
          </div>
        </div>
      </div>

      {/* Nesting 1D - Profili */}
      {totalProfilesCount > 0 && (
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 print:text-black print:font-bold">
            ✂️ Nesting di Taglio 1D: Profili & Montanti Lineari (3000mm)
          </h3>

          <div className="space-y-4">
            {packedBars.map((bar, barIdx) => (
              <div 
                key={barIdx} 
                className="p-5 rounded-2xl border bg-white/5 border-white/5 print:border-gray-300 print:text-black print:p-4"
              >
                <div className="flex justify-between items-center text-xs font-semibold text-gray-400 mb-3 print:text-black">
                  <span>BARRA COMMERCIALE #{barIdx + 1}</span>
                  <span>Sfrido residuo: {bar.remLen} mm</span>
                </div>

                <div className="w-full h-8 bg-white/10 rounded-lg overflow-hidden flex relative border border-white/10">
                  {bar.cuts.map((cut, cutIdx) => {
                    const widthPct = (cut / commercialProfileLen) * 100;
                    return (
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
                  })}
                  <div 
                    className="h-full bg-white/5 text-gray-500 flex items-center justify-center text-[9px] font-bold"
                    style={{ width: `${(bar.remLen / commercialProfileLen) * 100}%` }}
                  >
                    {bar.remLen > 0 ? `${bar.remLen}mm` : ""}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-gray-400 print:text-gray-700">
                  {bar.cuts.map((cut, idx) => (
                    <span key={idx} className="bg-white/5 px-2.5 py-1 rounded-md border border-white/5 print:border-gray-200">
                      📍 {bar.labels[idx]}: <strong className="text-white print:text-black">{Math.round(cut)} mm</strong>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Nesting 2D - Lastre */}
      {totalSheetsCount > 0 && (
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 print:text-black print:font-bold">
            ✂️ Nesting di Taglio 2D: Lastre Silicato / Cartongesso (2000x1200mm)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {packedBoards.map((board, boardIdx) => (
              <div 
                key={boardIdx}
                className="p-5 rounded-3xl border bg-white/5 border-white/5 flex flex-col items-center print:border-gray-300 print:text-black print:p-4"
              >
                <div className="w-full flex justify-between items-center text-xs font-semibold text-gray-400 mb-4 print:text-black">
                  <span>PANNELLO COMMERCIALE #{boardIdx + 1}</span>
                  <span>Sfrido: {Math.round(((totalBoardArea - board.usedArea) / totalBoardArea) * 100)}%</span>
                </div>

                {/* Grafico in scala */}
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
                        background: "linear-gradient(135deg, hsl(220, 90%, 56%), hsl(215, 85%, 45%))",
                      }}
                      title={`${p.label}: ${p.w}x${p.h}mm`}
                    >
                      <span className="truncate max-w-full">{p.w}x{p.h}</span>
                      <span className="text-[7.5px] opacity-60 truncate max-w-full">{p.label.split(" ")[0]}</span>
                    </div>
                  ))}
                </div>

                {/* Lista dei tagli */}
                <div className="w-full mt-4 space-y-1.5 text-[10px] text-gray-400 border-t pt-3 border-white/5 print:border-gray-200 print:text-gray-700">
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
      )}
    </div>
  );
}
