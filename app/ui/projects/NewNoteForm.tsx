"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  createFieldNote,
  updateFieldNote,
  createNoteType,
  deleteFieldNote,
  type FieldNoteType,
  type FieldNoteItem,
  type FieldNote,
} from "@/app/actions/field-notes";
import PlanimetriaMappa from "./PlanimetriaMappa";
import PhotoQuotaEditor from "./PhotoQuotaEditor";
import SketchEditorClient from "@/app/ui/sketches/SketchEditorClient";
import LivellaBolla from "./LivellaBolla";
import CalcolatriceWidget from "@/app/ui/dashboard/CalcolatriceWidget";
import { useOfflineStore } from "@/lib/stores/offline-store";
import type { Material } from "@/lib/types/database";

const is3DModelUrl = (url?: string | null) => {
  if (!url) return false;
  return url.startsWith("data:model/") || url.startsWith("data:application/octet-stream") || url.startsWith("data:application/x-gltf") || url.endsWith(".glb") || url.endsWith(".gltf");
};

// ============================================
// Tipi interni
// ============================================

type ItemType = FieldNoteItem["item_type"];

interface NoteItemDraft {
  id: string; // local only
  item_type: ItemType;
  value_num?: number | null;
  value_unit?: "mm" | "cm";
  value_bool?: boolean;
  value_text?: string;       // nota/foto: testo/base64; composite: JSON
  composite?: CompositeValue; // solo per dim_quadrata / dim_cubica (live, non salvato raw)
}

const ITEM_LABELS: Record<ItemType, string> = {
  base: "Misura orizzontale",
  altezza: "Misura verticale",
  spessore: "Spessore",
  lana_interna: "Lana interna",
  dipintura: "Dipintura",
  nota: "Nota libera",
  foto: "Foto",
  dim_quadrata: "📐 Dimensione quadrata",
  dim_cubica: "⬛ Dimensioni cubiche",
  posizione: "📍 Segna posizione",
  materiale: "📦 Materiale",
};

const MEASURE_TYPES: ItemType[] = ["base", "altezza", "spessore"];
const BOOL_TYPES: ItemType[] = ["lana_interna", "dipintura"];
const COMPOSITE_TYPES: ItemType[] = ["dim_quadrata", "dim_cubica"];

// Struttura JSON per misure composite
interface CompositeValue {
  b?: number | null;
  h?: number | null;
  d?: number | null;
  q?: number | null;
  unit: "mm" | "cm";
  isCutPiece?: boolean;
  refTitle?: string;
}

// ============================================
// Props
// ============================================

interface Props {
  projectId: string;
  levelId: string;       // livello (piano 2D/3D) a cui appartiene l'appunto
  noteTypes: FieldNoteType[];
  initialNote?: FieldNote; // se presente, siamo in modalità modifica
  /** URL della planimetria del livello (per Segna Posizione) */
  planImageUrl?: string | null;
  /** Numero appunto corrente (per il marker "in attesa") */
  nextNoteNumber?: number;
  /** Note già salvate del livello (per mostrare i punti esistenti) */
  levelNotes?: FieldNote[];
  /** Catalogo dei materiali */
  catalogMaterials?: Material[];
}

// ============================================
// Componente principale
// ============================================

