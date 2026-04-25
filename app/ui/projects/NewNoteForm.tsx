"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  createFieldNote,
  createNoteType,
  type FieldNoteType,
  type FieldNoteItem,
} from "@/app/actions/field-notes";

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
  value_text?: string;
}

const ITEM_LABELS: Record<ItemType, string> = {
  base: "Base",
  altezza: "Altezza",
  spessore: "Spessore",
  lana_interna: "Lana interna",
  dipintura: "Dipintura",
  nota: "Nota libera",
};

const MEASURE_TYPES: ItemType[] = ["base", "altezza", "spessore"];
const BOOL_TYPES: ItemType[] = ["lana_interna", "dipintura"];

// ============================================
// Props
// ============================================

interface Props {
  projectId: string;
  noteTypes: FieldNoteType[];
}

// ============================================
// Componente principale
// ============================================

export default function NewNoteForm({ projectId, noteTypes }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // --- Tipo appunto ---
  const [typeFilter, setTypeFilter] = useState("");
  const [selectedType, setSelectedType] = useState<FieldNoteType | null>(null);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [allTypes, setAllTypes] = useState<FieldNoteType[]>(noteTypes);
  const [isCreatingType, setIsCreatingType] = useState(false);
  const typeInputRef = useRef<HTMLInputElement>(null);

  const filteredTypes = allTypes.filter((t) =>
    t.name.toLowerCase().includes(typeFilter.toLowerCase())
  );
  const noMatch = typeFilter.trim() !== "" && filteredTypes.length === 0;

  // --- Voci misure ---
  const [items, setItems] = useState<NoteItemDraft[]>([]);
  const [showItemDropdown, setShowItemDropdown] = useState(false);

  // --- Errori ---
  const [error, setError] = useState<string | null>(null);

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
      const res = await createFieldNote({
        project_id: projectId,
        type_id: selectedType?.id ?? null,
        type_name: selectedType?.name ?? null,
        items: items.map((item, idx) => ({
          item_type: item.item_type,
          value_num: MEASURE_TYPES.includes(item.item_type) ? (item.value_num ?? null) : null,
          value_unit: MEASURE_TYPES.includes(item.item_type) ? (item.value_unit ?? "cm") : null,
          value_bool: BOOL_TYPES.includes(item.item_type) ? (item.value_bool ?? true) : null,
          value_text: item.item_type === "nota" ? (item.value_text ?? null) : null,
          sort_order: idx,
        })),
      });

      if (res.success) {
        router.push(`/projects/${projectId}/appunti`);
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
          <input
            ref={typeInputRef}
            type="text"
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setSelectedType(null);
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
          />

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
                    onMouseDown={handleQuickCreateType}
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

      {/* ── Voci / Misure ── */}
      <div
        className="rounded-2xl p-6 space-y-4"
        style={{ background: "hsl(220 26% 14%)", border: "1px solid hsl(220 20% 20%)" }}
      >
        <div className="flex items-center justify-between">
          <label className="block text-sm font-semibold text-white">
            Misure e note
          </label>

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
                {(Object.keys(ITEM_LABELS) as ItemType[]).map((type) => (
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
              </div>
            )}
          </div>
        </div>

        {items.length === 0 && (
          <p className="text-sm text-center py-6" style={{ color: "hsl(215 15% 40%)" }}>
            Clicca "＋" per aggiungere misure o note.
          </p>
        )}

        <div className="space-y-3">
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onChange={(changes) => updateItem(item.id, changes)}
              onRemove={() => removeItem(item.id)}
            />
          ))}
        </div>
      </div>

      {/* ── Pulsanti ── */}
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3 sm:justify-end pb-8">
        <button
          type="button"
          onClick={() => router.back()}
          disabled={isPending}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: "hsl(220 26% 14%)",
            border: "1px solid hsl(220 20% 24%)",
            color: "hsl(215 20% 65%)",
          }}
        >
          Annulla
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || !selectedType}
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
  );
}

// ============================================
// Sotto-componente: singola voce
// ============================================

function ItemRow({
  item,
  onChange,
  onRemove,
}: {
  item: NoteItemDraft;
  onChange: (changes: Partial<NoteItemDraft>) => void;
  onRemove: () => void;
}) {
  const label = ITEM_LABELS[item.item_type];
  const isMeasure = MEASURE_TYPES.includes(item.item_type);
  const isBool = BOOL_TYPES.includes(item.item_type);
  const isNote = item.item_type === "nota";

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
          <input
            type="number"
            min="0"
            step="0.1"
            value={item.value_num ?? ""}
            onChange={(e) =>
              onChange({ value_num: e.target.value ? parseFloat(e.target.value) : null })
            }
            placeholder="0"
            className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
            style={{
              background: "hsl(220 26% 14%)",
              border: "1px solid hsl(220 20% 22%)",
              color: "hsl(210 40% 96%)",
            }}
          />
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
