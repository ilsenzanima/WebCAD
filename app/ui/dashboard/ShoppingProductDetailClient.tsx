"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { ShoppingProduct, ShoppingProductBrand, NutrimentsSummary, Store } from "@/lib/types/database";
import {
  updateShoppingProduct,
  deleteShoppingProduct,
  createProductBrand,
  updateProductBrand,
  deleteProductBrand,
  lookupProductInfo,
} from "@/app/actions/shopping";
import { GROCERY_CATEGORIES, PERISHABLE_CATEGORIES } from "@/lib/shoppingCategories";
import { GROCERY_UNITS } from "@/lib/shoppingUnits";
import { suggestShelfLifeDays } from "@/lib/shelfLifeSuggestions";
import { DeleteIcon, EditIcon, ArrowLeftIcon } from "./icons";
import { useRouter } from "next/navigation";
import BarcodeScannerModal from "./BarcodeScannerModal";
import { isValidBarcodeChecksum } from "@/lib/barcodeChecksum";

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

interface BrandExtras {
  nutriments: NutrimentsSummary | null;
  additives: string | null;
  traces: string | null;
  labels: string | null;
  package_quantity: string | null;
  off_categories: string | null;
  image_packaging_url: string | null;
}

const EMPTY_EXTRAS: BrandExtras = {
  nutriments: null, additives: null, traces: null, labels: null,
  package_quantity: null, off_categories: null, image_packaging_url: null,
};

function hasExtras(e: BrandExtras): boolean {
  return Object.values(e).some((v) => v != null);
}

const NUTRIENT_ROWS: { key: keyof NutrimentsSummary; label: string; unit: string }[] = [
  { key: "energy_kcal_100g", label: "Energia", unit: "kcal" },
  { key: "fat_100g", label: "Grassi", unit: "g" },
  { key: "saturated_fat_100g", label: "di cui saturi", unit: "g" },
  { key: "carbohydrates_100g", label: "Carboidrati", unit: "g" },
  { key: "sugars_100g", label: "di cui zuccheri", unit: "g" },
  { key: "fiber_100g", label: "Fibre", unit: "g" },
  { key: "proteins_100g", label: "Proteine", unit: "g" },
  { key: "salt_100g", label: "Sale", unit: "g" },
];

