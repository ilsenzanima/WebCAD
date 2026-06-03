"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useOfflineStore, generateTempId } from "@/lib/stores/offline-store";
import type { FieldNote, FieldNoteItem, FieldNoteType } from "@/app/actions/field-notes";
import type { Material } from "@/lib/types/database";

interface Props {
  projectId: string;
  noteTypes: FieldNoteType[];
  initialNote: FieldNote;
  catalogMaterials: Material[];
}

interface PieceItem {
  id: string;
  b: number;
  h: number;
  q: number;
  unit: "cm" | "mm";
  refTitle: string;
}

export default function TaglioEditor({
  projectId,
  noteTypes,
  initialNote,
  catalogMaterials,
}: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [isDataActual, setIsDataActual] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const cachedNote = useOfflineStore((state) => state.fieldNotes[initialNote.id]);
  const noteToUse = (mounted && cachedNote) ? cachedNote : initialNote;

  // --- Stati dell'Editor ---
  const [title, setTitle] = useState("Taglio Parametrico");
  
  // Parametri di taglio (fogli di lamiera)
  const [sheetW, setSheetW] = useState(1200); // mm
  const [sheetH, setSheetH] = useState(2000); // mm
  const [kerf, setKerf] = useState(3);       // mm
  const [margin, setMargin] = useState(0);   // mm
  
  // Lista dei pezzi da tagliare
  const [pieces, setPieces] = useState<PieceItem[]>([]);
  const [materialFilter, setMaterialFilter] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Stato per l'inserimento manuale rapido
  const [newB, setNewB] = useState("");
  const [newH, setNewH] = useState("");
  const [newQ, setNewQ] = useState("1");
  const [newUnit, setNewUnit] = useState<"cm" | "mm">("cm");
  const [newRef, setNewRef] = useState("Pezzo manuale");

  // --- Inizializzazione ---
  useEffect(() => {
    if (mounted) {
      const hasCachedData = !!cachedNote;
      if (!initialized || (hasCachedData && !isDataActual)) {
        const noteSource = cachedNote || initialNote;
        if (noteSource) {
          // 1. Estrae il titolo dall'elemento 'nota' con sort_order 0
          const titleItem = (noteSource.field_note_items ?? []).find(
            (i) => i.item_type === "nota" && i.sort_order === 0
          );
          if (titleItem?.value_text) {
            setTitle(titleItem.value_text.replace("Taglio: ", ""));
          }

          // 2. Estrae la configurazione speciale (se presente)
          const configItem = (noteSource.field_note_items ?? []).find(
            (i) => i.item_type === "nota" && i.value_text?.startsWith("__CONFIG__:")
          );
          if (configItem?.value_text) {
            try {
              const configJson = JSON.parse(configItem.value_text.replace("__CONFIG__:", ""));
              if (configJson.sheetW) setSheetW(configJson.sheetW);
              if (configJson.sheetH) setSheetH(configJson.sheetH);
              if (configJson.kerf !== undefined) setKerf(configJson.kerf);
              if (configJson.margin !== undefined) setMargin(configJson.margin);
            } catch {
              // fallback
            }
          }

          // 3. Estrae il materiale (se presente)
          const materialItem = (noteSource.field_note_items ?? []).find(
            (i) => i.item_type === "materiale"
          );
          if (materialItem?.value_text) {
            setMaterialFilter(materialItem.value_text);
          }

          // 4. Estrae tutti i pezzi da tagliare 'dim_quadrata'
          const loadedPieces: PieceItem[] = [];
          (noteSource.field_note_items ?? []).forEach((item) => {
            if (item.item_type === "dim_quadrata") {
              try {
                const parsed = item.value_text ? JSON.parse(item.value_text) : item.composite;
                if (parsed) {
                  loadedPieces.push({
                    id: item.id || crypto.randomUUID(),
                    b: parseFloat(parsed.b) || 0,
                    h: parseFloat(parsed.h) || 0,
                    q: parseInt(parsed.q) || 1,
                    unit: parsed.unit || "cm",
                    refTitle: parsed.refTitle || "Rilievo",
                  });
                }
              } catch {
                // ignora
              }
            }
          });
          setPieces(loadedPieces);
          setInitialized(true);
          setIsDataActual(hasCachedData);
        }
      }
    }
  }, [mounted, cachedNote, initialNote, initialized, isDataActual]);

  // --- Handlers dei Pezzi ---
  const updatePiece = (id: string, key: keyof PieceItem, value: any) => {
    setPieces((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [key]: value } : p))
    );
  };

  const deletePiece = (id: string) => {
    setPieces((prev) => prev.filter((p) => p.id !== id));
  };

  const addManualPiece = () => {
    const bVal = parseFloat(newB);
    const hVal = parseFloat(newH);
    const qVal = parseInt(newQ) || 1;
    if (isNaN(bVal) || isNaN(hVal) || bVal <= 0 || hVal <= 0) {
      alert("Inserisci quote di Base e Altezza valide e maggiori di zero.");
      return;
    }

    const newPiece: PieceItem = {
      id: crypto.randomUUID(),
      b: bVal,
      h: hVal,
      q: qVal,
      unit: newUnit,
      refTitle: newRef.trim() || "Manuale",
    };

    setPieces((prev) => [...prev, newPiece]);
    setNewB("");
    setNewH("");
    setNewQ("1");
    setNewRef("Pezzo manuale");
  };

  // --- Algoritmo Nesting 2D (Ghigliottina First Fit Decreasing) ---
  interface PlacedPiece {
    x: number;
    y: number;
    w: number;
    h: number;
    label: string;
    rotated: boolean;
  }

  interface PackedSheet {
    placed: PlacedPiece[];
    usedArea: number;
    scrapArea: number;
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

  const nestingResult = useMemo(() => {
    // 1. Converte tutti i pezzi in millimetri
    const sheetRequests: { width: number; height: number; label: string }[] = [];
    pieces.forEach((p) => {
      const factor = p.unit === "cm" ? 10 : 1;
      const wMm = Math.round(p.b * factor);
      const hMm = Math.round(p.h * factor);
      if (wMm > 0 && hMm > 0) {
        for (let i = 0; i < p.q; i++) {
          sheetRequests.push({
            width: wMm,
            height: hMm,
            label: `${p.refTitle} (${p.b}x${p.h} ${p.unit})`,
          });
        }
      }
    });

    const activeSheetW = sheetW - margin * 2;
    const activeSheetH = sheetH - margin * 2;
    const totalBoardArea = sheetW * sheetH;

    if (sheetRequests.length === 0 || activeSheetW <= 0 || activeSheetH <= 0) {
      return { sheets: [], totalPieces: 0, efficiency: 0 };
    }

    // Ordina i pezzi per area decrescente per massimizzare il rendimento del packing
    const sorted = [...sheetRequests].sort((a, b) => (b.width * b.height) - (a.width * a.height));
    const sheets: PackedSheet[] = [];
    const freeRectsByBoard: FreeRect[][] = [];

    const createSheet = (): number => {
      sheets.push({ placed: [], usedArea: 0, scrapArea: 0 });
      freeRectsByBoard.push([{ x: margin, y: margin, w: activeSheetW, h: activeSheetH }]);
      return sheets.length - 1;
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

    // Split di un rettangolo libero F in base a un rettangolo occupato P (tenendo conto del kerf)
    const splitFreeRect = (f: FreeRect, p: { x: number; y: number; w: number; h: number }): FreeRect[] => {
      // Bounding box occupato allargato di 'kerf' a destra e in basso per garantire la spaziatura
      const pW = p.w + kerf;
      const pH = p.h + kerf;

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
      let bestSheetIdx = -1;
      let bestX = 0;
      let bestY = 0;
      let bestW = 0;
      let bestH = 0;
      let bestRotated = false;

      // Cerca la migliore collocazione tra tutti i fogli attuali
      for (let s = 0; s < sheets.length; s++) {
        const rects = freeRectsByBoard[s];
        for (let r = 0; r < rects.length; r++) {
          const fr = rects[r];

          // Prova orientamento normale
          if (req.width <= fr.w && req.height <= fr.h) {
            const candX = fr.x;
            const candY = fr.y;
            const candW = req.width;
            const candH = req.height;

            let isBetter = false;
            if (bestSheetIdx === -1) {
              isBetter = true;
            } else if (s !== bestSheetIdx) {
              isBetter = s < bestSheetIdx;
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
              bestSheetIdx = s;
              bestX = candX;
              bestY = candY;
              bestW = candW;
              bestH = candH;
              bestRotated = false;
            }
          }

          // Prova orientamento ruotato
          if (req.height <= fr.w && req.width <= fr.h) {
            const candX = fr.x;
            const candY = fr.y;
            const candW = req.height;
            const candH = req.width;

            let isBetter = false;
            if (bestSheetIdx === -1) {
              isBetter = true;
            } else if (s !== bestSheetIdx) {
              isBetter = s < bestSheetIdx;
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
              bestSheetIdx = s;
              bestX = candX;
              bestY = candY;
              bestW = candW;
              bestH = candH;
              bestRotated = true;
            }
          }
        }
      }

      // Se nessun foglio può ospitare il pezzo, ne creiamo uno nuovo
      if (bestSheetIdx === -1) {
        bestSheetIdx = createSheet();
        const fr = freeRectsByBoard[bestSheetIdx][0];
        
        // Verifica se il pezzo ci sta nel nuovo foglio vuoto
        if (req.width <= fr.w && req.height <= fr.h) {
          bestX = fr.x;
          bestY = fr.y;
          bestW = req.width;
          bestH = req.height;
          bestRotated = false;
        } else if (req.height <= fr.w && req.width <= fr.h) {
          bestX = fr.x;
          bestY = fr.y;
          bestW = req.height;
          bestH = req.width;
          bestRotated = true;
        } else {
          // Il pezzo è più grande del foglio intero, lo ignoriamo per evitare crash
          return;
        }
      }

      // Piazziamo il pezzo nel foglio selezionato
      const s = bestSheetIdx;
      sheets[s].placed.push({
        x: bestX,
        y: bestY,
        w: bestW,
        h: bestH,
        label: req.label,
        rotated: bestRotated,
      });
      sheets[s].usedArea += bestW * bestH;

      // Aggiorniamo i rettangoli liberi del foglio s
      const placedBox = { x: bestX, y: bestY, w: bestW, h: bestH };
      const newFreeRects: FreeRect[] = [];
      
      freeRectsByBoard[s].forEach((fr) => {
        const splits = splitFreeRect(fr, placedBox);
        newFreeRects.push(...splits);
      });

      freeRectsByBoard[s] = newFreeRects;

      // Rimuoviamo i rettangoli ridondanti
      pruneFreeRectangles(s);
    });

    // Calcola il rendimento totale
    let totalUsedArea = 0;
    sheets.forEach((s) => {
      totalUsedArea += s.usedArea;
    });

    const efficiency = sheets.length > 0 ? (totalUsedArea / (sheets.length * totalBoardArea)) * 100 : 0;

    return { sheets, totalPieces: sheetRequests.length, efficiency };
  }, [pieces, sheetW, sheetH, kerf, margin]);

  // --- Salva & Sincronizza ---
  const handleSave = () => {
    setSaveStatus("saving");
    // 1. Trova il tipo di appunto "Taglio" o crea un fallback
    const taglioType = noteTypes.find((t) => t.name === "Taglio") || { id: "temp_taglio", name: "Taglio" };

    // 2. Costruisce gli item del database
    const payloadItems: Omit<FieldNoteItem, "id">[] = [];
    
    // - Titolo della nota (sort_order 0)
    payloadItems.push({
      item_type: "nota",
      value_text: `Taglio: ${title.trim() || "Taglio Parametrico"}`,
      sort_order: 0,
    });

    // - Configurazione foglio / nesting (sort_order 1)
    payloadItems.push({
      item_type: "nota",
      value_text: `__CONFIG__:${JSON.stringify({ sheetW, sheetH, kerf, margin })}`,
      sort_order: 1,
    });

    // - Materiale se selezionato (sort_order 2)
    if (materialFilter) {
      payloadItems.push({
        item_type: "materiale",
        value_text: materialFilter,
        sort_order: 2,
      });
    }

    // - Tutti i pezzi 'dim_quadrata' (sort_order 3+)
    let order = 3;
    pieces.forEach((p) => {
      payloadItems.push({
        item_type: "dim_quadrata",
        value_text: JSON.stringify({
          b: p.b,
          h: p.h,
          q: p.q,
          unit: p.unit,
          isCutPiece: true,
          refTitle: p.refTitle,
        }),
        sort_order: order++,
      });
    });

    // 3. Salva optimisticamente nello store offline
    useOfflineStore.getState().saveFieldNoteItemsOptimistic(
      initialNote.id,
      projectId,
      noteToUse.level_id || initialNote.level_id || generateTempId(), // level_id
      payloadItems,
      "Taglio"
    );

    setSaveStatus("saved");
    setTimeout(() => {
      setSaveStatus("idle");
    }, 3000);
  };

  const handleDeletePlan = () => {
    if (confirm("Sei sicuro di voler eliminare definitivamente questo piano di taglio?")) {
      useOfflineStore.getState().deleteFieldNoteOptimistic(initialNote.id, projectId);
      router.push(`/projects/${projectId}`);
    }
  };

  const handleSaveAndExportPDF = async () => {
    setIsGeneratingPDF(true);
    try {
      // 1. Salva prima il piano di taglio per allineare lo store
      handleSave();

      // 2. Importa dinamicamente le librerie client-side
      const { jsPDF } = await import("jspdf");
      const html2canvas = (await import("html2canvas")).default;

      // 3. Raggruppa i pezzi per lo stesso riferimento geografico (refTitle)
      const grouped: Record<string, PieceItem[]> = {};
      pieces.forEach((p) => {
        const ref = p.refTitle.trim() || "Manuale";
        if (!grouped[ref]) grouped[ref] = [];
        grouped[ref].push(p);
      });

      // 4. Creazione documento jsPDF
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // 5. Creazione di Pagina 1: Dettagli + Distinta pezzi
      const page1Div = document.createElement("div");
      page1Div.id = "temp-pdf-page1-container";
      page1Div.style.position = "absolute";
      page1Div.style.left = "-9999px";
      page1Div.style.top = "-9999px";
      page1Div.style.width = "750px"; // Larghezza fissa adatta per A4
      page1Div.style.background = "#ffffff";
      page1Div.style.color = "#000000";
      page1Div.style.padding = "35px";
      page1Div.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

      let page1Html = `
        <div style="border-bottom: 3px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 20px;">
          <h1 style="margin: 0; color: #1e3a8a; font-size: 24px; font-weight: 800; text-transform: uppercase;">Report Schema di Taglio (Nesting)</h1>
          <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 11px; color: #4b5563;">
            <span><strong>Cantiere:</strong> ID ${projectId}</span>
            <span><strong>Data:</strong> ${new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        </div>

        <div style="margin-bottom: 20px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px;">
          <h2 style="margin: 0 0 10px 0; font-size: 14px; color: #0f172a; font-weight: 700;">📋 Dettagli Configurazione Lastre</h2>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px; color: #334155;">
            <div><strong>Nome Configurazione:</strong> ${title.trim() || "Taglio Parametrico"}</div>
            <div><strong>Materiale Lastra:</strong> ${materialFilter || "Nessuno (Generico)"}</div>
            <div><strong>Dimensioni Foglio:</strong> ${sheetW} x ${sheetH} mm</div>
            <div><strong>Resa Complessiva:</strong> ${nestingResult.efficiency.toFixed(1)}%</div>
            <div><strong>Fogli Richiesti:</strong> ${nestingResult.sheets.length} pannelli</div>
            <div><strong>Spessore Lama (Kerf):</strong> ${kerf} mm (Margini: ${margin} mm)</div>
          </div>
        </div>

        <div style="margin-bottom: 25px;">
          <h2 style="margin: 0 0 10px 0; font-size: 14px; color: #0f172a; font-weight: 700; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px;">✂️ Distinta dei Pezzi da Tagliare (Raggruppati per Riferimento)</h2>
      `;

      for (const refName in grouped) {
        page1Html += `
          <div style="margin-bottom: 18px; page-break-inside: avoid;">
            <h3 style="margin: 6px 0; font-size: 12px; color: #1e40af; font-weight: 700; display: flex; items-center: center; gap: 4px;">📍 Riferimento: ${refName}</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left;">
              <thead>
                <tr style="background-color: #f1f5f9; border-bottom: 1.5px solid #cbd5e1; font-weight: bold; color: #475569;">
                  <th style="padding: 6px 8px; border: 1px solid #e2e8f0;">Dimensioni Pezzo (Base x Altezza)</th>
                  <th style="padding: 6px 8px; border: 1px solid #e2e8f0;">Quantità (Q)</th>
                  <th style="padding: 6px 8px; border: 1px solid #e2e8f0;">Unità</th>
                </tr>
              </thead>
              <tbody>
        `;

        grouped[refName].forEach((p) => {
          page1Html += `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-family: monospace; font-weight: bold;">${p.b} x ${p.h}</td>
              <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-family: monospace; font-weight: 700;">${p.q}</td>
              <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">${p.unit}</td>
            </tr>
          `;
        });

        page1Html += `
              </tbody>
            </table>
          </div>
        `;
      }

      page1Html += `</div>`;
      page1Div.innerHTML = page1Html;
      document.body.appendChild(page1Div);

      const canvas1 = await html2canvas(page1Div, {
        scale: 1.3,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const imgData1 = canvas1.toDataURL("image/jpeg", 0.65);
      document.body.removeChild(page1Div);

      const heightInPdf1 = (canvas1.height * (pdfWidth - 20)) / canvas1.width;
      pdf.addImage(imgData1, "JPEG", 10, 10, pdfWidth - 20, heightInPdf1);

      // 6. Generazione e inserimento degli SVG di nesting a coppie (2 lastre per pagina, affiancate)
      const sheets = nestingResult.sheets;
      for (let i = 0; i < sheets.length; i += 2) {
        const pair = sheets.slice(i, i + 2);

        const sheetsDiv = document.createElement("div");
        sheetsDiv.id = `temp-pdf-sheets-container-${i}`;
        sheetsDiv.style.position = "absolute";
        sheetsDiv.style.left = "-9999px";
        sheetsDiv.style.top = "-9999px";
        sheetsDiv.style.width = "750px";
        sheetsDiv.style.background = "#ffffff";
        sheetsDiv.style.color = "#000000";
        sheetsDiv.style.padding = "35px";
        sheetsDiv.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

        let sheetsHtml = `
          <div style="border-bottom: 3px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 20px;">
            <h1 style="margin: 0; color: #1e3a8a; font-size: 20px; font-weight: 800; text-transform: uppercase;">Schemi di Taglio (Nesting)</h1>
            <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 11px; color: #4b5563;">
              <span><strong>Configurazione:</strong> ${title.trim() || "Taglio Parametrico"}</span>
              <span><strong>Lastre:</strong> ${i + 1} - ${Math.min(i + 2, sheets.length)} di ${sheets.length}</span>
            </div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 25px; align-items: start;">
        `;

        pair.forEach((sheet, indexInPair) => {
          const sheetIdx = i + indexInPair;
          const totalArea = sheetW * sheetH;
          const yieldPct = totalArea > 0 ? (sheet.usedArea / totalArea) * 100 : 0;

          sheetsHtml += `
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; font-weight: bold; font-size: 12px; color: #0f172a;">
                <span>📄 Lastra #${sheetIdx + 1}</span>
                <span style="color: #059669; font-family: monospace;">Resa: ${yieldPct.toFixed(1)}%</span>
              </div>
              <div style="font-size: 10px; color: #64748b; margin-bottom: 4px;">Dimensioni: ${sheetW} x ${sheetH} mm</div>
              <div id="svg-container-${sheetIdx}" style="width: 100%; border: 1px solid #cbd5e1; border-radius: 8px; background: #fafafa; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                <!-- SVG caricato via DOM -->
              </div>
            </div>
          `;
        });

        sheetsHtml += `</div>`;
        sheetsDiv.innerHTML = sheetsHtml;
        document.body.appendChild(sheetsDiv);

        // Ora creiamo e appendiamo gli SVG nel container
        pair.forEach((sheet, indexInPair) => {
          const sheetIdx = i + indexInPair;
          const container = sheetsDiv.querySelector(`#svg-container-${sheetIdx}`);
          if (container) {
            const svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svgElement.setAttribute("width", "100%");
            svgElement.setAttribute("viewBox", `0 0 ${sheetW} ${sheetH}`);
            svgElement.style.display = "block";
            svgElement.style.background = "#fafafa";

            // Sfondo lastra
            const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            bgRect.setAttribute("width", sheetW.toString());
            bgRect.setAttribute("height", sheetH.toString());
            bgRect.setAttribute("fill", "#f3f4f6");
            bgRect.setAttribute("stroke", "#9ca3af");
            bgRect.setAttribute("stroke-width", "5");
            svgElement.appendChild(bgRect);

            // Margini interni
            if (margin > 0) {
              const marginRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
              marginRect.setAttribute("x", margin.toString());
              marginRect.setAttribute("y", margin.toString());
              marginRect.setAttribute("width", (sheetW - margin * 2).toString());
              marginRect.setAttribute("height", (sheetH - margin * 2).toString());
              marginRect.setAttribute("fill", "none");
              marginRect.setAttribute("stroke", "#3b82f6");
              marginRect.setAttribute("stroke-width", "2");
              marginRect.setAttribute("stroke-dasharray", "6,6");
              marginRect.style.opacity = "0.5";
              svgElement.appendChild(marginRect);
            }

            // Posizionamento dei singoli pezzi
            sheet.placed.forEach((piece) => {
              const g = document.createElementNS("http://www.w3.org/2000/svg", "g");

              const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
              rect.setAttribute("x", piece.x.toString());
              rect.setAttribute("y", piece.y.toString());
              rect.setAttribute("width", piece.w.toString());
              rect.setAttribute("height", piece.h.toString());
              rect.setAttribute("fill", "#ecfdf5"); // Sfondo verde
              rect.setAttribute("stroke", "#059669"); // Bordo verde
              rect.setAttribute("stroke-width", "3");
              rect.setAttribute("rx", "4");
              g.appendChild(rect);

              const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
              text.setAttribute("x", (piece.x + piece.w / 2).toString());
              text.setAttribute("y", (piece.y + piece.h / 2).toString());
              text.setAttribute("dominant-baseline", "middle");
              text.setAttribute("text-anchor", "middle");
              text.setAttribute("fill", "#064e3b");
              text.setAttribute("font-family", "monospace");
              text.setAttribute("font-weight", "bold");

              if (piece.w > 120 && piece.h > 80) {
                text.setAttribute("font-size", Math.max(14, Math.min(28, piece.w / 12)).toString());

                const tspanDim = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
                tspanDim.setAttribute("x", (piece.x + piece.w / 2).toString());
                tspanDim.setAttribute("dy", "-0.3em");
                tspanDim.textContent = `${piece.w}x${piece.h}`;
                text.appendChild(tspanDim);

                const tspanLabel = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
                tspanLabel.setAttribute("x", (piece.x + piece.w / 2).toString());
                tspanLabel.setAttribute("dy", "1.1em");
                tspanLabel.setAttribute("font-size", Math.max(9, Math.min(18, piece.w / 16)).toString());
                tspanLabel.setAttribute("fill", "#047857");
                tspanLabel.textContent = piece.label.split(" (")[0];
                text.appendChild(tspanLabel);
              } else {
                text.setAttribute("font-size", "10");
                text.textContent = `${piece.w}x${piece.h}`;
              }

              g.appendChild(text);
              svgElement.appendChild(g);
            });

            container.appendChild(svgElement);
          }
        });

        // Eseguiamo il render
        const canvasSheets = await html2canvas(sheetsDiv, {
          scale: 1.3,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
        });

        const imgDataSheets = canvasSheets.toDataURL("image/jpeg", 0.65);
        document.body.removeChild(sheetsDiv);

        pdf.addPage();
        const heightInPdfSheets = (canvasSheets.height * (pdfWidth - 20)) / canvasSheets.width;
        pdf.addImage(imgDataSheets, "JPEG", 10, 10, pdfWidth - 20, heightInPdfSheets);
      }

      // Estraiamo il file in formato Base64 URI String completo
      const pdfBase64Uri = pdf.output("datauristring");

      // 7. Salvataggio della nota di tipo "PDF" nel cantiere (offline-first)
      const pdfNoteId = generateTempId();
      const levelId = noteToUse.level_id || initialNote.level_id || generateTempId();

      const pdfItems = [
        {
          item_type: "nota" as const,
          value_text: `PDF: ${title.trim() || "Piano di Taglio"}`,
          sort_order: 0,
        },
        {
          item_type: "foto" as const, // Memorizziamo il file PDF Base64 nel campo text
          value_text: pdfBase64Uri,
          sort_order: 1,
        }
      ];

      useOfflineStore.getState().saveFieldNoteItemsOptimistic(
        pdfNoteId,
        projectId,
        levelId,
        pdfItems,
        "PDF"
      );

      alert(`Il PDF "${title.trim() || "Piano di Taglio"}" è stato generato e archiviato nel cantiere con successo! Ora puoi leggerlo online nel tab "PDF".`);
      
      // Reindirizza al cantiere per vedere il PDF caricato
      router.push(`/projects/${projectId}`);
    } catch (err) {
      console.error("Errore durante l'esportazione del PDF:", err);
      alert("Impossibile completare la generazione ed esportazione del PDF.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className="space-y-6">
      {isGeneratingPDF && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[200] flex flex-col items-center justify-center gap-4 text-white">
          <div className="w-12 h-12 rounded-full border-4 border-t-red-500 border-white/10 animate-spin" />
          <div className="text-sm font-bold tracking-wide">Generazione e archiviazione PDF in corso...</div>
          <div className="text-xs text-white/40">Questo processo potrebbe richiedere qualche secondo per l'alta risoluzione</div>
        </div>
      )}
      {/* ── Sezione Configurazione Parametri Lastre ── */}
      <div
        className="rounded-2xl p-4 sm:p-5 grid grid-cols-2 md:grid-cols-5 gap-4 items-end print:hidden"
        style={{ background: "hsl(220 26% 14%)", border: "1px solid hsl(220 20% 20%)" }}
      >
        <div className="col-span-2 md:col-span-1">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1">
            Nome Configurazione
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-xs font-semibold outline-none"
            style={{ background: "hsl(220 32% 10%)", border: "1px solid hsl(220 20% 22%)", color: "white" }}
            placeholder="es. Piano Primo, Lotto A"
          />
          <span className="block mt-1 text-[9px] text-white/30 leading-tight">
            Identifica questo specifico piano di taglio (es: "Cucina", "Spalle").
          </span>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1.5">
            Larghezza Foglio (mm)
          </label>
          <input
            type="number"
            value={sheetW}
            onChange={(e) => setSheetW(Math.max(1, parseInt(e.target.value) || 0))}
            className="w-full px-3 py-2 rounded-xl text-xs font-mono outline-none"
            style={{ background: "hsl(220 32% 10%)", border: "1px solid hsl(220 20% 22%)", color: "white" }}
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1.5">
            Altezza Foglio (mm)
          </label>
          <input
            type="number"
            value={sheetH}
            onChange={(e) => setSheetH(Math.max(1, parseInt(e.target.value) || 0))}
            className="w-full px-3 py-2 rounded-xl text-xs font-mono outline-none"
            style={{ background: "hsl(220 32% 10%)", border: "1px solid hsl(220 20% 22%)", color: "white" }}
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1.5">
            Spessore Lama (mm)
          </label>
          <input
            type="number"
            value={kerf}
            onChange={(e) => setKerf(Math.max(0, parseInt(e.target.value) || 0))}
            className="w-full px-3 py-2 rounded-xl text-xs font-mono outline-none"
            style={{ background: "hsl(220 32% 10%)", border: "1px solid hsl(220 20% 22%)", color: "white" }}
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1.5">
            Margini Lamiera (mm)
          </label>
          <input
            type="number"
            value={margin}
            onChange={(e) => setMargin(Math.max(0, parseInt(e.target.value) || 0))}
            className="w-full px-3 py-2 rounded-xl text-xs font-mono outline-none"
            style={{ background: "hsl(220 32% 10%)", border: "1px solid hsl(220 20% 22%)", color: "white" }}
          />
        </div>
      </div>

      {/* ── Materiale & Riepilogo Efficienza ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Griglia Pezzi da Tagliare */}
        <div
          className="md:col-span-2 rounded-2xl p-4 space-y-4 print:p-0 print:border-none"
          style={{ background: "hsl(220 26% 14%)", border: "1px solid hsl(220 20% 20%)" }}
        >
          <div className="flex items-center justify-between border-b border-white/5 pb-2 print:hidden">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>✂️</span> Griglia Pezzi da Tagliare ({pieces.length})
            </h3>
            
            {/* Selezione Materiale */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase text-white/40">Materiale:</span>
              <select
                value={materialFilter}
                onChange={(e) => setMaterialFilter(e.target.value)}
                className="px-2 py-1 rounded-lg text-xs outline-none bg-[hsl(220,32%,10%)] border border-[hsl(220,20%,22%)] text-white"
              >
                <option value="">Nessuno (Generico)</option>
                {catalogMaterials.map((m) => (
                  <option key={m.id} value={m.name}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tabella interattiva */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs text-white/80">
              <thead>
                <tr className="border-b border-white/5 font-bold uppercase tracking-wider text-white/40">
                  <th className="py-2.5 px-2">Riferimento</th>
                  <th className="py-2.5 px-2">Base</th>
                  <th className="py-2.5 px-2">Altezza</th>
                  <th className="py-2.5 px-2">Unità</th>
                  <th className="py-2.5 px-2">Quantità (Q)</th>
                  <th className="py-2.5 px-2 print:hidden">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {pieces.map((p) => (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-2 px-1">
                      <input
                        type="text"
                        value={p.refTitle}
                        onChange={(e) => updatePiece(p.id, "refTitle", e.target.value)}
                        className="px-2 py-1.5 rounded bg-[hsl(220,32%,8%)] border border-[hsl(220,20%,18%)] text-white w-full max-w-[150px] font-medium"
                      />
                    </td>
                    <td className="py-2 px-1">
                      <input
                        type="number"
                        value={p.b}
                        onChange={(e) => updatePiece(p.id, "b", parseFloat(e.target.value) || 0)}
                        className="px-2 py-1.5 rounded bg-[hsl(220,32%,8%)] border border-[hsl(220,20%,18%)] text-white w-20 font-mono"
                      />
                    </td>
                    <td className="py-2 px-1">
                      <input
                        type="number"
                        value={p.h}
                        onChange={(e) => updatePiece(p.id, "h", parseFloat(e.target.value) || 0)}
                        className="px-2 py-1.5 rounded bg-[hsl(220,32%,8%)] border border-[hsl(220,20%,18%)] text-white w-20 font-mono"
                      />
                    </td>
                    <td className="py-2 px-1">
                      <select
                        value={p.unit}
                        onChange={(e) => updatePiece(p.id, "unit", e.target.value as any)}
                        className="px-2 py-1.5 rounded bg-[hsl(220,32%,8%)] border border-[hsl(220,20%,18%)] text-white cursor-pointer"
                      >
                        <option value="cm">cm</option>
                        <option value="mm">mm</option>
                      </select>
                    </td>
                    <td className="py-2 px-1">
                      <input
                        type="number"
                        value={p.q}
                        onChange={(e) => updatePiece(p.id, "q", Math.max(1, parseInt(e.target.value) || 1))}
                        className="px-2 py-1.5 rounded bg-[hsl(220,32%,8%)] border border-[hsl(220,20%,18%)] text-white w-16 font-mono"
                      />
                    </td>
                    <td className="py-2 px-1 print:hidden">
                      <button
                        type="button"
                        onClick={() => deletePiece(p.id)}
                        className="p-1 px-2.5 rounded-lg text-red-400 hover:bg-red-500/10 border border-red-500/10 font-bold transition-colors"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}

                {/* Riga Inserimento Manuale extra */}
                <tr className="bg-white/[0.01] print:hidden">
                  <td className="py-3 px-1">
                    <input
                      type="text"
                      placeholder="es. Muro Spalla dx"
                      value={newRef}
                      onChange={(e) => setNewRef(e.target.value)}
                      className="px-2 py-1.5 rounded bg-[hsl(220,32%,8%)] border border-[hsl(220,20%,18%)] text-white w-full max-w-[150px] placeholder-white/30"
                    />
                  </td>
                  <td className="py-3 px-1">
                    <input
                      type="number"
                      placeholder="Larghezza"
                      value={newB}
                      onChange={(e) => setNewB(e.target.value)}
                      className="px-2 py-1.5 rounded bg-[hsl(220,32%,8%)] border border-[hsl(220,20%,18%)] text-white w-20 placeholder-white/30 font-mono"
                    />
                  </td>
                  <td className="py-3 px-1">
                    <input
                      type="number"
                      placeholder="Altezza"
                      value={newH}
                      onChange={(e) => setNewH(e.target.value)}
                      className="px-2 py-1.5 rounded bg-[hsl(220,32%,8%)] border border-[hsl(220,20%,18%)] text-white w-20 placeholder-white/30 font-mono"
                    />
                  </td>
                  <td className="py-3 px-1">
                    <select
                      value={newUnit}
                      onChange={(e) => setNewUnit(e.target.value as any)}
                      className="px-2 py-1.5 rounded bg-[hsl(220,32%,8%)] border border-[hsl(220,20%,18%)] text-white cursor-pointer"
                    >
                      <option value="cm">cm</option>
                      <option value="mm">mm</option>
                    </select>
                  </td>
                  <td className="py-3 px-1">
                    <input
                      type="number"
                      value={newQ}
                      onChange={(e) => setNewQ(e.target.value)}
                      className="px-2 py-1.5 rounded bg-[hsl(220,32%,8%)] border border-[hsl(220,20%,18%)] text-white w-16 font-mono"
                    />
                  </td>
                  <td className="py-3 px-1">
                    <button
                      type="button"
                      onClick={addManualPiece}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-all bg-[hsl(220,90%,56%)] hover:bg-[hsl(220,85%,48%)] active:scale-95 cursor-pointer"
                    >
                      ＋ Aggiungi
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Dashboard Resa di Nesting */}
        <div className="space-y-4">
          <div
            className="rounded-2xl p-4 sm:p-5 space-y-4 text-white print:hidden"
            style={{ background: "hsl(220 26% 14%)", border: "1px solid hsl(220 20% 20%)" }}
          >
            <h3 className="text-sm font-bold border-b border-white/5 pb-2 flex items-center gap-1.5">
              <span>📊</span> Statistiche Nesting 2D
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[hsl(220,32%,10%)] p-3 rounded-xl border border-white/5">
                <span className="block text-[10px] font-bold uppercase text-white/40">Fogli Richiesti</span>
                <span className="text-xl font-bold font-mono">{nestingResult.sheets.length}</span>
              </div>

              <div className="bg-[hsl(220,32%,10%)] p-3 rounded-xl border border-white/5">
                <span className="block text-[10px] font-bold uppercase text-white/40">Pezzi Totali</span>
                <span className="text-xl font-bold font-mono">{nestingResult.totalPieces}</span>
              </div>
            </div>

            <div className="bg-[hsl(220,32%,10%)] p-4 rounded-xl border border-white/5 space-y-1.5">
              <span className="block text-[10px] font-bold uppercase text-white/40">Rendimento Lamiera</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black font-mono text-emerald-400">
                  {nestingResult.efficiency.toFixed(1)}%
                </span>
                <span className="text-xs text-white/50">utilizzato</span>
              </div>
              
              {/* Barra progresso */}
              <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${nestingResult.efficiency}%` }}
                />
              </div>
            </div>
          </div>

          {/* Pulsanti di Salvataggio e Stampa */}
          <div className="flex flex-col gap-3 print:hidden">
            <button
              type="button"
              onClick={handleSave}
              disabled={saveStatus === "saving"}
              className={`w-full py-3 rounded-xl font-semibold text-white shadow-lg transition-all active:scale-98 cursor-pointer text-sm ${
                saveStatus === "saved"
                  ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20"
                  : "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400"
              }`}
            >
              {saveStatus === "saving" && "💾 Salvataggio in corso..."}
              {saveStatus === "saved" && "✅ Piano Salvato con Successo!"}
              {saveStatus === "idle" && "💾 Salva Piano di Taglio"}
            </button>

            <button
              type="button"
              onClick={() => router.push(`/projects/${projectId}`)}
              className="w-full py-2.5 rounded-xl text-xs font-semibold text-white/50 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
            >
              ← Torna al Dettaglio Progetto
            </button>

            <button
              type="button"
              onClick={handleSaveAndExportPDF}
              disabled={isGeneratingPDF || nestingResult.sheets.length === 0}
              className="w-full py-3 rounded-xl font-semibold text-white shadow-lg transition-all bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 active:scale-98 cursor-pointer text-sm disabled:opacity-50"
            >
              {isGeneratingPDF ? "⏳ Generazione PDF..." : "📄 Salva & Esporta PDF"}
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              disabled={nestingResult.sheets.length === 0}
              className="w-full py-2.5 rounded-xl font-semibold text-white/70 transition-all bg-white/5 hover:bg-white/10 border border-white/5 cursor-pointer disabled:opacity-50 text-xs"
            >
              🖨️ Stampa Alternativa (Browser)
            </button>

            <button
              type="button"
              onClick={handleDeletePlan}
              className="w-full py-2.5 rounded-xl text-xs font-bold text-red-400 hover:text-red-300 bg-red-950/10 hover:bg-red-950/20 border border-red-900/20 active:scale-95 transition-all"
            >
              🗑️ Elimina Configurazione
            </button>
          </div>
        </div>
      </div>

      {/* ── Layout Grafico dei Fogli di Nesting ── */}
      <div className="space-y-6">
        <h3 className="text-base font-bold text-white border-b border-white/5 pb-2 print:border-black/10 print:text-black print:text-lg">
          🔍 Schemi di Taglio (Fogli {nestingResult.sheets.length})
        </h3>

        {nestingResult.sheets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 print:grid-cols-1 print:gap-12">
            {nestingResult.sheets.map((sheet, idx) => {
              const totalArea = sheetW * sheetH;
              const wasteArea = totalArea - sheet.usedArea;
              const yieldPct = totalArea > 0 ? (sheet.usedArea / totalArea) * 100 : 0;
              
              return (
                <div
                  key={idx}
                  className="rounded-2xl p-4 sm:p-5 space-y-4 print:p-0 print:border-none"
                  style={{
                    background: "hsl(220 26% 14%)",
                    border: "1px solid hsl(220 20% 20%)",
                  }}
                >
                  {/* Info Foglio */}
                  <div className="flex items-center justify-between border-b border-white/5 pb-2 print:border-black/10 print:text-black">
                    <span className="text-sm font-bold text-white print:text-black">
                      📄 Lastra #{idx + 1} ({sheetW}x{sheetH} mm)
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-400 print:text-black">
                      Resa: {yieldPct.toFixed(1)}%
                    </span>
                  </div>

                  {/* Rendering SVG del Foglio in scala */}
                  <div className="flex justify-center bg-[hsl(222,47%,6%)] rounded-xl p-3 border border-white/5 print:bg-white print:border-black/10">
                    <svg
                      width="100%"
                      viewBox={`0 0 ${sheetW} ${sheetH}`}
                      className="max-h-[60vh] max-w-full drop-shadow-xl"
                    >
                      {/* Sfondo foglio intero */}
                      <rect
                        width={sheetW}
                        height={sheetH}
                        rx={8}
                        fill="hsl(220 32% 10%)"
                        stroke="hsl(220 20% 25%)"
                        strokeWidth={6}
                        className="print:fill-gray-100 print:stroke-black"
                      />

                      {/* Rettangolo area utile (margine interno) */}
                      {margin > 0 && (
                        <rect
                          x={margin}
                          y={margin}
                          width={sheetW - margin * 2}
                          height={sheetH - margin * 2}
                          fill="none"
                          stroke="hsl(220 90% 56% / 0.15)"
                          strokeWidth={2}
                          strokeDasharray="8,8"
                        />
                      )}

                      {/* Disegno dei pezzi posizionati */}
                      {sheet.placed.map((piece, pIdx) => (
                        <g key={pIdx}>
                          <rect
                            x={piece.x}
                            y={piece.y}
                            width={piece.w}
                            height={piece.h}
                            rx={4}
                            fill="hsl(142 60% 15% / 0.75)"
                            stroke="hsl(142 60% 55%)"
                            strokeWidth={3}
                            className="print:fill-emerald-50 print:stroke-emerald-800"
                          />
                          
                          {/* Testo in scala */}
                          {piece.w > 120 && piece.h > 80 ? (
                            <text
                              x={piece.x + piece.w / 2}
                              y={piece.y + piece.h / 2}
                              dominantBaseline="middle"
                              textAnchor="middle"
                              fill="#ffffff"
                              fontSize={Math.max(14, Math.min(32, piece.w / 12))}
                              fontFamily="monospace"
                              fontWeight="bold"
                              className="print:fill-emerald-900"
                            >
                              <tspan x={piece.x + piece.w / 2} dy="-0.3em">
                                {piece.w}x{piece.h}
                              </tspan>
                              <tspan x={piece.x + piece.w / 2} dy="1em" fontSize={Math.max(10, Math.min(22, piece.w / 16))} fill="rgba(255,255,255,0.7)" className="print:fill-emerald-800">
                                {piece.label.split(" (")[0]}
                              </tspan>
                            </text>
                          ) : (
                            <text
                              x={piece.x + piece.w / 2}
                              y={piece.y + piece.h / 2}
                              dominantBaseline="middle"
                              textAnchor="middle"
                              fill="#ffffff"
                              fontSize={10}
                              fontFamily="monospace"
                              className="print:fill-emerald-900"
                            >
                              {piece.w}x{piece.h}
                            </text>
                          )}
                        </g>
                      ))}
                    </svg>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            className="p-8 rounded-2xl border text-center text-xs italic"
            style={{ background: "hsl(220 32% 10%)", borderColor: "hsl(220 20% 18%)", color: "hsl(215 15% 40%)" }}
          >
            Inserisci quote e pezzi validi per visualizzare gli schemi grafici di taglio.
          </div>
        )}
      </div>

      {/* ── CSS Globale Specializzato per la Stampa PDF ── */}
      <style jsx global>{`
        @media print {
          body {
            background-color: white !important;
            color: black !important;
          }
          /* Nasconde sidebar, intestazioni del sito, barra di navigazione e pulsanti dell'app */
          header, footer, nav, aside, .print\\:hidden {
            display: none !important;
          }
          /* Riduce margini della pagina di stampa browser */
          @page {
            margin: 1.2cm;
          }
          /* Forza sfondi a colori durante la stampa */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
}
