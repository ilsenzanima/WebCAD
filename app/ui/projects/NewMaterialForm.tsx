"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createMaterial, type MaterialFormState } from "@/app/actions/materials";

interface OptionItem { value: string; label: string; }

interface Props {
  categories: OptionItem[];
  units: OptionItem[];
}

export default function NewMaterialForm({ categories, units }: Props) {
  const router = useRouter();
  const [state, action, pending] = useActionState<MaterialFormState, FormData>(
    createMaterial,
    undefined
  );

  useEffect(() => {
    if (state?.success) {
      router.push("/catalog");
    }
  }, [state, router]);

  return (
    <div className="p-8 max-w-3xl animate-fade-in">
      <div className="mb-6">
        <Link
          href="/catalog"
          className="text-sm transition-colors"
          style={{ color: "hsl(215 20% 65%)" }}
        >
          ← Torna al catalogo
        </Link>
        <h1 className="text-2xl font-bold text-white mt-4">Nuovo Materiale</h1>
        <p className="mt-1 text-sm" style={{ color: "hsl(215 20% 55%)" }}>
          Definisci le specifiche del materiale (dimensioni, SKU, costo).
        </p>
      </div>

      {state?.message && (
        <div
          className="mb-6 flex items-start gap-3 rounded-xl p-4 text-sm"
          style={{ background: "hsl(0 84% 60% / 0.12)", color: "hsl(0 84% 75%)" }}
        >
          <span>⚠️ {state.message}</span>
        </div>
      )}

      <form action={action} autoComplete="off" data-1p-ignore data-lpignore="true" className="space-y-6">
        {/* Campi fittizi per disattivare l'autofill aggressivo delle estensioni browser */}
        <input type="text" name="prevent_autofill_username" style={{ display: "none" }} autoComplete="off" />
        <input type="password" name="prevent_autofill_password" style={{ display: "none" }} autoComplete="off" />

        <div
          className="p-6 rounded-2xl space-y-6"
          style={{ background: "hsl(220 26% 14%)", border: "1px solid hsl(220 20% 20%)" }}
        >
          {/* Riga 1: Nome e SKU */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="name" className="block text-sm" style={{ color: "hsl(215 20% 75%)" }}>
                Nome Materiale *
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                className="w-full px-4 py-3 rounded-xl text-sm text-white"
                style={{ background: "hsl(222 47% 6%)", border: "1px solid hsl(220 20% 22%)" }}
              />
              {state?.errors?.name && <p className="text-xs text-red-500">{state.errors.name[0]}</p>}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="sku" className="block text-sm" style={{ color: "hsl(215 20% 75%)" }}>
                SKU / Codice Prodotto
              </label>
              <input
                id="sku"
                name="sku"
                type="text"
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                className="w-full px-4 py-3 rounded-xl text-sm text-white"
                style={{ background: "hsl(222 47% 6%)", border: "1px solid hsl(220 20% 22%)" }}
              />
            </div>
          </div>

          {/* Riga 2: Categoria e U.M. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="category" className="block text-sm" style={{ color: "hsl(215 20% 75%)" }}>
                Categoria *
              </label>
              <select
                id="category"
                name="category"
                className="w-full px-4 py-3 rounded-xl text-sm text-white"
                style={{ background: "hsl(222 47% 6%)", border: "1px solid hsl(220 20% 22%)" }}
              >
                {categories.map((category) => (
                  <option key={category.value} value={category.value}>{category.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="unit" className="block text-sm" style={{ color: "hsl(215 20% 75%)" }}>
                Unità di Misura *
              </label>
              <select
                id="unit"
                name="unit"
                className="w-full px-4 py-3 rounded-xl text-sm text-white"
                style={{ background: "hsl(222 47% 6%)", border: "1px solid hsl(220 20% 22%)" }}
              >
                {units.map((unit) => (
                  <option key={unit.value} value={unit.value}>{unit.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Riga 3: Dimensioni fisiche */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="length_mm" className="block text-sm" style={{ color: "hsl(215 20% 75%)" }}>
                Lunghezza (mm)
              </label>
              <input
                id="length_mm"
                name="length_mm"
                type="number"
                step="0.1"
                className="w-full px-4 py-3 rounded-xl text-sm text-white"
                style={{ background: "hsl(222 47% 6%)", border: "1px solid hsl(220 20% 22%)" }}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="width_mm" className="block text-sm" style={{ color: "hsl(215 20% 75%)" }}>
                Larghezza (mm)
              </label>
              <input
                id="width_mm"
                name="width_mm"
                type="number"
                step="0.1"
                className="w-full px-4 py-3 rounded-xl text-sm text-white"
                style={{ background: "hsl(222 47% 6%)", border: "1px solid hsl(220 20% 22%)" }}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="thickness_mm" className="block text-sm" style={{ color: "hsl(215 20% 75%)" }}>
                Spessore (mm)
              </label>
              <input
                id="thickness_mm"
                name="thickness_mm"
                type="number"
                step="0.1"
                className="w-full px-4 py-3 rounded-xl text-sm text-white"
                style={{ background: "hsl(222 47% 6%)", border: "1px solid hsl(220 20% 22%)" }}
              />
            </div>
          </div>

          {/* Riga 4: Costo e Fornitore */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="unit_cost" className="block text-sm" style={{ color: "hsl(215 20% 75%)" }}>
                Costo Unitario (€)
              </label>
              <input
                id="unit_cost"
                name="unit_cost"
                type="number"
                step="0.01"
                className="w-full px-4 py-3 rounded-xl text-sm text-white"
                style={{ background: "hsl(222 47% 6%)", border: "1px solid hsl(220 20% 22%)" }}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="supplier" className="block text-sm" style={{ color: "hsl(215 20% 75%)" }}>
                Fornitore
              </label>
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
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link
            href="/catalog"
            className="px-5 py-3 rounded-xl text-sm font-semibold transition-colors"
            style={{ color: "hsl(215 20% 75%)", background: "hsl(220 20% 22%)" }}
          >
            Annulla
          </Link>
          <button
            type="submit"
            className="px-5 py-3 rounded-xl font-semibold text-sm text-white transition-all duration-200"
            style={{
              background: pending ? "hsl(16 80% 45%)" : "linear-gradient(135deg, hsl(16 100% 58%), hsl(0 84% 50%))",
              cursor: pending ? "not-allowed" : "pointer",
            }}
          >
            {pending ? "Salvataggio..." : "Salva Materiale"}
          </button>
        </div>
      </form>
    </div>
  );
}
