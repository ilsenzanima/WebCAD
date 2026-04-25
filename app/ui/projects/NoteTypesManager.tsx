"use client";

import { useState, useTransition } from "react";
import {
  createNoteType,
  deleteNoteType,
  type FieldNoteType,
} from "@/app/actions/field-notes";

interface Props {
  initialTypes: FieldNoteType[];
}

export default function NoteTypesManager({ initialTypes }: Props) {
  const [types, setTypes] = useState<FieldNoteType[]>(initialTypes);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    setError(null);
    startTransition(async () => {
      const res = await createNoteType(name);
      if (res.success && res.type) {
        setTypes((prev) =>
          [...prev, res.type!].sort((a, b) => a.name.localeCompare(b.name))
        );
        setNewName("");
      } else {
        setError(res.error ?? "Errore");
      }
    });
  }

  function handleDelete(id: string) {
    setDeletingId(id);
    startTransition(async () => {
      const res = await deleteNoteType(id);
      if (res.success) {
        setTypes((prev) => prev.filter((t) => t.id !== id));
      } else {
        setError(res.error ?? "Errore");
      }
      setDeletingId(null);
    });
  }

  return (
    <div className="max-w-xl space-y-6">
      {/* Errore */}
      {error && (
        <div
          className="px-4 py-3 rounded-xl text-sm"
          style={{
            background: "hsl(0 70% 15%)",
            color: "hsl(0 80% 70%)",
            border: "1px solid hsl(0 70% 25%)",
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* Aggiungi nuovo tipo */}
      <div
        className="rounded-2xl p-5 space-y-3"
        style={{
          background: "hsl(220 26% 14%)",
          border: "1px solid hsl(220 20% 20%)",
        }}
      >
        <label className="block text-sm font-semibold text-white">
          Aggiungi nuovo tipo
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Es. Parete, Soffitto, Porta..."
            className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
            style={{
              background: "hsl(220 32% 10%)",
              border: "1px solid hsl(220 20% 22%)",
              color: "hsl(210 40% 96%)",
            }}
          />
          <button
            onClick={handleAdd}
            disabled={isPending || !newName.trim()}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
            style={{
              background:
                "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
              boxShadow: "0 4px 12px hsl(220 90% 56% / 0.3)",
            }}
          >
            Aggiungi
          </button>
        </div>
      </div>

      {/* Lista tipi */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "hsl(220 26% 14%)",
          border: "1px solid hsl(220 20% 20%)",
        }}
      >
        <div
          className="px-5 py-3 text-xs font-semibold uppercase tracking-wider"
          style={{
            color: "hsl(215 15% 45%)",
            borderBottom: "1px solid hsl(220 20% 18%)",
          }}
        >
          Tipi configurati ({types.length})
        </div>

        {types.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm" style={{ color: "hsl(215 15% 45%)" }}>
            Nessun tipo ancora. Aggiungine uno qui sopra.
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: "hsl(220 20% 18%)" }}>
            {types.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between px-5 py-3.5 group transition-colors hover:bg-white/[0.02]"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: "hsl(220 90% 56%)" }}
                  />
                  <span className="text-sm text-white font-medium">{t.name}</span>
                </div>
                <button
                  onClick={() => handleDelete(t.id)}
                  disabled={isPending && deletingId === t.id}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-xs px-2.5 py-1 rounded-lg"
                  style={{
                    background: "hsl(0 60% 20%)",
                    color: "hsl(0 70% 65%)",
                    border: "1px solid hsl(0 60% 28%)",
                  }}
                  title="Elimina tipo"
                >
                  {deletingId === t.id ? "..." : "Elimina"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
