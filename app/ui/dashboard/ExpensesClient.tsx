"use client";

import { useState, useTransition } from "react";
import { type Expense, type ExpenseCategory, type Supplier } from "@/lib/types/database";
import { createExpense, updateExpense, deleteExpense } from "@/app/actions/expenses";
import { EditIcon, DeleteIcon } from "./icons";

// Estendiamo il tipo per includere le relazioni restituite dal join Supabase
interface ExpenseWithRelations extends Omit<Expense, "amount"> {
  amount: number;
  expense_categories?: {
    name: string;
    color: string;
  } | null;
  suppliers?: {
    name: string;
  } | null;
}

interface ExpensesClientProps {
  initialExpenses: any[]; // Accettiamo il tipo con relazioni
  categories: ExpenseCategory[];
  suppliers: Supplier[];
}

const COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  indigo: { bg: "rgba(99,102,241,0.12)", text: "hsl(245 85% 75%)", border: "rgba(99,102,241,0.2)" },
  rose: { bg: "rgba(239,68,68,0.12)", text: "hsl(0 80% 75%)", border: "rgba(239,68,68,0.2)" },
  emerald: { bg: "rgba(16,185,129,0.12)", text: "hsl(150 70% 70%)", border: "rgba(16,185,129,0.2)" },
  amber: { bg: "rgba(245,158,11,0.12)", text: "hsl(38 90% 70%)", border: "rgba(245,158,11,0.2)" },
  sky: { bg: "rgba(14,165,233,0.12)", text: "hsl(200 85% 70%)", border: "rgba(14,165,233,0.2)" },
  pink: { bg: "rgba(236,72,153,0.12)", text: "hsl(330 80% 75%)", border: "rgba(236,72,153,0.2)" },
  purple: { bg: "rgba(168,85,247,0.12)", text: "hsl(270 80% 75%)", border: "rgba(168,85,247,0.2)" },
  slate: { bg: "rgba(107,114,128,0.15)", text: "hsl(215 15% 75%)", border: "rgba(107,114,128,0.25)" },
};

