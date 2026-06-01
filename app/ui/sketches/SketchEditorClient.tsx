"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateSketch, Sketch } from "@/app/actions/sketches";
import CalcolatriceWidget from "@/app/ui/dashboard/CalcolatriceWidget";

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
  onSaveBase64?: (base64: string) => void;
  onClose?: () => void;
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

// Dimensioni logiche fisse del foglio da disegno
const LOGICAL_WIDTH = 1200;
const LOGICAL_HEIGHT = 1600;

export default function SketchEditorClient({
  sketch,
  associatedNotes: initialNotes,
  projectsWithLevels,
  onSaveBase64,
  onClose,
}: SketchEditorClientProps) {
  const router = useRouter();

  // TODO: Da rivedere qualche piccolo ritocco da fare sullo sketch (es. miglioramenti grafici, gesture), da affrontare dopo aver completato l'inserimento dei report per il 3D


  // Riferimenti ai Canvas dei livelli e overlay
  const containerRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
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
  
  // Stati di salvataggio (Manuale)
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error" | "unsaved">("saved");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Stati di Zoom e Pan (Multi-touch accelerato GPU)
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Stati dei Pannelli Drawer (destra)
  const [sidebarOpen, setSidebarOpen] = useState(false); // Sidebar rilievi/misure
  const [toolsOpen, setToolsOpen] = useState(false); // Sidebar strumenti per Mobile
  const [layersOpen, setLayersOpen] = useState(false); // Menu di gestione livelli per Desktop
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
  const [showCalc, setShowCalc] = useState(false);

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

  // Riferimenti interni per il disegno e zoom a 2 dita
  const isDrawingRef = useRef(false);
  const pointsRef = useRef<Point[]>([]);
  const startPointRef = useRef<Point | null>(null);
  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastPointRef = useRef<Point | null>(null);
  const isShapeDetectedRef = useRef(false);
  const detectedShapeRef = useRef<any>(null);

  // Riferimenti per zoom/pan a due dita
  const activePointersRef = useRef<Map<number, Point>>(new Map());
  const startTouchDistRef = useRef<number | null>(null);
  const startTouchScaleRef = useRef<number>(1);
  const startTouchCenterRef = useRef<{ x: number; y: number } | null>(null);
  const startTouchPanRef = useRef({ x: 0, y: 0 });
  const isZoomingRef = useRef(false);

  // Riferimenti per drag shape a due dita
  const isDraggingShapeRef = useRef(false);
  const startShapeCenterRef = useRef<{ x: number; y: number } | null>(null);
  const initialShapeParamsRef = useRef<any>(null);
  const initialStartPointRef = useRef<Point | null>(null);

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

  // Inizializzazione Canvas a Risoluzione Logica Fissa
  useEffect(() => {
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

    if (sketch.image_data) {
      const img = new Image();
      img.src = sketch.image_data;
      img.onload = () => {
        const rilievoCanvas = layerCanvasRefs.rilievo.current;
        const ctx = rilievoCanvas?.getContext("2d");
        if (ctx && rilievoCanvas) {
          ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
          ctx.drawImage(img, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
          undoStacksRef.current.rilievo = [rilievoCanvas.toDataURL()];
        }
      };
    } else {
      canvasIds.forEach((id) => {
        const canvas = layerCanvasRefs[id].current;
        if (canvas) {
          undoStacksRef.current[id] = [canvas.toDataURL()];
        }
      });
    }
  }, [sketch.image_data]);

  // Listener per l'evento calcolatrice
  useEffect(() => {
    const handleImportCalc = async (e: Event) => {
      const customEvent = e as CustomEvent<{ calculation: string }>;
      if (customEvent.detail && customEvent.detail.calculation && sketch.level_id) {
        const formula = customEvent.detail.calculation;
        setSaveStatus("saving");
        try {
          const res = await fetch("/api/create-note-quick", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              levelId: sketch.level_id,
              text: `🧮 Calcolo: ${formula}`
            })
          });

          if (res.ok) {
            const fetchRes = await fetch(`/api/notes-by-level?levelId=${sketch.level_id}`);
            if (fetchRes.ok) {
              setAssociatedNotes(await fetchRes.json());
            }
            setSaveStatus("saved");
            setShowCalc(false);
            alert("✓ Calcolo salvato correttamente come riga di appunto per questa zona!");
          } else {
            setSaveStatus("error");
          }
        } catch (err) {
          setSaveStatus("error");
          console.error("Errore salvataggio calcolo sketch:", err);
        }
      }
    };

    window.addEventListener("webcad-import-calc", handleImportCalc);
    return () => {
      window.removeEventListener("webcad-import-calc", handleImportCalc);
    };
  }, [sketch.level_id]);

  // Algoritmo di Riconoscimento Geometrico (Fixato e calibrato per Quadrati/Rettangoli vs Triangoli)
  function detectShape(points: Point[]) {
    if (points.length < 8) return null;

    const start = points[0];
    const end = points[points.length - 1];

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

    const distStartEnd = Math.sqrt((start.x - end.x) ** 2 + (start.y - end.y) ** 2);
    const isClosed = distStartEnd < size * 0.25;

    // A. LINEA RETTA
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

    // B. FORMA CHIUSA
    if (isClosed && w > 20 && h > 20) {
      const cx = minX + w / 2;
      const cy = minY + h / 2;
      const r = (w + h) / 4;

      // CERCHIO / ELLISSE
      let circleDevSum = 0;
      for (const p of points) {
        const dist = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
        circleDevSum += Math.abs(dist - r);
      }
      const avgCircleDev = circleDevSum / points.length;

      if (avgCircleDev < r * 0.16) {
        if (Math.abs(w - h) / Math.max(w, h) < 0.25) {
          return { type: "circle", params: { cx, cy, r } };
        } else {
          return { type: "ellipse", params: { cx, cy, rx: w / 2, ry: h / 2 } };
        }
      }

      // TRIANGOLO vs RETTANGOLO / QUADRATO (Algoritmo matematico dei 4 angoli)
      const minDistanceTo = (target: Point) => {
        let minD = Infinity;
        for (const p of points) {
          const d = Math.sqrt((p.x - target.x) ** 2 + (p.y - target.y) ** 2);
          if (d < minD) minD = d;
        }
        return minD;
      };

      const distTL = minDistanceTo({ x: minX, y: minY });
      const distTR = minDistanceTo({ x: maxX, y: minY });
      const distBL = minDistanceTo({ x: minX, y: maxY });
      const distBR = minDistanceTo({ x: maxX, y: maxY });

      const threshold = size * 0.22; // 22% della diagonale del bounding box
      const touchesTL = distTL < threshold;
      const touchesTR = distTR < threshold;
      const touchesBL = distBL < threshold;
      const touchesBR = distBR < threshold;

      const cornersTouched = (touchesTL ? 1 : 0) + (touchesTR ? 1 : 0) + (touchesBL ? 1 : 0) + (touchesBR ? 1 : 0);

      // Se tocca tutti e 4 gli angoli del bounding box, è sicuramente un rettangolo/quadrato!
      if (cornersTouched >= 4) {
        // Se larghezza e altezza sono simili (differenza < 18%), semplifica in un quadrato perfetto
        if (Math.abs(w - h) / Math.max(w, h) < 0.18) {
          const side = (w + h) / 2;
          return { type: "rectangle", params: { x: cx - side / 2, y: cy - side / 2, w: side, h: side } };
        }
        return { type: "rectangle", params: { x: minX, y: minY, w, h } };
      } else {
        // Altrimenti ha solo 3 (o meno) angoli passanti vicini, quindi è un triangolo!
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
      }
    }

    return null;
  }

  // 3. SALVATAGGIO MANUALE (Richiesto per evitare rallentamenti e conflitti durante il disegno rapido!)
  async function handleSaveManual() {
    if (saveStatus === "saving") return;
    setSaveStatus("saving");

    try {
      const mergeCanvas = document.createElement("canvas");
      mergeCanvas.width = LOGICAL_WIDTH;
      mergeCanvas.height = LOGICAL_HEIGHT;
      const mergeCtx = mergeCanvas.getContext("2d");

      if (mergeCtx) {
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
        
        if (onSaveBase64) {
          onSaveBase64(base64);
          setSaveStatus("saved");
          setHasUnsavedChanges(false);
          return;
        }

        const res = await updateSketch(sketch.id, { image_data: base64 });
        
        if (res.success) {
          setSaveStatus("saved");
          setHasUnsavedChanges(false);
        } else {
          setSaveStatus("error");
          alert("Errore durante il salvataggio: " + res.error);
        }
      }
    } catch (err) {
      console.error("Errore salvataggio manuale:", err);
      setSaveStatus("error");
      alert("Errore di rete durante il salvataggio.");
    }
  }

  // Undo e Redo manuali
  function handleUndo() {
    const activeCanvas = layerCanvasRefs[activeLayerId as keyof typeof layerCanvasRefs].current;
    if (!activeCanvas) return;

    const stack = undoStacksRef.current[activeLayerId];
    if (stack.length <= 1) return;

    const ctx = activeCanvas.getContext("2d");
    if (!ctx) return;

    const current = stack.pop()!;
    redoStacksRef.current[activeLayerId].push(current);

    const prev = stack[stack.length - 1];
    const img = new Image();
    img.src = prev;
    img.onload = () => {
      ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      ctx.drawImage(img, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      setHasUnsavedChanges(true);
      setSaveStatus("unsaved");
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
      setHasUnsavedChanges(true);
      setSaveStatus("unsaved");
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

    setHasUnsavedChanges(true);
    setSaveStatus("unsaved");
  }

  // Conversione Coordinate da CSS a Logiche
  function getCoordinates(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * LOGICAL_WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * LOGICAL_HEIGHT;
    return { x, y };
  }

  // 4. Gestione ZOOM & PAN via Touch (Gesture a due dita)
  // Gestiamo touchstart, touchmove e touchend sul container del workspace per non interferire con il disegno a 1 dito
  function handleTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    if (e.touches.length === 2) {
      if (isShapeDetectedRef.current && detectedShapeRef.current) {
        // Se c'è una forma attiva rilevata, usiamo le due dita per spostarla (Drag Shape)
        isZoomingRef.current = false;
        // Manteniamo isDrawingRef.current a true per far sì che al rilascio delle dita
        // la forma venga salvata correttamente sul canvas in modo definitivo!
        isDraggingShapeRef.current = true;

        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const centerX = (t1.clientX + t2.clientX) / 2;
        const centerY = (t1.clientY + t2.clientY) / 2;

        startShapeCenterRef.current = { x: centerX, y: centerY };
        initialShapeParamsRef.current = JSON.parse(JSON.stringify(detectedShapeRef.current.params));
        initialStartPointRef.current = startPointRef.current ? { ...startPointRef.current } : null;
      } else {
        // Altrimenti, zoom classico del foglio
        isZoomingRef.current = true;
        isDrawingRef.current = false;

        const t1 = e.touches[0];
        const t2 = e.touches[1];

        const dx = t1.clientX - t2.clientX;
        const dy = t1.clientY - t2.clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const centerX = (t1.clientX + t2.clientX) / 2;
        const centerY = (t1.clientY + t2.clientY) / 2;

        startTouchDistRef.current = dist;
        startTouchScaleRef.current = scale;
        startTouchCenterRef.current = { x: centerX, y: centerY };
        startTouchPanRef.current = { ...pan };
      }
    }
  }

  function handleTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    if (
      isDraggingShapeRef.current &&
      e.touches.length === 2 &&
      startShapeCenterRef.current !== null &&
      initialShapeParamsRef.current !== null
    ) {
      e.preventDefault();

      const tempCanvas = tempCanvasRef.current;
      if (!tempCanvas) return;
      const rect = tempCanvas.getBoundingClientRect();

      const t1 = e.touches[0];
      const t2 = e.touches[1];

      const centerX = (t1.clientX + t2.clientX) / 2;
      const centerY = (t1.clientY + t2.clientY) / 2;

      // Delta pixel a schermo
      const screenDx = centerX - startShapeCenterRef.current.x;
      const screenDy = centerY - startShapeCenterRef.current.y;

      // Calcoliamo il fattore di scala reale (pixel logici del canvas / pixel CSS a schermo)
      // LOGICAL_WIDTH = 1200, LOGICAL_HEIGHT = 1600.
      const scaleX = LOGICAL_WIDTH / rect.width;
      const scaleY = LOGICAL_HEIGHT / rect.height;

      // Spostamento logico calibrato in base alla densità di visualizzazione e allo zoom del foglio
      const logicalDx = (screenDx * scaleX) / scale;
      const logicalDy = (screenDy * scaleY) / scale;

      const shape = detectedShapeRef.current;
      const initParams = initialShapeParamsRef.current;

      if (!shape || !initParams) return;

      if (shape.type === "line") {
        shape.params.x1 = initParams.x1 + logicalDx;
        shape.params.y1 = initParams.y1 + logicalDy;
        shape.params.x2 = initParams.x2 + logicalDx;
        shape.params.y2 = initParams.y2 + logicalDy;
      } else if (shape.type === "circle" || shape.type === "ellipse") {
        shape.params.cx = initParams.cx + logicalDx;
        shape.params.cy = initParams.cy + logicalDy;
      } else if (shape.type === "rectangle") {
        shape.params.x = initParams.x + logicalDx;
        shape.params.y = initParams.y + logicalDy;
      } else if (shape.type === "triangle") {
        shape.params.x1 = initParams.x1 + logicalDx;
        shape.params.y1 = initParams.y1 + logicalDy;
        shape.params.x2 = initParams.x2 + logicalDx;
        shape.params.y2 = initParams.y2 + logicalDy;
        shape.params.x3 = initParams.x3 + logicalDx;
        shape.params.y3 = initParams.y3 + logicalDy;
      }

      // Spostiamo anche il punto iniziale del disegno per l'interazione successiva
      if (initialStartPointRef.current && startPointRef.current) {
        startPointRef.current.x = initialStartPointRef.current.x + logicalDx;
        startPointRef.current.y = initialStartPointRef.current.y + logicalDy;
      }

      drawShapePreview(shape);
      return;
    }

    if (
      isZoomingRef.current &&
      e.touches.length === 2 &&
      startTouchDistRef.current !== null &&
      startTouchCenterRef.current !== null
    ) {
      e.preventDefault();

      const t1 = e.touches[0];
      const t2 = e.touches[1];

      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const centerX = (t1.clientX + t2.clientX) / 2;
      const centerY = (t1.clientY + t2.clientY) / 2;

      // Calcola nuova scala
      const newScale = startTouchScaleRef.current * (dist / startTouchDistRef.current);
      // Limiti scale da 0.5x a 4.0x
      const clampedScale = Math.max(0.5, Math.min(4, newScale));
      setScale(clampedScale);

      // Calcola nuovo pan basato sullo spostamento del centro di tocco
      const deltaX = centerX - startTouchCenterRef.current.x;
      const deltaY = centerY - startTouchCenterRef.current.y;
      setPan({
        x: startTouchPanRef.current.x + deltaX,
        y: startTouchPanRef.current.y + deltaY,
      });
    }
  }

  function handleTouchEnd(e: React.TouchEvent<HTMLDivElement>) {
    if (e.touches.length < 2) {
      isZoomingRef.current = false;
      startTouchDistRef.current = null;
      startTouchCenterRef.current = null;

      // Resetta drag della forma
      isDraggingShapeRef.current = false;
      startShapeCenterRef.current = null;
      initialShapeParamsRef.current = null;
      initialStartPointRef.current = null;
    }
  }

  // Funzione rapida per resettare Zoom e Centrare
  function resetZoom() {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }

  // Disegno a mano e riconoscimento intelligente (Pointer Events a 1 dito)
  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    // Se stiamo zoomando con 2 dita o l'evento non è primario (multi-touch), ignora il disegno
    if (isZoomingRef.current || !e.isPrimary) return;

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

    tempCtx.beginPath();
    tempCtx.moveTo(coords.x, coords.y);
    tempCtx.strokeStyle = tool === "eraser" ? "rgba(255,255,255,0.4)" : color;
    tempCtx.lineWidth = brushSize;
    tempCtx.setLineDash(tool === "eraser" ? [10, 10] : []);

    tempCanvas.setPointerCapture(e.pointerId);

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
    }, 500); // 500ms attesa
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current || !lastPointRef.current || !startPointRef.current || !e.isPrimary) return;
    e.preventDefault();

    const tempCanvas = tempCanvasRef.current;
    const tempCtx = tempCanvas?.getContext("2d");
    if (!tempCanvas || !tempCtx) return;

    const coords = getCoordinates(e);
    pointsRef.current.push(coords);

    // Se l'utente si sta muovendo (sta disegnando), riprogrammiamo il timeout di hold
    // Il rilevamento della forma si attiverà solo se l'utente si ferma tenendo premuto per 500ms
    if (!isShapeDetectedRef.current) {
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
      }, 500); // 500ms hold fermo nello stesso punto
    }

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

    if (tool === "eraser") {
      activeCtx.globalCompositeOperation = "destination-out";
      activeCtx.lineWidth = brushSize * 1.8;
    } else {
      activeCtx.globalCompositeOperation = "source-over";
      activeCtx.strokeStyle = color;
      activeCtx.lineWidth = brushSize;
    }

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

    activeCtx.globalCompositeOperation = "source-over";
    tempCtx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // Salva nello storico
    undoStacksRef.current[activeLayerId].push(activeCanvas.toDataURL());
    redoStacksRef.current[activeLayerId] = [];

    // Segna modifiche non salvate (salvataggio manuale)
    setHasUnsavedChanges(true);
    setSaveStatus("unsaved");
  }

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

  const toggleLayerVisibility = (id: string) => {
    setLayers(
      layers.map((l) => {
        if (l.id === id) {
          return { ...l, visible: !l.visible };
        }
        return l;
      })
    );
    setHasUnsavedChanges(true);
    setSaveStatus("unsaved");
  };

  return (
    <div className="h-[calc(100vh-60px)] md:h-screen flex overflow-hidden relative select-none">
      
      {/* ── AREA DI DISEGNO CENTRALE ── */}
      <div className="flex-1 flex flex-col relative h-full bg-[#090b0f] overflow-hidden">
        
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
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 border border-white/5 text-white/80 hover:bg-white/10 transition-all text-sm flex-shrink-0 cursor-pointer text-white"
              >
                ⬅
              </button>
            ) : (
              <Link
                href="/sketches"
                className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 border border-white/5 text-white/80 hover:bg-white/10 transition-all text-sm flex-shrink-0"
              >
                ⬅
              </Link>
            )}
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

          {/* Stato e Pulsante di Salvataggio MANUALE (Premium & Visibile) */}
          <div className="flex items-center gap-2">
            {/* Tasto Reset Zoom */}
            {scale !== 1 && (
              <button
                onClick={resetZoom}
                className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 transition-all"
                title="Centra foglio e reset zoom"
              >
                🔍 Reset ({Math.round(scale * 100)}%)
              </button>
            )}

            {/* Stato Salvataggio */}
            {saveStatus === "unsaved" && (
              <span className="text-[10px] text-orange-400 font-bold bg-orange-400/5 px-2.5 py-1.5 rounded-xl border border-orange-400/15 animate-pulse">
                ● Modificato
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="text-[10px] text-emerald-400 font-bold bg-emerald-400/5 px-2.5 py-1.5 rounded-xl border border-emerald-400/15">
                ✓ Salvato
              </span>
            )}

            {/* Pulsante SALVA Disegno manuale */}
            <button
              onClick={handleSaveManual}
              disabled={saveStatus === "saving" || !hasUnsavedChanges}
              className="py-1.5 px-3 rounded-xl font-bold text-xs text-white transition-all shadow-md disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
              style={{
                background: hasUnsavedChanges 
                  ? "linear-gradient(135deg, hsl(24 95% 50%), hsl(16 100% 50%))" 
                  : "hsl(220 26% 14%)",
                border: "1px solid " + (hasUnsavedChanges ? "hsl(24 95% 50% / 0.5)" : "hsl(220 20% 20%)"),
              }}
            >
              {saveStatus === "saving" ? (
                <>
                  <span className="w-3 h-3 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                  Salvo...
                </>
              ) : (
                <>💾 Salva</>
              )}
            </button>

            {/* Impostazioni Sketch */}
            {!onClose && (
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 text-white/80 hover:bg-white/10 transition-all text-xs cursor-pointer"
              >
                ⚙️
              </button>
            )}
          </div>
        </div>

        {/* WORKSPACE DI DISEGNO CON SUPPORTI TOUCH GESTURE ZOOM/PAN */}
        <div
          ref={containerRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="flex-1 w-full h-full flex items-center justify-center relative touch-none select-none"
          style={{ 
            paddingTop: "76px", 
            paddingRight: "0px", // Rimosso padding per mobile
          }}
        >
          {/* FOGLIO DA DISEGNO 3:4 CON OMBRA E SCALATURA GPU FLUIDISSIMA */}
          <div
            ref={workspaceRef}
            className="relative shadow-[0_25px_60px_rgba(0,0,0,0.6)] border border-white/10 rounded-3xl overflow-hidden aspect-[3/4] transition-transform duration-75 ease-out"
            style={{
              width: "92%",
              height: "92%",
              maxWidth: "calc((100vh - 150px) * 0.75)",
              maxHeight: "calc(100vh - 150px)",
              background: "hsl(228 39% 7%)",
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, // Accelerazione hardware GPU e spostamento
              transformOrigin: "center center"
            }}
          >
            {/* Griglia */}
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

        {/* ── BARRA STRUMENTI MOBILE PERSISTENTE (Orizzontale in basso, solo mobile) ── */}
        <div
          className="md:hidden fixed bottom-4 left-4 right-4 z-30 px-3 py-2 rounded-2xl border flex items-center justify-between gap-1 shadow-2xl"
          style={{
            background: "hsl(220 35% 12% / 0.95)",
            backdropFilter: "blur(12px)",
            borderColor: "hsl(220 20% 16%)",
          }}
        >
          {/* Strumento Penna / Gomma alternato */}
          <button
            onClick={() => setTool(tool === "pen" ? "eraser" : "pen")}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-base active:scale-90 transition-all"
            style={{
              background: tool === "pen" ? "hsl(220 90% 56% / 0.15)" : "hsl(350 90% 56% / 0.15)",
              border: "1px solid " + (tool === "pen" ? "hsl(220 90% 56% / 0.3)" : "hsl(350 90% 56% / 0.3)"),
              color: "white",
            }}
          >
            {tool === "pen" ? "✏️" : "🧼"}
          </button>

          {/* Palette Colori Premium Rapida */}
          {tool !== "eraser" && (
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-[120px] px-1 scrollbar-none">
              {premiumColors.slice(0, 5).map((hex) => {
                const isSelected = color === hex;
                return (
                  <button
                    key={hex}
                    onClick={() => setColor(hex)}
                    className="w-5.5 h-5.5 rounded-full border transition-all flex-shrink-0 active:scale-75"
                    style={{
                      backgroundColor: hex,
                      borderColor: isSelected ? "white" : "white/10",
                      transform: isSelected ? "scale(1.2)" : "scale(1)",
                      boxShadow: isSelected ? `0 0 8px ${hex}` : "none",
                    }}
                  />
                );
              })}
            </div>
          )}

          {/* Dimensione Tratto Ciclica */}
          <button
            onClick={() => {
              const nextSizes = [4, 8, 12, 16, 24];
              const currentIndex = nextSizes.indexOf(brushSize);
              const nextIndex = (currentIndex + 1) % nextSizes.length;
              setBrushSize(nextSizes[nextIndex]);
            }}
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center justify-center active:scale-95 transition-all text-white/80"
          >
            <span className="text-[10px] leading-none">📏</span>
            <span className="text-[8px] font-extrabold mt-0.5">{brushSize}px</span>
          </button>

          {/* Calcolatrice rapida */}
          <button
            onClick={() => setShowCalc(true)}
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-sm active:scale-95 transition-all"
          >
            🧮
          </button>

          {/* Gestore Livelli & Misure (Apre drawer completo) */}
          <button
            onClick={() => setToolsOpen(true)}
            className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center text-sm active:scale-95 transition-all"
          >
            🥞
          </button>

          {/* Undo / Redo */}
          <div className="flex gap-1">
            <button
              onClick={handleUndo}
              className="w-8.5 h-8.5 rounded-lg bg-white/5 border border-white/10 text-white flex items-center justify-center text-xs active:scale-90 transition-all"
            >
              ↩
            </button>
            <button
              onClick={handleRedo}
              className="w-8.5 h-8.5 rounded-lg bg-white/5 border border-white/10 text-white flex items-center justify-center text-xs active:scale-90 transition-all"
            >
              ↪
            </button>
          </div>
        </div>

        {/* ── BARRA STRUMENTI DESKTOP LATERALE FLUTTUANTE A DESTRA (Hidden su Mobile) ── */}
        <div
          className="hidden md:flex absolute right-3 top-[76px] bottom-3 w-14 z-30 py-3 rounded-2xl border flex flex-col justify-between items-center gap-3 shadow-lg"
          style={{
            background: "hsl(220 35% 12% / 0.95)",
            backdropFilter: "blur(12px)",
            borderColor: "hsl(220 20% 16%)",
          }}
        >
          {/* Strumenti Principali */}
          <div className="flex flex-col gap-2 items-center w-full">
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

            {/* Slider Spessore */}
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

            {/* Colore Selezionato */}
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

          {/* Livelli e Azioni */}
          <div className="flex flex-col gap-2 items-center w-full">
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

            <button
              onClick={() => {
                setShowCalc(true);
                setSidebarOpen(false);
                setLayersOpen(false);
              }}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer text-base"
              style={{
                background: showCalc ? "hsl(220 90% 56%)" : "bg-white/5",
              }}
              title="Calcolatrice"
            >
              🧮
            </button>

            <div className="w-8 h-[1px] bg-white/5 my-1" />

            <button
              onClick={handleUndo}
              className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 transition-all flex items-center justify-center text-xs"
              title="Annulla"
            >
              ↩
            </button>

            <button
              onClick={handleRedo}
              className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 transition-all flex items-center justify-center text-xs"
              title="Ripristina"
            >
              ↪
            </button>

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

      {/* ── SIDEBAR STRUMENTI COMPLETA PER MOBILE (Drawer a comparsa laterale destra) ── */}
      {toolsOpen && (
        <aside
          className="fixed md:hidden top-0 right-0 h-full w-72 z-[1000] border-l flex flex-col transition-all duration-300 animate-slide-left p-4 space-y-4"
          style={{
            background: "hsl(220 32% 10% / 0.98)",
            backdropFilter: "blur(20px)",
            borderColor: "hsl(220 20% 16%)",
            boxShadow: "-10px 0 40px rgba(0,0,0,0.6)",
          }}
        >
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <h3 className="text-white font-bold text-xs uppercase tracking-wider">🛠️ Strumenti Disegno</h3>
            <button onClick={() => setToolsOpen(false)} className="text-xs text-white/40 hover:text-white bg-white/5 w-6 h-6 rounded-full flex items-center justify-center">
              ✕
            </button>
          </div>

          {/* Penna o Gomma */}
          <div className="flex gap-2">
            <button
              onClick={() => { setTool("pen"); setToolsOpen(false); }}
              className="flex-1 py-3.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5"
              style={{
                background: tool === "pen" ? "hsl(220 90% 56%)" : "hsl(220 26% 14%)",
                color: "white"
              }}
            >
              ✏️ Penna
            </button>
            <button
              onClick={() => { setTool("eraser"); setToolsOpen(false); }}
              className="flex-1 py-3.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5"
              style={{
                background: tool === "eraser" ? "hsl(220 90% 56%)" : "hsl(220 26% 14%)",
                color: "white"
              }}
            >
              🧼 Gomma
            </button>
          </div>

          {/* Dimensione Tratto */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-white/40 uppercase font-bold">Dimensione Tratto ({brushSize}px)</label>
            <input
              type="range"
              min="2"
              max="24"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              className="w-full accent-orange-500 h-2 rounded-lg cursor-pointer"
            />
          </div>

          <div className="border-t border-white/5 pt-3">
            <label className="text-[10px] text-white/40 uppercase font-bold block mb-2">🥞 Livelli CAD</label>
            <div className="space-y-1.5">
              {layers.map((layer) => {
                const isActive = activeLayerId === layer.id;
                return (
                  <div
                    key={layer.id}
                    onClick={() => setActiveLayerId(layer.id)}
                    className="flex items-center justify-between p-2 rounded-lg border cursor-pointer"
                    style={{
                      background: isActive ? "hsl(220 26% 16%)" : "transparent",
                      borderColor: isActive ? "hsl(220 90% 56% / 0.4)" : "white/5",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span>{layer.icon}</span>
                      <span className="text-[11px] text-white/80">{layer.name}</span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(layer.id); }}
                      className="w-6 h-6 rounded bg-white/5 flex items-center justify-center text-xs"
                    >
                      {layer.visible ? "👁️" : "🙈"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Palette Colori */}
          {tool !== "eraser" && (
            <div className="border-t border-white/5 pt-3 space-y-2">
              <label className="text-[10px] text-white/40 uppercase font-bold block">🎨 Palette Colori</label>
              <div className="grid grid-cols-5 gap-1.5">
                {premiumColors.map((hex) => (
                  <button
                    key={hex}
                    onClick={() => { setColor(hex); setToolsOpen(false); }}
                    className="w-8 h-8 rounded-lg border transition-all"
                    style={{
                      backgroundColor: hex,
                      borderColor: color === hex ? "white" : "transparent"
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Azioni Undo / Redo */}
          <div className="border-t border-white/5 pt-4 flex gap-2 justify-between">
            <button onClick={handleUndo} className="flex-1 py-2 bg-white/5 text-white/80 rounded-xl text-xs font-semibold">
              ↩ Undo
            </button>
            <button onClick={handleRedo} className="flex-1 py-2 bg-white/5 text-white/80 rounded-xl text-xs font-semibold">
              ↪ Redo
            </button>
            <button onClick={handleClearAll} className="px-3 py-2 bg-red-500/10 text-red-400 rounded-xl text-xs font-semibold">
              🗑️ Reset
            </button>
          </div>

          {/* Pulsante consultazione misure */}
          {sketch.level_id && (
            <button
              onClick={() => {
                setSidebarOpen(true);
                setToolsOpen(false);
              }}
              className="w-full py-3 bg-white/5 text-white rounded-xl text-xs font-bold border border-white/10"
            >
              📋 Leggi Misure di Cantiere
            </button>
          )}
        </aside>
      )}

      {/* ── SIDEBAR LIVELLI DESKTOP (Drawer a destra) ── */}
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
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(layer.id); }}
                    className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-xs"
                  >
                    {layer.visible ? "👁️" : "🙈"}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="border-t border-white/5 pt-3">
            <h4 className="text-[10px] text-white/40 uppercase font-bold tracking-wider mb-2">🎨 Palette Avanzata</h4>
            <div className="grid grid-cols-4 gap-2">
              {premiumColors.map((hex) => (
                <button
                  key={hex}
                  onClick={() => setColor(hex)}
                  className="w-10 h-10 rounded-xl border transition-all"
                  style={{
                    backgroundColor: hex,
                    borderColor: color === hex ? "white" : "transparent"
                  }}
                />
              ))}
            </div>
          </div>
        </aside>
      )}

      {/* ── SIDEBAR DETTAGLIO MISURE (Right Drawer) ── */}
      {sidebarOpen && sketch.level_id && (
        <aside
          className="fixed md:absolute top-0 md:top-[76px] right-0 md:right-16 h-full md:bottom-3 w-80 md:w-96 z-[1001] border-l md:border rounded-r-none md:rounded-2xl flex flex-col transition-all duration-300 animate-slide-left"
          style={{
            background: "hsl(220 32% 10% / 0.98)",
            backdropFilter: "blur(20px)",
            borderColor: "hsl(220 20% 16%)",
            boxShadow: "-10px 10px 40px rgba(0,0,0,0.6)",
          }}
        >
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <div>
              <h3 className="text-white font-bold text-xs uppercase tracking-wider">📋 Rilievi di Cantiere</h3>
              <p className="text-[9px] text-white/40 mt-0.5">Misure registrate</p>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="text-white/40 hover:text-white bg-white/5 w-8 h-8 rounded-full flex items-center justify-center">
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
                    <span className="px-2 py-0.5 rounded text-[9px] font-extrabold text-white" style={{ background: "hsl(24 95% 50%)" }}>
                      N° {note.note_number}
                    </span>
                    <span className="text-[9px] font-bold text-white/50 uppercase tracking-wider">
                      {note.type_name || "Generico"}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-white/80">
                    {note.field_note_items?.length === 0 ? (
                      <p className="text-[10px] text-white/40 italic">Nessuna misura.</p>
                    ) : (
                      note.field_note_items?.map((item: any) => {
                        const type = item.item_type;
                        if (type === "header") {
                          return <div key={item.id} className="text-xs font-bold text-orange-400 pt-1">{item.value_text}</div>;
                        }
                        if (type === "text") {
                          return <div key={item.id} className="bg-white/5 p-1.5 rounded-lg">💬 {item.value_text}</div>;
                        }
                        if (type === "number") {
                          return (
                            <div key={item.id} className="flex justify-between">
                              <span className="text-white/50">Misura:</span>
                              <span className="font-bold text-emerald-400">{item.value_num} {item.value_unit || "m"}</span>
                            </div>
                          );
                        }
                        if (type === "boolean") {
                          return (
                            <div key={item.id} className="flex justify-between">
                              <span className="text-white/50">Stato:</span>
                              <span className="font-bold text-white">{item.value_bool ? "🟢 SÌ" : "🔴 NO"}</span>
                            </div>
                          );
                        }
                        if (type === "livella") {
                          return <div key={item.id} className="text-emerald-400 bg-emerald-500/5 p-1.5 rounded border border-emerald-500/10">📐 {item.value_text}</div>;
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

      {/* MODALE IMPOSTAZIONI */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
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

      {/* Calcolatrice in Sketch */}
      <CalcolatriceWidget
        isOpen={showCalc}
        onClose={() => setShowCalc(false)}
        showImportButton={!!sketch.level_id}
      />
    </div>
  );
}
