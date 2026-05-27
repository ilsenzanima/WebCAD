"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createMaterial } from "@/app/actions/materials";

interface OptionItem { value: string; label: string; }
interface Props { categories: OptionItem[]; units: OptionItem[]; }

export default function NewMaterialForm({ categories, units }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const defaultName = searchParams.get("name") || "";
  const defaultCategory = searchParams.get("category") || "";
  const defaultUnit = searchParams.get("unit") || "";

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleAction = async (formData: FormData) => {
    setErrorMessage(null);
    setIsSaving(true);

    try {
      const result = await createMaterial(formData);

      if (result?.success) {
        router.push("/catalog");
        return;
      }

      setErrorMessage(result?.message || "Errore durante il salvataggio del materiale.");
    } catch (err: any) {
      setErrorMessage("Errore imprevisto durante il salvataggio.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl animate-fade-in">
      <div className="mb-6">
        <Link href="/catalog" className="text-sm transition-colors" style={{ color: "hsl(215 20% 65%)" }}>← Torna al catalogo</Link>
        <h1 className="text-2xl font-bold text-white mt-4">Nuovo Materiale</h1>
        <p className="mt-1 text-sm" style={{ color: "hsl(215 20% 55%)" }}>Definisci rapidamente le specifiche del materiale.</p>
      </div>

      {errorMessage && (
        <div className="mb-6 flex items-start gap-3 rounded-xl p-4 text-sm" style={{ background: "hsl(0 84% 60% / 0.12)", color: "hsl(0 84% 75%)" }}>
          <span>⚠️ {errorMessage}</span>
        </div>
      )}

      <form action={handleAction} autoComplete="off" data-1p-ignore data-lpignore="true" className="space-y-6">
        <div className="p-6 rounded-2xl space-y-6" style={{ background: "hsl(220 26% 14%)", border: "1px solid hsl(220 20% 20%)" }}>
          <div className="space-y-1.5">
            <label htmlFor="name" className="block text-sm" style={{ color: "hsl(215 20% 75%)" }}>Nome Materiale *</label>
            <input 
              id="name" 
              name="name" 
              type="text" 
              required 
              defaultValue={defaultName}
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              className="w-full px-4 py-3 rounded-xl text-sm text-white" 
              style={{ background: "hsl(222 47% 6%)", border: "1px solid hsl(220 20% 22%)" }} 
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="category" className="block text-sm" style={{ color: "hsl(215 20% 75%)" }}>Categoria *</label>
              <select id="category" name="category" defaultValue={defaultCategory} className="w-full px-4 py-3 rounded-xl text-sm text-white cursor-pointer" style={{ background: "hsl(222 47% 6%)", border: "1px solid hsl(220 20% 22%)" }}>
                {categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="unit" className="block text-sm" style={{ color: "hsl(215 20% 75%)" }}>Unità di Misura *</label>
              <select id="unit" name="unit" defaultValue={defaultUnit} className="w-full px-4 py-3 rounded-xl text-sm text-white cursor-pointer" style={{ background: "hsl(222 47% 6%)", border: "1px solid hsl(220 20% 22%)" }}>
                {units.map((unit) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5"><label htmlFor="length_mm" className="block text-sm" style={{ color: "hsl(215 20% 75%)" }}>Lunghezza (mm)</label><input id="length_mm" name="length_mm" type="number" step="0.1" autoComplete="off" className="w-full px-4 py-3 rounded-xl text-sm text-white" style={{ background: "hsl(222 47% 6%)", border: "1px solid hsl(220 20% 22%)" }} /></div>
            <div className="space-y-1.5"><label htmlFor="width_mm" className="block text-sm" style={{ color: "hsl(215 20% 75%)" }}>Larghezza (mm)</label><input id="width_mm" name="width_mm" type="number" step="0.1" autoComplete="off" className="w-full px-4 py-3 rounded-xl text-sm text-white" style={{ background: "hsl(222 47% 6%)", border: "1px solid hsl(220 20% 22%)" }} /></div>
            <div className="space-y-1.5"><label htmlFor="thickness_mm" className="block text-sm" style={{ color: "hsl(215 20% 75%)" }}>Spessore (mm)</label><input id="thickness_mm" name="thickness_mm" type="number" step="0.1" autoComplete="off" className="w-full px-4 py-3 rounded-xl text-sm text-white" style={{ background: "hsl(222 47% 6%)", border: "1px solid hsl(220 20% 22%)" }} /></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="supplier" className="block text-sm" style={{ color: "hsl(215 20% 75%)" }}>Fornitore</label>
              <input 
                id="supplier" 
                name="supplier" 
                type="text" 
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                className="w-full px-4 py-3 rounded-xl text-sm text-white" 
                style={{ background: "hsl(222 47% 6%)", border: "1px solid hsl(220 20% 22%)" }} 
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="grain_direction" className="block text-sm" style={{ color: "hsl(215 20% 75%)" }}>Orientamento Taglio (Verso Nesting)</label>
              <select 
                id="grain_direction" 
                name="grain_direction" 
                defaultValue="libero"
                className="w-full px-4 py-3 rounded-xl text-sm text-white cursor-pointer" 
                style={{ background: "hsl(222 47% 6%)", border: "1px solid hsl(220 20% 22%)" }}
              >
                <option value="libero">Libero (Ruotabile ↔ ↕ - Consigliato)</option>
                <option value="lunghezza">Lungo la Lunghezza (Non ruotabile ↔)</option>
                <option value="larghezza">Lungo la Larghezza (Non ruotabile ↕)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link href="/catalog" className="px-5 py-3 rounded-xl text-sm font-semibold transition-colors" style={{ color: "hsl(215 20% 75%)", background: "hsl(220 20% 22%)" }}>Annulla</Link>
          <button type="submit" disabled={isSaving} className="px-5 py-3 rounded-xl font-semibold text-sm text-white transition-all duration-200" style={{ background: isSaving ? "hsl(16 80% 45%)" : "linear-gradient(135deg, hsl(16 100% 58%), hsl(0 84% 50%))", cursor: isSaving ? "not-allowed" : "pointer" }}>
            {isSaving ? "Salvataggio..." : "Salva Materiale"}
          </button>
        </div>
      </form>
    </div>
  );
}
