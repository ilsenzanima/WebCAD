"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  createFieldNote,
  updateFieldNote,
  createNoteType,
  type FieldNoteType,
  type FieldNoteItem,
  type FieldNote,
} from "@/app/actions/field-notes";
import PlanimetriaMappa from "./PlanimetriaMappa";
import PhotoQuotaEditor from "./PhotoQuotaEditor";
import FreehandSketchEditor from "./FreehandSketchEditor";
import ModelViewer from "./ModelViewer";
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
  dim_quadrata: "◻ Dimensioni quadrate",
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
  unit: "mm" | "cm";
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

  const cachedNote = useOfflineStore((state) => state.fieldNotes[initialNote?.id ?? ""]);
  const noteToUse = cachedNote || initialNote;

  // --- Voci misure ---
  const [items, setItems] = useState<NoteItemDraft[]>([]);

  useEffect(() => {
    if (noteToUse?.field_note_items && noteToUse.field_note_items.length > 0 && items.length === 0) {
      setItems(
        noteToUse.field_note_items.map((item) => {
          const isComposite = item.item_type === "dim_quadrata" || item.item_type === "dim_cubica";
          let composite: CompositeValue | undefined;
          if (isComposite && item.value_text) {
            try { composite = JSON.parse(item.value_text); } catch { composite = { unit: "cm" }; }
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
    }
  }, [noteToUse, items.length]);

  const [activeModel3DUrl, setActiveModel3DUrl] = useState<string | null>(null);

  // Stato per l'autofocus dell'ultimo elemento inserito
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);

  // Store offline Zustand
  const isOnline = useOfflineStore((state) => state.isOnline);
  const setCatalogMaterialsCache = useOfflineStore((state) => state.setCatalogMaterialsCache);
  const setNoteTypesCache = useOfflineStore((state) => state.setNoteTypesCache);
  const saveFieldNoteItemsOptimistic = useOfflineStore((state) => state.saveFieldNoteItemsOptimistic);

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
    if (noteToUse) {
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
  }, [noteToUse, noteTypes, typeFilter, selectedType]);

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

  // Gestore per catturare l'inclinazione della livella ed inserirla come nota
  function handleCaptureLivella(text: string) {
    const draft: NoteItemDraft = {
      id: crypto.randomUUID(),
      item_type: "nota",
      value_text: text,
    };
    setItems((prev) => [...prev, draft]);
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

  function addItem(itemType: ItemType) {
    const newId = crypto.randomUUID();
    const draft: NoteItemDraft = {
      id: newId,
      item_type: itemType,
      value_unit: "cm",
      value_bool: true,
      // per dimensioni composite inizializziamo subito il composite
      composite: COMPOSITE_TYPES.includes(itemType)
        ? { b: null, h: null, d: null, unit: "cm" }
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
            (item.item_type === "nota" || item.item_type === "foto" || item.item_type === "posizione")
              ? (item.value_text ?? null)
              : COMPOSITE_TYPES.includes(item.item_type)
              ? JSON.stringify(item.composite ?? {})
              : null,
          sort_order: idx,
        })),
      };

      if (!isOnline) {
        // Salvataggio offline ottimistico
        const noteId = initialNote ? initialNote.id : `temp-note-${Date.now()}`;
        saveFieldNoteItemsOptimistic(noteId, projectId, levelId, payload.items);
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


  // ============================================
  // JSX
  // ============================================

  const isSketch = typeFilter === "Sketch" || selectedType?.name === "Sketch";
  const isReport3D = typeFilter === "Report 3D" || selectedType?.name === "Report 3D";

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
              : "rgba(14, 165, 233, 0.15)",
            color: isSketch ? "#fbbf24" : isReport3D ? "#c084fc" : "#38bdf8",
            border: `1px solid ${
              isSketch ? "rgba(245, 158, 11, 0.3)" : isReport3D ? "rgba(168, 85, 247, 0.3)" : "rgba(14, 165, 233, 0.3)"
            }`,
          }}
        >
          {isSketch ? "Sketch" : isReport3D ? "Report 3D" : "Nota"}
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

                      <div className="rounded-2xl overflow-hidden border border-white/10">
                        <ModelViewer
                          modelUrl={model3dItem.value_text}
                          onSnapshotTaken={(newSnapshot) => {
                            const newItems = [...items];
                            const existingSnapshotIndex = newItems.findIndex(i => i.item_type === "foto" && !is3DModelUrl(i.value_text));
                            if (existingSnapshotIndex > -1) {
                              newItems[existingSnapshotIndex].value_text = newSnapshot;
                            } else {
                              newItems.push({ id: crypto.randomUUID(), item_type: "foto", value_text: newSnapshot });
                            }
                            setItems(newItems);
                          }}
                        />
                      </div>
                    </div>

                    {snapshotItem?.value_text && (
                      <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.015] space-y-2 animate-fade-in">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">📸 Snapshot Quotato Attivo</span>
                          <button
                            type="button"
                            onClick={() => {
                              if (snapshotItem) {
                                setEditingFotoId(snapshotItem.id);
                                setEditingFotoUrl(snapshotItem.value_text!);
                              }
                            }}
                            className="text-[10px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
                          >
                            ✏️ Modifica Quote Snapshot
                          </button>
                        </div>
                        <div className="relative group rounded-xl overflow-hidden border border-white/5 bg-white p-2 max-w-sm mx-auto">
                          <img
                            src={snapshotItem.value_text}
                            alt="Snapshot 3D"
                            className="max-h-[220px] object-contain rounded"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div />

              {/* Pulsanti Azioni Note */}
              <div className="flex items-center gap-2">
                {/* Bottone Calcolatrice */}
                <button
                  type="button"
                  onClick={() => setShowCalc(true)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-sm transition-all"
                  style={{
                    background: "hsl(220 26% 18%)",
                    border: "1px solid hsl(220 20% 24%)",
                    boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
                  }}
                  title="Apri Calcolatrice Cantiere"
                >
                  🧮
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
                      {(Object.keys(ITEM_LABELS) as ItemType[]).filter(type => type !== "posizione").map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => addItem(type)}
                          className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition-colors"
                          style={{
                            color: "hsl(210 40% 90%)",
                            borderBottom: "1px solid hsl(220 20% 18%)",
                          }}
                        >
                          {ITEM_LABELS[type]}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setShowLivella(true);
                          setShowItemDropdown(false);
                        }}
                        className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition-colors font-bold"
                        style={{
                          color: "hsl(142, 60%, 75%)",
                          borderTop: "1px solid hsl(220 20% 18%)",
                        }}
                      >
                        🟢 Livella a Bolla
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {items.length === 0 && (
              <p className="text-sm text-center py-6" style={{ color: "hsl(215 15% 40%)" }}>
                Premi ＋ per aggiungere misure e appunti.
              </p>
            )}

            <div className="space-y-2">
              {items.map((item) => {
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
                    onOpen3DModel={setActiveModel3DUrl}
                    lastAddedId={lastAddedId}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Pulsanti ── */}
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3 sm:justify-end pb-8">
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

      {/* Modale FreehandSketchEditor per Disegno Libero / Sketch */}
      {editingSketchId && editingSketchUrl && (
        <FreehandSketchEditor
          imageUrl={editingSketchUrl}
          onSave={(newUrl) => {
            updateItem(editingSketchId, { value_text: newUrl });
            setEditingSketchId(null);
            setEditingSketchUrl(null);
          }}
          onClose={() => {
            setEditingSketchId(null);
            setEditingSketchUrl(null);
          }}
        />
      )}

      {/* Modale Visualizzatore 3D GLB/GLTF */}
      {activeModel3DUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="bg-[#090b11] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative animate-fade-in">
            <button
              onClick={() => setActiveModel3DUrl(null)}
              className="absolute top-4 right-4 z-50 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs transition-all cursor-pointer shadow-lg active:scale-95"
            >
              ✕ Chiudi
            </button>
            <div className="flex-1 overflow-hidden p-2">
              <ModelViewer modelUrl={activeModel3DUrl} />
            </div>
          </div>
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
// Sotto-componente: singola voce
// ============================================

function ItemRow({
  item,
  onChange,
  onRemove,
  catalogMaterials = [],
  onEditFoto,
  onDrawFoto,
  onOpen3DModel,
  lastAddedId,
}: {
  item: NoteItemDraft;
  onChange: (changes: Partial<NoteItemDraft>) => void;
  onRemove: () => void;
  catalogMaterials?: Material[];
  onEditFoto?: (id: string, url: string) => void;
  onDrawFoto?: (id: string, url: string) => void;
  onOpen3DModel?: (url: string) => void;
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
          <span className="text-xs font-bold" style={{ color: "hsl(215 20% 65%)" }}>
            {item.item_type === "dim_quadrata" ? "◻ Sezione 2D" : "⬛ Sezione 3D"}
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
                  <div 
                    onClick={() => onOpen3DModel?.(item.value_text!)}
                    className="h-8 w-8 rounded-lg flex items-center justify-center bg-sky-500/15 text-sky-400 text-sm font-bold border border-sky-500/30 cursor-pointer hover:bg-sky-500/25 transition-all" 
                    title="Clicca per visualizzare il modello 3D"
                  >
                    📦
                  </div>
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
                <button
                  type="button"
                  onClick={() => onOpen3DModel?.(item.value_text!)}
                  className="px-2 py-1 rounded-lg text-[10px] font-semibold transition-all whitespace-nowrap cursor-pointer"
                  style={{
                    background: "hsl(220 90% 56% / 0.15)",
                    color: "hsl(220 90% 70%)",
                    border: "1px solid hsl(220 90% 56% / 0.3)",
                  }}
                >
                  👁 Visualizza 3D
                </button>
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
