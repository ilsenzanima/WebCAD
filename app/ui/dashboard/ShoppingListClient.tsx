"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ShoppingList, ShoppingListItem, ShoppingProduct } from "@/lib/types/database";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  createShoppingList,
  updateShoppingListMeta,
  completeShoppingList,
  deleteShoppingList,
  registerListExpense,
  addShoppingListItemByName,
  toggleShoppingListItemChecked,
  updateShoppingListItem,
  removeShoppingListItem,
} from "@/app/actions/shopping";
import { DeleteIcon, CheckIcon } from "./icons";
import { GROCERY_UNITS } from "@/lib/shoppingUnits";

interface ActiveList extends ShoppingList {
  items: ShoppingListItem[];
}

interface ShoppingListClientProps {
  initialActiveList: ActiveList | null;
  initialHistory: ShoppingList[];
  initialProducts: ShoppingProduct[];
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

export default function ShoppingListClient({ initialActiveList, initialHistory, initialProducts, isAdmin }: ShoppingListClientProps) {
  const [activeList, setActiveList] = useState<ActiveList | null>(initialActiveList);
  const [history, setHistory] = useState<ShoppingList[]>(initialHistory);
  const [products, setProducts] = useState<ShoppingProduct[]>(initialProducts);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState("");
  const [newItemUnit, setNewItemUnit] = useState("");

  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [totalAmount, setTotalAmount] = useState("");

  const handleCreateList = () => {
    startTransition(async () => {
      const res = await createShoppingList();
      if (!res.success) { alert(res.error); return; }
      setActiveList({ ...res.data, items: [] });
    });
  };

  const handleUpdateMeta = (field: "name" | "shopping_date" | "store", value: string) => {
    if (!activeList) return;
    setActiveList({ ...activeList, [field]: value || null });
    startTransition(async () => {
      const res = await updateShoppingListMeta(activeList.id, { [field]: value } as any);
      if (!res.success) alert(res.error);
    });
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeList || !newItemName.trim()) return;

    startTransition(async () => {
      const res = await addShoppingListItemByName(activeList.id, {
        product_name: newItemName.trim(),
        quantity: newItemQty ? Number(newItemQty) : null,
        unit: newItemUnit || null,
      });
      if (!res.success || !res.data) { alert(res.error); return; }
      const newItem = res.data as ShoppingListItem;
      setActiveList((prev) => prev ? { ...prev, items: [...prev.items, newItem] } : prev);
      if (newItem.shopping_products && !products.some((p) => p.id === newItem.product_id)) {
        setProducts((prev) => [...prev, newItem.shopping_products as ShoppingProduct]);
      }
      setNewItemName("");
      setNewItemQty("");
      setNewItemUnit("");
    });
  };

  const handleToggleItem = (item: ShoppingListItem) => {
    if (!activeList) return;
    const nextChecked = !item.is_checked;
    setActiveList({
      ...activeList,
      items: activeList.items.map((i) => (i.id === item.id ? { ...i, is_checked: nextChecked } : i)),
    });
    startTransition(async () => {
      const res = await toggleShoppingListItemChecked(item.id, nextChecked);
      if (!res.success) { alert(res.error); return; }
      router.refresh();
    });
  };

  const handleUpdateItemField = (itemId: string, field: "quantity" | "unit" | "price", value: string) => {
    if (!activeList) return;
    const parsed: string | number | null = field === "unit" ? value : value === "" ? null : Number(value);
    setActiveList({
      ...activeList,
      items: activeList.items.map((i) => (i.id === itemId ? { ...i, [field]: parsed } : i)),
    });
    startTransition(async () => {
      const res = await updateShoppingListItem(itemId, { [field]: parsed } as any);
      if (!res.success) alert(res.error);
    });
  };

  const handleRemoveItem = (itemId: string) => {
    if (!activeList) return;
    setActiveList({ ...activeList, items: activeList.items.filter((i) => i.id !== itemId) });
    startTransition(async () => {
      const res = await removeShoppingListItem(itemId);
      if (!res.success) alert(res.error);
    });
  };

