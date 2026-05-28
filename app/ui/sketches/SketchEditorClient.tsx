"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateSketch, Sketch } from "@/app/actions/sketches";

interface SketchEditorClientProps {
  sketch: Sketch;
  associatedNotes: any[];
  projectsWithLevels: Array<{
    id: string;
    name: string;
    levels: Array<{
      id: string;
      name: string;
      piano: string | null;
    }>;
  }>;
}

interface Point {
  x: number;
  y: number;
}

export default function SketchEditorClient({
  sketch,
  associatedNotes: initialNotes,
  projectsWithLevels,
}: SketchEditorClientProps) {
  const router = useRouter();
  
  // Riferimenti ai Canvas e container
  const containerRef = useRef<HTMLDivElement>(null);
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement>(null);

  // Stati del disegno
  const [color, setColor] = useState("#ffffff");
  const [brushSize, setBrushSize] = useState(4);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");

  // Stati della Sidebar (Drawer)
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [associatedNotes, setAssociatedNotes] = useState(initialNotes);

  // Stati del Modale Impostazioni Sketch
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [sketchName, setSketchName] = useState(sketch.name);
  const [assocProjectId, setAssocProjectId] = useState(sketch.levels?.projects?.name 
    ? projectsWithLevels.find(p => p.name === sketch.levels?.projects?.name)?.id || "" 
    : ""
  );
  const [assocLevelId, setAssocLevelId] = useState(sketch.level_id || "");

  const [isPending, startTransition] = useTransition();

  // Storico per Undo / Redo
  const undoStackRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);

  // Stato interno del disegno
  const isDrawingRef = useRef(false);
  const pointsRef = useRef<Point[]>([]);
  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastPointRef = useRef<Point | null>(null);
  const isShapeDetectedRef = useRef(false);
  const detectedShapeRef = useRef<any>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Colori predefiniti per tavolozza premium
  const premiumColors = [
    "#ffffff", // Bianco
    "#f97316", // Arancione Brand
    "#ef4444", // Rosso
    "#3b82f6", // Blu tecnico
    "#10b981", // Verde OK
    "#eab308", // Giallo Warning
    "#a855f7", // Viola
    "#ec4899", // Rosa
  ];

  // 1. Inizializzazione Canvas & Ridimensionamento ad alta densità (DPI)
  useEffect(() => {
    const mainCanvas = mainCanvasRef.current;
    const tempCanvas = tempCanvasRef.current;
    const container = containerRef.current;

    if (!mainCanvas || !tempCanvas || !container) return;

    const ctx = mainCanvas.getContext("2d");
    const tempCtx = tempCanvas.getContext("2d");
    if (!ctx || !tempCtx) return;

    // Dimensioni fisiche del container
    const width = container.clientWidth;
    const height = container.clientHeight;
    const dpr = window.devicePixelRatio || 1;

    // Configura i pixel reali per evitare sfocature
    mainCanvas.width = width * dpr;
    mainCanvas.height = height * dpr;
    mainCanvas.style.width = `${width}px`;
    mainCanvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    tempCanvas.width = width * dpr;
    tempCanvas.height = height * dpr;
    tempCanvas.style.width = `${width}px`;
    tempCanvas.style.height = `${height}px`;
    tempCtx.scale(dpr, dpr);

    // Imposta sfondo canvas (trasparente o leggermente colorato come lavagna tecnica)
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    tempCtx.lineCap = "round";
    tempCtx.lineJoin = "round";

    // Carica l'immagine salvata in precedenza, se presente
    if (sketch.image_data) {
      const img = new Image();
      img.src = sketch.image_data;
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
        // Salva lo stato iniziale nello stack undo
        undoStackRef.current = [sketch.image_data!];
      };
    } else {
      // Salva canvas vuoto come stato iniziale
      undoStackRef.current = [mainCanvas.toDataURL()];
    }

    // Gestore ridimensionamento
    const handleResize = () => {
      // Salviamo lo stato corrente
      const currentData = mainCanvas.toDataURL();
      
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;

      mainCanvas.width = newWidth * dpr;
      mainCanvas.height = newHeight * dpr;
      mainCanvas.style.width = `${newWidth}px`;
      mainCanvas.style.height = `${newHeight}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0); // reset
      ctx.scale(dpr, dpr);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      tempCanvas.width = newWidth * dpr;
      tempCanvas.height = newHeight * dpr;
      tempCanvas.style.width = `${newWidth}px`;
      tempCanvas.style.height = `${newHeight}px`;
      tempCtx.setTransform(1, 0, 0, 1, 0, 0); // reset
      tempCtx.scale(dpr, dpr);
      tempCtx.lineCap = "round";
      tempCtx.lineJoin = "round";

      // Ridisegniamo l'immagine salvata
      const img = new Image();
      img.src = currentData;
      img.onload = () => {
        ctx.drawImage(img, 0, 0, newWidth, newHeight);
      };
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [sketch.image_data]);

  // 2. Algoritmo di Riconoscimento delle Forme (Procreate Style)
  function detectShape(points: Point[]) {
    if (points.length < 8) return null;

    const start = points[0];
    const end = points[points.length - 1];

    // Calcolo del bounding box
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const w = maxX - minX;
    const h = maxY - minY;
    const size = Math.sqrt(w * w + h * h);

    // Distanza inizio-fine
    const distStartEnd = Math.sqrt((start.x - end.x) ** 2 + (start.y - end.y) ** 2);
    const isClosed = distStartEnd < size * 0.25;

    // A. Verifica se è una linea retta
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lineLength = Math.sqrt(dx * dx + dy * dy);

    if (lineLength > 15) {
      let lineDevSum = 0;
      for (const p of points) {
        // Distanza del punto dalla retta: |A*x + B*y + C| / sqrt(A^2 + B^2)
        // retta: dy*x - dx*y + (end.x*start.y - end.y*start.x) = 0
        const dev = Math.abs(dy * p.x - dx * p.y + (end.x * start.y - end.y * start.x)) / lineLength;
        lineDevSum += dev;
      }
      const avgLineDev = lineDevSum / points.length;

      // Se la deviazione media è < 8% della lunghezza della linea, è una linea retta!
      if (avgLineDev < lineLength * 0.08) {
        return { type: "line", params: { x1: start.x, y1: start.y, x2: end.x, y2: end.y } };
      }
    }

    // B. Se la forma è chiusa, verifichiamo cerchio o rettangolo
    if (isClosed && w > 15 && h > 15) {
      const cx = minX + w / 2;
      const cy = minY + h / 2;
      const r = (w + h) / 4;

      let circleDevSum = 0;
      for (const p of points) {
        const dist = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
        circleDevSum += Math.abs(dist - r);
      }
      const avgCircleDev = circleDevSum / points.length;

      // Se la deviazione media dal raggio ideale è < 18%, è un cerchio o un'ellisse
      if (avgCircleDev < r * 0.18) {
        // Se larghezza e altezza sono simili, è un cerchio perfetto
        if (Math.abs(w - h) / Math.max(w, h) < 0.25) {
          return { type: "circle", params: { cx, cy, r } };
        } else {
          return { type: "ellipse", params: { cx, cy, rx: w / 2, ry: h / 2 } };
        }
      } else {
        // Altrimenti è un rettangolo
        return { type: "rectangle", params: { x: minX, y: minY, w, h } };
      }
    }

    return null;
  }

  // 3. Gestione Salvataggio Automatico (Debounced)
  function triggerAutoSave() {
    const mainCanvas = mainCanvasRef.current;
    if (!mainCanvas) return;

    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);

    setSaveStatus("saving");

    autoSaveTimeoutRef.current = setTimeout(async () => {
      try {
        const base64 = mainCanvas.toDataURL("image/png");
        const res = await updateSketch(sketch.id, { image_data: base64 });
        if (res.success) {
          setSaveStatus("saved");
        } else {
          setSaveStatus("error");
        }
      } catch (err) {
        console.error("Errore salvataggio automatico:", err);
        setSaveStatus("error");
      }
    }, 1500);
  }

  // 4. Funzioni di Undo e Redo
  function handleUndo() {
    const mainCanvas = mainCanvasRef.current;
    if (!mainCanvas || undoStackRef.current.length <= 1) return;

    const ctx = mainCanvas.getContext("2d");
    if (!ctx) return;

    // Sposta lo stato attuale in redo
    const current = undoStackRef.current.pop()!;
    redoStackRef.current.push(current);

    // Prendi lo stato precedente
    const prev = undoStackRef.current[undoStackRef.current.length - 1];

    const img = new Image();
    img.src = prev;
    img.onload = () => {
      ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
      ctx.drawImage(img, 0, 0, mainCanvas.width / window.devicePixelRatio, mainCanvas.height / window.devicePixelRatio);
      triggerAutoSave();
    };
  }

  function handleRedo() {
    const mainCanvas = mainCanvasRef.current;
    if (!mainCanvas || redoStackRef.current.length === 0) return;

    const ctx = mainCanvas.getContext("2d");
    if (!ctx) return;

    const next = redoStackRef.current.pop()!;
    undoStackRef.current.push(next);

    const img = new Image();
    img.src = next;
    img.onload = () => {
      ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
      ctx.drawImage(img, 0, 0, mainCanvas.width / window.devicePixelRatio, mainCanvas.height / window.devicePixelRatio);
      triggerAutoSave();
    };
  }

  function handleClearAll() {
    if (!confirm("Sei sicuro di voler ripulire completamente la lavagna? Questa azione creerà un punto di ripristino.")) return;

    const mainCanvas = mainCanvasRef.current;
    if (!mainCanvas) return;

    const ctx = mainCanvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);

    // Salva lo stato vuoto nella cronologia
    const dataUrl = mainCanvas.toDataURL();
    undoStackRef.current.push(dataUrl);
    redoStackRef.current = [];

    triggerAutoSave();
  }

  // 5. Gestione degli Eventi Pointer per il Canvas
  function getCoordinates(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const tempCanvas = tempCanvasRef.current;
    if (!tempCanvas) return;

    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;

    const coords = getCoordinates(e);
    isDrawingRef.current = true;
    pointsRef.current = [coords];
    lastPointRef.current = coords;
    isShapeDetectedRef.current = false;
    detectedShapeRef.current = null;

    // Inizializza il tratto sul canvas temporaneo
    tempCtx.beginPath();
    tempCtx.moveTo(coords.x, coords.y);
    tempCtx.strokeStyle = tool === "eraser" ? "rgba(255,255,255,0.4)" : color;
    tempCtx.lineWidth = brushSize;
    
    // Per gomma disegniamo a trattini leggeri per mostrare la zona
    if (tool === "eraser") {
      tempCtx.setLineDash([4, 4]);
    } else {
      tempCtx.setLineDash([]);
    }

    // Cattura pointer per il touch mobile
    tempCanvas.setPointerCapture(e.pointerId);

    // Avvia il timeout di attesa 750ms per Procreate-style Shape Recognition
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    holdTimeoutRef.current = setTimeout(() => {
      if (isDrawingRef.current && pointsRef.current.length > 5) {
        // L'utente si è fermato per 750ms: proviamo a rilevare la forma
        const shape = detectShape(pointsRef.current);
        if (shape) {
          isShapeDetectedRef.current = true;
          detectedShapeRef.current = shape;
          // Pulisce e disegna la preview della forma perfetta sul canvas temporaneo
          drawShapePreview(shape);
          
          // Esegui una micro-vibrazione sul cellulare per confermare il rilevamento intelligente
          if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate(35);
          }
        }
      }
    }, 750);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current || !lastPointRef.current) return;
    e.preventDefault();

    const tempCanvas = tempCanvasRef.current;
    const tempCtx = tempCanvas?.getContext("2d");
    if (!tempCanvas || !tempCtx) return;

    const coords = getCoordinates(e);
    pointsRef.current.push(coords);

    // Se abbiamo già rilevato e "bloccato" una forma perfetta, non seguiamo più il disegno libero
    // a meno che l'utente non si sposti vistosamente oltre una certa soglia, rompendo il blocco.
    const distFromLast = Math.sqrt((coords.x - lastPointRef.current.x) ** 2 + (coords.y - lastPointRef.current.y) ** 2);

    if (isShapeDetectedRef.current) {
      // Se si muove molto (es. più di 35px), annulla la forma geometrica e torna a disegno libero
      if (distFromLast > 35) {
        isShapeDetectedRef.current = false;
        detectedShapeRef.current = null;
        if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
        
        // Ridisegna l'intero tracciato a mano libera fatto finora
        redrawFreehandStroke();
      } else {
        // Altrimenti mantieni bloccata la forma geometrica
        return;
      }
    }

    // Disegno libero standard
    tempCtx.beginPath();
    tempCtx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    tempCtx.lineTo(coords.x, coords.y);
    tempCtx.stroke();

    lastPointRef.current = coords;

    // Se si muove molto, cancella e riavvia il timer dei 750ms dall'ultima posizione
    if (distFromLast > 8) {
      if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = setTimeout(() => {
        if (isDrawingRef.current && pointsRef.current.length > 5) {
          const shape = detectShape(pointsRef.current);
          if (shape) {
            isShapeDetectedRef.current = true;
            detectedShapeRef.current = shape;
            drawShapePreview(shape);
            if (typeof navigator !== "undefined" && navigator.vibrate) {
              navigator.vibrate(35);
            }
          }
        }
      }, 750);
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) return;
    e.preventDefault();

    isDrawingRef.current = false;
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);

    const tempCanvas = tempCanvasRef.current;
    const mainCanvas = mainCanvasRef.current;
    if (!tempCanvas || !mainCanvas) return;

    const mainCtx = mainCanvas.getContext("2d");
    const tempCtx = tempCanvas.getContext("2d");
    if (!mainCtx || !tempCtx) return;

    // Rilascia pointer capture
    tempCanvas.releasePointerCapture(e.pointerId);

    // Trasferisci il disegno finale dal canvas temporaneo al canvas principale
    if (isShapeDetectedRef.current && detectedShapeRef.current) {
      // Disegna la forma perfetta geometrica sul canvas reale
      mainCtx.strokeStyle = tool === "eraser" ? "rgba(0,0,0,0)" : color;
      mainCtx.lineWidth = brushSize;
      
      if (tool === "eraser") {
        // La gomma cancella sul canvas principale
        mainCtx.globalCompositeOperation = "destination-out";
      } else {
        mainCtx.globalCompositeOperation = "source-over";
      }

      drawShapeOnCtx(mainCtx, detectedShapeRef.current);
      
      // Ripristina composite operation di default
      mainCtx.globalCompositeOperation = "source-over";
    } else {
      // Altrimenti trasferisci il tratto a mano libera
      mainCtx.strokeStyle = color;
      mainCtx.lineWidth = brushSize;

      if (tool === "eraser") {
        mainCtx.globalCompositeOperation = "destination-out";
        // Disegniamo il tracciato per cancellare
        mainCtx.beginPath();
        if (pointsRef.current.length > 0) {
          mainCtx.moveTo(pointsRef.current[0].x, pointsRef.current[0].y);
          for (let i = 1; i < pointsRef.current.length; i++) {
            mainCtx.lineTo(pointsRef.current[i].x, pointsRef.current[i].y);
          }
          mainCtx.stroke();
        }
        mainCtx.globalCompositeOperation = "source-over";
      } else {
        // Disegna tracciato standard
        mainCtx.beginPath();
        if (pointsRef.current.length > 0) {
          mainCtx.moveTo(pointsRef.current[0].x, pointsRef.current[0].y);
          for (let i = 1; i < pointsRef.current.length; i++) {
            mainCtx.lineTo(pointsRef.current[i].x, pointsRef.current[i].y);
          }
          mainCtx.stroke();
        }
      }
    }

    // Pulisce il canvas temporaneo
    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Salva lo stato corrente nella storia
    const currentData = mainCanvas.toDataURL();
    undoStackRef.current.push(currentData);
    redoStackRef.current = []; // svuota redo

    // Innesca l'autosalvataggio
    triggerAutoSave();
  }

  // Supporto per ridisegnare a mano libera se la forma intelligente viene annullata
  function redrawFreehandStroke() {
    const tempCanvas = tempCanvasRef.current;
    const tempCtx = tempCanvas?.getContext("2d");
    if (!tempCanvas || !tempCtx) return;

    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.beginPath();
    tempCtx.strokeStyle = tool === "eraser" ? "rgba(255,255,255,0.4)" : color;
    tempCtx.lineWidth = brushSize;
    if (tool === "eraser") {
      tempCtx.setLineDash([4, 4]);
    } else {
      tempCtx.setLineDash([]);
    }

    if (pointsRef.current.length > 0) {
      tempCtx.moveTo(pointsRef.current[0].x, pointsRef.current[0].y);
      for (let i = 1; i < pointsRef.current.length; i++) {
        tempCtx.lineTo(pointsRef.current[i].x, pointsRef.current[i].y);
      }
      tempCtx.stroke();
    }
  }

  // Preview della forma sul canvas overlay temporaneo
  function drawShapePreview(shape: any) {
    const tempCanvas = tempCanvasRef.current;
    const tempCtx = tempCanvas?.getContext("2d");
    if (!tempCanvas || !tempCtx) return;

    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    // Disegna la forma in uno stile splendido "glowing/neon" per dare un feedback eccezionale
    tempCtx.strokeStyle = tool === "eraser" ? "rgba(239, 68, 68, 0.8)" : "hsl(142, 71%, 45%)"; // Verde brillante o Rosso gomma
    tempCtx.lineWidth = brushSize + 1.5;
    tempCtx.setLineDash([]);
    
    drawShapeOnCtx(tempCtx, shape);
  }

  // Helper per disegnare la forma geometrica su un generico contesto 2D
  function drawShapeOnCtx(ctx: CanvasRenderingContext2D, shape: any) {
    ctx.beginPath();
    if (shape.type === "line") {
      ctx.moveTo(shape.params.x1, shape.params.y1);
      ctx.lineTo(shape.params.x2, shape.params.y2);
      ctx.stroke();
    } else if (shape.type === "circle") {
      ctx.arc(shape.params.cx, shape.params.cy, shape.params.r, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (shape.type === "ellipse") {
      ctx.ellipse(
        shape.params.cx,
        shape.params.cy,
        shape.params.rx,
        shape.params.ry,
        0,
        0,
        2 * Math.PI
      );
      ctx.stroke();
    } else if (shape.type === "rectangle") {
      ctx.strokeRect(shape.params.x, shape.params.y, shape.params.w, shape.params.h);
    }
  }

  // 6. Gestione Modifica Impostazioni ed Associazione Sketch
  function handleUpdateSettings(e: React.FormEvent) {
    e.preventDefault();
    const name = sketchName.trim() || "Sketch Senza Nome";

    startTransition(async () => {
      const res = await updateSketch(sketch.id, {
        name,
        level_id: assocLevelId || null
      });

      if (res.success) {
        setIsSettingsOpen(false);
        // Se è cambiato il livello associato, ricarica le note in tempo reale
        if (assocLevelId) {
          const fetchRes = await fetch(`/api/notes-by-level?levelId=${assocLevelId}`);
          if (fetchRes.ok) {
            const data = await fetchRes.json();
            setAssociatedNotes(data);
          }
        } else {
          setAssociatedNotes([]);
        }
        router.refresh();
      } else {
        alert("Errore nell'aggiornamento dello sketch: " + res.error);
      }
    });
  }

  // Trova i livelli del cantiere selezionato nel modale impostazioni
  const currentSettingsProject = projectsWithLevels.find(p => p.id === assocProjectId);
  const settingsLevels = currentSettingsProject?.levels ?? [];

  return (
    <div className="h-[calc(100vh-60px)] md:h-screen flex overflow-hidden relative">
      
      {/* AREA DI DISEGNO CENTRALE */}
      <div className="flex-1 flex flex-col relative h-full">
        
        {/* BARRA DEGLI STRUMENTI SUPERIORE (Floating Glassmorphism) */}
        <div 
          className="absolute top-4 left-4 right-4 z-30 px-4 py-3 rounded-2xl border flex items-center justify-between gap-3 shadow-lg"
          style={{
            background: "hsl(220 35% 12% / 0.9)",
            backdropFilter: "blur(12px)",
            borderColor: "hsl(220 20% 16%)",
          }}
        >
          {/* Pulsante Indietro & Titolo */}
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/sketches"
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 border border-white/5 text-white/80 hover:bg-white/10 transition-all text-sm flex-shrink-0"
              title="Torna all'elenco sketch"
            >
              ⬅
            </Link>
            <div className="min-w-0">
              <h2 className="text-white font-bold text-xs md:text-sm truncate leading-snug">
                {sketchName}
              </h2>
              {sketch.levels?.projects?.name ? (
                <p className="text-[10px] text-white/50 truncate flex items-center gap-1">
                  📍 {sketch.levels.projects.name}
                  {sketch.levels.piano && <span className="text-orange-400">({sketch.levels.piano})</span>}
                </p>
              ) : (
                <p className="text-[10px] text-white/40 italic">Sketch Libero</p>
              )}
            </div>
          </div>

          {/* Icona Stato di Salvataggio */}
          <div className="flex items-center gap-2">
            {saveStatus === "saving" && (
              <span className="text-[10px] text-orange-400 font-medium flex items-center gap-1.5 bg-orange-400/5 px-2.5 py-1 rounded-md border border-orange-400/10">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                Salvataggio...
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1.5 bg-emerald-400/5 px-2.5 py-1 rounded-md border border-emerald-400/10">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Salvato
              </span>
            )}
            {saveStatus === "error" && (
              <span className="text-[10px] text-red-400 font-medium flex items-center gap-1.5 bg-red-400/5 px-2.5 py-1 rounded-md border border-red-400/10">
                ⚠️ Errore
              </span>
            )}

            {/* Impostazioni Sketch */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 border border-white/5 text-white/80 hover:bg-white/10 transition-all text-sm cursor-pointer"
              title="Modifica associazione sketch"
            >
              ⚙️
            </button>
          </div>
        </div>

        {/* WORKSPACE CANVAS DI DISEGNO */}
        <div 
          ref={containerRef} 
          className="flex-1 w-full h-full relative cursor-crosshair overflow-hidden"
          style={{ background: "hsl(228 39% 8%)" }}
        >
          {/* Griglia ingegneristica tecnica sotto il disegno */}
          <div 
            className="absolute inset-0 pointer-events-none opacity-[0.035]"
            style={{
              backgroundImage: `
                linear-gradient(to right, white 1px, transparent 1px),
                linear-gradient(to bottom, white 1px, transparent 1px)
              `,
              backgroundSize: "20px 20px"
            }}
          />

          {/* Canvas Principale (permanente) */}
          <canvas
            ref={mainCanvasRef}
            className="absolute inset-0 pointer-events-none"
          />

          {/* Canvas Temporaneo (overlay interattivo per touch/disegno libero e preview smart shapes) */}
          <canvas
            ref={tempCanvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="absolute inset-0 touch-none active:outline-none"
            style={{ touchAction: "none" }}
          />
        </div>

        {/* BARRA STRUMENTI INFERIORE (Palette e Dimensioni) */}
        <div 
          className="absolute bottom-4 left-4 right-4 z-30 p-3 rounded-2xl border flex flex-col gap-3 shadow-lg"
          style={{
            background: "hsl(220 35% 12% / 0.9)",
            backdropFilter: "blur(12px)",
            borderColor: "hsl(220 20% 16%)",
          }}
        >
          {/* Slider Dimensione & Controlli Gomma/Penna */}
          <div className="flex items-center justify-between gap-4 border-b border-white/5 pb-2">
            <div className="flex gap-1">
              <button
                onClick={() => setTool("pen")}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                style={{
                  background: tool === "pen" ? "hsl(220 90% 56%)" : "transparent",
                  color: tool === "pen" ? "white" : "rgba(255,255,255,0.6)"
                }}
              >
                ✏️ Penna
              </button>
              <button
                onClick={() => setTool("eraser")}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                style={{
                  background: tool === "eraser" ? "hsl(220 90% 56%)" : "transparent",
                  color: tool === "eraser" ? "white" : "rgba(255,255,255,0.6)"
                }}
              >
                🧼 Gomma
              </button>
            </div>

            {/* Slider Tratto */}
            <div className="flex items-center gap-2 flex-1 max-w-[160px] md:max-w-[200px]">
              <span className="text-[10px] text-white/50">Tratto</span>
              <input
                type="range"
                min="1"
                max="24"
                value={brushSize}
                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                className="flex-1 accent-orange-500 h-1 rounded-lg cursor-pointer"
              />
              <span className="text-[10px] font-bold text-white/80 w-4 text-right">{brushSize}px</span>
            </div>

            {/* Undo / Redo / Clear */}
            <div className="flex gap-1 flex-shrink-0">
              <button
                onClick={handleUndo}
                className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 text-white/85 hover:bg-white/10 transition-all flex items-center justify-center text-xs cursor-pointer"
                title="Annulla (Undo)"
              >
                ↩
              </button>
              <button
                onClick={handleRedo}
                className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 text-white/85 hover:bg-white/10 transition-all flex items-center justify-center text-xs cursor-pointer"
                title="Ripristina (Redo)"
              >
                ↪
              </button>
              <button
                onClick={handleClearAll}
                className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all flex items-center justify-center text-xs cursor-pointer animate-pulse-ring"
                title="Ripulisci Lavagna"
              >
                🗑️
              </button>
            </div>
          </div>

          {/* Palette Colori Premium */}
          {tool !== "eraser" && (
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
              {premiumColors.map((hex) => (
                <button
                  key={hex}
                  onClick={() => setColor(hex)}
                  className="w-8 h-8 rounded-full border-2 transition-all flex-shrink-0 relative cursor-pointer"
                  style={{
                    backgroundColor: hex,
                    borderColor: color === hex ? "hsl(16 100% 58%)" : "rgba(0, 0, 0, 0.4)",
                    transform: color === hex ? "scale(1.15)" : "scale(1)",
                    boxShadow: color === hex ? "0 0 10px hsl(16 100% 58% / 0.5)" : "none"
                  }}
                >
                  {color === hex && (
                    <span 
                      className="absolute inset-0 flex items-center justify-center text-[10px] font-bold"
                      style={{ color: hex === "#ffffff" ? "#000" : "#fff" }}
                    >
                      ✓
                    </span>
                  )}
                </button>
              ))}
              
              {/* Selettore colore personalizzato HTML5 */}
              <div 
                className="w-8 h-8 rounded-full border-2 border-black/40 overflow-hidden relative flex-shrink-0 cursor-pointer"
                style={{
                  background: "conic-gradient(red, yellow, green, cyan, blue, magenta, red)",
                  transform: !premiumColors.includes(color) ? "scale(1.15)" : "scale(1)",
                  boxShadow: !premiumColors.includes(color) ? "0 0 10px hsl(16 100% 58% / 0.5)" : "none"
                }}
              >
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
              </div>
            </div>
          )}
        </div>

        {/* PULSANTE FLUTTUANTE SIDEBAR (Se c'è un livello associato) */}
        {sketch.level_id && (
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="absolute right-4 top-20 z-30 p-3 rounded-full border text-white transition-all shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
            style={{
              background: sidebarOpen ? "hsl(220 90% 56%)" : "hsl(220 35% 12% / 0.9)",
              borderColor: "hsl(220 20% 16%)",
            }}
          >
            <span className="text-sm">📋 Appunti cantiere</span>
            <span className="text-xs">{sidebarOpen ? "▶" : "◀"}</span>
          </button>
        )}
      </div>

      {/* SIDEBAR DETTAGLIO MISURE/NOTE (Right Drawer) */}
      {sketch.level_id && (
        <aside
          className={`fixed md:relative top-0 right-0 h-full w-80 md:w-96 z-40 border-l flex flex-col flex-shrink-0 transition-transform duration-300 ease-in-out ${
            sidebarOpen ? "translate-x-0" : "translate-x-full md:absolute md:top-0 md:bottom-0 md:h-full md:pointer-events-none md:opacity-0"
          }`}
          style={{
            background: "hsl(220 32% 10%)",
            borderColor: "hsl(220 20% 16%)",
            boxShadow: "-10px 0 30px rgba(0,0,0,0.3)"
          }}
        >
          {/* Header Sidebar */}
          <div className="p-4 border-b border-white/5 flex items-center justify-between pointer-events-auto">
            <div>
              <h3 className="text-white font-bold text-sm">📋 Appunti & Misure</h3>
              <p className="text-[10px] text-white/50 mt-0.5">
                Consulta le misure di cantiere mentre disegni
              </p>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/70 bg-white/5 hover:bg-white/10"
            >
              ✕
            </button>
          </div>

          {/* Elenco appunti/misure */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 pointer-events-auto">
            {associatedNotes.length === 0 ? (
              <div className="text-center py-12 text-white/30 space-y-2">
                <span className="text-3xl block">📝</span>
                <p className="text-xs italic">Nessun appunto registrato per questa zona.</p>
              </div>
            ) : (
              associatedNotes.map((note: any) => (
                <div
                  key={note.id}
                  className="p-3.5 rounded-xl border space-y-2"
                  style={{
                    background: "hsl(220 26% 14%)",
                    borderColor: "hsl(220 20% 18%)",
                  }}
                >
                  {/* Numero e Categoria dell'appunto */}
                  <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                    <span 
                      className="px-2 py-0.5 rounded text-[10px] font-extrabold text-white"
                      style={{ background: "hsl(24 95% 50%)" }}
                    >
                      N° {note.note_number}
                    </span>
                    <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider">
                      {note.type_name || "Generico"}
                    </span>
                  </div>

                  {/* Voci dell'appunto */}
                  <div className="space-y-1.5">
                    {note.field_note_items?.length === 0 ? (
                      <p className="text-[11px] text-white/40 italic">Nessuna misura registrata.</p>
                    ) : (
                      note.field_note_items?.map((item: any) => {
                        const type = item.item_type;

                        if (type === "header") {
                          return (
                            <div key={item.id} className="text-xs font-bold text-orange-400 pt-1 border-t border-white/5">
                              {item.value_text}
                            </div>
                          );
                        }
                        if (type === "text") {
                          return (
                            <div key={item.id} className="text-xs text-white/80 leading-normal bg-white/5 p-1.5 rounded-lg">
                              💬 {item.value_text}
                            </div>
                          );
                        }
                        if (type === "number") {
                          return (
                            <div key={item.id} className="text-xs text-white/80 flex items-center justify-between">
                              <span className="text-white/50">Misura:</span>
                              <span className="font-bold text-emerald-400">
                                {item.value_num} {item.value_unit || "m"}
                              </span>
                            </div>
                          );
                        }
                        if (type === "boolean") {
                          return (
                            <div key={item.id} className="text-xs text-white/80 flex items-center justify-between">
                              <span className="text-white/50">Stato/Opzione:</span>
                              <span className="font-bold text-white">
                                {item.value_bool ? "🟢 SÌ" : "🔴 NO"}
                              </span>
                            </div>
                          );
                        }
                        if (type === "livella") {
                          return (
                            <div key={item.id} className="text-xs text-emerald-400 bg-emerald-500/5 p-1.5 rounded-lg border border-emerald-500/10">
                              📐 {item.value_text}
                            </div>
                          );
                        }
                        return null;
                      })
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      )}

      {/* MODALE IMPOSTAZIONI ED ASSOCIAZIONE SKETCH */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsSettingsOpen(false)}
          />

          <div
            className="relative w-full max-w-md rounded-2xl p-6 border shadow-2xl animate-fade-in"
            style={{
              background: "hsl(220 32% 10%)",
              borderColor: "hsl(220 20% 16%)",
            }}
          >
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-white/5">
              <h2 className="text-white font-bold text-base flex items-center gap-2">
                ⚙️ Impostazioni Sketch
              </h2>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white bg-white/10"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-1.5">
                  Nome dello Sketch
                </label>
                <input
                  type="text"
                  required
                  value={sketchName}
                  onChange={(e) => setSketchName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-sm text-white border transition-all focus:outline-none"
                  style={{
                    background: "hsl(220 26% 14%)",
                    borderColor: "hsl(220 20% 18%)",
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-1.5">
                  Sposta in un altro Cantiere
                </label>
                <select
                  value={assocProjectId}
                  onChange={(e) => {
                    setAssocProjectId(e.target.value);
                    setAssocLevelId(""); // Reset level
                  }}
                  className="w-full px-3 py-2.5 rounded-xl text-sm text-white border transition-all focus:outline-none cursor-pointer"
                  style={{
                    background: "hsl(220 26% 14%)",
                    borderColor: "hsl(220 20% 18%)",
                  }}
                >
                  <option value="">Nessuno (Sketch Libero)</option>
                  {projectsWithLevels.map((p) => (
                    <option key={p.id} value={p.id}>
                      📍 {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {assocProjectId && (
                <div>
                  <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-1.5">
                    Seleziona Nota di Cantiere / Zona
                  </label>
                  <select
                    value={assocLevelId}
                    required={!!assocProjectId}
                    onChange={(e) => setAssocLevelId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-white border transition-all focus:outline-none cursor-pointer"
                    style={{
                      background: "hsl(220 26% 14%)",
                      borderColor: "hsl(220 20% 18%)",
                    }}
                  >
                    <option value="">Scegli una Nota di Cantiere...</option>
                    {settingsLevels.map((lvl) => (
                      <option key={lvl.id} value={lvl.id}>
                        📝 {lvl.name} {lvl.piano ? `(${lvl.piano})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-white/5 mt-5">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold border border-white/10 text-white/70 hover:bg-white/5 transition-all cursor-pointer"
                >
                  Chiudi
                </button>
                <button
                  type="submit"
                  disabled={isPending || (!!assocProjectId && !assocLevelId)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-md disabled:opacity-50 cursor-pointer"
                  style={{
                    background: "linear-gradient(135deg, hsl(16 100% 58%), hsl(0 84% 60%))",
                  }}
                >
                  {isPending ? "Salvataggio..." : "Salva Modifiche"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
