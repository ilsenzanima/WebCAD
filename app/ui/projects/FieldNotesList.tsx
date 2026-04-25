"use client";

import type { FieldNote } from "@/app/actions/field-notes";

interface Props {
  notes: FieldNote[];
}

export default function FieldNotesList({ notes }: Props) {
  if (notes.length === 0) {
    return (
      <div
        className="p-16 text-center rounded-2xl"
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
          Clicca "Nuovo Appunto" per iniziare.
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

function NoteRow({ note }: { note: FieldNote }) {
  return (
    <li>
      <div
        className="flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-200 cursor-default"
        style={{
          background: "hsl(220 26% 14%)",
          border: "1px solid hsl(220 20% 20%)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "hsl(220 90% 56%)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.3)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "hsl(220 20% 20%)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
        }}
      >
        {/* Badge numero */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
          style={{
            background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
          }}
        >
          #{note.note_number}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="text-white font-semibold text-sm">
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
          </div>
        </div>

        {/* Badge tipo */}
        {note.type_name && (
          <span
            className="text-xs px-2.5 py-1 rounded-lg font-medium flex-shrink-0"
            style={{
              background: "hsl(220 32% 20%)",
              color: "hsl(215 20% 65%)",
            }}
          >
            {note.type_name}
          </span>
        )}
      </div>
    </li>
  );
}
