"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useOfflineStore, generateTempId } from "@/lib/stores/offline-store";
import type { FieldNote, FieldNoteItem, FieldNoteType } from "@/app/actions/field-notes";
import type { Material } from "@/lib/types/database";
import { runNesting, PIECE_COLORS } from "@/lib/utils/nesting";

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
  // Navigazione fogli e tab mobile
  const [sheetIndex, setSheetIndex] = useState(0);
  const [mobileTab, setMobileTab] = useState<"pezzi" | "canvas" | "bom">("pezzi");

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

      // Verifica se non c'Ã¨ intersezione
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

      // Se nessun foglio puÃ² ospitare il pezzo, ne creiamo uno nuovo
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
          // Il pezzo Ã¨ piÃ¹ grande del foglio intero, lo ignoriamo per evitare crash
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

  // Usa runNesting per ottenere dati con pieceIndex (per i colori)
  const nestingFull = useMemo(
    () => runNesting(pieces, { sheetW, sheetH, kerf, margin }),
    [pieces, sheetW, sheetH, kerf, margin]
  );

  // Reset sheetIndex se il numero di fogli cambia
  useEffect(() => {
    if (sheetIndex >= nestingFull.sheets.length && nestingFull.sheets.length > 0) {
      setSheetIndex(nestingFull.sheets.length - 1);
    }
  }, [nestingFull.sheets.length, sheetIndex]);

  const effColor = (e: number) =>
    e > 72 ? "hsl(142 71% 45%)" : e > 50 ? "hsl(38 92% 50%)" : "hsl(0 84% 60%)";


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
          <h2 style="margin: 0 0 10px 0; font-size: 14px; color: #0f172a; font-weight: 700;">ðŸ“‹ Dettagli Configurazione Lastre</h2>
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
          <h2 style="margin: 0 0 10px 0; font-size: 14px; color: #0f172a; font-weight: 700; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px;">âœ‚ï¸ Distinta dei Pezzi da Tagliare (Raggruppati per Riferimento)</h2>
      `;

      for (const refName in grouped) {
        page1Html += `
          <div style="margin-bottom: 18px; page-break-inside: avoid;">
            <h3 style="margin: 6px 0; font-size: 12px; color: #1e40af; font-weight: 700; display: flex; items-center: center; gap: 4px;">ðŸ“ Riferimento: ${refName}</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left;">
              <thead>
                <tr style="background-color: #f1f5f9; border-bottom: 1.5px solid #cbd5e1; font-weight: bold; color: #475569;">
                  <th style="padding: 6px 8px; border: 1px solid #e2e8f0;">Dimensioni Pezzo (Base x Altezza)</th>
                  <th style="padding: 6px 8px; border: 1px solid #e2e8f0;">QuantitÃ  (Q)</th>
                  <th style="padding: 6px 8px; border: 1px solid #e2e8f0;">UnitÃ </th>
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
                <span>ðŸ“„ Lastra #${sheetIdx + 1}</span>
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

      alert(`Il PDF "${title.trim() || "Piano di Taglio"}" Ã¨ stato generato e archiviato nel cantiere con successo! Ora puoi leggerlo online nel tab "PDF".`);
      
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
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "hsl(222 47% 6%)", overflow: "hidden" }}>
      {/* PDF overlay */}
      {isGeneratingPDF && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[200] flex flex-col items-center justify-center gap-4 text-white">
          <div className="w-12 h-12 rounded-full border-4 border-t-red-500 border-white/10 animate-spin" />
          <div className="text-sm font-bold tracking-wide">Generazione PDF in corso...</div>
        </div>
      )}

      {/* â”€â”€ Header 56px â”€â”€ */}
      <header style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 16px", height: 56, flexShrink: 0, background: "hsl(220 32% 10%)", borderBottom: "1px solid hsl(220 20% 22%)" }}>
        <button onClick={() => router.back()} style={{ display: "flex", alignItems: "center", gap: 4, color: "hsl(215 20% 65%)", fontSize: 12, background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}>
          <span style={{ opacity: 0.5, fontSize: 14 }}>â€¹</span>
          <span>Tagli</span>
        </button>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "hsl(210 40% 96%)", fontSize: 14, fontWeight: 700, minWidth: 0 }}
          onFocus={(e) => { e.target.style.background = "hsl(220 26% 14%)"; e.target.style.padding = "2px 8px"; e.target.style.borderRadius = "6px"; }}
          onBlur={(e) => { e.target.style.background = "transparent"; e.target.style.padding = "0"; }}
        />
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button onClick={handleSave} style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.2s", border: `1px solid ${saveStatus === "saved" ? "hsl(142 71% 45%)" : "hsl(220 20% 22%)"}`, background: saveStatus === "saved" ? "hsla(142,71%,45%,0.15)" : "hsl(220 22% 18%)", color: saveStatus === "saved" ? "hsl(142 71% 45%)" : "hsl(210 40% 96%)" }}>
            {saveStatus === "saving" ? "Salvataggioâ€¦" : saveStatus === "saved" ? "âœ“ Salvato" : "Salva"}
          </button>
          <button onClick={handleSaveAndExportPDF} disabled={isGeneratingPDF} style={{ padding: "6px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700, border: "none", background: "hsl(220 90% 56%)", color: "#fff", cursor: "pointer", opacity: isGeneratingPDF ? 0.6 : 1 }}>Esporta PDF</button>
          <button onClick={handleDeletePlan} style={{ padding: "6px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700, border: "1px solid hsl(0 84% 60% / 0.3)", background: "transparent", color: "hsl(0 84% 60%)", cursor: "pointer" }}>ðŸ—‘</button>
        </div>
      </header>

      {/* â”€â”€ Layout principale â”€â”€ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* DESKTOP: 3 colonne */}
        <div className="hidden md:flex" style={{ flex: 1, overflow: "hidden" }}>

          {/* Left panel 300px */}
          <div style={{ width: 300, flexShrink: 0, display: "flex", flexDirection: "column", background: "hsl(220 32% 10%)", borderRight: "1px solid hsl(220 20% 22%)", overflow: "hidden" }}>
            {/* Parametri foglio */}
            <div style={{ padding: "12px 16px", borderBottom: "1px solid hsl(220 20% 22%)", flexShrink: 0 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "hsl(220 15% 35%)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Parametri Foglio</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {([{ k: "sheetW", label: "Larghezza", unit: "mm", val: sheetW, set: setSheetW }, { k: "sheetH", label: "Altezza", unit: "mm", val: sheetH, set: setSheetH }, { k: "kerf", label: "Lama", unit: "mm", val: kerf, set: setKerf }, { k: "margin", label: "Margine", unit: "mm", val: margin, set: setMargin }] as const).map((p) => (
                  <div key={p.k}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: "hsl(220 15% 35%)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 2 }}>{p.label} <span style={{ color: "hsl(220 15% 35%)", fontWeight: 400 }}>{p.unit}</span></label>
                    <input type="number" value={p.val} onChange={(e) => p.set(parseFloat(e.target.value) || 0)}
                      style={{ background: "hsl(220 26% 14%)", border: "1px solid hsl(220 20% 22%)", borderRadius: 8, color: "hsl(210 40% 96%)", padding: "6px 10px", fontSize: 13, outline: "none", width: "100%" }}
                      onFocus={(e) => { e.target.style.borderColor = "hsl(220 90% 56%)"; }}
                      onBlur={(e) => { e.target.style.borderColor = "hsl(220 20% 22%)"; }}
                    />
                  </div>
                ))}
              </div>
            </div>
            {/* Header pezzi */}
            <div style={{ padding: "8px 16px 4px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "hsl(220 15% 35%)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Pezzi da Tagliare</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: "hsl(220 90% 56%)", background: "hsla(220,90%,56%,0.12)", padding: "1px 8px", borderRadius: 20 }}>{pieces.reduce((a, p) => a + p.q, 0)}</span>
            </div>
            {/* Lista pezzi */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {pieces.length === 0 ? (
                <div style={{ padding: "24px 16px", textAlign: "center", color: "hsl(220 15% 35%)", fontSize: 13 }}>Nessun pezzo.<br />Aggiungine uno.</div>
              ) : pieces.map((p, i) => (
                <PieceRow key={p.id} piece={p} color={PIECE_COLORS[i % PIECE_COLORS.length]} onUpdate={updatePiece} onDelete={deletePiece} />
              ))}
            </div>
            {/* Add form */}
            <div style={{ padding: "12px 16px", borderTop: "1px solid hsl(220 20% 22%)", flexShrink: 0 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "hsl(220 15% 35%)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Aggiungi Pezzo</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 42px", gap: 6, marginBottom: 6 }}>
                {[{ ph: "B", val: newB, set: setNewB }, { ph: "H", val: newH, set: setNewH }].map((f) => (
                  <input key={f.ph} placeholder={f.ph} type="number" value={f.val} onChange={(e) => f.set(e.target.value)}
                    style={{ background: "hsl(220 26% 14%)", border: "1px solid hsl(220 20% 22%)", borderRadius: 8, color: "hsl(210 40% 96%)", padding: "7px 8px", fontSize: 13, outline: "none", width: "100%" }}
                    onFocus={(e) => { e.target.style.borderColor = "hsl(220 90% 56%)"; }} onBlur={(e) => { e.target.style.borderColor = "hsl(220 20% 22%)"; }}
                  />
                ))}
                <button onClick={() => setNewUnit(u => u === "cm" ? "mm" : "cm")} style={{ background: "hsl(220 22% 18%)", border: "1px solid hsl(220 20% 22%)", borderRadius: 8, color: "hsl(210 40% 96%)", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>{newUnit}</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "50px 1fr", gap: 6, marginBottom: 8 }}>
                <input placeholder="Q" type="number" min="1" value={newQ} onChange={(e) => setNewQ(e.target.value)}
                  style={{ background: "hsl(220 26% 14%)", border: "1px solid hsl(220 20% 22%)", borderRadius: 8, color: "hsl(210 40% 96%)", padding: "7px 8px", fontSize: 13, outline: "none", width: "100%" }}
                  onFocus={(e) => { e.target.style.borderColor = "hsl(220 90% 56%)"; }} onBlur={(e) => { e.target.style.borderColor = "hsl(220 20% 22%)"; }}
                />
                <input placeholder="Riferimento" value={newRef} onChange={(e) => setNewRef(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addManualPiece()}
                  style={{ background: "hsl(220 26% 14%)", border: "1px solid hsl(220 20% 22%)", borderRadius: 8, color: "hsl(210 40% 96%)", padding: "7px 8px", fontSize: 13, outline: "none", width: "100%" }}
                  onFocus={(e) => { e.target.style.borderColor = "hsl(220 90% 56%)"; }} onBlur={(e) => { e.target.style.borderColor = "hsl(220 20% 22%)"; }}
                />
              </div>
              <button onClick={addManualPiece} style={{ width: "100%", padding: 8, borderRadius: 8, border: "none", background: "hsl(220 90% 56%)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ Aggiungi Pezzo</button>
            </div>
          </div>

          {/* Center: SVG visualization */}
          <NestingCanvas sheets={nestingFull.sheets} sheetW={sheetW} sheetH={sheetH} margin={margin} sheetIndex={sheetIndex} onPrev={() => setSheetIndex(i => Math.max(0, i - 1))} onNext={() => setSheetIndex(i => Math.min(nestingFull.sheets.length - 1, i + 1))} effColor={effColor} />

          {/* Right panel 268px */}
          <NestingBomPanel result={nestingFull} pieces={pieces} params={{ sheetW, sheetH }} effColor={effColor} onSheetSelect={setSheetIndex} activeSheet={sheetIndex} />
        </div>

        {/* MOBILE: tab bar in basso */}
        <div className="flex flex-col md:hidden" style={{ flex: 1, overflow: "hidden" }}>
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {mobileTab === "pezzi" && (
              <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Params mobile */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {([{ label: "Largh.", val: sheetW, set: setSheetW }, { label: "Alt.", val: sheetH, set: setSheetH }, { label: "Lama", val: kerf, set: setKerf }, { label: "Marg.", val: margin, set: setMargin }] as const).map((p) => (
                    <div key={p.label}>
                      <label style={{ fontSize: 10, fontWeight: 700, color: "hsl(220 15% 35%)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 2 }}>{p.label} mm</label>
                      <input type="number" value={p.val} onChange={(e) => p.set(parseFloat(e.target.value) || 0)}
                        style={{ background: "hsl(220 26% 14%)", border: "1px solid hsl(220 20% 22%)", borderRadius: 8, color: "hsl(210 40% 96%)", padding: "6px 10px", fontSize: 13, outline: "none", width: "100%" }}
                      />
                    </div>
                  ))}
                </div>
                {/* Add form mobile */}
                <div style={{ background: "hsl(220 32% 10%)", borderRadius: 12, padding: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 42px", gap: 6, marginBottom: 6 }}>
                    {[{ ph: "B", val: newB, set: setNewB }, { ph: "H", val: newH, set: setNewH }].map((f) => (
                      <input key={f.ph} placeholder={f.ph} type="number" inputMode="decimal" value={f.val} onChange={(e) => f.set(e.target.value)}
                        style={{ background: "hsl(220 26% 14%)", border: "1px solid hsl(220 20% 22%)", borderRadius: 8, color: "hsl(210 40% 96%)", padding: "7px 8px", fontSize: 13, outline: "none", width: "100%" }}
                      />
                    ))}
                    <button onClick={() => setNewUnit(u => u === "cm" ? "mm" : "cm")} style={{ background: "hsl(220 22% 18%)", border: "1px solid hsl(220 20% 22%)", borderRadius: 8, color: "hsl(210 40% 96%)", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>{newUnit}</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "50px 1fr", gap: 6, marginBottom: 8 }}>
                    <input placeholder="Q" type="number" min="1" value={newQ} onChange={(e) => setNewQ(e.target.value)}
                      style={{ background: "hsl(220 26% 14%)", border: "1px solid hsl(220 20% 22%)", borderRadius: 8, color: "hsl(210 40% 96%)", padding: "7px 8px", fontSize: 13, outline: "none", width: "100%" }} />
                    <input placeholder="Riferimento" value={newRef} onChange={(e) => setNewRef(e.target.value)}
                      style={{ background: "hsl(220 26% 14%)", border: "1px solid hsl(220 20% 22%)", borderRadius: 8, color: "hsl(210 40% 96%)", padding: "7px 8px", fontSize: 13, outline: "none", width: "100%" }} />
                  </div>
                  <button onClick={addManualPiece} style={{ width: "100%", padding: 8, borderRadius: 8, border: "none", background: "hsl(220 90% 56%)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ Aggiungi</button>
                </div>
                {/* Lista pezzi mobile */}
                {pieces.map((p, i) => <PieceRow key={p.id} piece={p} color={PIECE_COLORS[i % PIECE_COLORS.length]} onUpdate={updatePiece} onDelete={deletePiece} />)}
              </div>
            )}
            {mobileTab === "canvas" && (
              <NestingCanvas sheets={nestingFull.sheets} sheetW={sheetW} sheetH={sheetH} margin={margin} sheetIndex={sheetIndex} onPrev={() => setSheetIndex(i => Math.max(0, i - 1))} onNext={() => setSheetIndex(i => Math.min(nestingFull.sheets.length - 1, i + 1))} effColor={effColor} />
            )}
            {mobileTab === "bom" && (
              <NestingBomPanel result={nestingFull} pieces={pieces} params={{ sheetW, sheetH }} effColor={effColor} onSheetSelect={setSheetIndex} activeSheet={sheetIndex} />
            )}
          </div>
          {/* Tab bar mobile */}
          <div style={{ display: "flex", background: "hsl(220 32% 10%)", borderTop: "1px solid hsl(220 20% 22%)", flexShrink: 0 }}>
            {([{ id: "pezzi", icon: "âœ‚", label: "Pezzi" }, { id: "canvas", icon: "â–¦", label: "Canvas" }, { id: "bom", icon: "â‰¡", label: "BoM" }] as const).map((t) => (
              <button key={t.id} onClick={() => setMobileTab(t.id)} style={{ flex: 1, padding: "10px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, border: "none", borderTop: `2px solid ${mobileTab === t.id ? "hsl(220 90% 56%)" : "transparent"}`, background: "transparent", color: mobileTab === t.id ? "hsl(220 90% 56%)" : "hsl(220 15% 35%)", cursor: "pointer", fontSize: 18 }}>
                <span>{t.icon}</span>
                <span style={{ fontSize: 10, fontWeight: 700 }}>{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// â”€â”€ Componente riga pezzo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function PieceRow({ piece, color, onUpdate, onDelete }: { piece: { id: string; b: number; h: number; q: number; unit: string; refTitle: string }; color: string; onUpdate: (id: string, key: any, value: any) => void; onDelete: (id: string) => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", borderBottom: "1px solid hsl(220 20% 22%)", background: hover ? "hsl(220 26% 14%)" : "transparent", transition: "background 0.12s" }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div style={{ width: 9, height: 9, borderRadius: "50%", background: color, flexShrink: 0, boxShadow: `0 0 6px ${color}80` }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "hsl(210 40% 96%)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{piece.refTitle}</div>
        <div style={{ fontSize: 10, color: "hsl(215 20% 65%)", fontFamily: "monospace" }}>{piece.b} Ã— {piece.h} {piece.unit}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
        {([["-", -1], ["+", 1]] as const).map(([sym, d]) => (
          <button key={sym} onClick={() => onUpdate(piece.id, "q", Math.max(1, piece.q + d))} style={{ width: 22, height: 22, borderRadius: 6, border: "1px solid hsl(220 20% 22%)", background: "hsl(220 22% 18%)", color: "hsl(210 40% 96%)", fontSize: 13, cursor: "pointer", lineHeight: 1 }}>{sym}</button>
        ))}
        <span style={{ fontSize: 12, fontWeight: 800, color: "hsl(210 40% 96%)", minWidth: 22, textAlign: "center" }}>{piece.q}</span>
      </div>
      <button onClick={() => onDelete(piece.id)} style={{ width: 20, height: 20, border: "none", background: "transparent", color: hover ? "hsl(0 84% 60%)" : "hsl(220 15% 35%)", cursor: "pointer", fontSize: 13, transition: "color 0.15s", flexShrink: 0 }}>âœ•</button>
    </div>
  );
}

// â”€â”€ SVG Visualization â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function NestingCanvas({ sheets, sheetW, sheetH, margin, sheetIndex, onPrev, onNext, effColor }: { sheets: any[]; sheetW: number; sheetH: number; margin: number; sheetIndex: number; onPrev: () => void; onNext: () => void; effColor: (e: number) => string }) {
  const sheet = sheets[sheetIndex] ?? null;
  const usedArea = sheet ? sheet.placed.reduce((a: number, p: any) => a + p.w * p.h, 0) : 0;
  const sheetEff = sheetW * sheetH > 0 ? (usedArea / (sheetW * sheetH)) * 100 : 0;
  const ec = effColor(sheetEff);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "hsl(222 47% 6%)", overflow: "hidden" }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", flexShrink: 0, background: "hsl(220 32% 10%)", borderBottom: "1px solid hsl(220 20% 22%)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "hsl(210 40% 96%)" }}>Visualizzazione Nesting</span>
          <span style={{ fontSize: 11, color: "hsl(215 20% 65%)", fontFamily: "monospace" }}>{sheetW} Ã— {sheetH} mm</span>
        </div>
        {sheets.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={onPrev} disabled={sheetIndex === 0} style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid hsl(220 20% 22%)", background: "hsl(220 22% 18%)", color: sheetIndex === 0 ? "hsl(220 15% 35%)" : "hsl(210 40% 96%)", cursor: sheetIndex === 0 ? "not-allowed" : "pointer", fontSize: 16 }}>â€¹</button>
            <span style={{ fontSize: 12, fontWeight: 700, color: "hsl(210 40% 96%)", minWidth: 90, textAlign: "center" }}>Foglio {sheetIndex + 1} / {sheets.length}</span>
            <button onClick={onNext} disabled={sheetIndex === sheets.length - 1} style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid hsl(220 20% 22%)", background: "hsl(220 22% 18%)", color: sheetIndex === sheets.length - 1 ? "hsl(220 15% 35%)" : "hsl(210 40% 96%)", cursor: sheetIndex === sheets.length - 1 ? "not-allowed" : "pointer", fontSize: 16 }}>â€º</button>
          </div>
        )}
      </div>
      {/* SVG canvas */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, overflow: "hidden" }}>
        {!sheet ? (
          <div style={{ textAlign: "center", color: "hsl(220 15% 35%)" }}>
            <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.2, letterSpacing: -2 }}>â–¦</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Aggiungi pezzi per visualizzare il nesting</div>
            <div style={{ fontSize: 12, marginTop: 6, opacity: 0.6 }}>Il calcolo avviene in tempo reale</div>
          </div>
        ) : (
          <svg viewBox={`0 0 ${sheetW} ${sheetH}`} style={{ maxWidth: "100%", maxHeight: "100%", display: "block", borderRadius: 6, boxShadow: "0 8px 40px rgba(0,0,0,0.6)" }} preserveAspectRatio="xMidYMid meet">
            <defs>
              <pattern id="waste-hatch" width="36" height="36" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="36" stroke="hsl(220,20%,16%)" strokeWidth="10" />
              </pattern>
            </defs>
            <rect x={0} y={0} width={sheetW} height={sheetH} fill="hsl(220,30%,9%)" />
            <rect x={0} y={0} width={sheetW} height={sheetH} fill="url(#waste-hatch)" />
            <rect x={2} y={2} width={sheetW - 4} height={sheetH - 4} fill="none" stroke="hsl(220,28%,28%)" strokeWidth={6} />
            {margin > 0 && <rect x={margin} y={margin} width={sheetW - margin * 2} height={sheetH - margin * 2} fill="none" stroke="hsl(220,50%,45%)" strokeDasharray="20,14" strokeWidth={4} opacity={0.5} />}
            {sheet.placed.map((p: any, i: number) => {
              const col = PIECE_COLORS[p.pieceIndex % PIECE_COLORS.length];
              const cx = p.x + p.w / 2;
              const cy = p.y + p.h / 2;
              const fsize = Math.min(p.w, p.h) * 0.11;
              const show = p.w > 120 && p.h > 80;
              return (
                <g key={i}>
                  <rect x={p.x} y={p.y} width={p.w} height={p.h} fill={col} opacity={0.80} rx={6} />
                  <rect x={p.x} y={p.y} width={p.w} height={p.h} fill="none" stroke={col} strokeWidth={4} opacity={0.5} rx={6} />
                  {p.rotated && <text x={p.x + p.w - 28} y={p.y + 38} fill="rgba(0,0,0,0.5)" fontSize={28} fontFamily="monospace">â†»</text>}
                  {show && (<>
                    <text x={cx} y={cy - fsize * 0.5} textAnchor="middle" fill="rgba(0,0,0,0.75)" fontSize={fsize} fontWeight={800} fontFamily="Inter, monospace, sans-serif">{p.dims}</text>
                    <text x={cx} y={cy + fsize * 0.85} textAnchor="middle" fill="rgba(0,0,0,0.55)" fontSize={fsize * 0.72} fontFamily="Inter, sans-serif">{p.label}</text>
                  </>)}
                </g>
              );
            })}
            <text x={sheetW / 2} y={sheetH - 30} textAnchor="middle" fill="hsl(215,20%,38%)" fontSize={38} fontFamily="Inter, monospace, sans-serif">{sheetW} mm</text>
            <text x={30} y={sheetH / 2} textAnchor="middle" dominantBaseline="middle" fill="hsl(215,20%,38%)" fontSize={38} fontFamily="Inter, monospace, sans-serif" transform={`rotate(-90, 30, ${sheetH / 2})`}>{sheetH} mm</text>
          </svg>
        )}
      </div>
      {/* Barra efficienza foglio */}
      {sheet && (
        <div style={{ padding: "8px 16px", flexShrink: 0, background: "hsl(220 32% 10%)", borderTop: "1px solid hsl(220 20% 22%)", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 11, color: "hsl(215 20% 65%)", flexShrink: 0 }}>Resa foglio</span>
          <div style={{ flex: 1, height: 5, background: "hsl(220 26% 14%)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${sheetEff}%`, height: "100%", background: ec, borderRadius: 3, transition: "width 0.5s ease" }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 800, color: ec, flexShrink: 0 }}>{sheetEff.toFixed(1)}%</span>
          <span style={{ fontSize: 11, color: "hsl(220 15% 35%)", flexShrink: 0 }}>sfrido: {(100 - sheetEff).toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}

// â”€â”€ BoM Right Panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function NestingBomPanel({ result, pieces, params, effColor, onSheetSelect, activeSheet }: { result: any; pieces: any[]; params: { sheetW: number; sheetH: number }; effColor: (e: number) => string; onSheetSelect: (i: number) => void; activeSheet: number }) {
  const { sheets = [], efficiency = 0, waste = 0 } = result;
  const bArea = params.sheetW * params.sheetH;
  const r = 34;
  const circ = 2 * Math.PI * r;
  const ec = effColor(efficiency);

  // Raggruppa per refTitle
  const grouped: Record<string, { count: number; areaMm2: number; color: string }> = {};
  pieces.forEach((p, i) => {
    const key = p.refTitle;
    if (!grouped[key]) grouped[key] = { count: 0, areaMm2: 0, color: PIECE_COLORS[i % PIECE_COLORS.length] };
    const fac = p.unit === "cm" ? 10 : 1;
    grouped[key].count += p.q;
    grouped[key].areaMm2 += p.b * fac * p.h * fac * p.q;
  });

  return (
    <div style={{ width: 268, flexShrink: 0, display: "flex", flexDirection: "column", background: "hsl(220 32% 10%)", borderLeft: "1px solid hsl(220 20% 22%)", overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid hsl(220 20% 22%)", flexShrink: 0 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: "hsl(220 15% 35%)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Statistiche & BoM</p>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
        {/* Gauge + riepilogo */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <svg width={88} height={88} viewBox="0 0 88 88" style={{ flexShrink: 0 }}>
            <circle cx={44} cy={44} r={r} fill="none" stroke="hsl(220 26% 14%)" strokeWidth={9} />
            <circle cx={44} cy={44} r={r} fill="none" stroke={ec} strokeWidth={9} strokeLinecap="round"
              strokeDasharray={circ} strokeDashoffset={circ * (1 - efficiency / 100)}
              transform="rotate(-90 44 44)" style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.3s" }} />
            <text x={44} y={44} textAnchor="middle" dominantBaseline="middle" fill="hsl(210 40% 96%)" fontSize={15} fontWeight={800} fontFamily="Inter, sans-serif">{efficiency.toFixed(0)}%</text>
          </svg>
          <div>
            <div style={{ fontSize: 11, color: "hsl(215 20% 65%)", marginBottom: 2 }}>Efficienza media</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "hsl(210 40% 96%)", lineHeight: 1 }}>{efficiency.toFixed(1)}%</div>
            <div style={{ fontSize: 11, color: "hsl(16 100% 58%)", marginTop: 3 }}>sfrido {waste.toFixed(1)}%</div>
          </div>
        </div>
        {/* KPI */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18 }}>
          {[{ l: "Fogli", v: sheets.length, c: "hsl(220 90% 56%)" }, { l: "Pezzi tot.", v: result.totalPieces, c: "hsl(210 40% 96%)" }].map(({ l, v, c }) => (
            <div key={l} style={{ background: "hsl(220 26% 14%)", borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: c, lineHeight: 1 }}>{v}</div>
              <div style={{ fontSize: 10, color: "hsl(215 20% 65%)", marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
        {/* Distinta materiali */}
        <div style={{ marginBottom: 18 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "hsl(220 15% 35%)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Distinta Materiali</p>
          {Object.entries(grouped).length === 0 ? (
            <div style={{ fontSize: 12, color: "hsl(220 15% 35%)", fontStyle: "italic" }}>Nessun materiale</div>
          ) : Object.entries(grouped).map(([name, { count, areaMm2, color }]) => (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid hsl(220 20% 22%)" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0, boxShadow: `0 0 5px ${color}70` }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "hsl(210 40% 96%)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
                <div style={{ fontSize: 10, color: "hsl(215 20% 65%)", fontFamily: "monospace" }}>{count} pz Â· {(areaMm2 / 1e6).toFixed(3)} mÂ²</div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 800, color: "hsl(210 40% 96%)" }}>{count}</span>
            </div>
          ))}
        </div>
        {/* Riepilogo fogli */}
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, color: "hsl(220 15% 35%)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Riepilogo Fogli</p>
          {sheets.length === 0 ? (
            <div style={{ fontSize: 12, color: "hsl(220 15% 35%)", fontStyle: "italic", textAlign: "center", padding: 16 }}>Nessun foglio generato</div>
          ) : sheets.map((s: any, i: number) => {
            const ua = s.placed.reduce((a: number, p: any) => a + p.w * p.h, 0);
            const eff = bArea > 0 ? (ua / bArea * 100) : 0;
            const sheetEc = effColor(eff);
            return (
              <div key={i} onClick={() => onSheetSelect(i)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", marginBottom: 5, borderRadius: 10, background: i === activeSheet ? "hsl(220 22% 18%)" : "hsl(220 26% 14%)", cursor: "pointer", border: i === activeSheet ? "1px solid hsl(220 90% 56% / 0.3)" : "1px solid transparent" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "hsl(220 22% 18%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "hsl(220 90% 56%)", flexShrink: 0 }}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: "hsl(210 40% 96%)", fontWeight: 600 }}>{s.placed.length} pezzi</div>
                  <div style={{ fontSize: 10, color: sheetEc }}>Resa {eff.toFixed(0)}%</div>
                </div>
                <div style={{ width: 44, height: 4, background: "hsl(220 20% 22%)", borderRadius: 2, overflow: "hidden", flexShrink: 0 }}>
                  <div style={{ width: `${eff}%`, height: "100%", background: sheetEc, borderRadius: 2, transition: "width 0.4s ease" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

