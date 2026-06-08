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

  // Helper ricorsivo per dividere i pezzi che superano la dimensione del foglio con guardie di sicurezza
  const splitPiece = (w: number, h: number, sW: number, sH: number, depth = 0): { w: number; h: number }[] => {
    if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0 || !isFinite(w) || !isFinite(h)) {
      return [];
    }
    if (depth > 12) {
      // Circuito di sicurezza per evitare stack overflow in caso di scomposizioni infinite
      return [{ w: Math.min(w, sW), h: Math.min(h, sH) }];
    }
    if ((w <= sW && h <= sH) || (w <= sH && h <= sW)) {
      return [{ w, h }];
    }
    const maxSheetDim = Math.max(sW, sH);
    if (h > maxSheetDim || (h > w && w <= maxSheetDim)) {
      let maxH = maxSheetDim;
      if (w <= sW && w <= sH) {
        maxH = maxSheetDim;
      } else if (w <= sW) {
        maxH = sH;
      } else if (w <= sH) {
        maxH = sW;
      } else {
        maxH = maxSheetDim;
      }
      const result: { w: number; h: number }[] = [];
      let remainingH = h;
      let loops = 0;
      while (remainingH > 0 && loops < 6) {
        loops++;
        const currentH = Math.min(remainingH, maxH);
        result.push(...splitPiece(w, currentH, sW, sH, depth + 1));
        remainingH -= currentH;
      }
      return result;
    } else {
      let maxW = maxSheetDim;
      if (h <= sW && h <= sH) {
        maxW = maxSheetDim;
      } else if (h <= sW) {
        maxW = sH;
      } else if (h <= sH) {
        maxW = sW;
      } else {
        maxW = maxSheetDim;
      }
      const result: { w: number; h: number }[] = [];
      let remainingW = w;
      let loops = 0;
      while (remainingW > 0 && loops < 6) {
        loops++;
        const currentW = Math.min(remainingW, maxW);
        result.push(...splitPiece(currentW, h, sW, sH, depth + 1));
        remainingW -= currentW;
      }
      return result;
    }
  };

  let isCapped = false;

  // A. Estrazione materiali dalle Lastre 2D estruse in 3D
  allWalls.forEach((w) => {
    if (sheetRequests.length >= 300) {
      isCapped = true;
      return;
    }
    const dx = w.x2 - w.x1;
    const dy = w.y2 - w.y1;
    const rawLenMm = Math.round(Math.sqrt(dx * dx + dy * dy) * 10);
    const lenMm = Math.min(30000, rawLenMm); // limitiamo a max 30m
    
    if (isNaN(lenMm) || lenMm <= 0) return;

    // Le lastre del cassonetto sono caratterizzate da:
    // - Una larghezza pari a lenMm (sezione frontale)
    // - Una lunghezza pari alla profondità di estrusione w.height (es: 3000mm)
    // Se la lunghezza di estrusione supera l'altezza del pannello commerciale (commercialSheetH = 2000mm),
    // spezziamo il pezzo longitudinalmente (es. un pezzo da 2000mm e uno da 1000mm).
    let remainingLength = Math.min(10000, w.height || 3000); // limitiamo a max 10m
    if (isNaN(remainingLength) || remainingLength <= 0) remainingLength = 3000;

    let wallLoops = 0;
    while (remainingLength > 0 && wallLoops < 10) {
      wallLoops++;
      const currentPieceLen = Math.min(remainingLength, commercialSheetH);
      remainingLength -= currentPieceLen;
      if (sheetRequests.length >= 300) {
        isCapped = true;
        break;
      }
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
      if (sheetRequests.length >= 300) {
        isCapped = true;
        return;
      }
      if (item.item_type === "dim_quadrata" && item.value_text) {
        try {
          const parsed = JSON.parse(item.value_text);
          // Estraiamo solo se è esplicitamente un pezzo da tagliare per il nesting
          const isCut = parsed.isCutPiece || (parsed.q !== undefined && parsed.q !== null);
          if (!isCut) return;

          // Limitiamo a max 15m (1500cm) per evitare valori di test esagerati
          const maxAllowedDimCm = 1500;
          const parsedB = parseFloat(parsed.b);
          const parsedH = parseFloat(parsed.h);
          const b = isNaN(parsedB) ? 0 : Math.min(maxAllowedDimCm, parsedB);
          const h = isNaN(parsedH) ? 0 : Math.min(maxAllowedDimCm, parsedH);
          
          // Cap a 50 pezzi per evitare blocchi per input errati
          const q = Math.min(50, parseInt(parsed.q) || 1);
          const unit = parsed.unit || "cm";

          if (b > 0 && h > 0 && isFinite(b) && isFinite(h)) {
            // Conversione in mm (1 cm = 10 mm)
            const factor = unit === "cm" ? 10 : 1;
            const wMm = Math.round(b * factor);
            const hMm = Math.round(h * factor);

            const splitPieces = splitPiece(wMm, hMm, commercialSheetW, commercialSheetH);
            for (let i = 0; i < q; i++) {
              if (sheetRequests.length >= 300) {
                isCapped = true;
                break;
              }
              splitPieces.forEach((sp) => {
                if (sheetRequests.length >= 300) {
                  isCapped = true;
                  return;
                }
                sheetRequests.push({
                  width: sp.w,
                  height: sp.h,
                  label: parsed.refTitle
                    ? `Nota #${note.note_number} - ${parsed.refTitle} (${wMm}x${hMm}mm)`
                    : `Nota #${note.note_number} (${wMm}x${hMm}mm)`,
                });
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

    // Helper per verificare se un rettangolo A contiene completamente un rettangolo B
    const contains = (a: FreeRect, b: FreeRect): boolean => {
      return (
        b.x >= a.x &&
        b.y >= a.y &&
        b.x + b.w <= a.x + a.w &&
        b.y + b.h <= a.y + a.h
      );
    };

    // Helper per rimuovere rettangoli ridondanti (completamente contenuti in altri)
    const pruneFreeRectangles = (boardIdx: number) => {
      const rects = freeRectsByBoard[boardIdx];
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          if (contains(rects[i], rects[j])) {
            rects.splice(j, 1);
            j--;
          } else if (contains(rects[j], rects[i])) {
            rects.splice(i, 1);
            i--;
            break;
          }
        }
      }
    };

    // Split di un rettangolo libero F in base a un rettangolo occupato P (tenendo conto della lama)
    const splitFreeRect = (f: FreeRect, p: { x: number; y: number; w: number; h: number }): FreeRect[] => {
      const pW = p.w + bladeThickness;
      const pH = p.h + bladeThickness;

      // Verifica se non c'è intersezione
      if (p.x >= f.x + f.w || p.x + pW <= f.x || p.y >= f.y + f.h || p.y + pH <= f.y) {
        return [f];
      }

      const result: FreeRect[] = [];

      // Split Top
      if (p.y > f.y && p.y < f.y + f.h) {
        result.push({ x: f.x, y: f.y, w: f.w, h: p.y - f.y });
      }
      // Split Bottom
      if (p.y + pH < f.y + f.h) {
        result.push({ x: f.x, y: p.y + pH, w: f.w, h: f.y + f.h - (p.y + pH) });
      }
      // Split Left
      if (p.x > f.x && p.x < f.x + f.w) {
        result.push({ x: f.x, y: f.y, w: p.x - f.x, h: f.h });
      }
      // Split Right
      if (p.x + pW < f.x + f.w) {
        result.push({ x: p.x + pW, y: f.y, w: f.x + f.w - (p.x + pW), h: f.h });
      }

      return result;
    };

    // Algoritmo MaxRects con euristica Top-Left a cascata (compattazione ad angolo)
    sorted.forEach((req) => {
      const reqW = Math.min(req.width, commercialSheetW);
      const reqH = Math.min(req.height, commercialSheetH);

      let bestBoardIdx = -1;
      let bestX = 0;
      let bestY = 0;
      let bestW = 0;
      let bestH = 0;
      let bestRotated = false;
      let bestFrX = 0;
      let bestFrW = 0;

      // Cerca la migliore collocazione solo negli ultimi 5 fogli per evitare rallentamenti O(N^2)
      const startBoard = Math.max(0, boards.length - 5);
      for (let s = startBoard; s < boards.length; s++) {
        const rects = freeRectsByBoard[s];
        for (let r = 0; r < rects.length; r++) {
          const fr = rects[r];

          // Prova orientamento normale
          if (reqW <= fr.w && reqH <= fr.h) {
            const candX = fr.x;
            const candY = fr.y;
            const candW = reqW;
            const candH = reqH;

            let isBetter = false;
            if (bestBoardIdx === -1) {
              isBetter = true;
            } else if (s !== bestBoardIdx) {
              isBetter = s < bestBoardIdx;
            } else if (candY !== bestY) {
              isBetter = candY < bestY;
            } else if (candX !== bestX) {
              isBetter = candX < bestX;
            } else if (candH !== bestH) {
              isBetter = candH < bestH;
            } else {
              isBetter = candW < bestW;
            }

            if (isBetter) {
              bestBoardIdx = s;
              bestX = candX;
              bestY = candY;
              bestW = candW;
              bestH = candH;
              bestRotated = false;
              bestFrX = fr.x;
              bestFrW = fr.w;
            }
          }

          // Prova orientamento ruotato
          if (reqH <= fr.w && reqW <= fr.h) {
            const candX = fr.x;
            const candY = fr.y;
            const candW = reqH;
            const candH = reqW;

            let isBetter = false;
            if (bestBoardIdx === -1) {
              isBetter = true;
            } else if (s !== bestBoardIdx) {
              isBetter = s < bestBoardIdx;
            } else if (candY !== bestY) {
              isBetter = candY < bestY;
            } else if (candX !== bestX) {
              isBetter = candX < bestX;
            } else if (candH !== bestH) {
              isBetter = candH < bestH;
            } else {
              isBetter = candW < bestW;
            }

            if (isBetter) {
              bestBoardIdx = s;
              bestX = candX;
              bestY = candY;
              bestW = candW;
              bestH = candH;
              bestRotated = true;
              bestFrX = fr.x;
              bestFrW = fr.w;
            }
          }
        }
      }

      // Se nessun foglio può ospitare il pezzo, ne creiamo uno nuovo
      if (bestBoardIdx === -1) {
        bestBoardIdx = createBoard();
        const fr = freeRectsByBoard[bestBoardIdx][0];
        
        // Verifica se il pezzo ci sta nel nuovo foglio vuoto
        if (reqW <= fr.w && reqH <= fr.h) {
          bestX = fr.x;
          bestY = fr.y;
          bestW = reqW;
          bestH = reqH;
          bestRotated = false;
          bestFrX = fr.x;
          bestFrW = fr.w;
        } else if (reqH <= fr.w && reqW <= fr.h) {
          bestX = fr.x;
          bestY = fr.y;
          bestW = reqH;
          bestH = reqW;
          bestRotated = true;
          bestFrX = fr.x;
          bestFrW = fr.w;
        } else {
          // Il pezzo è più grande del foglio intero, lo ignoriamo per evitare crash
          return;
        }
      }

      // Solo dopo aver scelto la collocazione ottimale, applichiamo la regola di allineamento dal lato opposto
      let finalX = bestX;
      if (finalX + bestW > commercialSheetW / 2) {
        finalX = bestFrX + bestFrW - bestW;
      }

      // Piazziamo il pezzo nel foglio selezionato
      const s = bestBoardIdx;
      boards[s].placed.push({
        x: finalX,
        y: bestY,
        w: bestW,
        h: bestH,
        label: req.label,
      });
      boards[s].usedArea += bestW * bestH;

      // Aggiorniamo i rettangoli liberi del foglio s
      const placedBox = { x: finalX, y: bestY, w: bestW, h: bestH };
      const newFreeRects: FreeRect[] = [];
      
      freeRectsByBoard[s].forEach((fr) => {
        const splits = splitFreeRect(fr, placedBox);
        newFreeRects.push(...splits);
      });

      freeRectsByBoard[s] = newFreeRects;

      // Rimuoviamo i rettangoli ridondanti
      pruneFreeRectangles(s);

      // Circuito di sicurezza: se il numero di rettangoli liberi supera 300 (frammentazione estrema),
      // lo limitiamo per prevenire l'esplosione esponenziale e il conseguente blocco della pagina.
      if (freeRectsByBoard[s] && freeRectsByBoard[s].length > 300) {
        freeRectsByBoard[s] = freeRectsByBoard[s].slice(0, 150);
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
    <div className="space-y-8">
      {/* Banner di avviso se i dati sono stati limitati per sicurezza */}
      {isCapped && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs leading-relaxed print:text-black print:border-gray-300">
          ⚠️ <strong>Attenzione:</strong> Il calcolo del nesting è stato limitato a un massimo di 300 pezzi per garantire la stabilità e la velocità del report. Alcuni pezzi di dimensioni fuori scala o quantità eccessive inseriti nelle note sono stati ignorati o ridimensionati.
        </div>
      )}

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
