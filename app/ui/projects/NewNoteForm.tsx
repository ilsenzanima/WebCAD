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
import LivellaBolla from "./LivellaBolla";
import CalcolatriceWidget from "@/app/ui/dashboard/CalcolatriceWidget";
import { interpretDettatoCantiere } from "@/app/actions/ai";

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
  catalogMaterials?: any[];
}

// ============================================
// Componente principale
// ============================================

export default function NewNoteForm({ projectId, levelId, noteTypes, initialNote, planImageUrl, nextNoteNumber, levelNotes, catalogMaterials = [] }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

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

  // --- Assistente IA Dettato ---
  const [dettatoText, setDettatoText] = useState("");
  const [isAILoading, setIsAILoading] = useState(false);
  const [showAIBox, setShowAIBox] = useState(false);

  async function handleInterpretAI() {
    if (!dettatoText.trim()) return;
    setError(null);
    setIsAILoading(true);

    try {
      const res = await interpretDettatoCantiere(dettatoText);
      setIsAILoading(false);
      
      if (res.success && res.items) {
        // Convertiamo gli items strutturati estratti da Gemini
        const newDrafts: NoteItemDraft[] = res.items.map((item) => ({
          id: crypto.randomUUID(),
          item_type: item.item_type,
          value_num: item.value_num,
          value_unit: (item.value_unit as any) ?? "cm",
          value_bool: item.value_bool ?? true,
          value_text: item.value_text ?? undefined,
          composite: COMPOSITE_TYPES.includes(item.item_type)
            ? { b: null, h: null, d: null, unit: "cm" }
            : undefined
        }));

        if (newDrafts.length > 0) {
          setItems((prev) => [...prev, ...newDrafts]);
          setDettatoText("");
          setShowAIBox(false);
          alert(`🤖 Gemini ha interpretato ed aggiunto con successo ${newDrafts.length} voci di rilievo!`);
        } else {
          setError("L'IA non ha identificato misure chiare in questo testo. Prova ad essere più specifico, es: 'altezza due metri, spessore trenta'.");
        }
      } else {
        setError(res.error ?? "Errore di interpretazione dell'IA.");
      }
    } catch (err: any) {
      setIsAILoading(false);
      setError("Errore di connessione con l'IA: " + err.message);
    }
  }

  // --- Tipo appunto ---
  const [typeFilter, setTypeFilter] = useState(initialNote?.type_name ?? "");
  const [selectedType, setSelectedType] = useState<FieldNoteType | null>(
    initialNote?.type_id ? noteTypes.find((t) => t.id === initialNote.type_id) ?? null : null
  );
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [allTypes, setAllTypes] = useState<FieldNoteType[]>(noteTypes);
  const [isCreatingType, setIsCreatingType] = useState(false);
  const typeInputRef = useRef<HTMLInputElement>(null);

  const filteredTypes = allTypes.filter((t) =>
    t.name.toLowerCase().includes(typeFilter.toLowerCase())
  );
  const noMatch = typeFilter.trim() !== "" && filteredTypes.length === 0;

  // --- Voci misure ---
  const [items, setItems] = useState<NoteItemDraft[]>(
    initialNote?.field_note_items?.map((item) => {
      const isComposite = item.item_type === "dim_quadrata" || item.item_type === "dim_cubica";
      let composite: CompositeValue | undefined;
      if (isComposite && item.value_text) {
        try { composite = JSON.parse(item.value_text); } catch { composite = { unit: "cm" }; }
      }
      return {
        id: item.id,
        item_type: item.item_type,
        value_num: item.value_num,
        value_unit: (item.value_unit as "mm" | "cm") ?? "cm",
        value_bool: item.value_bool ?? true,
        value_text: isComposite ? undefined : (item.value_text ?? undefined),
        composite,
      };
    }) ?? []
  );
  const [showItemDropdown, setShowItemDropdown] = useState(false);

  // --- Posizione in selezione (apre la mappa) ---
  const [posizionePickingId, setPosizionePickingId] = useState<string | null>(null);

  // --- Stati per Foto Quotata & Livella ---
  const [showLivella, setShowLivella] = useState(false);
  const [editingFotoId, setEditingFotoId] = useState<string | null>(null);
  const [editingFotoUrl, setEditingFotoUrl] = useState<string | null>(null);

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
    const draft: NoteItemDraft = {
      id: crypto.randomUUID(),
      item_type: itemType,
      value_unit: "cm",
      value_bool: true,
      // per dimensioni composite inizializziamo subito il composite
      composite: COMPOSITE_TYPES.includes(itemType)
        ? { b: null, h: null, d: null, unit: "cm" }
        : undefined,
    };
    setItems((prev) => [...prev, draft]);
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

      {/* ── Tipo appunto ── */}
      <div
        className="rounded-2xl p-6 space-y-3"
        style={{ background: "hsl(220 26% 14%)", border: "1px solid hsl(220 20% 20%)" }}
      >
        <label className="block text-sm font-semibold text-white">
          Tipo di appunto <span style={{ color: "hsl(0 80% 60%)" }}>*</span>
        </label>

        <div className="relative">
          {/* Wrapper per evitare crash con estensioni di autofill */}
          <div className="w-full relative">
            <input
              ref={typeInputRef}
              type="text"
              value={typeFilter}
              onChange={(e) => {
                const val = e.target.value;
                setTypeFilter(val);
                
                // Auto-matching case-insensitive
                const match = allTypes.find((t) => t.name.toLowerCase() === val.trim().toLowerCase());
                if (match) {
                  setSelectedType(match);
                } else {
                  setSelectedType(null);
                }
                setShowTypeDropdown(true);
              }}
              onFocus={() => setShowTypeDropdown(true)}
              onBlur={() => setTimeout(() => setShowTypeDropdown(false), 180)}
              placeholder="Cerca o digita un tipo..."
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
              style={{
                background: "hsl(220 32% 10%)",
                border: "1px solid hsl(220 20% 22%)",
                color: "hsl(210 40% 96%)",
              }}
              data-1p-ignore
              autoComplete="off"
              name={`typeFilter_${Date.now()}`}
            />
          </div>

          {showTypeDropdown && (
            <div
              className="absolute left-0 right-0 mt-1 rounded-xl overflow-hidden z-50"
              style={{
                background: "hsl(220 26% 14%)",
                border: "1px solid hsl(220 20% 22%)",
                boxShadow: "0 12px 30px rgba(0,0,0,0.5)",
                maxHeight: "220px",
                overflowY: "auto",
              }}
            >
              {filteredTypes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onMouseDown={() => selectType(t)}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition-colors"
                  style={{ color: "hsl(210 40% 90%)" }}
                >
                  {t.name}
                </button>
              ))}

              {noMatch && (
                <div className="px-4 py-3 border-t" style={{ borderColor: "hsl(220 20% 22%)" }}>
                  <p className="text-xs mb-2" style={{ color: "hsl(215 15% 50%)" }}>
                    Nessun tipo trovato per "{typeFilter}"
                  </p>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault(); // Previene onBlur dell'input!
                      handleQuickCreateType();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      handleQuickCreateType();
                    }}
                    disabled={isCreatingType}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    style={{
                      background: "hsl(220 90% 56% / 0.15)",
                      color: "hsl(220 90% 70%)",
                      border: "1px solid hsl(220 90% 56% / 0.3)",
                    }}
                  >
                    {isCreatingType ? "Creazione..." : `＋ Aggiungi "${typeFilter}"`}
                  </button>
                </div>
              )}

              {filteredTypes.length === 0 && !noMatch && (
                <div className="px-4 py-3 text-xs text-center" style={{ color: "hsl(215 15% 45%)" }}>
                  Inizia a digitare per cercare...
                </div>
              )}
            </div>
          )}
        </div>

        {selectedType && (
          <div className="flex items-center gap-2 text-xs" style={{ color: "hsl(142 60% 55%)" }}>
            ✓ Tipo selezionato: <strong>{selectedType.name}</strong>
          </div>
        )}
      </div>

      {/* ── Assistente IA Dettato (Gemini) ── */}
      <div
        className="rounded-2xl p-6 space-y-4 border transition-all duration-300"
        style={{ 
          background: "linear-gradient(135deg, hsl(220 32% 10%), hsl(220 28% 12%))", 
          borderColor: showAIBox ? "hsl(220 90% 56% / 0.3)" : "hsl(220 20% 18%)",
          boxShadow: showAIBox ? "0 8px 30px hsl(220 90% 56% / 0.05)" : "none"
        }}
      >
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowAIBox(!showAIBox)}>
          <div className="flex items-center gap-2.5">
            <span className="text-xl animate-pulse">🤖</span>
            <div>
              <h3 className="text-sm font-bold text-white">Assistente Vocale IA (Gemini)</h3>
              <p className="text-[10px] text-white/50">Compila l'intero appunto dettando a voce libera</p>
            </div>
          </div>
          <button
            type="button"
            className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-xs text-white/70"
          >
            {showAIBox ? "▲" : "▼"}
          </button>
        </div>

        {showAIBox && (
          <div className="space-y-3 pt-2 border-t border-white/5 animate-fade-in">
            <p className="text-[11px] text-white/50 leading-relaxed">
              Premi il microfono sulla tastiera del tuo smartphone e detta liberamente il rilievo. <br />
              <span className="text-orange-400 font-bold">Esempio:</span> <em>"porta tagliafuoco larga novanta centimetri alta due metri e dieci spessore trenta presente lana di roccia interna e maniglione danneggiato"</em>
            </p>
            
            <textarea
              value={dettatoText}
              onChange={(e) => setDettatoText(e.target.value)}
              placeholder="Fai clic qui, detta o digita il tuo rilievo..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl text-xs outline-none focus:ring-1 focus:ring-blue-500/50 resize-none font-medium leading-relaxed"
              style={{
                background: "hsl(220 32% 8%)",
                border: "1px solid hsl(220 20% 18%)",
                color: "white"
              }}
            />

            <div className="flex items-center justify-between gap-3">
              <span className="text-[9px] text-white/30">Richiede connessione internet attiva</span>
              <button
                type="button"
                onClick={handleInterpretAI}
                disabled={isAILoading || !dettatoText.trim()}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-md disabled:opacity-40 flex items-center gap-2 cursor-pointer"
                style={{
                  background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))"
                }}
              >
                {isAILoading ? (
                  <>
                    <span className="w-3 h-3 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                    Elaborazione...
                  </>
                ) : (
                  <>🤖 Interpreta con Gemini</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Voci / Misure ── */}
      <div
        className="rounded-2xl p-6 space-y-4"
        style={{ background: "hsl(220 26% 14%)", border: "1px solid hsl(220 20% 20%)" }}
      >
        <div className="flex items-center justify-between">
          <label className="block text-sm font-semibold text-white">
            Misure e note
          </label>

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
            Clicca "＋" per aggiungere misure o note.
          </p>
        )}

        <div className="space-y-3">
          {items.map((item) => {
            if (item.item_type === "posizione") {
              // UI posizione inline: mostra il valore già scelto o il picker
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
                        className="text-xs px-2 py-1 rounded-lg transition-all"
                        style={{ background: "hsl(0 60% 20%)", color: "hsl(0 70% 60%)", border: "1px solid hsl(0 60% 25%)" }}
                      >Rimuovi</button>
                    )}
                    {planImageUrl ? (
                      <button type="button" onClick={() => setPosizionePickingId(posizionePickingId === item.id ? null : item.id)}
                        className="text-xs px-2 py-1 rounded-lg transition-all"
                        style={{ background: "hsl(220 90% 56% / 0.15)", color: "hsl(220 90% 70%)", border: "1px solid hsl(220 90% 56% / 0.3)" }}
                      >{posizionePickingId === item.id ? "Chiudi mappa" : (hasPos ? "Modifica" : "Seleziona")}</button>
                    ) : (
                      <span className="text-xs italic" style={{ color: "hsl(215 15% 40%)" }}>Nessuna planimetria caricata</span>
                    )}
                    <button type="button" onClick={() => { removeItem(item.id); setPosizionePickingId(null); }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-all flex-shrink-0"
                      style={{ background: "hsl(0 60% 20%)", color: "hsl(0 70% 60%)", border: "1px solid hsl(0 60% 25%)" }}
                      title="Rimuovi voce">✕</button>
                  </div>
                  {/* Mappa picker inline */}
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
              />
            );
          })}
        </div>
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
}: {
  item: NoteItemDraft;
  onChange: (changes: Partial<NoteItemDraft>) => void;
  onRemove: () => void;
  catalogMaterials?: any[];
  onEditFoto?: (id: string, url: string) => void;
}) {
  const label = ITEM_LABELS[item.item_type];
  const isMeasure = MEASURE_TYPES.includes(item.item_type);
  const isBool = BOOL_TYPES.includes(item.item_type);
  const isNote = item.item_type === "nota";
  const isFoto = item.item_type === "foto";
  const isComposite = COMPOSITE_TYPES.includes(item.item_type);
  const isDim3D = item.item_type === "dim_cubica";
  const isMateriale = item.item_type === "materiale";

  // Helper per aggiornare il composite
  const updateComposite = (patch: Partial<CompositeValue>) => {
    onChange({ composite: { ...{ unit: "cm" }, ...item.composite, ...patch } });
  };

  // Layout verticale per i tipi compositi (hanno più campi)
  if (isComposite) {
    const cv = item.composite ?? { unit: "cm" };
    const unitSel = (
      <select
        value={cv.unit ?? "cm"}
        onChange={(e) => updateComposite({ unit: e.target.value as "mm" | "cm" })}
        className="px-2 py-2 rounded-lg text-sm outline-none cursor-pointer flex-shrink-0"
        style={{ background: "hsl(220 26% 18%)", border: "1px solid hsl(220 20% 24%)", color: "hsl(210 40% 85%)" }}
      >
        <option value="mm">mm</option>
        <option value="cm">cm</option>
      </select>
    );
    const numInput = (placeholder: string, val: number | null | undefined, key: "b" | "h" | "d") => (
      <div className="flex items-center gap-1.5 flex-1">
        <span className="text-xs flex-shrink-0" style={{ color: "hsl(215 15% 45%)", minWidth: 16 }}>
          {key === "b" ? "↔" : key === "h" ? "↕" : "↗"}
        </span>
        <input
          type="number" min="0" step="0.1"
          value={val ?? ""}
          onChange={(e) => updateComposite({ [key]: e.target.value ? parseFloat(e.target.value) : null })}
          placeholder={placeholder}
          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: "hsl(220 26% 14%)", border: "1px solid hsl(220 20% 22%)", color: "hsl(210 40% 96%)" }}
          data-1p-ignore autoComplete="off"
        />
      </div>
    );
    return (
      <div className="p-4 rounded-xl space-y-3" style={{ background: "hsl(220 32% 10%)", border: "1px solid hsl(220 20% 18%)" }}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium" style={{ color: "hsl(215 20% 65%)" }}>{label}</span>
          <div className="flex items-center gap-2">
            {unitSel}
            <button type="button" onClick={onRemove}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-all"
              style={{ background: "hsl(0 60% 20%)", color: "hsl(0 70% 60%)", border: "1px solid hsl(0 60% 25%)" }}
              title="Rimuovi voce">✕</button>
          </div>
        </div>
        <div className={`flex gap-2 ${isDim3D ? "flex-col sm:flex-row" : ""}`}>
          {numInput("Larghezza", cv.b, "b")}
          {numInput("Altezza", cv.h, "h")}
          {isDim3D && numInput("Profondità", cv.d, "d")}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-3 p-4 rounded-xl"
      style={{
        background: "hsl(220 32% 10%)",
        border: "1px solid hsl(220 20% 18%)",
      }}
    >
      {/* Label */}
      <span
        className="text-sm font-medium w-24 flex-shrink-0"
        style={{ color: "hsl(215 20% 65%)" }}
      >
        {label}
      </span>

      {/* Input misura */}
      {isMeasure && (
        <div className="flex flex-1 items-center gap-2">
          {/* Wrapper per evitare crash con estensioni */}
          <div className="flex-1 relative">
            <input
              type="number"
              min="0"
              step="0.1"
              value={item.value_num ?? ""}
              onChange={(e) =>
                onChange({ value_num: e.target.value ? parseFloat(e.target.value) : null })
              }
              placeholder="0"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                background: "hsl(220 26% 14%)",
                border: "1px solid hsl(220 20% 22%)",
                color: "hsl(210 40% 96%)",
              }}
              data-1p-ignore
              autoComplete="off"
            />
          </div>
          <select
            value={item.value_unit ?? "cm"}
            onChange={(e) =>
              onChange({ value_unit: e.target.value as "mm" | "cm" })
            }
            className="px-2 py-2 rounded-lg text-sm outline-none cursor-pointer"
            style={{
              background: "hsl(220 26% 18%)",
              border: "1px solid hsl(220 20% 24%)",
              color: "hsl(210 40% 85%)",
            }}
          >
            <option value="mm">mm</option>
            <option value="cm">cm</option>
          </select>
        </div>
      )}

      {/* Checkbox bool */}
      {isBool && (
        <div className="flex flex-1 items-center gap-3">
          <button
            type="button"
            onClick={() => onChange({ value_bool: !item.value_bool })}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold transition-all"
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
          <span className="text-sm" style={{ color: "hsl(215 20% 55%)" }}>
            {item.value_bool ? "Presente" : "Non presente"}
          </span>
        </div>
      )}

      {/* Textarea nota */}
      {isNote && (
        <textarea
          value={item.value_text ?? ""}
          onChange={(e) => onChange({ value_text: e.target.value })}
          placeholder="Scrivi una nota..."
          rows={2}
          className="flex-1 px-3 py-2 rounded-lg text-sm outline-none resize-none"
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
          value={item.value_text ?? ""}
          onChange={(e) => onChange({ value_text: e.target.value })}
          className="flex-1 px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
          style={{
            background: "hsl(220 26% 14%)",
            border: "1px solid hsl(220 20% 22%)",
            color: "hsl(210 40% 96%)",
          }}
        >
          <option value="">Seleziona un materiale...</option>
          {catalogMaterials.map((mat) => (
            <option key={mat.id} value={mat.name}>
              {mat.name} {mat.sku ? `(${mat.sku})` : ""}
            </option>
          ))}
        </select>
      )}

      {/* Foto */}
      {isFoto && (
        <div className="flex-1 space-y-2">
          {item.value_text ? (
            <div className="flex flex-col gap-2">
              <div className="relative inline-block w-fit">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={item.value_text} 
                  alt="Anteprima foto" 
                  className="h-24 w-auto rounded-lg object-cover" 
                  style={{ border: "1px solid hsl(220 20% 22%)" }}
                />
                <button
                  type="button"
                  onClick={() => onChange({ value_text: undefined })}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-md transition-all"
                  style={{ background: "hsl(0 70% 50%)", color: "white" }}
                  title="Rimuovi foto"
                >
                  ✕
                </button>
              </div>
              
              <button
                type="button"
                onClick={() => onEditFoto?.(item.id, item.value_text!)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all w-fit"
                style={{
                  background: "hsl(220 90% 56% / 0.15)",
                  color: "hsl(220 90% 70%)",
                  border: "1px solid hsl(220 90% 56% / 0.3)",
                }}
              >
                📐 Disegna Quote su Foto
              </button>
            </div>
          ) : (
            <div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  
                  // Comprimiamo e ridimensioniamo l'immagine per non superare il limite 1MB di Next.js
                  const reader = new FileReader();
                  reader.onload = (evt) => {
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
                      
                      // Esporta come JPEG compresso (qualità 0.7)
                      const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
                      onChange({ value_text: compressedBase64 });
                    };
                    img.src = evt.target?.result as string;
                  };
                  reader.readAsDataURL(file);
                }}
                className="w-full text-xs file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:text-white file:cursor-pointer cursor-pointer"
                style={{ color: "hsl(215 15% 50%)" }}
              />
              {/* Iniettiamo un po' di stile per il bottone file via classi inline dato che non possiamo usare tailwind complex qui */}
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
        onClick={onRemove}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-all flex-shrink-0 ml-1"
        style={{
          background: "hsl(0 60% 20%)",
          color: "hsl(0 70% 60%)",
          border: "1px solid hsl(0 60% 25%)",
        }}
        title="Rimuovi voce"
      >
        ✕
      </button>
    </div>
  );
}