export default function ExpensesClient({ initialExpenses, categories, suppliers }: ExpensesClientProps) {
  const [expenses, setExpenses] = useState<ExpenseWithRelations[]>(initialExpenses);
  const [isPending, startTransition] = useTransition();

  // Stati del form
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [supplierId, setSupplierId] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  // Stato per la modifica
  const [editingId, setEditingId] = useState<string | null>(null);

  // Filtri
  const [filterCategoryId, setFilterCategoryId] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const resetForm = () => {
    setAmount("");
    setCategoryId(categories[0]?.id || "");
    setSupplierId("");
    setDescription("");
    setDate(new Date().toISOString().split("T")[0]);
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      alert("Inserisci un importo valido");
      return;
    }

    const selectedCat = categories.find(c => c.id === categoryId);
    if (!selectedCat) {
      alert("Seleziona una categoria valida");
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          amount: Number(amount),
          category_id: categoryId,
          supplier_id: supplierId || null,
          category_name: selectedCat.name, // fallback
          description,
          date,
        };

        if (editingId) {
          await updateExpense(editingId, payload);
          setExpenses(prev =>
            prev.map(item => {
              if (item.id !== editingId) return item;
              const matchingSupplier = suppliers.find(s => s.id === supplierId);
              return {
                ...item,
                ...payload,
                expense_categories: { name: selectedCat.name, color: selectedCat.color },
                suppliers: matchingSupplier ? { name: matchingSupplier.name } : null
              };
            })
          );
        } else {
          await createExpense(payload);
          const matchingSupplier = suppliers.find(s => s.id === supplierId);
          const newExp: ExpenseWithRelations = {
            id: Math.random().toString(),
            user_id: "",
            amount: Number(amount),
            category: selectedCat.name,
            category_id: categoryId,
            supplier_id: supplierId || null,
            description,
            date,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            expense_categories: { name: selectedCat.name, color: selectedCat.color },
            suppliers: matchingSupplier ? { name: matchingSupplier.name } : null
          };
          setExpenses(prev => [newExp, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        }
        resetForm();
      } catch (err: any) {
        alert(err.message || "Si è verificato un errore");
      }
    });
  };

  const handleEdit = (exp: ExpenseWithRelations) => {
    setEditingId(exp.id);
    setAmount(exp.amount.toString());
    setCategoryId(exp.category_id || categories[0]?.id || "");
    setSupplierId(exp.supplier_id || "");
    setDescription(exp.description || "");
    setDate(exp.date);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questa spesa?")) return;

    startTransition(async () => {
      try {
        await deleteExpense(id);
        setExpenses(prev => prev.filter(item => item.id !== id));
      } catch (err: any) {
        alert(err.message || "Errore durante l'eliminazione");
      }
    });
  };

  // Filtra localmente le spese
  const filteredExpenses = expenses.filter(exp => {
    const matchesCategory = filterCategoryId === "all" || exp.category_id === filterCategoryId;
    const matchesSearch = exp.description?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          exp.expense_categories?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          exp.suppliers?.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(val);
  };

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="animate-fade-in space-y-1">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
          Gestione Spese
        </h1>
        <p className="text-sm text-slate-400">Registra le transazioni e associa categorie e fornitori personalizzati.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Form di inserimento (1 colonna) */}
        <div
          className="rounded-2xl p-6 border h-fit shadow-xl backdrop-blur-md"
          style={{
            background: "hsl(240 10% 10% / 0.8)",
            borderColor: "hsl(240 5% 18% / 0.7)",
          }}
        >
          <h2 className="text-base font-bold text-white mb-5 tracking-tight">
            {editingId ? "📝 Modifica Spesa" : "💰 Nuova Spesa"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Importo */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Importo (€)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
                className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none transition-all duration-200 border"
                style={{
                  background: "hsl(240 10% 4% / 0.8)",
                  borderColor: "hsl(240 5% 18%)",
                }}
              />
            </div>

            {/* Categoria (Dinamica dal database) */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Categoria</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border select-custom"
                style={{
                  background: "hsl(240 10% 4% / 0.8)",
                  borderColor: "hsl(240 5% 18%)",
                }}
              >
                {categories.length === 0 ? (
                  <option value="">Nessuna categoria configurata</option>
                ) : (
                  categories.map((cat) => (
                    <option key={cat.id} value={cat.id} style={{ background: "hsl(240 10% 10%)" }}>
                      {cat.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Fornitore (Dinamico dal database) */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fornitore / Servizio</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border select-custom"
                style={{
                  background: "hsl(240 10% 4% / 0.8)",
                  borderColor: "hsl(240 5% 18%)",
                }}
              >
                <option value="" style={{ background: "hsl(240 10% 10%)" }}>Nessun Fornitore</option>
                {suppliers.map((sup) => (
                  <option key={sup.id} value={sup.id} style={{ background: "hsl(240 10% 10%)" }}>
                    {sup.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Data */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Data transazione</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border text-left"
                style={{
                  background: "hsl(240 10% 4% / 0.8)",
                  borderColor: "hsl(240 5% 18%)",
                }}
              />
            </div>

            {/* Descrizione */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Note / Dettaglio spesa</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Note aggiuntive..."
                className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none transition-all duration-200 border"
                style={{
                  background: "hsl(240 10% 4% / 0.8)",
                  borderColor: "hsl(240 5% 18%)",
                }}
              />
            </div>

            {/* Pulsanti */}
            <div className="flex gap-3 pt-2">
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 py-3 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-all border border-zinc-800"
                  style={{
                    background: "hsl(240 10% 15%)",
                  }}
                >
                  Annulla
                </button>
              )}
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 py-3 rounded-xl text-xs font-extrabold text-white transition-all shadow-md active:scale-98"
                style={{
                  background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
                  cursor: isPending ? "not-allowed" : "pointer",
                }}
              >
                {isPending ? "Salvataggio..." : editingId ? "Salva" : "Aggiungi"}
              </button>
            </div>
          </form>
        </div>

        {/* Lista e Tabella Spese (2 colonne) */}
        <div
          className="lg:col-span-2 rounded-2xl p-6 border flex flex-col space-y-5 shadow-xl backdrop-blur-md"
          style={{
            background: "hsl(240 10% 10% / 0.8)",
            borderColor: "hsl(240 5% 18% / 0.7)",
          }}
        >
          {/* Barra Filtri */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cerca spesa o fornitore..."
                className="w-full pl-4 pr-10 py-3 rounded-xl text-xs text-white focus:outline-none border"
                style={{
                  background: "hsl(240 10% 4% / 0.6)",
                  borderColor: "hsl(240 5% 15% / 0.8)",
                }}
              />
            </div>

            <select
              value={filterCategoryId}
              onChange={(e) => setFilterCategoryId(e.target.value)}
              className="px-4 py-3 rounded-xl text-xs text-white focus:outline-none border"
              style={{
                background: "hsl(240 10% 4% / 0.6)",
                borderColor: "hsl(240 5% 15% / 0.8)",
              }}
            >
              <option value="all">Tutte le Categorie</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id} style={{ background: "hsl(240 10% 10%)" }}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Elenco Spese */}
          <div className="flex-1 overflow-x-auto pr-1">
            {filteredExpenses.length === 0 ? (
              <div className="text-center py-16 text-slate-500 flex flex-col items-center justify-center">
                <span className="text-3xl mb-2">💸</span>
                <p className="text-sm">Nessuna spesa registrata.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b" style={{ borderColor: "hsl(240 5% 18% / 0.7)" }}>
                    <th className="pb-3.5 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Data</th>
                    <th className="pb-3.5 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Fornitore & Note</th>
                    <th className="pb-3.5 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Categoria</th>
                    <th className="pb-3.5 font-bold text-slate-400 uppercase tracking-wider text-[9px] text-right">Importo</th>
                    <th className="pb-3.5 font-bold text-slate-400 uppercase tracking-wider text-[9px] text-center">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "hsl(240 5% 18% / 0.3)" }}>
                  {filteredExpenses.map((exp, index) => {
                    const catName = exp.expense_categories?.name || exp.category;
                    const catColor = exp.expense_categories?.color || "slate";
                    const badge = COLOR_MAP[catColor] || COLOR_MAP.slate;

                    return (
                      <tr key={exp.id} className="hover:bg-white/2 transition-all duration-150 group animate-fade-in" style={{ animationDelay: `${index * 15}ms` }}>
                        <td className="py-4 text-slate-300 font-semibold whitespace-nowrap">
                          {new Date(exp.date).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" })}
                        </td>
                        <td className="py-4 pr-3">
                          <div className="text-white font-bold max-w-[220px] truncate">
                            {exp.suppliers?.name || "Nessun Fornitore"}
                          </div>
                          {exp.description && (
                            <div className="text-[10px] text-slate-400 mt-0.5 max-w-[220px] truncate">
                              {exp.description}
                            </div>
                          )}
                        </td>
                        <td className="py-4">
                          <span
                            className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border"
                            style={{
                              backgroundColor: badge.bg,
                              color: badge.text,
                              borderColor: badge.border,
                            }}
                          >
                            {catName}
                          </span>
                        </td>
                        <td className="py-4 text-right font-black text-rose-400 text-sm whitespace-nowrap">
                          -{formatCurrency(exp.amount)}
                        </td>
                        <td className="py-4 text-center">
                          <div className="flex items-center justify-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleEdit(exp)}
                              className="w-7 h-7 rounded-lg text-xs hover:bg-blue-500/10 hover:text-blue-400 border border-transparent hover:border-blue-500/20 flex items-center justify-center transition-all"
                              title="Modifica"
                            >
                              <EditIcon size={12} />
                            </button>
                            <button
                              onClick={() => handleDelete(exp.id)}
                              className="w-7 h-7 rounded-lg text-xs hover:bg-rose-500/10 hover:text-rose-400 border border-transparent hover:border-rose-500/20 flex items-center justify-center transition-all"
                              title="Elimina"
                            >
                              <DeleteIcon size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
