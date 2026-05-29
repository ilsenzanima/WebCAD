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

interface Layer {
  id: string;
  name: string;
  visible: boolean;
  icon: string;
}

// Dimensioni logiche fisse del foglio da disegno per evitare deformazioni su schermi diversi (aspetto 3:4 premium)
const LOGICAL_WIDTH = 1200;
const LOGICAL_HEIGHT = 1600;

export default function SketchEditorClient({
  sketch,
  associatedNotes: initialNotes,
  projectsWithLevels,
}: SketchEditorClientProps) {
  const router = useRouter();

  // Riferimenti ai Canvas dei livelli e overlay
  const containerRef = useRef<HTMLDivElement>(null);
  const layerCanvasRefs = {
    rilievo: useRef<HTMLCanvasElement>(null),
    impianti: useRef<HTMLCanvasElement>(null),
    quote: useRef<HTMLCanvasElement>(null),
  };
  const tempCanvasRef = useRef<HTMLCanvasElement>(null);

  // Definizione dei 3 Livelli Standard per Cantiere Antincendio
  const [layers, setLayers] = useState<Layer[]>([
    { id: "quote", name: "3. Quote & Note", visible: true, icon: "📏" },
    { id: "impianti", name: "2. Impianti & Voci", visible: true, icon: "🔥" },
    { id: "rilievo", name: "1. Muri & Rilievo", visible: true, icon: "🧱" },
  ]);
  const [activeLayerId, setActiveLayerId] = useState<string>("rilievo");

  // Stati del disegno
  const [color, setColor] = useState("#ffffff");
  const [brushSize, setBrushSize] = useState(4);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");

  // Stati dei Pannelli Drawer (destra)
  const [sidebarOpen, setSidebarOpen] = useState(false); // Sidebar rilievi/misure
  const [layersOpen, setLayersOpen] = useState(false); // Sidebar livelli e strumenti su mobile
  const [associatedNotes, setAssociatedNotes] = useState(initialNotes);

  // Stati del Modale Impostazioni
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [sketchName, setSketchName] = useState(sketch.name);
  const [assocProjectId, setAssocProjectId] = useState(
    sketch.levels?.projects?.name
      ? projectsWithLevels.find((p) => p.name === sketch.levels?.projects?.name)?.id || ""
      : ""
  );
  const [assocLevelId, setAssocLevelId] = useState(sketch.level_id || "");

  const [isPending, startTransition] = useTransition();

  // Storici per Undo / Redo divisi per livello
  const undoStacksRef = useRef<Record<string, string[]>>({
    rilievo: [],
    impianti: [],
    quote: [],
  });
  const redoStacksRef = useRef<Record<string, string[]>>({
    rilievo: [],
    impianti: [],
    quote: [],
  });

  // Riferimenti interni al disegno
  const isDrawingRef = useRef(false);
  const pointsRef = useRef<Point[]>([]);
  const startPointRef = useRef<Point | null>(null);
  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastPointRef = useRef<Point | null>(null);
  const isShapeDetectedRef = useRef(false);
  const detectedShapeRef = useRef<any>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Colori predefiniti per palette premium
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

  // 1. Inizializzazione Canvas a Risoluzione Logica Fissa
  useEffect(() => {
    // Configura tutti i canvas a 1200x1600 pixel
    const canvasIds: Array<keyof typeof layerCanvasRefs> = ["rilievo", "impianti", "quote"];
    
    canvasIds.forEach((id) => {
      const canvas = layerCanvasRefs[id].current;
      if (!canvas) return;
      canvas.width = LOGICAL_WIDTH;
      canvas.height = LOGICAL_HEIGHT;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      }
    });

    const tempCanvas = tempCanvasRef.current;
    if (tempCanvas) {
      tempCanvas.width = LOGICAL_WIDTH;
      tempCanvas.height = LOGICAL_HEIGHT;
      const tempCtx = tempCanvas.getContext("2d");
      if (tempCtx) {
        tempCtx.lineCap = "round";
        tempCtx.lineJoin = "round";
      }
    }

    // Carica l'immagine precedentemente salvata (se esiste) sul livello "rilievo" come base iniziale
    if (sketch.image_data) {
      const img = new Image();
      img.src = sketch.image_data;
      img.onload = () => {
        const rilievoCanvas = layerCanvasRefs.rilievo.current;
        const ctx = rilievoCanvas?.getContext("2d");
        if (ctx && rilievoCanvas) {
          ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
          ctx.drawImage(img, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
          
          // Salva stato iniziale nello stack undo del livello rilievo
          undoStacksRef.current.rilievo = [rilievoCanvas.toDataURL()];
        }
      };
    } else {
      // Salva lo stato vuoto iniziale per tutti i livelli
      canvasIds.forEach((id) => {
        const canvas = layerCanvasRefs[id].current;
        if (canvas) {
          undoStacksRef.current[id] = [canvas.toDataURL()];
        }
      });
    }
  }, [sketch.image_data]);

  // 2. Algoritmo di Riconoscimento Geometrico (Esteso con Triangoli + Ellisse/Cerchio/Linee/Rettangolo)
  function detectShape(points: Point[]) {
    if (points.length < 8) return null;

    const start = points[0];
    const end = points[points.length - 1];

    // Calcolo Bounding Box
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

    // Verifica se è una forma chiusa
    const distStartEnd = Math.sqrt((start.x - end.x) ** 2 + (start.y - end.y) ** 2);
    const isClosed = distStartEnd < size * 0.25;

    // A. Verifica LINEA RETTA
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lineLength = Math.sqrt(dx * dx + dy * dy);

    if (lineLength > 25) {
      let lineDevSum = 0;
      for (const p of points) {
        const dev = Math.abs(dy * p.x - dx * p.y + (end.x * start.y - end.y * start.x)) / lineLength;
        lineDevSum += dev;
      }
      const avgLineDev = lineDevSum / points.length;

      if (avgLineDev < lineLength * 0.08) {
        return { type: "line", params: { x1: start.x, y1: start.y, x2: end.x, y2: end.y } };
      }
    }

    // B. Se è una forma CHIUSA
    if (isClosed && w > 20 && h > 20) {
      const cx = minX + w / 2;
      const cy = minY + h / 2;
      const r = (w + h) / 4;

      // Verifica CERCHIO / ELLISSE
      let circleDevSum = 0;
      for (const p of points) {
        const dist = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
        circleDevSum += Math.abs(dist - r);
      }
      const avgCircleDev = circleDevSum / points.length;

      if (avgCircleDev < r * 0.18) {
        if (Math.abs(w - h) / Math.max(w, h) < 0.25) {
          return { type: "circle", params: { cx, cy, r } };
        } else {
          return { type: "ellipse", params: { cx, cy, rx: w / 2, ry: h / 2 } };
        }
      }

      // C. Riconoscimento TRIANGOLO vs RETTANGOLO
      // Troviamo i tre potenziali vertici:
      // 1. Il picco superiore (Y minima)
      // 2. Il punto più a sinistra (X minima)
      // 3. Il punto più a destra (X massima)
      let topPt = points[0], leftPt = points[0], rightPt = points[0];
      for (const p of points) {
        if (p.y < topPt.y) topPt = p;
        if (p.x < leftPt.x) leftPt = p;
        if (p.x > rightPt.x) rightPt = p;
      }

      // Calcoliamo se l'area del bounding box è coperta per circa il 50% (tipico di un triangolo)
      // o per più dell'80% (tipico di un rettangolo)
      const triangleArea = 0.5 * w * h;
      let pointsInsideTriangle = 0;
      
      // Semplice euristica: se la deviazione dei punti dai lati del triangolo formato da topPt, leftPt, rightPt
      // è minima rispetto a un rettangolo, allora è un triangolo perfetto.
      // Un indicatore molto solido è valutare la coordinata Y del centro inferiore:
      // se l'utente disegna un triangolo, la parte inferiore è una base piatta e i lati salgono ad angolo.
      // Se la distanza della coordinata Y dei punti centrali è significativamente minore del bounding box
      // nella metà superiore rispetto a quella inferiore, è un triangolo.
      const isTriangle = points.some(p => p.y > cy && Math.abs(p.x - cx) < w * 0.15) && 
                         !points.some(p => p.y < cy && Math.abs(p.x - cx) > w * 0.4);

      if (isTriangle) {
        return {
          type: "triangle",
          params: {
            x1: cx,
            y1: minY,
            x2: minX,
            y2: maxY,
            x3: maxX,
            y3: maxY,
          },
        };
      } else {
        return { type: "rectangle", params: { x: minX, y: minY, w, h } };
      }
    }

    return null;
  }

  // 3. Unione e Salvataggio di tutti i livelli in un unico Base64 per Supabase
  function triggerAutoSave() {
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);

    setSaveStatus("saving");

    autoSaveTimeoutRef.current = setTimeout(async () => {
      try {
        // Creiamo un canvas virtuale temporaneo per fondere solo i livelli VISIBILI
        const mergeCanvas = document.createElement("canvas");
        mergeCanvas.width = LOGICAL_WIDTH;
        mergeCanvas.height = LOGICAL_HEIGHT;
        const mergeCtx = mergeCanvas.getContext("2d");

        if (mergeCtx) {
          // Fondo i livelli dal basso verso l'alto (rilievo -> impianti -> quote)
          const renderOrder = ["rilievo", "impianti", "quote"];
          renderOrder.forEach((id) => {
            const layer = layers.find((l) => l.id === id);
            if (layer?.visible) {
              const canvas = layerCanvasRefs[id as keyof typeof layerCanvasRefs].current;
              if (canvas) {
                mergeCtx.drawImage(canvas, 0, 0);
              }
            }
          });

          const base64 = mergeCanvas.toDataURL("image/png");
          const res = await updateSketch(sketch.id, { image_data: base64 });
          
          if (res.success) {
            setSaveStatus("saved");
          } else {
            setSaveStatus("error");
          }
        }
      } catch (err) {
        console.error("Errore salvataggio automatico multilivello:", err);
        setSaveStatus("error");
      }
    }, 1500);
  }

  // 4. Undo e Redo legati al livello attivo
  function handleUndo() {
    const activeCanvas = layerCanvasRefs[activeLayerId as keyof typeof layerCanvasRefs].current;
    if (!activeCanvas) return;

    const stack = undoStacksRef.current[activeLayerId];
    if (stack.length <= 1) return;

    const ctx = activeCanvas.getContext("2d");
    if (!ctx) return;

    // Sposta in redo
    const current = stack.pop()!;
    redoStacksRef.current[activeLayerId].push(current);

    // Ridisegna il precedente
    const prev = stack[stack.length - 1];
    const img = new Image();
    img.src = prev;
    img.onload = () => {
      ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      ctx.drawImage(img, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      triggerAutoSave();
    };
  }

  function handleRedo() {
    const activeCanvas = layerCanvasRefs[activeLayerId as keyof typeof layerCanvasRefs].current;
    if (!activeCanvas) return;

    const stack = redoStacksRef.current[activeLayerId];
    if (stack.length === 0) return;

    const ctx = activeCanvas.getContext("2d");
    if (!ctx) return;

    const next = stack.pop()!;
    undoStacksRef.current[activeLayerId].push(next);

    const img = new Image();
    img.src = next;
    img.onload = () => {
      ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      ctx.drawImage(img, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      triggerAutoSave();
    };
  }

  function handleClearAll() {
    if (!confirm("Sei sicuro di ripulire interamente il livello corrente?")) return;

    const activeCanvas = layerCanvasRefs[activeLayerId as keyof typeof layerCanvasRefs].current;
    const ctx = activeCanvas?.getContext("2d");
    if (!activeCanvas || !ctx) return;

    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    
    undoStacksRef.current[activeLayerId].push(activeCanvas.toDataURL());
    redoStacksRef.current[activeLayerId] = [];

    triggerAutoSave();
  }

  // 5. Conversione Coordinate da CSS a Coordinate Logiche (1200x1600)
  function getCoordinates(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    
    // Calcoliamo la posizione in percentuale e proiettiamola sulle dimensioni reali
    const x = ((e.clientX - rect.left) / rect.width) * LOGICAL_WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * LOGICAL_HEIGHT;
    
    return { x, y };
  }

  // 6. Gestione Disegno & Riconoscimento / Scaling Forme Dinamico (Procreate Style)
  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const tempCanvas = tempCanvasRef.current;
    if (!tempCanvas) return;

    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;

    const coords = getCoordinates(e);
    isDrawingRef.current = true;
    pointsRef.current = [coords];
    startPointRef.current = coords;
    lastPointRef.current = coords;
    isShapeDetectedRef.current = false;
    detectedShapeRef.current = null;

    // Tracciamento temporaneo
    tempCtx.beginPath();
    tempCtx.moveTo(coords.x, coords.y);
    tempCtx.strokeStyle = tool === "eraser" ? "rgba(255,255,255,0.4)" : color;
    tempCtx.lineWidth = brushSize;
    tempCtx.setLineDash(tool === "eraser" ? [10, 10] : []);

    tempCanvas.setPointerCapture(e.pointerId);

    // Avvia timer 750ms per blocco forma intelligente
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

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current || !lastPointRef.current || !startPointRef.current) return;
    e.preventDefault();

    const tempCanvas = tempCanvasRef.current;
    const tempCtx = tempCanvas?.getContext("2d");
    if (!tempCanvas || !tempCtx) return;

    const coords = getCoordinates(e);
    pointsRef.current.push(coords);

    // Se la forma geometrica è bloccata (dito fermo per 750ms), muovendo il dito
    // ridimensioniamo dinamicamente la forma (Drag-to-size Procreate style)!
    if (isShapeDetectedRef.current && detectedShapeRef.current) {
      const shape = detectedShapeRef.current;
      const start = startPointRef.current;

      if (shape.type === "line") {
        shape.params.x2 = coords.x;
        shape.params.y2 = coords.y;
      } else if (shape.type === "circle") {
        const r = Math.sqrt((coords.x - shape.params.cx) ** 2 + (coords.y - shape.params.cy) ** 2);
        shape.params.r = r;
      } else if (shape.type === "ellipse") {
        shape.params.rx = Math.abs(coords.x - shape.params.cx);
        shape.params.ry = Math.abs(coords.y - shape.params.cy);
      } else if (shape.type === "rectangle") {
        shape.params.w = coords.x - start.x;
        shape.params.h = coords.y - start.y;
      } else if (shape.type === "triangle") {
        shape.params.x2 = start.x - Math.abs(coords.x - start.x);
        shape.params.x3 = start.x + Math.abs(coords.x - start.x);
        shape.params.y2 = coords.y;
        shape.params.y3 = coords.y;
      }

      drawShapePreview(shape);
      return;
    }

    // Disegno a mano libera
    tempCtx.beginPath();
    tempCtx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    tempCtx.lineTo(coords.x, coords.y);
    tempCtx.stroke();

    lastPointRef.current = coords;
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) return;
    e.preventDefault();

    isDrawingRef.current = false;
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);

    const tempCanvas = tempCanvasRef.current;
    const activeCanvas = layerCanvasRefs[activeLayerId as keyof typeof layerCanvasRefs].current;
    if (!tempCanvas || !activeCanvas) return;

    const activeCtx = activeCanvas.getContext("2d");
    const tempCtx = tempCanvas.getContext("2d");
    if (!activeCtx || !tempCtx) return;

    tempCanvas.releasePointerCapture(e.pointerId);

    // Gomma o Penna composite operation
    if (tool === "eraser") {
      activeCtx.globalCompositeOperation = "destination-out";
      activeCtx.lineWidth = brushSize * 1.8; // Gomma leggermente più larga per comodità
    } else {
      activeCtx.globalCompositeOperation = "source-over";
      activeCtx.strokeStyle = color;
      activeCtx.lineWidth = brushSize;
    }

    // Disegna la forma perfetta o il tracciato libero sul canvas logico reale
    if (isShapeDetectedRef.current && detectedShapeRef.current) {
      drawShapeOnCtx(activeCtx, detectedShapeRef.current);
    } else {
      activeCtx.beginPath();
      if (pointsRef.current.length > 0) {
        activeCtx.moveTo(pointsRef.current[0].x, pointsRef.current[0].y);
        for (let i = 1; i < pointsRef.current.length; i++) {
          activeCtx.lineTo(pointsRef.current[i].x, pointsRef.current[i].y);
        }
        activeCtx.stroke();
      }
    }

    // Ripristina composite di default
    activeCtx.globalCompositeOperation = "source-over";

    // Svuota overlay
    tempCtx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // Salva nella storia
    undoStacksRef.current[activeLayerId].push(activeCanvas.toDataURL());
    redoStacksRef.current[activeLayerId] = []; // Reset Redo

    triggerAutoSave();
  }

  // Disegna preview verde brillante neon o rossa sull'overlay temporaneo
  function drawShapePreview(shape: any) {
    const tempCanvas = tempCanvasRef.current;
    const tempCtx = tempCanvas?.getContext("2d");
    if (!tempCanvas || !tempCtx) return;

    tempCtx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    tempCtx.strokeStyle = tool === "eraser" ? "rgba(239, 68, 68, 0.9)" : "hsl(142, 71%, 45%)";
    tempCtx.lineWidth = brushSize + 2;
    tempCtx.setLineDash([]);
    
    drawShapeOnCtx(tempCtx, shape);
  }

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
    } else if (shape.type === "triangle") {
      ctx.moveTo(shape.params.x1, shape.params.y1);
      ctx.lineTo(shape.params.x2, shape.params.y2);
      ctx.lineTo(shape.params.x3, shape.params.y3);
      ctx.closePath();
      ctx.stroke();
    }
  }

  // 7. Modifica associazione
  function handleUpdateSettings(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateSketch(sketch.id, {
        name: sketchName.trim() || "Sketch Senza Nome",
        level_id: assocLevelId || null,
      });

      if (res.success) {
        setIsSettingsOpen(false);
        if (assocLevelId) {
          const fetchRes = await fetch(`/api/notes-by-level?levelId=${assocLevelId}`);
          if (fetchRes.ok) {
            setAssociatedNotes(await fetchRes.json());
          }
        } else {
          setAssociatedNotes([]);
        }
        router.refresh();
      } else {
        alert("Errore aggiornamento: " + res.error);
      }
    });
  }

  const currentSettingsProject = projectsWithLevels.find((p) => p.id === assocProjectId);
  const settingsLevels = currentSettingsProject?.levels ?? [];

  // Toggle visibilità livello
  const toggleLayerVisibility = (id: string) => {
    setLayers(
      layers.map((l) => {
        if (l.id === id) {
          return { ...l, visible: !l.visible };
        }
        return l;
      })
    );
    // Innesca salvataggio per aggiornare l'immagine su database senza il livello nascosto
    setTimeout(triggerAutoSave, 50);
  };

  return (
    <div className="h-[calc(100vh-60px)] md:h-screen flex overflow-hidden relative">
      
      {/* ── AREA DI DISEGNO CENTRALE ── */}
      <div className="flex-1 flex flex-col relative h-full bg-[#0d1017]">
        
        {/* BARRA SUPERIORE FLUTTUANTE */}
        <div
          className="absolute top-3 left-3 right-3 z-30 px-4 py-3 rounded-2xl border flex items-center justify-between gap-3 shadow-lg"
          style={{
            background: "hsl(220 35% 12% / 0.95)",
            backdropFilter: "blur(12px)",
            borderColor: "hsl(220 20% 16%)",
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/sketches"
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 border border-white/5 text-white/80 hover:bg-white/10 transition-all text-sm flex-shrink-0"
            >
              ⬅
            </Link>
            <div className="min-w-0">
              <h2 className="text-white font-bold text-xs md:text-sm truncate leading-snug">
                {sketchName}
              </h2>
              {sketch.levels?.projects?.name ? (
                <p className="text-[9px] text-white/50 truncate flex items-center gap-1">
                  📍 {sketch.levels.projects.name}
                  {sketch.levels.piano && <span className="text-orange-400">({sketch.levels.piano})</span>}
                </p>
              ) : (
                <p className="text-[9px] text-white/40 italic">Sketch Libero</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {saveStatus === "saving" && (
              <span className="text-[10px] text-orange-400 font-bold bg-orange-400/5 px-2 py-0.5 rounded border border-orange-400/10">
                Salvataggio...
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="text-[10px] text-emerald-400 font-bold bg-emerald-400/5 px-2 py-0.5 rounded border border-emerald-400/10">
                Salvato
              </span>
            )}
            
            {/* Impostazioni Sketch */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 border border-white/5 text-white/80 hover:bg-white/10 transition-all text-xs cursor-pointer"
            >
              ⚙️
            </button>
          </div>
        </div>

        {/* WORKSPACE DI DISEGNO CON ASPECT RATIO FISSO 3:4 */}
        <div
          ref={containerRef}
          className="flex-1 w-full h-full flex items-center justify-center p-4 relative"
          style={{ paddingTop: "76px", paddingRight: "76px" }} // Spazio per barra sup e barra laterale
        >
          {/* FOGLIO DA DISEGNO 3:4 CON OMBRA PREMIUM */}
          <div
            className="relative shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 rounded-2xl overflow-hidden aspect-[3/4]"
            style={{
              width: "100%",
              height: "100%",
              maxWidth: "calc((100vh - 120px) * 0.75)", // Ottimizzazione altezza mobile
              maxHeight: "calc(100vh - 120px)",
              background: "hsl(228 39% 7%)",
            }}
          >
            {/* Griglia ingegneristica */}
            <div
              className="absolute inset-0 pointer-events-none opacity-[0.03]"
              style={{
                backgroundImage: `
                  linear-gradient(to right, white 1px, transparent 1px),
                  linear-gradient(to bottom, white 1px, transparent 1px)
                `,
                backgroundSize: "30px 30px",
              }}
            />

            {/* Livello 1: Rilievo (Muri) */}
            <canvas
              ref={layerCanvasRefs.rilievo}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              style={{
                display: layers.find((l) => l.id === "rilievo")?.visible ? "block" : "none",
                zIndex: 1,
              }}
            />

            {/* Livello 2: Impianti */}
            <canvas
              ref={layerCanvasRefs.impianti}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              style={{
                display: layers.find((l) => l.id === "impianti")?.visible ? "block" : "none",
                zIndex: 2,
              }}
            />

            {/* Livello 3: Quote & Annotazioni */}
            <canvas
              ref={layerCanvasRefs.quote}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              style={{
                display: layers.find((l) => l.id === "quote")?.visible ? "block" : "none",
                zIndex: 3,
              }}
            />

            {/* Overlay temporaneo interattivo per disegnare */}
            <canvas
              ref={tempCanvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="absolute inset-0 w-full h-full object-contain touch-none cursor-crosshair active:outline-none"
              style={{ zIndex: 10, touchAction: "none" }}
            />
          </div>
        </div>

        {/* ── BARRA DEGLI STRUMENTI LATERALE FLUTTUANTE A DESTRA ── */}
        <div
          className="absolute right-3 top-[76px] bottom-3 w-14 z-30 py-3 rounded-2xl border flex flex-col justify-between items-center gap-3 shadow-lg"
          style={{
            background: "hsl(220 35% 12% / 0.95)",
            backdropFilter: "blur(12px)",
            borderColor: "hsl(220 20% 16%)",
          }}
        >
          {/* Strumenti Principali */}
          <div className="flex flex-col gap-2 items-center w-full">
            {/* Penna */}
            <button
              onClick={() => setTool("pen")}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer text-base"
              style={{
                background: tool === "pen" ? "hsl(220 90% 56%)" : "transparent",
                color: "white",
              }}
              title="Penna"
            >
              ✏️
            </button>

            {/* Gomma */}
            <button
              onClick={() => setTool("eraser")}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer text-base"
              style={{
                background: tool === "eraser" ? "hsl(220 90% 56%)" : "transparent",
                color: "white",
              }}
              title="Gomma"
            >
              🧼
            </button>

            <div className="w-8 h-[1px] bg-white/5 my-1" />

            {/* Spessore Pennello (Mini range verticale) */}
            <div className="flex flex-col items-center gap-1.5 py-1">
              <span className="text-[8px] text-white/40 uppercase font-bold">Px</span>
              <input
                type="range"
                min="2"
                max="24"
                value={brushSize}
                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                className="h-16 accent-orange-500 cursor-pointer"
                style={{ writingMode: "bt-lr", WebkitAppearance: "slider-vertical" } as any}
              />
              <span className="text-[9px] font-bold text-white/80">{brushSize}</span>
            </div>

            <div className="w-8 h-[1px] bg-white/5 my-1" />

            {/* Colori Palette rapida (il selezionato o primo) */}
            <div className="relative">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-8 h-8 rounded-full border border-white/20 cursor-pointer outline-none overflow-hidden opacity-0 absolute inset-0 z-10"
              />
              <div
                className="w-8 h-8 rounded-full border-2 border-white/20 flex items-center justify-center text-xs text-black font-bold shadow-lg"
                style={{ backgroundColor: color }}
              >
                🎨
              </div>
            </div>
          </div>

          {/* Livelli, Misure, Undo/Redo */}
          <div className="flex flex-col gap-2 items-center w-full">
            {/* Pulsante Apri Livelli */}
            <button
              onClick={() => {
                setLayersOpen(!layersOpen);
                setSidebarOpen(false);
              }}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer text-base relative"
              style={{
                background: layersOpen ? "hsl(220 90% 56%)" : "bg-white/5",
              }}
              title="Gestisci Livelli"
            >
              🥞
              <span className="absolute -bottom-0.5 -right-0.5 bg-orange-500 text-[8px] font-extrabold px-1 rounded-full text-white">
                3
              </span>
            </button>

            {/* Pulsante Misure/Appunti */}
            {sketch.level_id && (
              <button
                onClick={() => {
                  setSidebarOpen(!sidebarOpen);
                  setLayersOpen(false);
                }}
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer text-base"
                style={{
                  background: sidebarOpen ? "hsl(220 90% 56%)" : "bg-white/5",
                }}
                title="Misure di Cantiere"
              >
                📋
              </button>
            )}

            <div className="w-8 h-[1px] bg-white/5 my-1" />

            {/* Undo */}
            <button
              onClick={handleUndo}
              className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 transition-all flex items-center justify-center text-xs"
              title="Annulla"
            >
              ↩
            </button>

            {/* Redo */}
            <button
              onClick={handleRedo}
              className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 transition-all flex items-center justify-center text-xs"
              title="Ripristina"
            >
              ↪
            </button>

            {/* Cancella tutto sul livello */}
            <button
              onClick={handleClearAll}
              className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all flex items-center justify-center text-xs"
              title="Ripulire livello"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>

      {/* ── SIDEBAR LIVELLI & PALETTE AVANZATA (Drawer a destra) ── */}
      {layersOpen && (
        <aside
          className="absolute right-16 top-[76px] bottom-3 w-72 z-40 border rounded-2xl flex flex-col transition-all duration-300 animate-slide-left p-4 space-y-4"
          style={{
            background: "hsl(220 32% 10% / 0.95)",
            backdropFilter: "blur(16px)",
            borderColor: "hsl(220 20% 16%)",
            boxShadow: "-10px 10px 40px rgba(0,0,0,0.5)",
          }}
        >
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <h3 className="text-white font-bold text-xs uppercase tracking-wider">🥞 Gestione Livelli</h3>
            <button onClick={() => setLayersOpen(false)} className="text-xs text-white/40 hover:text-white">
              ✕
            </button>
          </div>

          {/* Elenco Livelli CAD */}
          <div className="space-y-2">
            {layers.map((layer) => {
              const isActive = activeLayerId === layer.id;
              return (
                <div
                  key={layer.id}
                  onClick={() => setActiveLayerId(layer.id)}
                  className="flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer"
                  style={{
                    background: isActive ? "hsl(220 26% 16%)" : "transparent",
                    borderColor: isActive ? "hsl(220 90% 56% / 0.4)" : "white/5",
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm">{layer.icon}</span>
                    <span className={`text-xs ${isActive ? "text-white font-bold" : "text-white/60"}`}>
                      {layer.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Occhiolino Visibilità */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLayerVisibility(layer.id);
                      }}
                      className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-xs"
                      title={layer.visible ? "Nascondi" : "Mostra"}
                    >
                      {layer.visible ? "👁️" : "🙈"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-white/5 pt-3">
            <h4 className="text-[10px] text-white/40 uppercase font-bold tracking-wider mb-2">
              🎨 Palette Colori Avanzata
            </h4>
            <div className="grid grid-cols-4 gap-2">
              {premiumColors.map((hex) => (
                <button
                  key={hex}
                  onClick={() => setColor(hex)}
                  className="w-10 h-10 rounded-xl border transition-all relative flex items-center justify-center cursor-pointer"
                  style={{
                    backgroundColor: hex,
                    borderColor: color === hex ? "white" : "transparent",
                    boxShadow: color === hex ? "0 0 8px white/30" : "none",
                  }}
                >
                  {color === hex && (
                    <span
                      className="text-[9px] font-extrabold"
                      style={{ color: hex === "#ffffff" ? "#000" : "#fff" }}
                    >
                      ✓
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </aside>
      )}

      {/* ── SIDEBAR DETTAGLIO MISURE/NOTE (Right Drawer) ── */}
      {sidebarOpen && sketch.level_id && (
        <aside
          className="absolute right-16 top-[76px] bottom-3 w-80 md:w-96 z-40 border rounded-2xl flex flex-col transition-all duration-300 animate-slide-left"
          style={{
            background: "hsl(220 32% 10% / 0.95)",
            backdropFilter: "blur(16px)",
            borderColor: "hsl(220 20% 16%)",
            boxShadow: "-10px 10px 40px rgba(0,0,0,0.5)",
          }}
        >
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <div>
              <h3 className="text-white font-bold text-xs uppercase tracking-wider">📋 Rilievi di Cantiere</h3>
              <p className="text-[9px] text-white/40 mt-0.5">Misure registrate in questa nota</p>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="text-white/40 hover:text-white">
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {associatedNotes.length === 0 ? (
              <div className="text-center py-12 text-white/30 space-y-2">
                <span className="text-3xl block">📝</span>
                <p className="text-xs italic">Nessun appunto registrato.</p>
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
                  <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                    <span
                      className="px-2 py-0.5 rounded text-[9px] font-extrabold text-white"
                      style={{ background: "hsl(24 95% 50%)" }}
                    >
                      N° {note.note_number}
                    </span>
                    <span className="text-[9px] font-bold text-white/50 uppercase tracking-wider">
                      {note.type_name || "Generico"}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {note.field_note_items?.length === 0 ? (
                      <p className="text-[10px] text-white/40 italic">Nessuna misura.</p>
                    ) : (
                      note.field_note_items?.map((item: any) => {
                        const type = item.item_type;
                        if (type === "header") {
                          return (
                            <div key={item.id} className="text-xs font-bold text-orange-400 pt-1">
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
                              <span className="text-white/50">Stato:</span>
                              <span className="font-bold text-white">
                                {item.value_bool ? "🟢 SÌ" : "🔴 NO"}
                              </span>
                            </div>
                          );
                        }
                        if (type === "livella") {
                          return (
                            <div key={item.id} className="text-xs text-emerald-400 bg-emerald-500/5 p-1.5 rounded border border-emerald-500/10">
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

      {/* MODALE IMPOSTAZIONI ED ASSOCIAZIONE */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsSettingsOpen(false)} />
          <div
            className="relative w-full max-w-md rounded-2xl p-6 border shadow-2xl animate-fade-in"
            style={{
              background: "hsl(220 32% 10%)",
              borderColor: "hsl(220 20% 16%)",
            }}
          >
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-white/5">
              <h2 className="text-white font-bold text-base flex items-center gap-2">⚙️ Impostazioni Sketch</h2>
              <button onClick={() => setIsSettingsOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center text-white bg-white/10">
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-1.5">Nome dello Sketch</label>
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
                <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-1.5">Sposta in un altro Cantiere</label>
                <select
                  value={assocProjectId}
                  onChange={(e) => {
                    setAssocProjectId(e.target.value);
                    setAssocLevelId("");
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
                  <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-1.5">Seleziona Nota / Zona</label>
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
