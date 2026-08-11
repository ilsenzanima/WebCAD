"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { ShoppingProduct, ShoppingProductBrand } from "@/lib/types/database";
import {
  updateShoppingProduct,
  deleteShoppingProduct,
  createProductBrand,
  updateProductBrand,
  deleteProductBrand,
  lookupProductInfo,
} from "@/app/actions/shopping";
import { GROCERY_CATEGORIES } from "@/lib/shoppingCategories";
import { DeleteIcon, EditIcon, ArrowLeftIcon } from "./icons";
import { useRouter } from "next/navigation";
import BarcodeScannerModal from "./BarcodeScannerModal";

// Nutri-Score ed Eco-Score usano la stessa scala A-E con gli stessi colori ufficiali.
const GRADE_COLORS: Record<string, string> = {
  A: "#038141",
  B: "#85BB2F",
  C: "#FECB02",
  D: "#EE8100",
  E: "#E63E11",
};

const NOVA_LABELS: Record<number, string> = {
  1: "Non/poco lavorato",
  2: "Ingrediente lavorato",
  3: "Alimento processato",
  4: "Ultra-processato",
};

function StarRating({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n ? null : n)}
          className="text-base leading-none transition-transform hover:scale-110"
          title={`${n} stelle`}
        >
          <span style={{ color: value != null && n <= value ? "#fbbf24" : "hsl(240 5% 30%)" }}>★</span>
        </button>
      ))}
    </div>
  );
}

interface ShoppingProductDetailClientProps {
  product: ShoppingProduct;
  initialBrands: ShoppingProductBrand[];
}