export default function NewNoteForm({ projectId, levelId, noteTypes, initialNote, planImageUrl, nextNoteNumber, levelNotes, catalogMaterials = [] }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [mounted, setMounted] = useState(false);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const cachedNote = useOfflineStore((state) => state.fieldNotes[initialNote?.id ?? ""]);
  const noteToUse = (mounted && cachedNote) ? cachedNote : initialNote;

  // --- Voci misure ---
  const [items, setItems] = useState<NoteItemDraft[]>([]);

  useEffect(() => {
    if (noteToUse?.field_note_items && noteToUse.field_note_items.length > 0) {
      const shouldInitialize = !hasInitializedRef.current || (mounted && cachedNote && cachedNote.updated_at !== initialNote?.updated_at);

      if (shouldInitialize) {
        setItems(
          noteToUse.field_note_items.map((item) => {
            const isComposite = item.item_type === "dim_quadrata" || item.item_type === "dim_cubica";
            let composite: CompositeValue | undefined;
            if (isComposite && item.value_text) {
              try {
                const parsed = JSON.parse(item.value_text);
                composite = {
                  ...parsed,
                  isCutPiece: parsed.isCutPiece || (parsed.q !== undefined && parsed.q !== null),
                };
              } catch {
                composite = { unit: "cm" };
              }
            }
            return {
              id: item.id || crypto.randomUUID(),
              item_type: item.item_type,
              value_num: item.value_num,
              value_unit: (item.value_unit as "mm" | "cm") ?? "cm",
              value_bool: item.value_bool ?? true,
              value_text: isComposite ? undefined : (item.value_text ?? undefined),
              composite,
            };
          })
        );
        hasInitializedRef.current = true;
      }
    }
  }, [noteToUse, mounted, cachedNote, initialNote]);

  // Stato per l'autofocus dell'ultimo elemento inserito
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);

  // Store offline Zustand
  const isOnline = useOfflineStore((state) => state.isOnline);
  const setCatalogMaterialsCache = useOfflineStore((state) => state.setCatalogMaterialsCache);
  const setNoteTypesCache = useOfflineStore((state) => state.setNoteTypesCache);
  const saveFieldNoteItemsOptimistic = useOfflineStore((state) => state.saveFieldNoteItemsOptimistic);
  const deleteFieldNoteOptimistic = useOfflineStore((state) => state.deleteFieldNoteOptimistic);

  // Carica i materiali e i tipi di note nella cache offline
  useEffect(() => {
    setCatalogMaterialsCache(catalogMaterials);
    setNoteTypesCache(noteTypes);
  }, [catalogMaterials, noteTypes, setCatalogMaterialsCache, setNoteTypesCache]);

  // --- Calcolatrice ---
  const [showCalc, setShowCalc] = useState(false);


  useEffect(() => {
    const handleImportCalc = (e: Event) => {
      const customEvent = e as CustomEvent<{ calculation: string }>;
      if (customEvent.detail && customEvent.detail.calculation) {
        const formula = customEvent.detail.calculation;
        const draft: NoteItemDraft = {
          id: crypto.randomUUID(),
          item_type: "nota",
          value_text: `🧮 Calcolo: ${formula}`,
        };
        setItems((prev) => [...prev, draft]);
        setShowCalc(false);
      }
    };

    window.addEventListener("webcad-import-calc", handleImportCalc);
    return () => {
      window.removeEventListener("webcad-import-calc", handleImportCalc);
    };
  }, []);

  // --- Tipo appunto ---
  const [typeFilter, setTypeFilter] = useState(initialNote?.type_name ?? "");
  const [selectedType, setSelectedType] = useState<FieldNoteType | null>(
    initialNote?.type_id ? noteTypes.find((t) => t.id === initialNote.type_id) ?? null : null
  );
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [allTypes, setAllTypes] = useState<FieldNoteType[]>(noteTypes);
  const [isCreatingType, setIsCreatingType] = useState(false);
  const typeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mounted && cachedNote) {
      if (cachedNote.type_name) {
        setTypeFilter(cachedNote.type_name);
        const found = noteTypes.find((t) => t.name.toLowerCase() === cachedNote.type_name!.toLowerCase());
        if (found) setSelectedType(found);
      }
    } else if (noteToUse) {
      if (noteToUse.type_name && !typeFilter) {
        setTypeFilter(noteToUse.type_name);
      }
      if (noteToUse.type_id && !selectedType) {
        const found = noteTypes.find((t) => t.id === noteToUse.type_id);
        if (found) setSelectedType(found);
      } else if (!selectedType && noteToUse.type_name) {
        const found = noteTypes.find((t) => t.name.toLowerCase() === noteToUse.type_name!.toLowerCase());
        if (found) setSelectedType(found);
      }
    }
  }, [noteToUse, noteTypes, typeFilter, selectedType, mounted, cachedNote]);

  // Auto-inizializzazione per Sketch e Report 3D
  useEffect(() => {
    if (typeFilter === "Sketch" || selectedType?.name === "Sketch") {
      const hasNota = items.some(i => i.item_type === "nota");
      const hasFoto = items.some(i => i.item_type === "foto");
      if (!hasNota || !hasFoto) {
        const newItems = [...items];
        if (!hasNota) {
          newItems.push({ id: crypto.randomUUID(), item_type: "nota", value_text: initialNote?.field_note_items?.find(i => i.item_type === "nota")?.value_text || "" });
        }
        if (!hasFoto) {
          const canvas = document.createElement("canvas");
          canvas.width = 1200;
          canvas.height = 1200;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, 1200, 1200);
            ctx.strokeStyle = "#e2e8f0";
            ctx.lineWidth = 1;
            for (let i = 0; i < 1200; i += 40) {
              ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 1200); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(1200, i); ctx.stroke();
            }
          }
          const emptySketchBase64 = canvas.toDataURL("image/png");
          newItems.push({ id: crypto.randomUUID(), item_type: "foto", value_text: emptySketchBase64 });
        }
        setItems(newItems);
      }
    } else if (typeFilter === "Report 3D" || selectedType?.name === "Report 3D") {
      const hasNota = items.some(i => i.item_type === "nota");
      if (!hasNota) {
        setItems(prev => [...prev, { id: crypto.randomUUID(), item_type: "nota", value_text: initialNote?.field_note_items?.find(i => i.item_type === "nota")?.value_text || "" }]);
      }
    }
  }, [typeFilter, selectedType]);

  const filteredTypes = allTypes.filter((t) =>
    t.name.toLowerCase().includes(typeFilter.toLowerCase())
  );
  const noMatch = typeFilter.trim() !== "" && filteredTypes.length === 0;

  const [showItemDropdown, setShowItemDropdown] = useState(false);

  // --- Posizione in selezione (apre la mappa) ---
  const [posizionePickingId, setPosizionePickingId] = useState<string | null>(null);

  // --- Stati per Foto Quotata & Livella ---
  const [showLivella, setShowLivella] = useState(false);
  const [editingFotoId, setEditingFotoId] = useState<string | null>(null);
  const [editingFotoUrl, setEditingFotoUrl] = useState<string | null>(null);
  const [editingSketchId, setEditingSketchId] = useState<string | null>(null);
  const [editingSketchUrl, setEditingSketchUrl] = useState<string | null>(null);

  // --- Errori ---
  const [error, setError] = useState<string | null>(null);

  // Gestore per catturare l'inclinazione della livella ed inserirla come nota + foto unificata
  function handleCaptureLivella(text: string, photoBase64?: string | null) {
    if (photoBase64) {
      // Inserisce lo snapshot fotografico della bolla (tipo foto)
      const fotoDraft: NoteItemDraft = {
        id: crypto.randomUUID(),
        item_type: "foto",
        value_text: photoBase64,
      };
      
      // Inserisce la nota descrittiva dell'allineamento (tipo nota)
      const notaDraft: NoteItemDraft = {
        id: crypto.randomUUID(),
        item_type: "nota",
        value_text: text,
      };
      
      setItems((prev) => [...prev, fotoDraft, notaDraft]);
    } else {
      // Inserisce solo il testo descrittivo se non è disponibile lo stream video
      const draft: NoteItemDraft = {
        id: crypto.randomUUID(),
        item_type: "nota",
        value_text: text,
      };
      setItems((prev) => [...prev, draft]);
    }
    setShowLivella(false);
  }

  // ============================================
  // Handlers tipo
  // ============================================

  function selectType(t: FieldNoteType) {
    setSelectedType(t);
    setTypeFilter(t.name);
    setShowTypeDropdown(false);
  }

  async function handleQuickCreateType() {
    const name = typeFilter.trim();
    if (!name) return;
    setIsCreatingType(true);
    const res = await createNoteType(name);
    setIsCreatingType(false);
    if (res.success && res.type) {
      setAllTypes((prev) => [...prev, res.type!].sort((a, b) => a.name.localeCompare(b.name)));
      selectType(res.type);
    } else {
      setError(res.error ?? "Errore nella creazione del tipo");
    }
  }

  // ============================================
  // Handlers voci
  // ============================================

  function addItem(itemType: ItemType, options?: { isCutPiece?: boolean }) {
    const newId = crypto.randomUUID();
    const draft: NoteItemDraft = {
      id: newId,
      item_type: itemType,
      value_unit: "cm",
      value_bool: true,
      // per dimensioni composite inizializziamo subito il composite
      composite: COMPOSITE_TYPES.includes(itemType)
        ? { 
            b: null, 
            h: null, 
            d: null, 
            q: options?.isCutPiece ? 1 : null, 
            unit: "cm",
            isCutPiece: options?.isCutPiece 
          }
        : undefined,
    };
    setItems((prev) => [...prev, draft]);
    setLastAddedId(newId);
    setShowItemDropdown(false);
  }

  function updateItem(id: string, changes: Partial<NoteItemDraft>) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...changes } : item))
    );
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  // ============================================
  // Submit
  // ============================================

  function handleSave() {
    setError(null);
    startTransition(async () => {
      let finalType = selectedType;

      // Se l'utente ha scritto un tipo nuovo (o non ha cliccato nel dropdown)
      if (!finalType && typeFilter.trim()) {
        const match = allTypes.find((t) => t.name.toLowerCase() === typeFilter.trim().toLowerCase());
        if (match) {
          finalType = match;
        } else {
          // Creiamo il nuovo tipo al volo in background
          setIsCreatingType(true);
          const createRes = await createNoteType(typeFilter.trim());
          setIsCreatingType(false);
          if (createRes.success && createRes.type) {
            finalType = createRes.type;
            setAllTypes((prev) => [...prev, createRes.type!].sort((a, b) => a.name.localeCompare(b.name)));
          } else {
            setError(createRes.error ?? "Errore nella creazione automatica del tipo di appunto");
            return;
          }
        }
      }

      if (!finalType) {
        setError("Seleziona o scrivi un tipo di appunto valido.");
        return;
      }

      const payload = {
        project_id: projectId,
        level_id: levelId,
        type_id: finalType.id,
        type_name: finalType.name,
        items: items.map((item, idx) => ({
          item_type: item.item_type,
          value_num: MEASURE_TYPES.includes(item.item_type) ? (item.value_num ?? null) : null,
          value_unit: MEASURE_TYPES.includes(item.item_type) ? (item.value_unit ?? "cm") : null,
          value_bool: BOOL_TYPES.includes(item.item_type) ? (item.value_bool ?? true) : null,
          // nota, foto e posizione usano value_text; composite salvano JSON in value_text
          value_text:
            (item.item_type === "nota" || item.item_type === "foto" || item.item_type === "posizione" || item.item_type === "materiale")
              ? (item.value_text ?? null)
              : COMPOSITE_TYPES.includes(item.item_type)
              ? JSON.stringify(item.composite ?? {})
              : null,
          sort_order: idx,
        })),
      };

      if (!isOnline || levelId.startsWith("temp_") || (initialNote && initialNote.id.startsWith("temp_"))) {
        // Salvataggio offline ottimistico (in coda) per preservare la risoluzione referenziale dei Temp ID
        const noteId = initialNote ? initialNote.id : `temp-note-${Date.now()}`;
        saveFieldNoteItemsOptimistic(noteId, projectId, levelId, payload.items, finalType.name);
        router.push(`/projects/${projectId}`);
        return;
      }

      const res = initialNote 
        ? await updateFieldNote(initialNote.id, payload)
        : await createFieldNote(payload);

      if (res.success) {
        router.push(`/projects/${projectId}`);
      } else {
        setError(res.error ?? "Errore durante il salvataggio");
      }
    });
  }

  function handleDelete() {
    if (!initialNote) return;
    const confermata = window.confirm("Sei sicuro di voler eliminare definitivamente questo appunto?");
    if (!confermata) return;

    setError(null);
    startTransition(async () => {
      if (!isOnline || initialNote.id.startsWith("temp_")) {
        deleteFieldNoteOptimistic(initialNote.id, projectId);
        router.push(`/projects/${projectId}`);
        return;
      }

      const res = await deleteFieldNote(initialNote.id, projectId);
      if (res.success) {
        router.push(`/projects/${projectId}`);
      } else {
        setError(res.error ?? "Errore durante l'eliminazione dell'appunto");
      }
    });
  }


  // ============================================
  // JSX
  // ============================================

  const isSketch = typeFilter === "Sketch" || selectedType?.name === "Sketch";
  const has3DModel = items.some(i => i.item_type === "foto" && is3DModelUrl(i.value_text));
  const isReport3D = typeFilter === "Report 3D" || selectedType?.name === "Report 3D" || has3DModel;
  const isTaglio = typeFilter === "Taglio" || selectedType?.name === "Taglio";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Errore globale */}
      {error && (
        <div
          className="px-4 py-3 rounded-xl text-sm"
          style={{ background: "hsl(0 70% 15%)", color: "hsl(0 80% 70%)", border: "1px solid hsl(0 70% 25%)" }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* ── Tipo appunto (Automatico e Leggibile) ── */}
      <div
        className="rounded-2xl p-4 flex items-center justify-between gap-4"
        style={{ background: "hsl(220 26% 14%)", border: "1px solid hsl(220 20% 20%)" }}
      >
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-white/40 mb-1">
            Tipo di Appunto
          </label>
          <div className="text-sm font-bold text-white flex items-center gap-2">
            {isSketch ? (
              <>
                <span className="text-base">🎨</span>
                <span>Sketch (Disegno / Schema)</span>
              </>
            ) : isReport3D ? (
              <>
                <span className="text-base">📦</span>
                <span>Report 3D (Modello CAD)</span>
              </>
            ) : isTaglio ? (
              <>
                <span className="text-base">✂️</span>
                <span>Taglio Raggruppato (Nesting)</span>
              </>
            ) : (
              <>
                <span className="text-base">📝</span>
                <span>Nota di Cantiere (Misure)</span>
              </>
            )}
          </div>
        </div>

        <div
          className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full font-mono"
          style={{
            background: isSketch
              ? "rgba(245, 158, 11, 0.15)"
              : isReport3D
              ? "rgba(168, 85, 247, 0.15)"
              : isTaglio
              ? "rgba(16, 185, 129, 0.15)"
              : "rgba(14, 165, 233, 0.15)",
            color: isSketch ? "#fbbf24" : isReport3D ? "#c084fc" : isTaglio ? "#10b981" : "#38bdf8",
            border: `1px solid ${
              isSketch ? "rgba(245, 158, 11, 0.3)" : isReport3D ? "rgba(168, 85, 247, 0.3)" : isTaglio ? "rgba(16, 185, 129, 0.3)" : "rgba(14, 165, 233, 0.3)"
            }`,
          }}
        >
          {isSketch ? "Sketch" : isReport3D ? "Report 3D" : isTaglio ? "Taglio" : "Nota"}
        </div>
      </div>


      {/* ── Voci / Misure o UI Specializzate ── */}
      <div
        className="rounded-2xl p-4 space-y-4"
        style={{ background: "hsl(220 26% 14%)", border: "1px solid hsl(220 20% 20%)" }}
      >
        {isSketch ? (
          (() => {
            const sketchTitleItem = items.find(i => i.item_type === "nota");
            const sketchFotoItem = items.find(i => i.item_type === "foto");
            return (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-white/60 uppercase mb-1">
                    Titolo dello Sketch
                  </label>
                  <input
                    type="text"
                    value={sketchTitleItem?.value_text ?? ""}
                    onChange={(e) => {
                      if (sketchTitleItem) {
                        updateItem(sketchTitleItem.id, { value_text: e.target.value });
                      }
                    }}
                    placeholder="es. Schema quadro elettrico, Dettaglio tubazioni..."
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                    style={{
                      background: "hsl(220 32% 10%)",
                      border: "1px solid hsl(220 20% 22%)",
                      color: "hsl(210 40% 96%)",
                    }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white/60 uppercase mb-1">
                    Disegno (Foglio Millimetrato)
                  </label>
                  
                  {sketchFotoItem?.value_text ? (
                    <div className="relative group rounded-2xl overflow-hidden border border-white/10 bg-white p-2.5 flex flex-col items-center gap-4">
                      <img
                        src={sketchFotoItem.value_text}
                        alt="Sketch"
                        className="max-h-[350px] object-contain rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (sketchFotoItem) {
                            setEditingSketchId(sketchFotoItem.id);
                            setEditingSketchUrl(sketchFotoItem.value_text!);
                          }
                        }}
                        className="px-6 py-2.5 rounded-xl text-xs font-bold text-white transition-all bg-amber-500 hover:bg-amber-600 active:scale-95 flex items-center gap-2 cursor-pointer shadow-md"
                      >
                        ✏️ Modifica con Sketch
                      </button>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-xs text-white/40 italic">
                      Generazione area da disegno in corso...
                    </div>
                  )}
                </div>
              </div>
            );
          })()
        ) : isReport3D ? (
          (() => {
            const reportTitleItem = items.find(i => i.item_type === "nota");
            const model3dItem = items.find(i => i.item_type === "foto" && is3DModelUrl(i.value_text));
            const snapshotItem = items.find(i => i.item_type === "foto" && !is3DModelUrl(i.value_text));
            return (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-white/60 uppercase mb-1">
                    Titolo del Report 3D
                  </label>
                  <input
                    type="text"
                    value={reportTitleItem?.value_text ?? ""}
                    onChange={(e) => {
                      if (reportTitleItem) {
                        updateItem(reportTitleItem.id, { value_text: e.target.value });
                      }
                    }}
                    placeholder="es. Assieme condotte piano 1, Vista assonometrica..."
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                    style={{
                      background: "hsl(220 32% 10%)",
                      border: "1px solid hsl(220 20% 22%)",
                      color: "hsl(210 40% 96%)",
                    }}
                  />
                </div>

                {!model3dItem ? (
                  <div className="p-6 rounded-2xl border border-dashed border-white/20 bg-white/[0.02] text-center space-y-3">
                    <div className="text-3xl">📦</div>
                    <div className="text-xs font-bold text-white">Carica un Modello 3D (Fusion 360 / FreeCAD)</div>
                    <p className="text-[10px] text-white/40 max-w-md mx-auto">
                      Supporta file in formato .glb o .gltf. Una volta caricato potrai ruotarlo e scattare foto quotate.
                    </p>
                    <input
                      type="file"
                      accept=".glb,.gltf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                          const resultUrl = evt.target?.result as string;
                          const newItems = [...items];
                          const existingModelIndex = newItems.findIndex(i => i.item_type === "foto" && is3DModelUrl(i.value_text));
                          if (existingModelIndex > -1) {
                            newItems[existingModelIndex].value_text = resultUrl;
                          } else {
                            newItems.push({ id: crypto.randomUUID(), item_type: "foto", value_text: resultUrl });
                          }
                          setItems(newItems);
                        };
                        reader.readAsDataURL(file);
                      }}
                      className="text-xs mx-auto text-white/60 cursor-pointer"
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold text-white/60 uppercase">
                          Modellatore 3D Attivo
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            removeItem(model3dItem.id);
                          }}
                          className="text-[10px] text-red-400 hover:text-red-300 font-bold cursor-pointer"
                        >
                          Sostituisci Modello 3D
                        </button>
                      </div>

                      <div className="rounded-2xl p-4 border border-sky-500/20 bg-sky-500/5 text-center space-y-2">
                        <span className="text-2xl">📦</span>
                        <p className="text-xs font-bold text-white">Modello CAD 3D Allegato con Successo</p>
                        <p className="text-[10px] text-white/50">
                          Il file CAD è memorizzato nel cloud ed è pronto per essere scaricato.
                        </p>
                        <a 
                          href={model3dItem.value_text!}
                          download="modello_cad.glb"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block mt-1 px-3 py-1.5 rounded-lg text-[10px] font-extrabold text-sky-400 bg-sky-500/10 border border-sky-500/20 hover:bg-sky-500/20 transition-all cursor-pointer"
                        >
                          📥 Scarica Modello CAD (GLB)
                        </a>
                      </div>
                    </div>

                    {(() => {
                      const snapshotItems = items.filter(i => i.item_type === "foto" && !is3DModelUrl(i.value_text));
                      if (snapshotItems.length === 0) return null;
                      return (
                        <div className="space-y-3">
                          <label className="block text-xs font-semibold text-white/60 uppercase">
                            📸 Snapshot Acquisiti ({snapshotItems.length})
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {snapshotItems.map((item) => {
                              const isIncluded = item.value_bool !== false;
                              return (
                                <div
                                  key={item.id}
                                  className="p-4 rounded-2xl border border-white/10 bg-white/[0.015] flex flex-col justify-between gap-3 animate-fade-in"
                                >
                                  <div className="relative group rounded-xl overflow-hidden border border-white/5 bg-white p-1.5 flex items-center justify-center h-28">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={item.value_text || ""}
                                      alt="Snapshot 3D"
                                      className="max-h-full object-contain rounded"
                                    />
                                  </div>

                                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-2.5">
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          updateItem(item.id, { value_bool: !isIncluded });
                                        }}
                                        className={`px-2.5 py-1.5 rounded-lg text-[9px] font-bold cursor-pointer transition-all border ${
                                          isIncluded
                                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                            : "bg-white/5 text-white/40 border-white/5 hover:text-white"
                                        }`}
                                        title={isIncluded ? "Clicca per escludere dal report" : "Clicca per includere nel report"}
                                      >
                                        {isIncluded ? "✓ Nel Report" : "🙈 Escluso"}
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingFotoId(item.id);
                                          setEditingFotoUrl(item.value_text!);
                                        }}
                                        className="p-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 rounded-lg text-[9px] font-bold cursor-pointer transition-colors"
                                        title="Modifica quote grafiche"
                                      >
                                        ✏️ Quota
                                      </button>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => removeItem(item.id)}
                                      className="p-1.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded-lg text-[9px] font-bold cursor-pointer transition-colors"
                                      title="Elimina snapshot"
                                    >
                                      🗑️ Rimuovi
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })()
        ) : (
          <>
            {/* Titolo dell'Appunto */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-white/60 uppercase mb-1">
                Titolo dell&apos;Appunto
              </label>
              <input
                type="text"
                value={items.find((i) => i.item_type === "nota")?.value_text ?? ""}
                onChange={(e) => {
                  const titleItem = items.find((i) => i.item_type === "nota");
                  if (titleItem) {
                    updateItem(titleItem.id, { value_text: e.target.value });
                  } else {
                    const newId = crypto.randomUUID();
                    setItems((prev) => [
                      { id: newId, item_type: "nota", value_text: e.target.value, sort_order: 0 },
                      ...prev,
                    ]);
                  }
                }}
                placeholder="es. Rilievo Staffaggi, Misure Canali..."
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: "hsl(220 32% 10%)",
                  border: "1px solid hsl(220 20% 22%)",
                  color: "hsl(210 40% 96%)",
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <div />

              {/* Pulsanti Azioni Note */}
              <div className="flex items-center gap-2">
                {/* Bottone Calcolatrice */}
                <button
                  type="button"
                  onClick={() => setShowCalc(true)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-sm transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  style={{
                    background: "hsl(220 26% 18%)",
                    border: "1px solid hsl(220 20% 24%)",
                    boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
                  }}
                  title="Apri Calcolatrice Cantiere"
                >
                  🧮
                </button>

                {/* Bottone Livella a Bolla */}
              {!isTaglio && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowLivella(true)}
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-sm transition-all hover:scale-105 active:scale-95 cursor-pointer"
                    style={{
                      background: "hsl(220 26% 18%)",
                      border: "1px solid hsl(220 20% 24%)",
                      boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
                    }}
                    title="Apri Livella a Bolla"
                  >
                    🟢
                  </button>

                  {/* Pulsante "+" con dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowItemDropdown((p) => !p)}
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-lg transition-all"
                      style={{
                        background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
                        boxShadow: "0 4px 12px hsl(220 90% 56% / 0.3)",
                      }}
                    >
                      ＋
                    </button>

                    {showItemDropdown && (
                      <div
                        className="absolute right-0 mt-1 w-44 rounded-xl overflow-hidden z-50"
                        style={{
                          background: "hsl(220 26% 14%)",
                          border: "1px solid hsl(220 20% 22%)",
                          boxShadow: "0 12px 30px rgba(0,0,0,0.5)",
                        }}
                      >
                        {/* Voci Standard del Menu "+" */}
                        <button
                          type="button"
                          onClick={() => addItem("nota")}
                          className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition-colors text-[hsl(210,40%,90%)]"
                          style={{ borderBottom: "1px solid hsl(220 20% 18%)" }}
                        >
                          📝 Nota libera
                        </button>
                        <button
                          type="button"
                          onClick={() => addItem("foto")}
                          className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition-colors text-[hsl(210,40%,90%)]"
                          style={{ borderBottom: "1px solid hsl(220 20% 18%)" }}
                        >
                          📷 Foto o disegno
                        </button>
                        <button
                          type="button"
                          onClick={() => addItem("base")}
                          className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition-colors text-[hsl(210,40%,90%)]"
                          style={{ borderBottom: "1px solid hsl(220 20% 18%)" }}
                        >
                          ↔ Misura orizzontale
                        </button>
                        <button
                          type="button"
                          onClick={() => addItem("altezza")}
                          className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition-colors text-[hsl(210,40%,90%)]"
                          style={{ borderBottom: "1px solid hsl(220 20% 18%)" }}
                        >
                          ↕ Misura verticale
                        </button>
                        <button
                          type="button"
                          onClick={() => addItem("spessore")}
                          className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition-colors text-[hsl(210,40%,90%)]"
                          style={{ borderBottom: "1px solid hsl(220 20% 18%)" }}
                        >
                          ↗ Spessore
                        </button>
                        <button
                          type="button"
                          onClick={() => addItem("dim_quadrata")}
                          className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition-colors text-[hsl(210,40%,90%)]"
                          style={{ borderBottom: "1px solid hsl(220 20% 18%)" }}
                        >
                          📐 Dimensione quadrata
                        </button>
                        <button
                          type="button"
                          onClick={() => addItem("dim_quadrata", { isCutPiece: true })}
                          className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition-colors text-[hsl(210,40%,90%)]"
                          style={{ borderBottom: "1px solid hsl(220 20% 18%)" }}
                        >
                          ✂️ Pezzo da tagliare
                        </button>
                        <button
                          type="button"
                          onClick={() => addItem("dim_cubica")}
                          className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition-colors text-[hsl(210,40%,90%)]"
                          style={{ borderBottom: "1px solid hsl(220 20% 18%)" }}
                        >
                          ⬛ Dimensioni cubiche
                        </button>
                        <button
                          type="button"
                          onClick={() => addItem("materiale")}
                          className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition-colors text-[hsl(210,40%,90%)]"
                          style={{ borderBottom: "1px solid hsl(220 20% 18%)" }}
                        >
                          📦 Materiale
                        </button>
                        <button
                          type="button"
                          onClick={() => addItem("lana_interna")}
                          className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition-colors text-[hsl(210,40%,90%)]"
                          style={{ borderBottom: "1px solid hsl(220 20% 18%)" }}
                        >
                          🔥 Lana interna
                        </button>
                        <button
                          type="button"
                          onClick={() => addItem("dipintura")}
                          className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition-colors text-[hsl(210,40%,90%)]"
                          style={{ borderBottom: "1px solid hsl(220 20% 18%)" }}
                        >
                          🎨 Dipintura
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowLivella(true);
                            setShowItemDropdown(false);
                          }}
                          className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition-colors text-[hsl(210,40%,90%)]"
                          style={{ borderTop: "1px solid hsl(220 20% 18%)" }}
                        >
                          🟢 Livella a Bolla
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
              </div>
            </div>

            {items.length === 0 && (
              <p className="text-sm text-center py-6" style={{ color: "hsl(215 15% 40%)" }}>
                Premi ＋ per aggiungere misure e appunti.
              </p>
            )}

            <div className="space-y-2">
              {(() => {
                const firstNotaItem = items.find((i) => i.item_type === "nota");
                const firstNotaId = firstNotaItem?.id;
                return items
                  .filter((item) => item.id !== firstNotaId)
                  .map((item) => {
                    if (item.item_type === "posizione") {
                      const hasPos = !!item.value_text;
                      let posLabel = "Nessuna posizione selezionata";
                      if (hasPos) {
                        try {
                          const { x, y } = JSON.parse(item.value_text!);
                          posLabel = `x:${x}% y:${y}%`;
                        } catch { /* noop */ }
                      }
                      return (
                        <div key={item.id} className="rounded-xl overflow-hidden" style={{ border: "1px solid hsl(220 20% 18%)", background: "hsl(220 32% 10%)" }}>
                          <div className="flex items-center gap-3 p-3">
                            <span className="text-sm font-medium" style={{ color: "hsl(215 20% 65%)" }}>📍 Posizione</span>
                            <span className="flex-1 text-xs font-mono" style={{ color: hasPos ? "hsl(220 90% 70%)" : "hsl(215 15% 40%)" }}>{posLabel}</span>
                            {hasPos && (
                              <button type="button" onClick={() => updateItem(item.id, { value_text: undefined })}
                                className="text-xs px-2 py-1 rounded-lg transition-all cursor-pointer"
                                style={{ background: "hsl(0 60% 20%)", color: "hsl(0 70% 60%)", border: "1px solid hsl(0 60% 25%)" }}
                              >Rimuovi</button>
                            )}
                            {planImageUrl ? (
                              <button type="button" onClick={() => setPosizionePickingId(posizionePickingId === item.id ? null : item.id)}
                                className="text-xs px-2 py-1 rounded-lg transition-all cursor-pointer"
                                style={{ background: "hsl(220 90% 56% / 0.15)", color: "hsl(220 90% 70%)", border: "1px solid hsl(220 90% 56% / 0.3)" }}
                              >{posizionePickingId === item.id ? "Chiudi mappa" : (hasPos ? "Modifica" : "Seleziona")}</button>
                            ) : (
                              <span className="text-xs italic" style={{ color: "hsl(215 15% 40%)" }}>Nessuna planimetria caricata</span>
                            )}
                            <button type="button" onClick={() => { removeItem(item.id); setPosizionePickingId(null); }}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-all flex-shrink-0 cursor-pointer"
                              style={{ background: "hsl(0 60% 20%)", color: "hsl(0 70% 60%)", border: "1px solid hsl(0 60% 25%)" }}
                              title="Rimuovi voce">✕</button>
                          </div>
                          {posizionePickingId === item.id && planImageUrl && (
                            <div className="px-3 pb-3">
                              <PlanimetriaMappa
                                planImageUrl={planImageUrl}
                                notes={levelNotes ?? []}
                                pendingNoteNumber={nextNoteNumber ?? (initialNote?.note_number)}
                                pendingPosition={hasPos ? (() => { try { return JSON.parse(item.value_text!); } catch { return null; } })() : null}
                                onPositionSelected={(x, y) => {
                                  updateItem(item.id, { value_text: JSON.stringify({ x, y }) });
                                  setPosizionePickingId(null);
                                }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    }
                    return (
                      <ItemRow
                        key={item.id}
                        item={item}
                        onChange={(changes) => updateItem(item.id, changes)}
                        onRemove={() => removeItem(item.id)}
                        catalogMaterials={catalogMaterials}
                        onEditFoto={(id, url) => {
                          setEditingFotoId(id);
                          setEditingFotoUrl(url);
                        }}
                        onDrawFoto={(id, url) => {
                          setEditingSketchId(id);
                          setEditingSketchUrl(url);
                        }}
                        lastAddedId={lastAddedId}
                      />
                    );
                  });
              })()}
            </div>
          </>
        )}
      </div>

      {/* Anteprima Nesting per note di tipo Taglio */}
      {isTaglio && (
        <div className="mb-6">
          <NestingPreview items={items} />
        </div>
      )}

      {/* ── Pulsanti ── */}
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3 sm:justify-between pb-8">
        <div>
          {initialNote && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-semibold transition-all text-red-400 hover:text-red-300 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 active:scale-95 disabled:opacity-50"
            >
              {isPending ? "Eliminazione..." : "Elimina Appunto"}
            </button>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3">
          <button
            type="button"
            onClick={() => router.push(`/projects/${projectId}`)}
            disabled={isPending}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: "hsl(220 26% 14%)",
              border: "1px solid hsl(220 20% 24%)",
              color: "hsl(215 20% 65%)",
            }}
          >
            Indietro
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || (!selectedType && !typeFilter.trim())}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
              boxShadow: "0 4px 16px hsl(220 90% 56% / 0.3)",
            }}
          >
            {isPending ? "Salvataggio..." : "Salva Appunto"}
          </button>
        </div>
      </div>

      {/* Modale Livella a Bolla */}
      {showLivella && (
        <LivellaBolla
          onCapture={handleCaptureLivella}
          onClose={() => setShowLivella(false)}
        />
      )}

      {/* Modale PhotoQuotaEditor per Foto Quotata */}
      {editingFotoId && editingFotoUrl && (
        <PhotoQuotaEditor
          imageUrl={editingFotoUrl}
          onSave={(newUrl) => {
            updateItem(editingFotoId, { value_text: newUrl });
            setEditingFotoId(null);
            setEditingFotoUrl(null);
          }}
          onClose={() => {
            setEditingFotoId(null);
            setEditingFotoUrl(null);
          }}
        />
      )}

      {/* Modale SketchEditorClient per Disegno Libero / Sketch con Riconoscimento Forme */}
      {editingSketchId && editingSketchUrl && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black">
          <SketchEditorClient
            sketch={{
              id: editingSketchId,
              name: isSketch ? "Disegno Foglio Millimetrato" : "Annotazione su Foto",
              user_id: "",
              level_id: levelId,
              image_data: editingSketchUrl,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }}
            associatedNotes={[]}
            projectsWithLevels={[]}
            onSaveBase64={(newUrl) => {
              updateItem(editingSketchId, { value_text: newUrl });
              setEditingSketchId(null);
              setEditingSketchUrl(null);
            }}
            onClose={() => {
              setEditingSketchId(null);
              setEditingSketchUrl(null);
            }}
          />
        </div>
      )}



      {/* Calcolatrice Cantiere con Importazione */}
      <CalcolatriceWidget
        isOpen={showCalc}
        onClose={() => setShowCalc(false)}
        showImportButton={true}
      />
    </div>
  );
}

