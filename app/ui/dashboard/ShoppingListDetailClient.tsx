"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ShoppingList, ShoppingListItem, ShoppingProduct, Store } from "@/lib/types/database";
import { formatCurrency } from "@/lib/format";
import {
  updateShoppingListMeta,
  completeShoppingList,
  deleteShoppingList,
  registerListExpense,
  addShoppingListItemByName,
  toggleShoppingListItemChecked,
  updateShoppingListItem,
  removeShoppingListItem,
} from "@/app/actions/shopping";
import { DeleteIcon, CheckIcon, ArrowLeftIcon } from "./icons";
import { GROCERY_UNITS } from "@/lib/shoppingUnits";

interface ListWithItems extends ShoppingList {
  items: ShoppingListItem[];
}

interface ShoppingListDetailClientProps {
  initialList: ListWithItems;
  initialProducts: ShoppingProduct[];
  stores: Store[];
  isAdmin: boolean;
}

function expiryBadge(dateStr: string) {
  const target = new Date(`${dateStr}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - today.getTime()) / 86400000);

  let tone = { bg: "rgba(16,185,129,0.12)", text: "#34d399", border: "rgba(16,185,129,0.25)" };
  let label = `Scade tra ${days}g`;
  if (days < 0) {
    tone = { bg: "rgba(244,63,94,0.12)", text: "#fb7185", border: "rgba(244,63,94,0.25)" };
    label = "Scaduto";
  } else if (days === 0) {
    tone = { bg: "rgba(244,63,94,0.12)", text: "#fb7185", border: "rgba(244,63,94,0.25)" };
    label = "Scade oggi";
  } else if (days <= 2) {
    tone = { bg: "rgba(245,158,11,0.12)", text: "#fbbf24", border: "rgba(245,158,11,0.25)" };
  }

  return (
    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border" style={{ background: tone.bg, color: tone.text, borderColor: tone.border }}>
      {label}
    </span>
  );
}

export default function ShoppingListDetailClient({ initialList, initialProducts, stores, isAdmin }: ShoppingListDetailClientProps) {
  const [list, setList] = useState<ListWithItems>(initialList);
  const [products, setProducts] = useState<ShoppingProduct[]>(initialProducts);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const isOpen = list.status === "open";

  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState("");
  const [newItemUnit, setNewItemUnit] = useState("");

  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [totalAmount, setTotalAmount] = useState("");

  const handleUpdateMeta = (field: "name" | "shopping_date" | "store_id", value: string) => {
    setList((prev) => ({ ...prev, [field]: value || null }));
    startTransition(async () => {
      const res = await updateShoppingListMeta(list.id, { [field]: value } as any);
      if (!res.success) alert(res.error);
    });
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    startTransition(async () => {
      const res = await addShoppingListItemByName(list.id, {
        product_name: newItemName.trim(),
        quantity: newItemQty ? Number(newItemQty) : null,
        unit: newItemUnit || null,
      });
      if (!res.success || !res.data) { alert(res.error); return; }
      const newItem = res.data as ShoppingListItem;
      setList((prev) => ({ ...prev, items: [...prev.items, newItem] }));
      if (newItem.shopping_products && !products.some((p) => p.id === newItem.product_id)) {
        setProducts((prev) => [...prev, newItem.shopping_products as ShoppingProduct]);
      }
      setNewItemName("");
      setNewItemQty("");
      setNewItemUnit("");
    });
  };

  const handleToggleItem = (item: ShoppingListItem) => {
    const nextChecked = !item.is_checked;
    setList((prev) => ({
      ...prev,
      items: prev.items.map((i) => (i.id === item.id ? { ...i, is_checked: nextChecked } : i)),
    }));
    startTransition(async () => {
      const res = await toggleShoppingListItemChecked(item.id, nextChecked);
      if (!res.success) { alert(res.error); return; }
      router.refresh();
    });
  };

  const handleUpdateItemField = (itemId: string, field: "quantity" | "unit" | "price", value: string) => {
    const parsed: string | number | null = field === "unit" ? value : value === "" ? null : Number(value);
    setList((prev) => ({
      ...prev,
      items: prev.items.map((i) => (i.id === itemId ? { ...i, [field]: parsed } : i)),
    }));
    startTransition(async () => {
      const res = await updateShoppingListItem(itemId, { [field]: parsed } as any);
      if (!res.success) alert(res.error);
    });
  };

  const handleRemoveItem = (itemId: string) => {
    setList((prev) => ({ ...prev, items: prev.items.filter((i) => i.id !== itemId) }));
    startTransition(async () => {
      const res = await removeShoppingListItem(itemId);
      if (!res.success) alert(res.error);
    });
  };

  const handleCompleteList = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(totalAmount);
    if (!amount || amount <= 0) { alert("Inserisci un totale valido"); return; }

    startTransition(async () => {
      const res = await completeShoppingList(list.id, { total_amount: amount });
      if (!res.success) { alert(res.error); return; }
      setList((prev) => ({ ...prev, status: "completed", total_amount: amount }));
      setShowCompleteForm(false);
      setTotalAmount("");
    });
  };

  const handleDeleteList = () => {
    if (!confirm("Eliminare questa lista della spesa?")) return;
    startTransition(async () => {
      const res = await deleteShoppingList(list.id);
      if (!res.success) { alert(res.error); return; }
      router.push("/dashboard/shopping-list");
    });
  };

  const handleRegisterExpense = () => {
    startTransition(async () => {
      const res = await registerListExpense(list.id);
      if (!res.success) { alert(res.error); return; }
      router.refresh();
    });
  };

  const itemsByCategory = list.items.reduce<Record<string, ShoppingListItem[]>>((acc, item) => {
    const cat = item.shopping_products?.category || "Senza categoria";
    (acc[cat] ||= []).push(item);
    return acc;
  }, {});

  const checkedCount = list.items.filter((i) => i.is_checked).length;
  const totalCount = list.items.length;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
      <Link href="/dashboard/shopping-list" className="inline-flex items-center gap-1.5 text-[11px] font-bold text-zinc-400 hover:text-white transition-all">
        <ArrowLeftIcon size={12} /> Liste della spesa
      </Link>

      <div className="animate-fade-in flex items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
          📝 {list.name}
        </h1>
        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold border flex-shrink-0 ${
          isOpen ? "bg-sky-500/10 text-sky-400 border-sky-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
        }`}>
          {isOpen ? "🛒 In corso" : "✅ Conclusa"}
        </span>
      </div>

      <div className="space-y-6 animate-fade-in">
        {/* Dettagli lista */}
        <div className="rounded-2xl p-5 border shadow-2xl backdrop-blur-xl grid grid-cols-1 sm:grid-cols-3 gap-3"
          style={{ background: "linear-gradient(135deg, hsla(240, 10%, 12%, 0.5), hsla(240, 10%, 10%, 0.8))", borderColor: "hsla(240, 5%, 18%, 0.7)" }}>
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Nome lista</label>
            <input defaultValue={list.name} disabled={!isOpen} onBlur={(e) => handleUpdateMeta("name", e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-xs text-white border border-zinc-800 bg-zinc-950/80 disabled:opacity-60" />
          </div>
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Giorno della spesa</label>
            <input type="date" defaultValue={list.shopping_date || ""} disabled={!isOpen} onBlur={(e) => handleUpdateMeta("shopping_date", e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-xs text-white border border-zinc-800 bg-zinc-950/80 disabled:opacity-60" />
          </div>
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Negozio</label>
            <select defaultValue={list.store_id || ""} disabled={!isOpen} onChange={(e) => handleUpdateMeta("store_id", e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-xs text-white border border-zinc-800 bg-zinc-950/80 disabled:opacity-60">
              <option value="">—</option>
              {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        {/* Aggiunta rapida */}
        {isOpen && (
          <form onSubmit={handleAddItem} className="flex flex-col sm:flex-row gap-2">
            <input list="product-suggestions" value={newItemName} onChange={(e) => setNewItemName(e.target.value)}
              placeholder="Aggiungi un articolo..." required
              className="flex-1 px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80" />
            <datalist id="product-suggestions">
              {products.map((p) => <option key={p.id} value={p.name} />)}
            </datalist>
            <input value={newItemQty} onChange={(e) => setNewItemQty(e.target.value)} placeholder="Pezzi"
              className="w-full sm:w-24 px-3 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80" />
            <select value={newItemUnit} onChange={(e) => setNewItemUnit(e.target.value)}
              className="w-full sm:w-24 px-3 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80">
              <option value="">Unità</option>
              {GROCERY_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <button type="submit" disabled={isPending}
              className="px-5 py-3 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-500 transition-all">
              Aggiungi
            </button>
          </form>
        )}

        {/* Progresso */}
        {totalCount > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(checkedCount / totalCount) * 100}%` }} />
            </div>
            <span className="text-[10px] font-bold text-zinc-400">{checkedCount}/{totalCount}</span>
          </div>
        )}

        {/* Articoli per categoria */}
        <div className="space-y-5">
          {Object.entries(itemsByCategory).map(([category, items]) => (
            <div key={category}>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">{category}</h3>
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.id} className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-950/40 flex flex-wrap items-center gap-3">
                    <button onClick={() => isOpen && handleToggleItem(item)} disabled={!isOpen}
                      className={`w-5 h-5 rounded-md flex items-center justify-center border flex-shrink-0 transition-all ${item.is_checked ? "bg-emerald-500 border-emerald-500" : "border-zinc-700"}`}>
                      {item.is_checked && <CheckIcon size={11} className="text-white" />}
                    </button>
                    <span className={`text-xs font-semibold flex-1 min-w-[100px] ${item.is_checked ? "text-zinc-500 line-through" : "text-white"}`}>
                      {item.shopping_products?.name}
                    </span>
                    {item.expiry_date && expiryBadge(item.expiry_date)}
                    {isOpen ? (
                      <>
                        <input defaultValue={item.quantity ?? ""} onBlur={(e) => handleUpdateItemField(item.id, "quantity", e.target.value)}
                          placeholder="Pezzi" className="w-16 px-2 py-1.5 rounded-lg text-[11px] text-white border border-zinc-800 bg-zinc-950/80" />
                        <select defaultValue={item.unit ?? ""} onChange={(e) => handleUpdateItemField(item.id, "unit", e.target.value)}
                          className="w-16 px-2 py-1.5 rounded-lg text-[11px] text-white border border-zinc-800 bg-zinc-950/80">
                          <option value="">Unità</option>
                          {GROCERY_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                        </select>
                        <input defaultValue={item.price ?? ""} onBlur={(e) => handleUpdateItemField(item.id, "price", e.target.value)}
                          placeholder="€" className="w-16 px-2 py-1.5 rounded-lg text-[11px] text-white border border-zinc-800 bg-zinc-950/80" />
                        <button onClick={() => handleRemoveItem(item.id)} className="p-1.5 rounded text-slate-500 hover:text-rose-400 transition-all">
                          <DeleteIcon size={13} />
                        </button>
                      </>
                    ) : (
                      <span className="text-[11px] text-zinc-400">
                        {[item.quantity != null ? `${item.quantity}${item.unit ? ` ${item.unit}` : ""}` : null, item.price != null ? formatCurrency(item.price) : null].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {totalCount === 0 && <p className="text-[11px] text-zinc-500">Nessun articolo ancora aggiunto.</p>}
        </div>

        {/* Chiusura spesa / Registrazione Finanze */}
        {isOpen ? (
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            {!showCompleteForm ? (
              <>
                <button onClick={() => setShowCompleteForm(true)} disabled={totalCount === 0}
                  className="flex-1 py-3 rounded-xl text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-500 transition-all disabled:opacity-40">
                  ✅ Concludi spesa
                </button>
                <button onClick={handleDeleteList}
                  className="py-3 px-5 rounded-xl text-xs font-bold text-rose-300 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all">
                  Elimina lista
                </button>
              </>
            ) : (
              <form onSubmit={handleCompleteList} className="flex-1 flex flex-col sm:flex-row gap-2">
                <input type="number" step="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)}
                  placeholder="Totale speso (€)" required autoFocus
                  className="flex-1 px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80" />
                <button type="submit" disabled={isPending} className="px-5 py-3 rounded-xl text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-500 transition-all">
                  Conferma
                </button>
                <button type="button" onClick={() => setShowCompleteForm(false)} className="px-5 py-3 rounded-xl text-xs font-bold text-zinc-400 bg-zinc-800 hover:bg-zinc-700 transition-all">
                  Annulla
                </button>
              </form>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 pt-2 p-4 rounded-xl border border-zinc-800/80 bg-zinc-950/40">
            <span className="text-xs font-extrabold text-white">Totale: {list.total_amount != null ? formatCurrency(list.total_amount) : "—"}</span>
            {list.expense_id ? (
              <span className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20">
                ✓ In Finanze
              </span>
            ) : isAdmin ? (
              <button onClick={handleRegisterExpense} disabled={isPending}
                className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all">
                Registra in Finanze
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
