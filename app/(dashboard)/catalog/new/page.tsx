"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createMaterial, type MaterialFormState } from "@/app/actions/materials";

export default function NewMaterialPage() {
  const [state, action, pending] = useActionState<MaterialFormState, FormData>(
    createMaterial,
    undefined
  );

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

      <form action={action} className="space-y-6">
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
                <option value="profilo">Profilo L/C/U</option>
                <option value="lastra">Lastra C.S.</option>
                <option value="accessorio">Accessorio (Guarnizioni/Viti)</option>
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
                <option value="pz">Pezzi (pz)</option>
                <option value="ml">Metri Lineari (ml)</option>
                <option value="mq">Metri Quadri (mq)</option>
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
            disabled={pending}
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
