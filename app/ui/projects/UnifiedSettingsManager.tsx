"use client";

import { useMemo, useState, useTransition } from "react";
import { createUserTag, deleteUserTag, updateUserTag, type UserTag } from "@/app/actions/settings";

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
  
  // Stati per la creazione
  const [inputValue, setInputValue] = useState("");
  const [thicknessValue, setThicknessValue] = useState("0");

  // Stati per la modifica (editing)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingThickness, setEditingThickness] = useState("0");

  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const tabs = [
    { key: "material_category" as const, label: "Materiali", icon: "📦" },
    { key: "material_unit" as const, label: "Unità di Misura", icon: "📏" },
  ];

  const currentItems = useMemo(() => {
    if (activeTab === "material_category") {
      return materialCategories.map((item) => ({
        id: item.id,
        name: item.name,
        thickness_mm: item.thickness_mm ?? 0,
      }));
    }
    return materialUnits.map((item) => ({ id: item.id, name: item.name }));
  }, [activeTab, materialCategories, materialUnits]);

  function handleAdd() {
    const value = inputValue.trim();
    if (!value) return;

    const thickness = activeTab === "material_category" ? (parseFloat(thicknessValue) || 0) : 0;

    setError(null);
    startTransition(async () => {
      const res = await createUserTag(activeTab, value, thickness);
      if (res.success && res.tag) {
        if (activeTab === "material_category") {
          setMaterialCategories((prev) => [...prev, res.tag!].sort((a, b) => a.name.localeCompare(b.name)));
        } else {
          setMaterialUnits((prev) => [...prev, res.tag!].sort((a, b) => a.name.localeCompare(b.name)));
        }
        setInputValue("");
        setThicknessValue("0");
      } else {
        setError(res.error ?? "Errore durante la creazione");
      }
    });
  }

  function handleUpdate(id: string) {
    const name = editingName.trim();
    if (!name) return;

    const thickness = activeTab === "material_category" ? (parseFloat(editingThickness) || 0) : 0;

    setError(null);
    startTransition(async () => {
      const res = await updateUserTag(id, name, thickness);
      if (res.success && res.tag) {
        if (activeTab === "material_category") {
          setMaterialCategories((prev) =>
            prev.map((item) => (item.id === id ? res.tag! : item)).sort((a, b) => a.name.localeCompare(b.name))
          );
        } else {
          setMaterialUnits((prev) =>
            prev.map((item) => (item.id === id ? res.tag! : item)).sort((a, b) => a.name.localeCompare(b.name))
          );
        }
        setEditingId(null);
      } else {
        setError(res.error ?? "Errore durante l'aggiornamento");
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
            onClick={() => {
              setActiveTab(tab.key);
              setEditingId(null);
              setError(null);
            }}
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
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder={activeTab === "material_category" ? "Nome materiale (es. Lastra Silicato)..." : "Unità di misura (es. cm)..."}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: "hsl(220 32% 10%)", border: "1px solid hsl(220 20% 22%)", color: "hsl(210 40% 96%)" }}
          />
          {activeTab === "material_category" && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                value={thicknessValue}
                onChange={(e) => setThicknessValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="Spessore (mm)"
                className="w-32 px-4 py-2.5 rounded-xl text-sm outline-none font-bold"
                style={{ background: "hsl(220 32% 10%)", border: "1px solid hsl(220 20% 22%)", color: "hsl(210 40% 96%)" }}
              />
              <span className="text-xs text-gray-400">mm</span>
            </div>
          )}
          <button
            onClick={handleAdd}
            disabled={!inputValue.trim() || isPending}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 cursor-pointer whitespace-nowrap"
            style={{ background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))" }}
          >
            Aggiungi
          </button>
        </div>

        {error && <p className="text-sm" style={{ color: "hsl(0 80% 70%)" }}>⚠️ {error}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
          {currentItems.length === 0 ? (
            <span className="text-sm col-span-full" style={{ color: "hsl(215 15% 45%)" }}>Nessuna voce configurata.</span>
          ) : (
            currentItems.map((item: any) => {
              const isEditing = editingId === item.id;

              if (isEditing) {
                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl border flex flex-col gap-2.5 col-span-1"
                    style={{ background: "hsl(220 32% 10%)", borderColor: "hsl(220 90% 56% / 0.5)" }}
                  >
                    <input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      placeholder="Nome voce..."
                      className="w-full px-3 py-1.5 rounded-lg text-xs outline-none bg-white/5 border border-white/10 text-white"
                    />
                    {activeTab === "material_category" && (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.1"
                          value={editingThickness}
                          onChange={(e) => setEditingThickness(e.target.value)}
                          placeholder="Spessore (mm)"
                          className="w-full px-3 py-1.5 rounded-lg text-xs outline-none bg-white/5 border border-white/10 text-white font-bold"
                        />
                        <span className="text-[10px] text-gray-400">mm</span>
                      </div>
                    )}
                    <div className="flex justify-end gap-1.5 mt-1">
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white/5 hover:bg-white/10 text-white cursor-pointer"
                      >
                        Annulla
                      </button>
                      <button
                        onClick={() => handleUpdate(item.id)}
                        disabled={isPending || !editingName.trim()}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-white cursor-pointer bg-gradient-to-r from-blue-600 to-sky-600"
                      >
                        Salva
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={item.id}
                  className="flex justify-between items-center px-4 py-3 rounded-xl border transition-all hover:bg-white/[0.02]"
                  style={{ background: "hsl(220 32% 18% / 0.4)", borderColor: "hsl(220 20% 22%)" }}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-white truncate">{item.name}</span>
                    {activeTab === "material_category" && (
                      <span className="text-[10px] text-gray-400 font-bold mt-0.5">
                        📐 Spessore: {item.thickness_mm} mm
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {/* Pulsante Modifica */}
                    <button
                      onClick={() => {
                        setEditingId(item.id);
                        setEditingName(item.name);
                        setEditingThickness(String(item.thickness_mm ?? 0));
                        setError(null);
                      }}
                      className="w-7 h-7 rounded-lg text-xs hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
                      title={`Modifica ${item.name}`}
                    >
                      ✏️
                    </button>
                    {/* Pulsante Elimina */}
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="w-7 h-7 rounded-lg text-xs hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors cursor-pointer flex items-center justify-center"
                      disabled={isPending && deletingId === item.id}
                      title={`Elimina ${item.name}`}
                    >
                      {isPending && deletingId === item.id ? "..." : "🗑️"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
