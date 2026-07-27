"use client";

import { useState, useTransition, useMemo } from "react";
import { type Expense, type ExpenseCategory, type Supplier } from "@/lib/types/database";
import { createExpense, updateExpense, deleteExpense } from "@/app/actions/expenses";
import { EditIcon, DeleteIcon, ExpensesIcon } from "./icons";

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
  initialExpenses: any[];
  categories: ExpenseCategory[];
  suppliers: Supplier[];
}

const COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  indigo: { bg: "rgba(99,102,241,0.12)", text: "hsl(245 85% 75%)", border: "rgba(99,102,241,0.2)" },
  rose: { bg: "rgba(239,68,68,0.12)", text: "hsl(0 80% 75%)", border: "rgba(239,68,68,0.2)" },
  emerald: { bg: "rgba(16,185,129,0.12)", text: "hsl(150 70% 70%)", border: "rgba(16,185,129,0.2)" },
  amber: { bg: "rgba(245,158,11,0.12)", text: "hsl(38 90% 70%)", border: "rgba(245,158,11,0.2)" },
  sky: { bg: "rgba(14,165,233,0.12)", text: "hsl(200 85% 70%)", border: "rgba(200 85% 70% / 0.2)" },
  pink: { bg: "rgba(236,72,153,0.12)", text: "hsl(330 80% 75%)", border: "rgba(236,72,153,0.2)" },
  purple: { bg: "rgba(168,85,247,0.12)", text: "hsl(270 80% 75%)", border: "rgba(168,85,247,0.2)" },
  slate: { bg: "rgba(107,114,128,0.15)", text: "hsl(215 15% 75%)", border: "rgba(107,114,128,0.25)" },
};