function NutritionTable({ n }: { n: NutrimentsSummary }) {
  const rows = NUTRIENT_ROWS.filter((r) => n[r.key] != null);
  if (rows.length === 0) return null;

  return (
    <div className="rounded-lg border border-zinc-800 overflow-hidden">
      <div className="px-2.5 py-1.5 bg-zinc-900 text-[9px] font-bold uppercase tracking-wider text-zinc-400 flex justify-between">
        <span>Valori nutrizionali</span>
        <span>per 100g{n.serving_size ? ` · porzione ${n.serving_size}` : ""}</span>
      </div>
      <div className="divide-y divide-zinc-800">
        {rows.map((r) => {
          const servingKey = (r.key.replace("_100g", "_serving")) as keyof NutrimentsSummary;
          const servingValue = n[servingKey];
          return (
            <div key={r.key} className="px-2.5 py-1 flex items-center justify-between text-[10px]">
              <span className="text-zinc-400">{r.label}</span>
              <span className="text-zinc-200 font-semibold">
                {n[r.key]}{r.unit}
                {servingValue != null && <span className="text-zinc-500 font-normal"> · {servingValue}{r.unit}/porz.</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BrandExtrasPreview({ e }: { e: BrandExtras }) {
  if (!hasExtras(e)) return null;

  return (
    <div className="space-y-2 p-3 rounded-lg border border-zinc-800 bg-zinc-950/40">
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Dati trovati (verranno salvati con la marca)</p>
        {e.image_packaging_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={e.image_packaging_url} alt="Confezione" className="w-10 h-10 object-cover rounded-lg border border-zinc-800" />
        )}
      </div>
      {(e.package_quantity || e.off_categories) && (
        <p className="text-[10px] text-zinc-400">
          {e.package_quantity && <>Formato: <span className="text-zinc-200 font-semibold">{e.package_quantity}</span></>}
          {e.package_quantity && e.off_categories && " · "}
          {e.off_categories && <>Categoria: <span className="text-zinc-200 font-semibold">{e.off_categories}</span></>}
        </p>
      )}
      {e.labels && (
        <div className="flex flex-wrap gap-1">
          {e.labels.split(",").map((l) => l.trim()).filter(Boolean).map((l) => (
            <span key={l} className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">{l}</span>
          ))}
        </div>
      )}
      {e.traces && <p className="text-[10px] text-amber-400">⚠️ Può contenere tracce di: {e.traces}</p>}
      {e.additives && <p className="text-[10px] text-zinc-400">Additivi: <span className="text-zinc-200">{e.additives}</span></p>}
      {e.nutriments && <NutritionTable n={e.nutriments} />}
    </div>
  );
}

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

function BrandCard({ brand: b, onEdit, onDelete, onQuickRating }: {
  brand: ShoppingProductBrand;
  onEdit: (b: ShoppingProductBrand) => void;
  onDelete: (id: string) => void;
  onQuickRating: (b: ShoppingProductBrand, value: number | null) => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const extras: BrandExtras = {
    nutriments: b.nutriments, additives: b.additives, traces: b.traces, labels: b.labels,
    package_quantity: b.package_quantity, off_categories: b.off_categories, image_packaging_url: b.image_packaging_url,
  };

  return (
    <div className="p-3.5 rounded-xl border border-zinc-800/80 bg-zinc-950/40">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          {b.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.image_url} alt={b.brand_name} className="w-10 h-10 object-cover rounded-lg border border-zinc-800 flex-shrink-0" />
          )}
          <div>
            <div className="text-xs font-bold text-white">
              {b.brand_name}
              {b.package_quantity && <span className="text-zinc-500 font-normal"> · {b.package_quantity}</span>}
            </div>
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
          <button onClick={() => onEdit(b)} className="p-1 rounded text-slate-400 hover:text-white transition-all">
            <EditIcon size={12} />
          </button>
          <button onClick={() => onDelete(b.id)} className="p-1 rounded text-slate-400 hover:text-rose-400 transition-all">
            <DeleteIcon size={12} />
          </button>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between flex-wrap gap-2">
        <StarRating value={b.rating} onChange={(v) => onQuickRating(b, v)} />
        {b.notes && <p className="text-[10px] text-zinc-500 italic">{b.notes}</p>}
      </div>
      {b.allergens && (
        <p className="mt-1.5 text-[10px] text-amber-400">⚠️ Allergeni: {b.allergens}</p>
      )}
      {b.ingredients_text && (
        <p className="mt-1 text-[10px] text-zinc-500 line-clamp-2">{b.ingredients_text}</p>
      )}
      {b.labels && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {b.labels.split(",").map((l) => l.trim()).filter(Boolean).slice(0, 6).map((l) => (
            <span key={l} className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">{l}</span>
          ))}
        </div>
      )}
      {hasExtras(extras) && (
        <div className="mt-2">
          <button onClick={() => setShowDetails((v) => !v)} className="text-[9px] font-bold text-indigo-300 hover:text-indigo-200 transition-all">
            {showDetails ? "▾ Nascondi info nutrizionali" : "▸ Info nutrizionali"}
          </button>
          {showDetails && (
            <div className="mt-2 space-y-2">
              {b.traces && <p className="text-[10px] text-amber-400">⚠️ Può contenere tracce di: {b.traces}</p>}
              {b.additives && <p className="text-[10px] text-zinc-400">Additivi: <span className="text-zinc-200">{b.additives}</span></p>}
              {b.off_categories && <p className="text-[10px] text-zinc-500">Categoria (Open Facts): {b.off_categories}</p>}
              {b.image_packaging_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.image_packaging_url} alt="Confezione" className="w-14 h-14 object-cover rounded-lg border border-zinc-800" />
              )}
              {b.nutriments && <NutritionTable n={b.nutriments} />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ShoppingProductDetailClientProps {
  product: ShoppingProduct;
  initialBrands: ShoppingProductBrand[];
  stores: Store[];
}

export default function ShoppingProductDetailClient({ product, initialBrands, stores }: ShoppingProductDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [brands, setBrands] = useState<ShoppingProductBrand[]>(initialBrands);

  const [prodName, setProdName] = useState(product.name);
  const [prodCategory, setProdCategory] = useState(product.category || "");
  const [prodStoreId, setProdStoreId] = useState(product.store_id || "");
  const [prodAisle, setProdAisle] = useState(product.aisle || "");
  const [prodUnit, setProdUnit] = useState(product.default_unit || "");
  const [prodShelfLife, setProdShelfLife] = useState(product.shelf_life_days?.toString() || "");
  const [prodOffList, setProdOffList] = useState(product.is_off_list);

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
  const [brandExtras, setBrandExtras] = useState<BrandExtras>(EMPTY_EXTRAS);
  const [showScanner, setShowScanner] = useState(false);
  const [lookingUpOff, setLookingUpOff] = useState(false);
  const [lookupSource, setLookupSource] = useState<string | null>(null);

  const handleSaveProduct = () => {
    if (!prodName.trim()) { alert("Il nome non può essere vuoto"); return; }
    startTransition(async () => {
      const res = await updateShoppingProduct(product.id, {
        name: prodName.trim(),
        category: prodCategory || null,
        store_id: prodStoreId || null,
        aisle: prodAisle || null,
        default_unit: prodUnit || null,
        shelf_life_days: prodShelfLife ? Number(prodShelfLife) : null,
        is_off_list: prodOffList,
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
    setBrandNotes(""); setBrandExtras(EMPTY_EXTRAS); setLookupSource(null);
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
    setBrandExtras({
      nutriments: b.nutriments,
      additives: b.additives,
      traces: b.traces,
      labels: b.labels,
      package_quantity: b.package_quantity,
      off_categories: b.off_categories,
      image_packaging_url: b.image_packaging_url,
    });
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
      ...brandExtras,
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
      setBrandExtras({
        nutriments: result.nutriments,
        additives: result.additives,
        traces: result.traces,
        labels: result.labels,
        package_quantity: result.package_quantity,
        off_categories: result.off_categories,
        image_packaging_url: result.image_packaging_url,
      });
      setLookupSource(result.source);
    });
  };

  const trimmedBarcode = brandBarcode.trim();
  const barcodeChecksumInvalid = trimmedBarcode.length > 0 && !isValidBarcodeChecksum(trimmedBarcode);

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
            <select value={prodStoreId} onChange={(e) => setProdStoreId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-xs text-white border border-zinc-800 bg-zinc-950/80">
              <option value="">—</option>
              {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Corsia</label>
            <input value={prodAisle} onChange={(e) => setProdAisle(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-xs text-white border border-zinc-800 bg-zinc-950/80" />
          </div>
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Unità</label>
            <select value={prodUnit} onChange={(e) => setProdUnit(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-xs text-white border border-zinc-800 bg-zinc-950/80">
              <option value="">—</option>
              {GROCERY_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          {PERISHABLE_CATEGORIES.includes(prodCategory) && (
            <div className="space-y-1 animate-fade-in">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Dura (giorni da acquisto)</label>
              <input type="number" value={prodShelfLife} onChange={(e) => setProdShelfLife(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg text-xs text-white border border-zinc-800 bg-zinc-950/80" />
              {!prodShelfLife && suggestShelfLifeDays(prodName) && (
                <button type="button" onClick={() => setProdShelfLife(suggestShelfLifeDays(prodName)!.toString())}
                  className="text-[9px] font-bold text-indigo-300 hover:text-indigo-200 transition-all">
                  💡 Suggerimento USDA FoodKeeper: {suggestShelfLifeDays(prodName)} giorni
                </button>
              )}
            </div>
          )}
        </div>

        <label className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 cursor-pointer mt-3">
          <input type="checkbox" checked={prodOffList} onChange={(e) => setProdOffList(e.target.checked)} className="accent-violet-500" />
          🎁 Articolo da fuori lista (si prende spesso in più, scorciatoia rapida nelle liste)
        </label>

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
                {barcodeChecksumInvalid && (
                  <p className="text-[10px] font-semibold text-amber-400">⚠️ Il codice non sembra valido: controlla le cifre (spesso in Italia iniziano con 8).</p>
                )}
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

            {hasExtras(brandExtras) && (
              <div className="space-y-1.5">
                <BrandExtrasPreview e={brandExtras} />
                <button type="button" onClick={() => setBrandExtras(EMPTY_EXTRAS)} className="text-[9px] font-bold text-zinc-500 hover:text-rose-400 transition-all">
                  ✕ Rimuovi i dati trovati
                </button>
              </div>
            )}

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
            <BrandCard key={b.id} brand={b} onEdit={handleEditBrand} onDelete={handleDeleteBrand} onQuickRating={handleQuickRating} />
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