export default function ShoppingProductDetailClient({ product, initialBrands }: ShoppingProductDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [brands, setBrands] = useState<ShoppingProductBrand[]>(initialBrands);

  const [prodName, setProdName] = useState(product.name);
  const [prodCategory, setProdCategory] = useState(product.category || "");
  const [prodStore, setProdStore] = useState(product.default_store || "");
  const [prodAisle, setProdAisle] = useState(product.aisle || "");
  const [prodUnit, setProdUnit] = useState(product.default_unit || "");
  const [prodShelfLife, setProdShelfLife] = useState(product.shelf_life_days?.toString() || "");

  const [showBrandForm, setShowBrandForm] = useState(false);
  const [editingBrandId, setEditingBrandId] = useState<string | null>(null);
  const [brandName, setBrandName] = useState("");
  const [brandBarcode, setBrandBarcode] = useState("");
  const [brandRating, setBrandRating] = useState<number | null>(null);
  const [brandNutriScore, setBrandNutriScore] = useState("");
  const [brandNova, setBrandNova] = useState("");
  const [brandEcoScore, setBrandEcoScore] = useState("");
  const [brandImageUrl, setBrandImageUrl] = useState("");
  const [brandIngredients, setBrandIngredients] = useState("");
  const [brandAllergens, setBrandAllergens] = useState("");
  const [brandNotes, setBrandNotes] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [lookingUpOff, setLookingUpOff] = useState(false);
  const [lookupSource, setLookupSource] = useState<string | null>(null);

  const handleSaveProduct = () => {
    if (!prodName.trim()) { alert("Il nome non può essere vuoto"); return; }
    startTransition(async () => {
      const res = await updateShoppingProduct(product.id, {
        name: prodName.trim(),
        category: prodCategory || null,
        default_store: prodStore || null,
        aisle: prodAisle || null,
        default_unit: prodUnit || null,
        shelf_life_days: prodShelfLife ? Number(prodShelfLife) : null,
      });
      if (!res.success) alert(res.error);
    });
  };

  const handleDeleteProduct = () => {
    if (!confirm(`Eliminare "${product.name}" e tutte le sue marche dalla vetrina?`)) return;
    startTransition(async () => {
      const res = await deleteShoppingProduct(product.id);
      if (!res.success) { alert(res.error); return; }
      router.push("/dashboard/shopping-catalog");
    });
  };

  const resetBrandForm = () => {
    setEditingBrandId(null);
    setBrandName(""); setBrandBarcode(""); setBrandRating(null);
    setBrandNutriScore(""); setBrandNova(""); setBrandEcoScore("");
    setBrandImageUrl(""); setBrandIngredients(""); setBrandAllergens("");
    setBrandNotes(""); setLookupSource(null);
    setShowBrandForm(false);
  };

  const handleEditBrand = (b: ShoppingProductBrand) => {
    setEditingBrandId(b.id);
    setBrandName(b.brand_name);
    setBrandBarcode(b.barcode || "");
    setBrandRating(b.rating);
    setBrandNutriScore(b.nutri_score || "");
    setBrandNova(b.nova_group?.toString() || "");
    setBrandEcoScore(b.eco_score || "");
    setBrandImageUrl(b.image_url || "");
    setBrandIngredients(b.ingredients_text || "");
    setBrandAllergens(b.allergens || "");
    setBrandNotes(b.notes || "");
    setLookupSource(null);
    setShowBrandForm(true);
  };

  const handleSubmitBrand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandName.trim()) { alert("Inserisci il nome della marca"); return; }

    const payload = {
      brand_name: brandName.trim(),
      barcode: brandBarcode.trim() || null,
      rating: brandRating,
      nutri_score: (brandNutriScore || null) as any,
      nova_group: (brandNova ? Number(brandNova) : null) as any,
      eco_score: (brandEcoScore || null) as any,
      image_url: brandImageUrl.trim() || null,
      ingredients_text: brandIngredients.trim() || null,
      allergens: brandAllergens.trim() || null,
      notes: brandNotes.trim() || null,
    };

    startTransition(async () => {
      const res = editingBrandId
        ? await updateProductBrand(editingBrandId, payload)
        : await createProductBrand(product.id, payload);
      if (!res.success || !res.data) { alert(res.error); return; }
      const brand = res.data as ShoppingProductBrand;
      setBrands((prev) => (editingBrandId ? prev.map((b) => (b.id === editingBrandId ? brand : b)) : [...prev, brand]));
      resetBrandForm();
    });
  };

  const handleDeleteBrand = (id: string) => {
    if (!confirm("Rimuovere questa marca?")) return;
    startTransition(async () => {
      const res = await deleteProductBrand(id);
      if (!res.success) { alert(res.error); return; }
      setBrands((prev) => prev.filter((b) => b.id !== id));
    });
  };

  const handleQuickRating = (brand: ShoppingProductBrand, value: number | null) => {
    setBrands((prev) => prev.map((b) => (b.id === brand.id ? { ...b, rating: value } : b)));
    startTransition(async () => {
      const res = await updateProductBrand(brand.id, { rating: value });
      if (!res.success) alert(res.error);
    });
  };

  const handleScanDetected = (code: string) => {
    setShowScanner(false);
    setBrandBarcode(code);
  };

  const handleLookupProductInfo = () => {
    if (!brandBarcode.trim()) { alert("Inserisci prima un codice a barre"); return; }
    setLookingUpOff(true);
    setLookupSource(null);
    startTransition(async () => {
      const result = await lookupProductInfo(brandBarcode);
      setLookingUpOff(false);
      if (!result) { alert("Nessuna scheda trovata (provati Open Food/Beauty/Products Facts) per questo codice."); return; }
      if (!brandName.trim() && result.brand_name) setBrandName(result.brand_name);
      if (result.nutri_score) setBrandNutriScore(result.nutri_score);
      if (result.nova_group) setBrandNova(result.nova_group.toString());
      if (result.eco_score) setBrandEcoScore(result.eco_score);
      if (result.image_url) setBrandImageUrl(result.image_url);
      if (result.ingredients_text) setBrandIngredients(result.ingredients_text);
      if (result.allergens) setBrandAllergens(result.allergens);
      setLookupSource(result.source);
    });
  };

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-4xl mx-auto">
      <Link href="/dashboard/shopping-catalog" className="inline-flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-white transition-colors animate-fade-in">
        <ArrowLeftIcon size={12} /> Vetrina prodotti
      </Link>

      {/* Scheda generica */}
      <div className="rounded-2xl p-6 border shadow-2xl backdrop-blur-xl animate-fade-in"
        style={{ background: "linear-gradient(135deg, hsla(240, 10%, 12%, 0.5), hsla(240, 10%, 10%, 0.8))", borderColor: "hsla(240, 5%, 18%, 0.7)" }}>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-extrabold text-white">Scheda prodotto</h1>
          <button onClick={handleDeleteProduct} className="p-2 rounded-lg text-slate-500 hover:text-rose-400 transition-all" title="Elimina prodotto">
            <DeleteIcon size={14} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Nome</label>
            <input value={prodName} onChange={(e) => setProdName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-xs text-white border border-zinc-800 bg-zinc-950/80" />
          </div>
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Categoria</label>
            <select value={prodCategory} onChange={(e) => setProdCategory(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-xs text-white border border-zinc-800 bg-zinc-950/80">
              <option value="">Nessuna</option>
              {GROCERY_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Negozio abituale</label>
            <input value={prodStore} onChange={(e) => setProdStore(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-xs text-white border border-zinc-800 bg-zinc-950/80" />
          </div>
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Corsia</label>
            <input value={prodAisle} onChange={(e) => setProdAisle(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-xs text-white border border-zinc-800 bg-zinc-950/80" />
          </div>
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Unità</label>
            <input value={prodUnit} onChange={(e) => setProdUnit(e.target.value)} placeholder="es. kg"
              className="w-full px-3 py-2.5 rounded-lg text-xs text-white border border-zinc-800 bg-zinc-950/80" />
          </div>
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Dura (giorni da acquisto)</label>
            <input type="number" value={prodShelfLife} onChange={(e) => setProdShelfLife(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-xs text-white border border-zinc-800 bg-zinc-950/80" />
          </div>
        </div>

        <button onClick={handleSaveProduct} disabled={isPending}
          className="mt-4 px-5 py-2.5 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-500 transition-all">
          Salva scheda
        </button>
      </div>

      {/* Marche */}
      <div className="rounded-2xl p-6 border shadow-2xl backdrop-blur-xl animate-fade-in"
        style={{ background: "linear-gradient(135deg, hsla(240, 10%, 12%, 0.5), hsla(240, 10%, 10%, 0.8))", borderColor: "hsla(240, 5%, 18%, 0.7)" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-extrabold text-white">Marche</h2>
          {!showBrandForm && (
            <button onClick={() => setShowBrandForm(true)} className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-all">
              + Aggiungi marca
            </button>
          )}
        </div>

        {showBrandForm && (
          <form onSubmit={handleSubmitBrand} className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-3 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Nome marca (es. Granarolo)" required
                className="w-full px-3 py-2.5 rounded-lg text-xs text-white border border-zinc-800 bg-zinc-950/80" />
              <div className="space-y-1.5">
                <div className="flex gap-2">
                  <input value={brandBarcode} onChange={(e) => setBrandBarcode(e.target.value)} placeholder="Codice a barre (opzionale)"
                    className="flex-1 min-w-0 px-3 py-2.5 rounded-lg text-xs text-white border border-zinc-800 bg-zinc-950/80" />
                  <button type="button" onClick={() => setShowScanner(true)} title="Scansiona con la fotocamera"
                    className="px-3 py-2.5 rounded-lg text-xs font-bold text-white bg-zinc-800 hover:bg-zinc-700 transition-all flex-shrink-0">
                    📷
                  </button>
                </div>
                <button type="button" onClick={handleLookupProductInfo} disabled={lookingUpOff || !brandBarcode.trim()}
                  className="text-[10px] font-bold text-indigo-300 hover:text-indigo-200 transition-all disabled:opacity-40 disabled:hover:text-indigo-300">
                  {lookingUpOff ? "Ricerca in corso..." : "🔎 Cerca su Open Food/Beauty/Products Facts"}
                </button>
                {lookupSource && (
                  <p className="text-[10px] font-semibold text-emerald-400">✓ Trovato su {lookupSource}</p>
                )}
              </div>
            </div>
            {brandImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brandImageUrl} alt={brandName || "Prodotto"} className="w-16 h-16 object-cover rounded-lg border border-zinc-800" />
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-center">
              <div>
                <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Valutazione famiglia</label>
                <StarRating value={brandRating} onChange={setBrandRating} />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Nutri-Score</label>
                <select value={brandNutriScore} onChange={(e) => setBrandNutriScore(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-xs text-white border border-zinc-800 bg-zinc-950/80">
                  <option value="">—</option>
                  {["A", "B", "C", "D", "E"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Eco-Score</label>
                <select value={brandEcoScore} onChange={(e) => setBrandEcoScore(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-xs text-white border border-zinc-800 bg-zinc-950/80">
                  <option value="">—</option>
                  {["A", "B", "C", "D", "E"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1">NOVA</label>
                <select value={brandNova} onChange={(e) => setBrandNova(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-xs text-white border border-zinc-800 bg-zinc-950/80">
                  <option value="">—</option>
                  {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} · {NOVA_LABELS[n]}</option>)}
                </select>
              </div>
            </div>
            <input value={brandAllergens} onChange={(e) => setBrandAllergens(e.target.value)} placeholder="Allergeni (opzionale)"
              className="w-full px-3 py-2.5 rounded-lg text-xs text-white border border-zinc-800 bg-zinc-950/80" />
            <textarea value={brandIngredients} onChange={(e) => setBrandIngredients(e.target.value)} placeholder="Ingredienti (opzionale)" rows={2}
              className="w-full px-3 py-2.5 rounded-lg text-xs text-white border border-zinc-800 bg-zinc-950/80 resize-none" />
            <input value={brandNotes} onChange={(e) => setBrandNotes(e.target.value)} placeholder="Note (opzionale)"
              className="w-full px-3 py-2.5 rounded-lg text-xs text-white border border-zinc-800 bg-zinc-950/80" />
            <p className="text-[9px] text-zinc-500">Nutri-Score, Eco-Score e NOVA si copiano dall'etichetta della confezione, non vengono calcolati automaticamente.</p>
            <div className="flex gap-2">
              <button type="button" onClick={resetBrandForm} className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-300 bg-zinc-800 hover:bg-zinc-700 transition-all">
                Annulla
              </button>
              <button type="submit" disabled={isPending} className="flex-1 py-2.5 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-500 transition-all">
                {editingBrandId ? "Salva marca" : "Aggiungi marca"}
              </button>
            </div>
          </form>
        )}

        <div className="space-y-2">
          {brands.map((b) => (
            <div key={b.id} className="p-3.5 rounded-xl border border-zinc-800/80 bg-zinc-950/40">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-3">
                  {b.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.image_url} alt={b.brand_name} className="w-10 h-10 object-cover rounded-lg border border-zinc-800 flex-shrink-0" />
                  )}
                  <div>
                    <div className="text-xs font-bold text-white">{b.brand_name}</div>
                    {b.barcode && <div className="text-[10px] text-zinc-500 font-mono">{b.barcode}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {b.nutri_score && (
                    <span className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-extrabold text-white"
                      style={{ background: GRADE_COLORS[b.nutri_score] }} title="Nutri-Score">
                      {b.nutri_score}
                    </span>
                  )}
                  {b.eco_score && (
                    <span className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-extrabold text-white"
                      style={{ background: GRADE_COLORS[b.eco_score] }} title="Eco-Score">
                      🌱
                    </span>
                  )}
                  {b.nova_group && (
                    <span className="px-1.5 h-5 rounded flex items-center justify-center text-[9px] font-extrabold text-zinc-300 bg-zinc-800 border border-zinc-700" title={NOVA_LABELS[b.nova_group]}>
                      NOVA {b.nova_group}
                    </span>
                  )}
                  <button onClick={() => handleEditBrand(b)} className="p-1 rounded text-slate-400 hover:text-white transition-all">
                    <EditIcon size={12} />
                  </button>
                  <button onClick={() => handleDeleteBrand(b.id)} className="p-1 rounded text-slate-400 hover:text-rose-400 transition-all">
                    <DeleteIcon size={12} />
                  </button>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between flex-wrap gap-2">
                <StarRating value={b.rating} onChange={(v) => handleQuickRating(b, v)} />
                {b.notes && <p className="text-[10px] text-zinc-500 italic">{b.notes}</p>}
              </div>
              {b.allergens && (
                <p className="mt-1.5 text-[10px] text-amber-400">⚠️ Allergeni: {b.allergens}</p>
              )}
              {b.ingredients_text && (
                <p className="mt-1 text-[10px] text-zinc-500 line-clamp-2">{b.ingredients_text}</p>
              )}
            </div>
          ))}
          {brands.length === 0 && !showBrandForm && (
            <p className="text-[11px] text-zinc-500">Nessuna marca ancora registrata per questo prodotto.</p>
          )}
        </div>
      </div>

      {showScanner && <BarcodeScannerModal onDetected={handleScanDetected} onClose={() => setShowScanner(false)} />}
    </div>
  );
}