  const handleCompleteList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeList) return;
    const amount = Number(totalAmount);
    if (!amount || amount <= 0) { alert("Inserisci un totale valido"); return; }

    startTransition(async () => {
      const res = await completeShoppingList(activeList.id, { total_amount: amount });
      if (!res.success) { alert(res.error); return; }
      const { items, ...listWithoutItems } = activeList;
      setHistory((prev) => [{ ...listWithoutItems, status: "completed" as const, total_amount: amount }, ...prev]);
      setActiveList(null);
      setShowCompleteForm(false);
      setTotalAmount("");
    });
  };

  const handleDeleteList = () => {
    if (!activeList) return;
    if (!confirm("Eliminare questa lista della spesa?")) return;
    startTransition(async () => {
      const res = await deleteShoppingList(activeList.id);
      if (!res.success) { alert(res.error); return; }
      setActiveList(null);
    });
  };

  const handleRegisterExpense = (list: ShoppingList) => {
    startTransition(async () => {
      const res = await registerListExpense(list.id);
      if (!res.success) { alert(res.error); return; }
      router.refresh();
    });
  };

  const itemsByCategory = (activeList?.items || []).reduce<Record<string, ShoppingListItem[]>>((acc, item) => {
    const cat = item.shopping_products?.category || "Senza categoria";
    (acc[cat] ||= []).push(item);
    return acc;
  }, {});

  const checkedCount = activeList?.items.filter((i) => i.is_checked).length || 0;
  const totalCount = activeList?.items.length || 0;

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
          📝 Lista della spesa
        </h1>
        <p className="text-sm text-slate-400 mt-1">Condivisa con tutta la famiglia.</p>
      </div>

      <div className="space-y-6 animate-fade-in">
        {!activeList ? (
          <div className="rounded-2xl p-10 border shadow-2xl backdrop-blur-xl text-center"
            style={{ background: "linear-gradient(135deg, hsla(240, 10%, 12%, 0.5), hsla(240, 10%, 10%, 0.8))", borderColor: "hsla(240, 5%, 18%, 0.7)" }}>
            <p className="text-sm text-slate-400 mb-4">Nessuna lista della spesa in corso.</p>
            <button onClick={handleCreateList} disabled={isPending}
              className="px-6 py-3 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-500 transition-all">
              + Crea nuova lista
            </button>
          </div>
        ) : (
          <>
            {/* Dettagli lista */}
            <div className="rounded-2xl p-5 border shadow-2xl backdrop-blur-xl grid grid-cols-1 sm:grid-cols-3 gap-3"
              style={{ background: "linear-gradient(135deg, hsla(240, 10%, 12%, 0.5), hsla(240, 10%, 10%, 0.8))", borderColor: "hsla(240, 5%, 18%, 0.7)" }}>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Nome lista</label>
                <input defaultValue={activeList.name} onBlur={(e) => handleUpdateMeta("name", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-xs text-white border border-zinc-800 bg-zinc-950/80" />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Giorno della spesa</label>
                <input type="date" defaultValue={activeList.shopping_date || ""} onBlur={(e) => handleUpdateMeta("shopping_date", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-xs text-white border border-zinc-800 bg-zinc-950/80" />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Negozio</label>
                <input defaultValue={activeList.store || ""} placeholder="es. Esselunga" onBlur={(e) => handleUpdateMeta("store", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-xs text-white border border-zinc-800 bg-zinc-950/80" />
              </div>
            </div>

            {/* Aggiunta rapida */}
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
                        <button onClick={() => handleToggleItem(item)}
                          className={`w-5 h-5 rounded-md flex items-center justify-center border flex-shrink-0 transition-all ${item.is_checked ? "bg-emerald-500 border-emerald-500" : "border-zinc-700"}`}>
                          {item.is_checked && <CheckIcon size={11} className="text-white" />}
                        </button>
                        <span className={`text-xs font-semibold flex-1 min-w-[100px] ${item.is_checked ? "text-zinc-500 line-through" : "text-white"}`}>
                          {item.shopping_products?.name}
                        </span>
                        {item.expiry_date && expiryBadge(item.expiry_date)}
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
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {totalCount === 0 && <p className="text-[11px] text-zinc-500">Nessun articolo ancora aggiunto.</p>}
            </div>

            {/* Chiusura spesa */}
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
          </>
        )}

        {/* Storico */}
        {history.length > 0 && (
          <div className="pt-4">
            <h2 className="text-sm font-extrabold text-white mb-3">Spese passate</h2>
            <div className="space-y-2">
              {history.map((list) => (
                <div key={list.id} className="p-3.5 rounded-xl border border-zinc-800/80 bg-zinc-950/40 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="text-xs font-bold text-white">{list.name}{list.store ? ` — ${list.store}` : ""}</div>
                    <div className="text-[10px] text-zinc-500">{list.shopping_date ? formatDate(list.shopping_date) : list.completed_at ? formatDate(list.completed_at) : ""}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-extrabold text-white">{list.total_amount != null ? formatCurrency(list.total_amount) : "—"}</span>
                    {isAdmin && !list.expense_id && (
                      <button onClick={() => handleRegisterExpense(list)} disabled={isPending}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all">
                        Registra in Finanze
                      </button>
                    )}
                    {list.expense_id && (
                      <span className="px-2 py-1 rounded-lg text-[10px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20">
                        ✓ In Finanze
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
