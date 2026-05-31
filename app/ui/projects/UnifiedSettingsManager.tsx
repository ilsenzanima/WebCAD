"use client";

import { useMemo, useState, useTransition } from "react";
import { createUserTag, deleteUserTag, type UserTag } from "@/app/actions/settings";

type TabKey = "material_category" | "material_unit";

interface Props {
  initialNoteTypes?: any[]; // Non più utilizzato ma mantenuto per compatibilità prop
  initialMaterialCategories: UserTag[];
  initialMaterialUnits: UserTag[];
}

export default function UnifiedSettingsManager({
  initialMaterialCategories,
  initialMaterialUnits,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("material_category");
  const [materialCategories, setMaterialCategories] = useState(initialMaterialCategories);
  const [materialUnits, setMaterialUnits] = useState(initialMaterialUnits);
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const tabs = [
    { key: "material_category" as const, label: "Materiali", icon: "📦" },
    { key: "material_unit" as const, label: "Unità di Misura", icon: "📏" },
  ];

  const currentItems = useMemo(() => {
    if (activeTab === "material_category") return materialCategories.map((item) => ({ id: item.id, name: item.name }));
    return materialUnits.map((item) => ({ id: item.id, name: item.name }));
  }, [activeTab, materialCategories, materialUnits]);

  function handleAdd() {
    const value = inputValue.trim();
    if (!value) return;

    setError(null);
    startTransition(async () => {
      const res = await createUserTag(activeTab, value);
      if (res.success && res.tag) {
        if (activeTab === "material_category") {
          setMaterialCategories((prev) => [...prev, res.tag!].sort((a, b) => a.name.localeCompare(b.name)));
        } else {
          setMaterialUnits((prev) => [...prev, res.tag!].sort((a, b) => a.name.localeCompare(b.name)));
        }
        setInputValue("");
      } else {
        setError(res.error ?? "Errore durante la creazione");
      }
    });
  }

  function handleDelete(id: string) {
    setDeletingId(id);
    setError(null);
    startTransition(async () => {
      const res = await deleteUserTag(id);
      if (res.success) {
        if (activeTab === "material_category") {
          setMaterialCategories((prev) => prev.filter((item) => item.id !== id));
        } else {
          setMaterialUnits((prev) => prev.filter((item) => item.id !== id));
        }
      } else {
        setError(res.error ?? "Errore durante l'eliminazione");
      }
      setDeletingId(null);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="px-4 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer"
            style={{
              background: activeTab === tab.key ? "hsl(220 90% 56%)" : "hsl(220 26% 14%)",
              color: activeTab === tab.key ? "white" : "hsl(215 20% 75%)",
              border: "1px solid hsl(220 20% 22%)",
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl p-5 space-y-4" style={{ background: "hsl(220 26% 14%)", border: "1px solid hsl(220 20% 20%)" }}>
        <div className="flex gap-2">
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Inserisci nuova voce..."
            className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: "hsl(220 32% 10%)", border: "1px solid hsl(220 20% 22%)", color: "hsl(210 40% 96%)" }}
          />
          <button
            onClick={handleAdd}
            disabled={!inputValue.trim() || isPending}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 cursor-pointer"
            style={{ background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))" }}
          >
            Aggiungi
          </button>
        </div>

        {error && <p className="text-sm" style={{ color: "hsl(0 80% 70%)" }}>⚠️ {error}</p>}

        <div className="flex flex-wrap gap-2">
          {currentItems.length === 0 ? (
            <span className="text-sm" style={{ color: "hsl(215 15% 45%)" }}>Nessuna voce configurata.</span>
          ) : (
            currentItems.map((item) => (
              <span
                key={item.id}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all"
                style={{ background: "hsl(220 32% 20%)", color: "hsl(210 40% 96%)" }}
              >
                {item.name}
                <button
                  onClick={() => handleDelete(item.id)}
                  className="w-5 h-5 rounded-full text-xs cursor-pointer flex items-center justify-center"
                  style={{ background: "hsl(0 60% 24%)", color: "hsl(0 70% 75%)" }}
                  disabled={isPending && deletingId === item.id}
                  aria-label={`Elimina ${item.name}`}
                >
                  x
                </button>
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