// ============================================
// Sotto-componente: Anteprima Nesting 2D per Tagli
// ============================================
function NestingPreview({ items }: { items: NoteItemDraft[] }) {
  const commercialSheetW = 1200; // Lastra standard 1200mm
  const commercialSheetH = 2000; // Lastra standard 2000mm
  const bladeThickness = 3; // Spessore lama (Kerf) in mm
  const totalBoardArea = commercialSheetW * commercialSheetH;

  interface SheetMaterialRequest {
    width: number;
    height: number;
    label: string;
  }

  const sheetRequests: SheetMaterialRequest[] = [];

  items.forEach((item, idx) => {
    if (item.item_type === "dim_quadrata" && item.composite) {
      const cv = item.composite;
      const b = parseFloat(cv.b as any);
      const h = parseFloat(cv.h as any);
      const q = parseInt(cv.q as any) || 1;
      const unit = cv.unit || "cm";

      if (!isNaN(b) && !isNaN(h) && b > 0 && h > 0) {
        const factor = unit === "cm" ? 10 : 1;
        const wMm = Math.round(b * factor);
        const hMm = Math.round(h * factor);

        for (let i = 0; i < q; i++) {
          sheetRequests.push({
            width: wMm,
            height: hMm,
            label: cv.refTitle ? `${cv.refTitle} (${wMm}x${hMm}mm)` : `Pezzo #${idx + 1} (${wMm}x${hMm}mm)`,
          });
        }
      }
    }
  });

  if (sheetRequests.length === 0) {
    return (
      <div className="p-6 rounded-2xl border text-center text-xs italic" style={{ background: "hsl(220 32% 10%)", borderColor: "hsl(220 20% 18%)", color: "hsl(215 15% 40%)" }}>
        Nessun pezzo da tagliare inserito con misure valide per l'ottimizzazione del nesting.
      </div>
    );
  }

  // --- Algoritmo Ghigliottina 2D ---
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
      boards.push({ placed: [], usedArea: 0 });
      freeRectsByBoard.push([{ x: 0, y: 0, w: commercialSheetW, h: commercialSheetH }]);
      return boards.length - 1;
    };

    const tryMakeCandidate = (reqW: number, reqH: number, boardIndex: number, freeRectIndex: number, freeRect: FreeRect, rotated: boolean): PlacementCandidate | null => {
      const pieceW = rotated ? reqH : reqW;
      const pieceH = rotated ? reqW : reqH;
      if (pieceW > freeRect.w || pieceH > freeRect.h) return null;

      let candX = freeRect.x;
      // Se superiamo la metà del foglio in larghezza, i pezzi vengono calcolati partendo dal lato opposto
      if (candX + pieceW > commercialSheetW / 2) {
        candX = freeRect.x + freeRect.w - pieceW;
      }

      return { boardIndex, freeRectIndex, rotated, x: candX, y: freeRect.y, w: pieceW, h: pieceH };
    };

    const isBetterBottomLeft = (a: PlacementCandidate, b: PlacementCandidate): boolean => {
      if (a.y !== b.y) return a.y < b.y;
      if (a.x !== b.x) return a.x < b.x;
      const aShortSide = Math.min(a.w, a.h);
      const bShortSide = Math.min(b.w, b.h);
      return aShortSide > bShortSide;
    };

    const splitFreeRectGuillotine = (freeRect: FreeRect, piece: PlacementCandidate): FreeRect[] => {
      const isRightAligned = piece.x > freeRect.x;
      const stripX = isRightAligned
        ? freeRect.x
        : freeRect.x + piece.w + bladeThickness;

      const rightStrip: FreeRect | null = freeRect.w - piece.w > 0
        ? { x: stripX, y: freeRect.y, w: freeRect.w - piece.w - bladeThickness, h: piece.h }
        : null;
      const bottomStrip: FreeRect | null = freeRect.h - piece.h > 0
        ? { x: freeRect.x, y: freeRect.y + piece.h + bladeThickness, w: freeRect.w, h: freeRect.h - piece.h - bladeThickness }
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
        bestCandidate = tryMakeCandidate(reqW, reqH, newBoardIndex, 0, baseFreeRect, false) ?? tryMakeCandidate(reqW, reqH, newBoardIndex, 0, baseFreeRect, true);
      }

      if (!bestCandidate) return;

      const board = boards[bestCandidate.boardIndex];
      const freeRects = freeRectsByBoard[bestCandidate.boardIndex];
      const targetFreeRect = freeRects[bestCandidate.freeRectIndex];
      if (!board || !targetFreeRect) return;

      board.placed.push({ x: bestCandidate.x, y: bestCandidate.y, w: bestCandidate.w, h: bestCandidate.h, label: req.label });
      board.usedArea += bestCandidate.w * bestCandidate.h;

      freeRects.splice(bestCandidate.freeRectIndex, 1);
      freeRects.push(...splitFreeRectGuillotine(targetFreeRect, bestCandidate));
    });

    return boards;
  };

  const packedBoards = pack2D();
  const totalSheetsCount = packedBoards.length;
  const totalUsedSheetArea = packedBoards.reduce((acc, b) => acc + b.usedArea, 0);
  const totalSheetSfrido = totalSheetsCount > 0 ? Math.round(((totalSheetsCount * totalBoardArea - totalUsedSheetArea) / (totalSheetsCount * totalBoardArea)) * 100) : 0;

  return (
    <div className="space-y-5 p-5 rounded-2xl border" style={{ background: "hsl(220 26% 12% / 0.15)", borderColor: "hsl(220 20% 18%)" }}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
          <span>✂️</span> Ottimizzazione Nesting 2D (Pannelli 2000x1200mm)
        </h3>
        <div className="self-start px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-950/30 text-emerald-400 border border-emerald-900/30">
          Sfrido stimato: {totalSheetSfrido}% ({totalSheetsCount} {totalSheetsCount === 1 ? "foglio" : "fogli"})
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {packedBoards.map((board, idx) => (
          <div key={idx} className="p-4 rounded-xl border flex flex-col items-center" style={{ background: "hsl(220 32% 10%)", borderColor: "hsl(220 20% 20%)" }}>
            <div className="w-full flex justify-between items-center text-[10px] text-gray-500 font-bold mb-3">
              <span>FOGLIO #{idx + 1}</span>
              <span>Utilizzo: {Math.round((board.usedArea / totalBoardArea) * 100)}%</span>
            </div>

            <div 
              className="relative bg-white/5 rounded-xl overflow-hidden border border-white/10"
              style={{
                width: `${commercialSheetW * 0.15}px`,
                height: `${commercialSheetH * 0.15}px`,
              }}
            >
              {board.placed.map((p, pIdx) => (
                <div
                  key={pIdx}
                  className="absolute border border-black/40 flex flex-col items-center justify-center p-0.5 text-[8px] font-extrabold text-white leading-tight overflow-hidden truncate"
                  style={{
                    left: `${p.x * 0.15}px`,
                    top: `${p.y * 0.15}px`,
                    width: `${p.w * 0.15}px`,
                    height: `${p.h * 0.15}px`,
                    background: "linear-gradient(135deg, hsl(220, 90%, 56%), hsl(215, 85%, 45%))",
                  }}
                  title={p.label}
                >
                  <span className="truncate max-w-full">{p.w}x{p.h}</span>
                  {p.label && (
                    <span className="text-[6.5px] opacity-60 truncate max-w-full">
                      {p.label.split(" ")[0]}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Sotto-componente: singola voce
// ============================================

function ItemRow({
  item,
  onChange,
  onRemove,
  catalogMaterials = [],
  onEditFoto,
  onDrawFoto,
  lastAddedId,
}: {
  item: NoteItemDraft;
  onChange: (changes: Partial<NoteItemDraft>) => void;
  onRemove: () => void;
  catalogMaterials?: Material[];
  onEditFoto?: (id: string, url: string) => void;
  onDrawFoto?: (id: string, url: string) => void;
  lastAddedId?: string | null;
}) {
  const label = ITEM_LABELS[item.item_type];
  const isMeasure = MEASURE_TYPES.includes(item.item_type);
  const isBool = BOOL_TYPES.includes(item.item_type);
  const isNote = item.item_type === "nota";
  const isFoto = item.item_type === "foto";
  const isComposite = COMPOSITE_TYPES.includes(item.item_type);
  const isDim3D = item.item_type === "dim_cubica";
  const isMateriale = item.item_type === "materiale";

  const rowRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (item.id === lastAddedId) {
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        } else if (selectRef.current) {
          selectRef.current.focus();
        } else if (fileInputRef.current) {
          fileInputRef.current.focus();
        }
        rowRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [item.id, lastAddedId]);

  // Helper per aggiornare il composite
  const updateComposite = (patch: Partial<CompositeValue>) => {
    onChange({ composite: { ...{ unit: "cm" }, ...item.composite, ...patch } });
  };

  if (isComposite) {
    const cv = item.composite ?? { unit: "cm" };
    return (
      <div
        ref={rowRef}
        className="p-3 rounded-xl space-y-2 text-sm"
        style={{
          background: item.id === lastAddedId ? "hsl(220 90% 56% / 0.05)" : "hsl(220 32% 10%)",
          border: item.id === lastAddedId ? "1px solid hsl(220 90% 56% / 0.3)" : "1px solid hsl(220 20% 18%)",
        }}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: cv.isCutPiece ? "hsl(142 70% 55%)" : "hsl(215 20% 65%)" }}>
            <span>
              {item.item_type === "dim_quadrata" 
                ? (cv.isCutPiece ? "✂️ Pezzo da tagliare" : "📐 Dimensione quadrata") 
                : "⬛ Sezione 3D"}
            </span>
            {cv.refTitle && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-white/5 text-white/50 border border-white/10 uppercase tracking-wider">
                Rif: {cv.refTitle}
              </span>
            )}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => updateComposite({ unit: cv.unit === "mm" ? "cm" : "mm" })}
              className="px-2 py-1 rounded-lg text-xs font-bold transition-all"
              style={{
                background: "hsl(220 26% 18%)",
                border: "1px solid hsl(220 20% 24%)",
                color: cv.unit === "mm" ? "hsl(220 90% 70%)" : "hsl(210 40% 85%)",
              }}
            >
              {cv.unit ?? "cm"}
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-all text-red-400 bg-red-950/20 border border-red-900/30"
              title="Rimuovi"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <span className="text-[10px] text-gray-500">L:</span>
            <input
              ref={inputRef}
              type="number"
              min="0"
              step="0.1"
              value={cv.b ?? ""}
              onChange={(e) => updateComposite({ b: e.target.value ? parseFloat(e.target.value) : null })}
              placeholder="Base"
              className="w-full px-2 py-1.5 rounded-lg text-xs outline-none"
              style={{ background: "hsl(220 26% 14%)", border: "1px solid hsl(220 20% 22%)", color: "hsl(210 40% 96%)" }}
            />
          </div>
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <span className="text-[10px] text-gray-500">H:</span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={cv.h ?? ""}
              onChange={(e) => updateComposite({ h: e.target.value ? parseFloat(e.target.value) : null })}
              placeholder="Altezza"
              className="w-full px-2 py-1.5 rounded-lg text-xs outline-none"
              style={{ background: "hsl(220 26% 14%)", border: "1px solid hsl(220 20% 22%)", color: "hsl(210 40% 96%)" }}
            />
          </div>
          {item.item_type === "dim_quadrata" && cv.isCutPiece && (
            <div className="flex items-center gap-1 w-20 flex-shrink-0">
              <span className="text-[10px] text-gray-500">Q:</span>
              <input
                type="number"
                min="1"
                step="1"
                value={cv.q ?? 1}
                onChange={(e) => updateComposite({ q: e.target.value ? parseInt(e.target.value) : 1 })}
                placeholder="Qtà"
                className="w-full px-2 py-1.5 rounded-lg text-xs outline-none"
                style={{ background: "hsl(220 26% 14%)", border: "1px solid hsl(220 20% 22%)", color: "hsl(142 60% 75%)" }}
              />
            </div>
          )}
          {isDim3D && (
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <span className="text-[10px] text-gray-500">P:</span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={cv.d ?? ""}
                onChange={(e) => updateComposite({ d: e.target.value ? parseFloat(e.target.value) : null })}
                placeholder="Prof."
                className="w-full px-2 py-1.5 rounded-lg text-xs outline-none"
                style={{ background: "hsl(220 26% 14%)", border: "1px solid hsl(220 20% 22%)", color: "hsl(210 40% 96%)" }}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rowRef}
      className="grid grid-cols-[85px_1fr_auto] items-center gap-2 p-2 rounded-xl text-sm"
      style={{
        background: item.id === lastAddedId ? "hsl(220 90% 56% / 0.05)" : "hsl(220 32% 10%)",
        border: item.id === lastAddedId ? "1px solid hsl(220 90% 56% / 0.3)" : "1px solid hsl(220 20% 18%)",
        minHeight: "48px",
      }}
    >
      {/* Label */}
      <span
        className="font-medium text-xs truncate flex items-center gap-1"
        style={{ color: "hsl(215 20% 65%)" }}
      >
        {item.item_type === "base" ? "↔ L (Oriz.)" :
         item.item_type === "altezza" ? "↕ H (Vert.)" :
         item.item_type === "spessore" ? "↗ S (Spes.)" :
         item.item_type === "nota" ? "📝 Nota" :
         item.item_type === "materiale" ? "📦 Materiale" :
         item.item_type === "foto" ? "📷 Foto" : label}
      </span>

      {/* Input misura */}
      {isMeasure && (
        <div className="flex flex-1 items-center gap-1.5 min-w-0">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="number"
              min="0"
              step="0.1"
              value={item.value_num ?? ""}
              onChange={(e) =>
                onChange({ value_num: e.target.value ? parseFloat(e.target.value) : null })
              }
              placeholder="0"
              className="w-full px-2.5 py-1.5 rounded-lg text-xs outline-none"
              style={{
                background: "hsl(220 26% 14%)",
                border: "1px solid hsl(220 20% 22%)",
                color: "hsl(210 40% 96%)",
              }}
              data-1p-ignore
              autoComplete="off"
            />
          </div>
          <button
            type="button"
            onClick={() => onChange({ value_unit: item.value_unit === "mm" ? "cm" : "mm" })}
            className="px-2 py-1.5 rounded-lg text-xs font-bold transition-all flex-shrink-0"
            style={{
              background: "hsl(220 26% 18%)",
              border: "1px solid hsl(220 20% 24%)",
              color: item.value_unit === "mm" ? "hsl(220 90% 70%)" : "hsl(210 40% 85%)",
            }}
          >
            {item.value_unit ?? "cm"}
          </button>
        </div>
      )}

      {/* Checkbox bool */}
      {isBool && (
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => onChange({ value_bool: !item.value_bool })}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-all"
            style={{
              background: item.value_bool
                ? "hsl(142 60% 40%)"
                : "hsl(220 26% 14%)",
              border: `1px solid ${item.value_bool ? "hsl(142 60% 35%)" : "hsl(220 20% 22%)"}`,
              color: item.value_bool ? "white" : "hsl(215 15% 45%)",
            }}
          >
            ✓
          </button>
          <span className="text-xs" style={{ color: "hsl(215 20% 55%)" }}>
            {item.value_bool ? "Presente" : "Non presente"}
          </span>
        </div>
      )}

      {/* Input nota */}
      {isNote && (
        <input
          ref={inputRef}
          type="text"
          value={item.value_text ?? ""}
          onChange={(e) => onChange({ value_text: e.target.value })}
          placeholder="Scrivi una nota..."
          className="flex-1 px-2.5 py-1.5 rounded-lg text-xs outline-none min-w-0"
          style={{
            background: "hsl(220 26% 14%)",
            border: "1px solid hsl(220 20% 22%)",
            color: "hsl(210 40% 96%)",
          }}
        />
      )}

      {/* Materiale */}
      {isMateriale && (
        <select
          ref={selectRef}
          value={item.value_text ?? ""}
          onChange={(e) => onChange({ value_text: e.target.value })}
          className="flex-1 px-2 py-1.5 rounded-lg text-xs outline-none cursor-pointer min-w-0"
          style={{
            background: "hsl(220 26% 14%)",
            border: "1px solid hsl(220 20% 22%)",
            color: "hsl(210 40% 96%)",
          }}
        >
          <option value="">Seleziona materiale...</option>
          {catalogMaterials.map((mat) => (
            <option key={mat.id} value={mat.name}>
              {mat.name} {mat.sku ? `(${mat.sku})` : ""}
            </option>
          ))}
        </select>
      )}

      {/* Foto o Allegato 3D */}
      {isFoto && (
        <div className="flex-1 flex items-center gap-2 min-w-0">
          {item.value_text ? (
            <div className="flex items-center gap-2 min-w-0">
              <div className="relative inline-block flex-shrink-0">
                {is3DModelUrl(item.value_text) ? (
                  <a 
                    href={item.value_text}
                    download="modello_cad.glb"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-8 w-8 rounded-lg flex items-center justify-center bg-sky-500/15 text-sky-400 text-sm font-bold border border-sky-500/30 cursor-pointer hover:bg-sky-500/25 transition-all" 
                    title="Clicca per scaricare il modello CAD"
                  >
                    📦
                  </a>
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img 
                    src={item.value_text} 
                    alt="Anteprima foto" 
                    className="h-8 w-8 rounded-lg object-cover" 
                    style={{ border: "1px solid hsl(220 20% 22%)" }}
                  />
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Sei sicuro di voler rimuovere questa foto/disegno?")) {
                      onChange({ value_text: undefined });
                    }
                  }}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] shadow-md transition-all animate-fade-in cursor-pointer"
                  style={{ background: "hsl(0 70% 50%)", color: "white" }}
                  title="Rimuovi"
                >
                  ✕
                </button>
              </div>
              
              {is3DModelUrl(item.value_text) ? (
                <a
                  href={item.value_text}
                  download="modello_cad.glb"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-1 rounded-lg text-[10px] font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 shadow-sm"
                  style={{
                    background: "hsl(220 90% 56% / 0.15)",
                    color: "hsl(220 90% 70%)",
                    border: "1px solid hsl(220 90% 56% / 0.3)",
                  }}
                >
                  📥 Scarica CAD
                </a>
              ) : (
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => onEditFoto?.(item.id, item.value_text!)}
                    className="px-2.5 py-1.5 rounded-lg text-[9px] font-extrabold transition-all whitespace-nowrap bg-sky-600 hover:bg-sky-700 active:scale-95 text-white flex items-center gap-1 cursor-pointer shadow-sm"
                    title="Quota questa foto con linee d'asse e misure"
                  >
                    <span>📐</span> Quota Foto
                  </button>
                  <button
                    type="button"
                    onClick={() => onDrawFoto?.(item.id, item.value_text!)}
                    className="px-2.5 py-1.5 rounded-lg text-[9px] font-extrabold transition-all whitespace-nowrap bg-amber-500 hover:bg-amber-600 active:scale-95 text-white flex items-center gap-1 cursor-pointer shadow-sm"
                    title="Disegna a mano libera sopra questa foto"
                  >
                    <span>✏️</span> Disegna su Foto
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center w-full min-w-0">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.glb,.gltf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  
                  const is3DModel = file.name.endsWith(".glb") || file.name.endsWith(".gltf") || file.type.includes("gltf") || file.type.includes("model");
                  
                  const reader = new FileReader();
                  reader.onload = (evt) => {
                    const resultUrl = evt.target?.result as string;
                    
                    if (is3DModel) {
                      // Salviamo direttamente il Base64 DataURL del modello 3D nel database
                      onChange({ value_text: resultUrl });
                    } else {
                      // Compressione immagine classica
                      const img = new Image();
                      img.onload = () => {
                        const canvas = document.createElement("canvas");
                        const MAX_WIDTH = 800;
                        const MAX_HEIGHT = 800;
                        let width = img.width;
                        let height = img.height;

                        if (width > height) {
                          if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                          }
                        } else {
                          if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                          }
                        }

                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext("2d");
                        ctx?.drawImage(img, 0, 0, width, height);
                        
                        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
                        onChange({ value_text: compressedBase64 });
                      };
                      img.src = resultUrl;
                    }
                  };
                  reader.readAsDataURL(file);
                }}
                className="w-full text-[10px] file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:text-white file:cursor-pointer cursor-pointer"
                style={{ color: "hsl(215 15% 50%)" }}
              />
              <style dangerouslySetInnerHTML={{__html: `
                input[type=file]::file-selector-button {
                  background: linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%));
                }
              `}} />
            </div>
          )}
        </div>
      )}

      {/* Rimuovi */}
      <button
        type="button"
        onClick={() => {
          if (window.confirm("Sei sicuro di voler rimuovere questa voce dal foglio delle misure?")) {
            onRemove();
          }
        }}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-all flex-shrink-0 text-red-400 bg-red-950/20 border border-red-900/30 cursor-pointer"
        title="Rimuovi voce"
      >
        ✕
      </button>
    </div>
  );
}