export default function ExpensesClient({ initialExpenses, categories, suppliers }: ExpensesClientProps) {
  const [expenses, setExpenses] = useState<ExpenseWithRelations[]>(initialExpenses);
  const [isPending, startTransition] = useTransition();

  // Tab Principale: "expenses" (Uscite) o "incomes" (Entrate)
  const [activeTab, setActiveTab] = useState<"expenses" | "incomes">("expenses");

  // Form states
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [supplierId, setSupplierId] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const [editingId, setEditingId] = useState<string | null>(null);

  // Filtri ricerca
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

  const isIncomeMode = activeTab === "incomes";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      alert("Inserisci un importo valido");
      return;
    }

    const selectedCat = categories.find(c => c.id === categoryId);
    if (!isIncomeMode && !selectedCat) {
      alert("Seleziona una categoria valida");
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          amount: Number(amount),
          category_id: isIncomeMode ? null : categoryId,
          supplier_id: isIncomeMode ? null : (supplierId || null),
          category_name: isIncomeMode ? "Entrata" : (selectedCat?.name || "Generica"),
          description,
          date,
          is_income: isIncomeMode,
        };

        if (editingId) {
          const res = await updateExpense(editingId, payload);
          if (!res.success) {
            alert(res.error || "Errore durante la modifica");
            return;
          }
          setExpenses(prev =>
            prev.map(item => {
              if (item.id !== editingId) return item;
              const matchingSupplier = suppliers.find(s => s.id === supplierId);
              return {
                ...item,
                ...payload,
                expense_categories: isIncomeMode ? null : (selectedCat ? { name: selectedCat.name, color: selectedCat.color } : null),
                suppliers: isIncomeMode ? null : (matchingSupplier ? { name: matchingSupplier.name } : null)
              };
            })
          );
        } else {
          const res = await createExpense(payload);
          if (!res.success || !res.data) {
            alert(res.error || "Errore durante il salvataggio");
            return;
          }
          setExpenses(prev => [res.data, ...prev]);
        }
        resetForm();
      } catch (err: any) {
        alert(err.message || "Si è verificato un errore");
      }
    });
  };

  const handleEdit = (exp: ExpenseWithRelations) => {
    setActiveTab(exp.is_income ? "incomes" : "expenses");
    setEditingId(exp.id);
    setAmount(exp.amount.toString());
    setCategoryId(exp.category_id || categories[0]?.id || "");
    setSupplierId(exp.supplier_id || "");
    setDescription(exp.description || "");
    setDate(exp.date);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questa registrazione?")) return;

    startTransition(async () => {
      try {
        const res = await deleteExpense(id);
        if (!res.success) {
          alert(res.error || "Errore durante l'eliminazione");
          return;
        }
        setExpenses(prev => prev.filter(item => item.id !== id));
      } catch (err: any) {
        alert(err.message || "Errore durante l'eliminazione");
      }
    });
  };

  // Calcolo Totali del mese per il tab attivo
  const monthlyTotal = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();

    return expenses
      .filter(exp => {
        const eDate = new Date(exp.date);
        const isCurMonth = eDate.getFullYear() === curYear && eDate.getMonth() === curMonth;
        return isCurMonth && (isIncomeMode ? exp.is_income : !exp.is_income);
      })
      .reduce((sum, exp) => sum + Number(exp.amount), 0);
  }, [expenses, isIncomeMode]);

  // Lista filtrata separata per il tab attivo
  const filteredList = useMemo(() => {
    return expenses.filter(exp => {
      const matchType = isIncomeMode ? exp.is_income : !exp.is_income;
      const matchCategory = filterCategoryId === "all" || exp.category_id === filterCategoryId;
      const matchSearch = exp.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          exp.expense_categories?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          exp.suppliers?.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchType && matchCategory && matchSearch;
    });
  }, [expenses, isIncomeMode, filterCategoryId, searchQuery]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(val);
  };

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="animate-fade-in flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            Transazioni Reali
          </h1>
          <p className="text-sm text-slate-400 mt-1">Registra le tue spese ed entrate mantenendole nettamente separate.</p>
        </div>

        {/* Tab Switcher con Neon Glow */}
        <div className="flex gap-2 p-1.5 bg-zinc-950/80 border border-white/10 rounded-2xl w-fit shadow-xl">
          <button
            type="button"
            onClick={() => { setActiveTab("expenses"); resetForm(); }}
            className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
              !isIncomeMode
                ? "bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-[0_0_20px_rgba(244,63,94,0.25)]"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <span>💸</span> Spese / Uscite
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("incomes"); resetForm(); }}
            className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
              isIncomeMode
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.25)]"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <span>💰</span> Entrate
          </button>
        </div>
      </div>

      {/* KPI Card Risorse per il tab attivo */}
      <div
        className="rounded-2xl p-5 border relative overflow-hidden group backdrop-blur-xl animate-fade-in"
        style={{
          background: isIncomeMode
            ? "linear-gradient(135deg, hsla(150, 60%, 15%, 0.08), hsla(240, 10%, 10%, 0.7))"
            : "linear-gradient(135deg, hsla(350, 60%, 15%, 0.08), hsla(240, 10%, 10%, 0.7))",
          borderColor: isIncomeMode
            ? "hsla(150, 60%, 50%, 0.15)"
            : "hsla(350, 60%, 50%, 0.15)",
        }}
      >
        <div className="flex justify-between items-center relative z-10">
          <div>
            <h4 className={`text-[10px] font-bold uppercase tracking-widest ${isIncomeMode ? "text-emerald-400" : "text-rose-400"}`}>
              {isIncomeMode ? "Totale Entrate Questo Mese" : "Totale Uscite Questo Mese"}
            </h4>
            <p className="text-3xl font-black text-white mt-1">{formatCurrency(monthlyTotal)}</p>
          </div>
          <div className={`p-3.5 rounded-2xl text-xl font-bold ${
            isIncomeMode ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
          }`}>
            {isIncomeMode ? "📈" : "📉"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Form di Inserimento */}
        <div
          className="rounded-2xl p-6 border relative overflow-hidden group shadow-2xl backdrop-blur-xl animate-fade-in h-fit"
          style={{
            background: isIncomeMode
              ? "linear-gradient(135deg, hsla(150, 60%, 15%, 0.08), hsla(240, 10%, 10%, 0.7))"
              : "linear-gradient(135deg, hsla(350, 60%, 15%, 0.08), hsla(240, 10%, 10%, 0.7))",
            borderColor: isIncomeMode
              ? "hsla(150, 60%, 50%, 0.15)"
              : "hsla(350, 60%, 50%, 0.15)",
          }}
        >
          <div className="absolute top-[-30%] right-[-20%] w-40 h-40 rounded-full bg-rose-500/5 blur-[50px] pointer-events-none" />

          <h2 className="text-base font-extrabold bg-gradient-to-r from-white to-zinc-300 bg-clip-text text-transparent mb-5 tracking-tight flex items-center gap-2">
            <span className={isIncomeMode ? "text-emerald-400" : "text-rose-400"}><ExpensesIcon size={16} /></span>
            {editingId ? (isIncomeMode ? "Modifica Entrata" : "Modifica Spesa") : (isIncomeMode ? "Nuova Entrata" : "Nuova Spesa")}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
            
            {/* Importo */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Importo (€)</label>
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
                onFocus={(e) => {
                  e.target.style.borderColor = isIncomeMode ? "hsl(142 70% 45%)" : "hsl(350 85% 55%)";
                  e.target.style.boxShadow = isIncomeMode ? "0 0 15px rgba(16,185,129,0.15)" : "0 0 15px rgba(244,63,94,0.15)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "hsl(240 5% 18%)";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>

            {/* Categoria (Solo se Uscita) */}
            {!isIncomeMode && (
              <div className="space-y-1.5 animate-fade-in">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Categoria Spesa</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border select-custom transition-all"
                  style={{
                    background: "hsl(240 10% 4% / 0.8)",
                    borderColor: "hsl(240 5% 18%)",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "hsl(350 85% 55%)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "hsl(240 5% 18%)";
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
            )}

            {/* Fornitore (Solo se Uscita) */}
            {!isIncomeMode && (
              <div className="space-y-1.5 animate-fade-in">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Fornitore / Servizio</label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border select-custom transition-all"
                  style={{
                    background: "hsl(240 10% 4% / 0.8)",
                    borderColor: "hsl(240 5% 18%)",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "hsl(350 85% 55%)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "hsl(240 5% 18%)";
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
            )}

            {/* Data */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Data registrata</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border text-left transition-all"
                style={{
                  background: "hsl(240 10% 4% / 0.8)",
                  borderColor: "hsl(240 5% 18%)",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = isIncomeMode ? "hsl(142 70% 45%)" : "hsl(350 85% 55%)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "hsl(240 5% 18%)";
                }}
              />
            </div>

            {/* Descrizione / Note */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                {isIncomeMode ? "Origine / Descrizione (es. Stipendio, Rimborso)" : "Note / Causale Spesa"}
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={isIncomeMode ? "es. Stipendio mese corrente, Rendita" : "es. Spesa alimentari, Rifornimento carburante"}
                className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none transition-all duration-200 border"
                style={{
                  background: "hsl(240 10% 4% / 0.8)",
                  borderColor: "hsl(240 5% 18%)",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = isIncomeMode ? "hsl(142 70% 45%)" : "hsl(350 85% 55%)";
                  e.target.style.boxShadow = isIncomeMode ? "0 0 15px rgba(16,185,129,0.15)" : "0 0 15px rgba(244,63,94,0.15)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "hsl(240 5% 18%)";
                  e.target.style.boxShadow = "none";
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
                className="flex-1 py-3 rounded-xl text-xs font-extrabold text-white transition-all shadow-[0_0_20px_rgba(244,63,94,0.15)] hover:shadow-[0_0_30px_rgba(244,63,94,0.3)] active:scale-98"
                style={{
                  background: isIncomeMode
                    ? "linear-gradient(135deg, hsl(142 70% 45%), hsl(150 60% 35%))"
                    : "linear-gradient(135deg, hsl(350 85% 55%), hsl(340 75% 45%))",
                  cursor: isPending ? "not-allowed" : "pointer",
                }}
              >
                {isPending ? "Salvataggio..." : editingId ? "Salva Modifiche" : (isIncomeMode ? "Registra Entrata" : "Registra Spesa")}
              </button>
            </div>
          </form>
        </div>

        {/* Tabella Registro (2 Colonne) */}
        <div
          className="lg:col-span-2 rounded-2xl p-6 border flex flex-col space-y-5 shadow-2xl relative overflow-hidden group backdrop-blur-xl animate-fade-in"
          style={{
            background: "linear-gradient(135deg, hsla(240, 10%, 12%, 0.5), hsla(240, 10%, 10%, 0.8))",
            borderColor: "hsla(240, 5%, 18%, 0.7)",
          }}
        >
          <div className="absolute top-[-30%] left-[-20%] w-60 h-60 rounded-full bg-zinc-500/5 blur-[80px] pointer-events-none" />

          {/* Filtri */}
          <div className="flex flex-col sm:flex-row gap-3 relative z-10">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isIncomeMode ? "Cerca entrate..." : "Cerca per note o fornitore..."}
                className="w-full pl-4 pr-10 py-3 rounded-xl text-xs text-white focus:outline-none border transition-all"
                style={{
                  background: "hsl(240 10% 4% / 0.6)",
                  borderColor: "hsl(240 5% 15% / 0.8)",
                }}
                onFocus={(e) => e.target.style.borderColor = "hsl(240 5% 35%)"}
                onBlur={(e) => e.target.style.borderColor = "hsl(240 5% 15% / 0.8)"}
              />
            </div>

            {!isIncomeMode && (
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
            )}
          </div>

          {/* Elenco Tabella */}
          <div className="flex-1 overflow-x-auto pr-1 relative z-10">
            {filteredList.length === 0 ? (
              <div className="text-center py-16 text-slate-500 flex flex-col items-center justify-center">
                <span className="text-3xl mb-2">{isIncomeMode ? "💰" : "💸"}</span>
                <p className="text-xs">{isIncomeMode ? "Nessuna entrata registrata." : "Nessuna spesa trovata."}</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b" style={{ borderColor: "hsl(240 5% 18% / 0.7)" }}>
                    <th className="pb-3.5 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Data</th>
                    <th className="pb-3.5 font-bold text-slate-400 uppercase tracking-wider text-[9px]">
                      {isIncomeMode ? "Descrizione Entrata" : "Fornitore & Note"}
                    </th>
                    {!isIncomeMode && (
                      <th className="pb-3.5 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Categoria</th>
                    )}
                    <th className="pb-3.5 font-bold text-slate-400 uppercase tracking-wider text-[9px] text-right">Importo</th>
                    <th className="pb-3.5 font-bold text-slate-400 uppercase tracking-wider text-[9px] text-center">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "hsl(240 5% 18% / 0.3)" }}>
                  {filteredList.map((exp, index) => {
                    const catName = exp.expense_categories?.name || exp.category;
                    const catColor = exp.expense_categories?.color || "slate";
                    const badge = COLOR_MAP[catColor] || COLOR_MAP.slate;

                    return (
                      <tr key={exp.id} className="hover:bg-white/2 transition-all duration-150 group animate-fade-in" style={{ animationDelay: `${index * 15}ms` }}>
                        <td className="py-4 text-slate-300 font-semibold whitespace-nowrap">
                          {new Date(exp.date).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" })}
                        </td>
                        <td className="py-4 pr-3">
                          {isIncomeMode ? (
                            <div className="text-white font-bold">{exp.description || "Entrata Senza Descrizione"}</div>
                          ) : (
                            <>
                              <div className="text-white font-bold max-w-[200px] truncate">
                                {exp.suppliers?.name || "Nessun Fornitore"}
                              </div>
                              {exp.description && (
                                <div className="text-[10px] text-slate-400 mt-0.5 max-w-[200px] truncate font-medium">
                                  {exp.description}
                                </div>
                              )}
                            </>
                          )}
                        </td>
                        {!isIncomeMode && (
                          <td className="py-4">
                            <span
                              className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border transition-transform duration-300 group-hover:scale-102"
                              style={{
                                backgroundColor: badge.bg,
                                color: badge.text,
                                borderColor: badge.border,
                              }}
                            >
                              {catName}
                            </span>
                          </td>
                        )}
                        <td className={`py-4 text-right font-black text-sm whitespace-nowrap ${isIncomeMode ? "text-emerald-400" : "text-rose-400"}`}>
                          {isIncomeMode ? "+" : "-"}{formatCurrency(exp.amount)}
                        </td>
                        <td className="py-4 text-center">
                          <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
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
