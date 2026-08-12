"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ShoppingList, ShoppingListItem, Store } from "@/lib/types/database";
import { formatCurrency, formatDate } from "@/lib/format";
import { createShoppingList, deleteShoppingList, registerListExpense } from "@/app/actions/shopping";
import { DeleteIcon, ArrowRightIcon } from "./icons";

interface ListWithItems extends ShoppingList {
  items: ShoppingListItem[];
}

interface ShoppingListsGalleryClientProps {
  initialLists: ListWithItems[];
  stores: Store[];
  isAdmin: boolean;
}

export default function ShoppingListsGalleryClient({ initialLists, stores, isAdmin }: ShoppingListsGalleryClientProps) {
  const [lists, setLists] = useState<ListWithItems[]>(initialLists);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const storeName = (id: string | null) => stores.find((s) => s.id === id)?.name || null;

  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createShoppingList(newName.trim() || undefined);
      if (!res.success || !res.data) { alert(res.error); return; }
      router.push(`/dashboard/shopping-list/${res.data.id}`);
    });
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Eliminare questa lista della spesa?")) return;
    startTransition(async () => {
      const res = await deleteShoppingList(id);
      if (!res.success) { alert(res.error); return; }
      setLists((prev) => prev.filter((l) => l.id !== id));
    });
  };

  const handleRegisterExpense = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      const res = await registerListExpense(id);
      if (!res.success) { alert(res.error); return; }
      router.refresh();
    });
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="animate-fade-in flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            📝 Liste della spesa
          </h1>
          <p className="text-sm text-slate-400 mt-1">Condivise con tutta la famiglia: puoi averne più di una aperta insieme.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="px-4 py-2.5 rounded-xl text-xs font-extrabold text-white transition-all shadow-lg active:scale-98 flex items-center gap-2 flex-shrink-0"
          style={{ background: "linear-gradient(135deg, hsl(245 70% 60%), hsl(255 60% 50%))" }}
        >
          <span>＋</span> Nuova lista
        </button>
      </div>

      {lists.length === 0 ? (
        <div className="rounded-2xl p-12 border text-center text-slate-500 bg-zinc-950/40 border-zinc-800/60 animate-fade-in">
          <span className="text-3xl block mb-2">📝</span>
          <p className="text-xs">Nessuna lista della spesa ancora. Creane una con il pulsante "Nuova lista".</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
          {lists.map((list) => {
            const checkedCount = list.items.filter((i) => i.is_checked).length;
            const totalCount = list.items.length;
            const isOpen = list.status === "open";

            return (
              <Link
                key={list.id}
                href={`/dashboard/shopping-list/${list.id}`}
                className="rounded-2xl p-5 border flex flex-col justify-between gap-4 shadow-xl relative overflow-hidden group backdrop-blur-xl transition-all duration-300 hover:border-indigo-500/30"
                style={{
                  background: "linear-gradient(135deg, hsla(240, 10%, 12%, 0.6), hsla(240, 10%, 10%, 0.8))",
                  borderColor: "hsla(240, 5%, 18%, 0.7)",
                }}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-extrabold text-white group-hover:text-indigo-300 transition-colors truncate">{list.name}</h3>
                      <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                        {[storeName(list.store_id), list.shopping_date ? formatDate(list.shopping_date) : (list.completed_at ? formatDate(list.completed_at) : null)].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleDelete(list.id, e)}
                      className="p-1 rounded text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                      title="Elimina lista"
                    >
                      <DeleteIcon size={12} />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 mt-3">
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold border ${
                      isOpen
                        ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
                        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    }`}>
                      {isOpen ? "🛒 In corso" : "✅ Conclusa"}
                    </span>
                    {totalCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
                        {checkedCount}/{totalCount} articoli
                      </span>
                    )}
                    {list.total_amount != null && (
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-zinc-800 text-white border border-zinc-700">
                        {formatCurrency(list.total_amount)}
                      </span>
                    )}
                  </div>
                </div>

                {!isOpen && (
                  <div>
                    {list.expense_id ? (
                      <span className="w-full py-2 rounded-lg text-[10px] font-bold text-center text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center gap-1.5">
                        ✓ In Finanze
                      </span>
                    ) : isAdmin && list.total_amount != null ? (
                      <button onClick={(e) => handleRegisterExpense(list.id, e)} disabled={isPending}
                        className="w-full py-2 rounded-lg text-[10px] font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all">
                        Registra in Finanze
                      </button>
                    ) : (
                      <span className="flex items-center justify-end gap-1 text-[10px] font-bold text-zinc-500">
                        Apri <ArrowRightIcon size={11} />
                      </span>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {/* Modale Nuova lista */}
      {showModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 animate-fade-in overflow-y-auto"
          onClick={() => setShowModal(false)}
        >
          <div
            className="relative w-full max-w-md my-8 rounded-2xl p-6 border shadow-2xl backdrop-blur-xl animate-fade-in"
            style={{ background: "linear-gradient(135deg, hsla(245, 60%, 15%, 0.1), hsla(240, 10%, 10%, 0.97))", borderColor: "hsla(245, 60%, 50%, 0.15)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white text-lg leading-none z-20" aria-label="Chiudi">
              ✕
            </button>

            <h2 className="text-base font-extrabold text-white mb-4">Nuova lista della spesa</h2>

            <form onSubmit={handleCreate} className="space-y-3">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome (es. Spesa settimanale)"
                className="w-full px-4 py-3 rounded-xl text-xs text-white border border-zinc-800 bg-zinc-950/80" />
              <p className="text-[9px] text-zinc-500">Negozio, data e articoli si aggiungono aprendo la lista appena creata.</p>
              <button type="submit" disabled={isPending} className="w-full py-3 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-500 transition-all">
                Crea lista
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
