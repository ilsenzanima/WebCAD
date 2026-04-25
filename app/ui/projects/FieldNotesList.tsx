"use client";

import { useState } from "react";
import type { FieldNote, FieldNoteItem } from "@/app/actions/field-notes";

interface Props {
  notes: FieldNote[];
}

const ITEM_LABELS: Record<FieldNoteItem["item_type"], string> = {
  base: "Base",
  altezza: "Altezza",
  spessore: "Spessore",
  lana_interna: "Lana interna",
  dipintura: "Dipintura",
  nota: "Nota",
  foto: "Foto",
};

const MEASURE_TYPES = ["base", "altezza", "spessore"] as const;
const BOOL_TYPES = ["lana_interna", "dipintura"] as const;

export default function FieldNotesList({ notes }: Props) {
  if (notes.length === 0) {
    return (
      <div
        className="p-12 text-center rounded-2xl"
        style={{
          border: "1px dashed hsl(220 20% 24%)",
          background: "hsl(220 26% 14%)",
        }}
      >
        <div className="text-4xl mb-4">📋</div>
        <p className="text-sm font-medium" style={{ color: "hsl(215 15% 55%)" }}>
          Nessun appunto ancora.
        </p>
        <p className="text-xs mt-1" style={{ color: "hsl(215 15% 40%)" }}>
          Clicca "＋ Nuovo Appunto" per iniziare.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {notes.map((note) => (
        <NoteRow key={note.id} note={note} />
      ))}
    </ul>
  );
}

// ============================================
// Singola riga espandibile
// ============================================

function NoteRow({ note }: { note: FieldNote }) {
  const [open, setOpen] = useState(false);
  const items = note.field_note_items ?? [];
  const hasItems = items.length > 0;

  return (
    <li
      className="rounded-2xl overflow-hidden transition-all duration-200"
      style={{
        background: "hsl(220 26% 14%)",
        border: `1px solid ${open ? "hsl(220 90% 56%)" : "hsl(220 20% 20%)"}`,
        boxShadow: open ? "0 4px 20px rgba(0,0,0,0.35)" : "none",
      }}
    >
      {/* ── Intestazione (sempre visibile) ── */}
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-4 px-4 py-4 sm:px-5 text-left transition-colors"
        style={{ cursor: hasItems ? "pointer" : "default" }}
        aria-expanded={open}
      >
        {/* Badge numero */}
        <div
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-white font-bold text-xs sm:text-sm flex-shrink-0"
          style={{
            background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
          }}
        >
          #{note.note_number}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="text-white font-semibold text-sm truncate">
            {note.type_name ?? (
              <span className="italic" style={{ color: "hsl(215 15% 45%)" }}>
                Tipo non specificato
              </span>
            )}
          </div>
          <div className="text-xs mt-0.5" style={{ color: "hsl(215 15% 45%)" }}>
            {new Date(note.created_at).toLocaleDateString("it-IT", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {hasItems && (
              <span className="ml-2" style={{ color: "hsl(220 70% 60%)" }}>
                · {items.length} {items.length === 1 ? "voce" : "voci"}
              </span>
            )}
          </div>
        </div>

        {/* Chevron */}
        {hasItems && (
          <span
            className="flex-shrink-0 text-xs transition-transform duration-300"
            style={{
              color: "hsl(215 15% 50%)",
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              display: "inline-block",
            }}
          >
            ▼
          </span>
        )}
      </button>

      {/* ── Dettaglio (espandibile) ── */}
      {open && (
        <div
          className="px-4 pb-4 sm:px-5 sm:pb-5 space-y-2"
          style={{ borderTop: "1px solid hsl(220 20% 18%)" }}
        >
          {hasItems ? (
            <div className="pt-3 space-y-2">
              {items
                .slice()
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((item) => (
                  <ItemDetail key={item.id} item={item} />
                ))}
            </div>
          ) : (
            <div
              className="text-xs italic pt-3"
              style={{ color: "hsl(215 15% 40%)" }}
            >
              Nessuna voce aggiunta per questo appunto.
            </div>
          )}

          {/* Azioni: Modifica */}
          <div className="pt-4 flex justify-end">
             <a
               href={`/projects/${note.project_id}/levels/${note.level_id}/appunti/${note.id}/modifica`}
               className="px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-150"
               style={{
                 background: "hsl(220 26% 20%)",
                 color: "hsl(210 40% 90%)",
                 border: "1px solid hsl(220 20% 26%)",
               }}
             >
               ✏️ Modifica Appunto
             </a>
          </div>
        </div>
      )}
    </li>
  );
}

// ============================================
// Singola voce dettaglio
// ============================================

function ItemDetail({ item }: { item: FieldNoteItem }) {
  const label = ITEM_LABELS[item.item_type];
  const isMeasure = (MEASURE_TYPES as readonly string[]).includes(item.item_type);
  const isBool = (BOOL_TYPES as readonly string[]).includes(item.item_type);

  return (
    <div
      className="flex items-center justify-between px-3 py-2.5 rounded-xl"
      style={{
        background: "hsl(220 32% 10%)",
        border: "1px solid hsl(220 20% 18%)",
      }}
    >
      <span className="text-xs font-medium" style={{ color: "hsl(215 20% 55%)" }}>
        {label}
      </span>

      <span className="text-sm font-semibold" style={{ color: "hsl(210 40% 90%)" }}>
        {isMeasure && item.value_num != null && (
          <>{item.value_num} {item.value_unit ?? "cm"}</>
        )}
        {isMeasure && item.value_num == null && (
          <span className="italic text-xs" style={{ color: "hsl(215 15% 40%)" }}>—</span>
        )}
        {isBool && (
          <span
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
            style={{
              background: item.value_bool ? "hsl(142 60% 15%)" : "hsl(220 26% 18%)",
              color: item.value_bool ? "hsl(142 60% 55%)" : "hsl(215 15% 45%)",
            }}
          >
            {item.value_bool ? "✓ Presente" : "✗ Non presente"}
          </span>
        )}
        {item.item_type === "nota" && (
          <span className="text-xs leading-relaxed" style={{ color: "hsl(210 30% 80%)" }}>
            {item.value_text ?? "—"}
          </span>
        )}
        {item.item_type === "foto" && (
          <span className="text-xs italic" style={{ color: "hsl(215 15% 40%)" }}>
            [Immagine allegata]
          </span>
        )}
      </span>
    </div>
  );
}
