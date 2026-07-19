"use client";

import { useState, useTransition, useMemo } from "react";
import { type Budget, type ExpenseCategory } from "@/lib/types/database";
import { createBudget, deleteBudget } from "@/app/actions/budget";
import { DeleteIcon, ExpensesIcon, SchedulesIcon } from "./icons";

interface BudgetWithRelations extends Omit<Budget, "amount"> {
  amount: number;
  expense_categories?: {
    name: string;
    color: string;
  } | null;
}

interface BudgetClientProps {
  initialBudgets: any[];
  categories: ExpenseCategory[];
  expenses: any[];
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

export default function BudgetClient({ initialBudgets, categories, expenses }: BudgetClientProps) {
  const [budgets, setBudgets] = useState<BudgetWithRelations[]>(initialBudgets);
  const [isPending, startTransition] = useTransition();

  // Stati del form
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [type, setType] = useState<"income" | "fixed" | "variable">("fixed");
  const [label, setLabel] = useState("");

  const resetForm = () => {
    setAmount("");
    setCategoryId("");
    setLabel("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      alert("Inserisci un importo valido");
      return;
    }
    if (!label.trim()) {
      alert("Inserisci una descrizione o etichetta");
      return;
    }

    const selectedCat = categories.find(c => c.id === categoryId);

    startTransition(async () => {
      try {
        const payload = {
          amount: Number(amount),
          category_id: type === "income" ? null : (categoryId || null),
          type,
          label: label.trim(),
        };

        const res = await createBudget(payload);
        if (!res.success || !res.data) {
          alert(res.error || "Errore durante il salvataggio");
          return;
        }

        setBudgets(prev => [res.data, ...prev]);
        resetForm();
      } catch (err: any) {
        alert(err.message || "Si è verificato un errore");
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questa voce di budget?")) return;

    startTransition(async () => {
      try {
        const res = await deleteBudget(id);
        if (!res.success) {
          alert(res.error || "Errore durante l'eliminazione");
          return;
        }
        setBudgets(prev => prev.filter(b => b.id !== id));
      } catch (err: any) {
        alert(err.message || "Errore durante l'eliminazione");
      }
    });
  };

  // 1. Spese del mese in corso
  const currentMonthExpenses = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth(); // 0-indexed

    return expenses.filter(e => {
      const eDate = new Date(e.date);
      return eDate.getFullYear() === curYear && eDate.getMonth() === curMonth;
    });
  }, [expenses]);

  // 2. Spese raggruppate per categoria del mese corrente
  const realExpensesByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    currentMonthExpenses.forEach(e => {
      const catId = e.category_id || "unassigned";
      map[catId] = (map[catId] || 0) + Number(e.amount);
    });
    return map;
  }, [currentMonthExpenses]);

  // 3. Calcoli Totali Budget
  const totals = useMemo(() => {
    let income = 0;
    let fixed = 0;
    let variable = 0;

    budgets.forEach(b => {
      if (b.type === "income") income += b.amount;
      else if (b.type === "fixed") fixed += b.amount;
      else if (b.type === "variable") variable += b.amount;
    });

    const totalOutgoings = fixed + variable;
    const powerOfSpending = income - fixed; // Entrate - Spese Fisse
    const remainingBudget = income - totalOutgoings;

    return { income, fixed, variable, totalOutgoings, powerOfSpending, remainingBudget };
  }, [budgets]);

  // 4. Analisi Regola 50/30/20
  const ruleAnalysis = useMemo(() => {
    if (totals.income === 0) return null;
    const fixedPercent = (totals.fixed / totals.income) * 100;
    const variablePercent = (totals.variable / totals.income) * 100;
    const savingsPercent = ((totals.income - totals.fixed - totals.variable) / totals.income) * 100;

    return {
      fixedPercent: Math.round(fixedPercent),
      variablePercent: Math.round(variablePercent),
      savingsPercent: Math.round(savingsPercent),
    };
  }, [totals]);

  // 5. Consolidamento budget di spesa per categoria per il confronto (fisse + variabili)
  const categoryBudgetComparison = useMemo(() => {
    const map: Record<string, { categoryName: string; color: string; budgetAmt: number; realAmt: number }> = {};

    budgets.forEach(b => {
      if (b.type === "income") return;
      const catId = b.category_id || "unassigned";
      const catName = b.expense_categories?.name || "Generica / Altro";
      const catColor = b.expense_categories?.color || "slate";

      if (!map[catId]) {
        map[catId] = {
          categoryName: catName,
          color: catColor,
          budgetAmt: 0,
          realAmt: realExpensesByCategory[catId] || 0,
        };
      }
      map[catId].budgetAmt += b.amount;
    });

    // Aggiungi anche le categorie in cui l'utente ha speso soldi reali ma non ha pianificato un budget
    Object.keys(realExpensesByCategory).forEach(catId => {
      if (!map[catId]) {
        const catObj = categories.find(c => c.id === catId);
        map[catId] = {
          categoryName: catObj ? catObj.name : "Generica / Altro",
          color: catObj ? catObj.color : "slate",
          budgetAmt: 0,
          realAmt: realExpensesByCategory[catId],
        };
      }
    });

    return Object.values(map);
  }, [budgets, realExpensesByCategory, categories]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(val);
  };

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="animate-fade-in space-y-1">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
          Budget & Previsioni
        </h1>
        <p className="text-sm text-slate-400">Pianifica le tue finanze e confronta il budget preventivato con le spese reali.</p>
      </div>

      {/* KPI Cards (Design Premium Neon) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in">
        
        {/* Entrate Previste */}
        <div
          className="rounded-2xl p-5 border relative overflow-hidden group shadow-[0_0_20px_rgba(16,185,129,0.02)]"
          style={{
            background: "linear-gradient(135deg, hsla(150, 60%, 15%, 0.05), hsla(240, 10% ,10%, 0.6))",
            borderColor: "hsla(150, 60%, 50%, 0.12)",
          }}
        >
          <div className="absolute top-[-30%] right-[-20%] w-32 h-32 rounded-full bg-emerald-500/5 blur-[40px]" />
          <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Entrate Mensili</h4>
          <p className="text-2xl font-black text-white mt-2">{formatCurrency(totals.income)}</p>
          <div className="text-[9px] text-slate-500 mt-1 font-semibold">Budget pianificato</div>
        </div>

        {/* Spese Fisse Previste */}
        <div
          className="rounded-2xl p-5 border relative overflow-hidden group shadow-[0_0_20px_rgba(244,63,94,0.02)]"
          style={{
            background: "linear-gradient(135deg, hsla(350, 60%, 15%, 0.05), hsla(240, 10%, 10%, 0.6))",
            borderColor: "hsla(350, 60%, 50%, 0.12)",
          }}
        >
          <div className="absolute top-[-30%] right-[-20%] w-32 h-32 rounded-full bg-rose-500/5 blur-[40px]" />
          <h4 className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">Uscite Fisse</h4>
          <p className="text-2xl font-black text-white mt-2">{formatCurrency(totals.fixed)}</p>
          <div className="text-[9px] text-slate-500 mt-1 font-semibold">Obbligazioni fisse</div>
        </div>

        {/* Potere di Spesa Residuo */}
        <div
          className="rounded-2xl p-5 border relative overflow-hidden group shadow-[0_0_20px_rgba(14,165,233,0.02)]"
          style={{
            background: "linear-gradient(135deg, hsla(200, 60%, 15%, 0.05), hsla(240, 10%, 10%, 0.6))",
            borderColor: "hsla(200, 60%, 50%, 0.12)",
          }}
        >
          <div className="absolute top-[-30%] right-[-20%] w-32 h-32 rounded-full bg-sky-500/5 blur-[40px]" />
          <h4 className="text-[10px] font-bold text-sky-400 uppercase tracking-widest">Potere di Spesa</h4>
          <p className="text-2xl font-black text-white mt-2">{formatCurrency(totals.powerOfSpending)}</p>
          <div className="text-[9px] text-slate-500 mt-1 font-semibold">Entrate - Spese Fisse</div>
        </div>

        {/* Risparmio Ipotizzato */}
        <div
          className="rounded-2xl p-5 border relative overflow-hidden group shadow-[0_0_20px_rgba(168,85,247,0.02)]"
          style={{
            background: "linear-gradient(135deg, hsla(270, 60%, 15%, 0.05), hsla(240, 10%, 10%, 0.6))",
            borderColor: "hsla(270, 60%, 50%, 0.12)",
          }}
        >
          <div className="absolute top-[-30%] right-[-20%] w-32 h-32 rounded-full bg-purple-500/5 blur-[40px]" />
          <h4 className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Risparmio Stimato</h4>
          <p className={`text-2xl font-black mt-2 ${totals.remainingBudget >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {formatCurrency(totals.remainingBudget)}
          </p>
          <div className="text-[9px] text-slate-500 mt-1 font-semibold">Margine residuo mensile</div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Aggiunta Pianificazione Budget (Neon Indigo) */}
        <div
          className="rounded-2xl p-6 border h-fit shadow-2xl relative overflow-hidden group backdrop-blur-xl animate-fade-in"
          style={{
            background: "linear-gradient(135deg, hsla(245, 60%, 15%, 0.08), hsla(240, 10%, 10%, 0.7))",
            borderColor: "hsla(245, 60%, 50%, 0.15)",
          }}
        >
          <div className="absolute top-[-30%] right-[-20%] w-40 h-40 rounded-full bg-indigo-500/5 blur-[50px] pointer-events-none" />

          <h2 className="text-base font-extrabold bg-gradient-to-r from-white to-zinc-300 bg-clip-text text-transparent mb-5 tracking-tight flex items-center gap-2">
            <span>📊</span> Aggiungi Previsione
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
            {/* Tipo */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Tipo Voce</label>
              <select
                value={type}
                onChange={(e) => {
                  setType(e.target.value as any);
                  if (e.target.value === "income") setCategoryId("");
                }}
                className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border select-custom transition-all"
                style={{
                  background: "hsl(240 10% 4% / 0.8)",
                  borderColor: "hsl(240 5% 18%)",
                }}
                onFocus={(e) => e.target.style.borderColor = "hsl(245 85% 55%)"}
                onBlur={(e) => e.target.style.borderColor = "hsl(240 5% 18%)"}
              >
                <option value="fixed" style={{ background: "hsl(240 10% 10%)" }}>Spesa Fissa (Bisogni)</option>
                <option value="variable" style={{ background: "hsl(240 10% 10%)" }}>Spesa Ipotetica (Desideri)</option>
                <option value="income" style={{ background: "hsl(240 10% 10%)" }}>Entrata Corrente</option>
              </select>
            </div>

            {/* Categoria (Nascondi se Entrata) */}
            {type !== "income" && (
              <div className="space-y-1.5 animate-fade-in">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Categoria</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border select-custom transition-all"
                  style={{
                    background: "hsl(240 10% 4% / 0.8)",
                    borderColor: "hsl(240 5% 18%)",
                  }}
                  onFocus={(e) => e.target.style.borderColor = "hsl(245 85% 55%)"}
                  onBlur={(e) => e.target.style.borderColor = "hsl(240 5% 18%)"}
                >
                  <option value="" style={{ background: "hsl(240 10% 10%)" }}>Nessuna categoria (Generica)</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id} style={{ background: "hsl(240 10% 10%)" }}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Descrizione */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Descrizione / Nome</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={type === "income" ? "es. Stipendio, Affitti" : "es. Affitto, Bolletta, Ristorante"}
                required
                className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border transition-all duration-200"
                style={{
                  background: "hsl(240 10% 4% / 0.8)",
                  borderColor: "hsl(240 5% 18%)",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "hsl(245 85% 55%)";
                  e.target.style.boxShadow = "0 0 15px rgba(99,102,241,0.15)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "hsl(240 5% 18%)";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>

            {/* Importo */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Importo Mensile (€)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
                className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border transition-all duration-200"
                style={{
                  background: "hsl(240 10% 4% / 0.8)",
                  borderColor: "hsl(240 5% 18%)",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "hsl(245 85% 55%)";
                  e.target.style.boxShadow = "0 0 15px rgba(99,102,241,0.15)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "hsl(240 5% 18%)";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-3 rounded-xl text-xs font-extrabold text-white transition-all shadow-[0_0_20px_rgba(99,102,241,0.15)] hover:shadow-[0_0_30px_rgba(99,102,241,0.3)] active:scale-98 mt-2"
              style={{
                background: "linear-gradient(135deg, hsl(245 85% 55%), hsl(240 75% 45%))",
                cursor: isPending ? "not-allowed" : "pointer",
              }}
            >
              {isPending ? "Aggiunta..." : "Aggiungi al Budget"}
            </button>
          </form>
        </div>

        {/* Confronto Budget vs Spese Reali (2 Colonne, Neon Slate/Indigo) */}
        <div
          className="lg:col-span-2 rounded-2xl p-6 border flex flex-col space-y-6 shadow-2xl relative overflow-hidden group backdrop-blur-xl animate-fade-in"
          style={{
            background: "linear-gradient(135deg, hsla(240, 10%, 12%, 0.5), hsla(240, 10%, 10%, 0.8))",
            borderColor: "hsla(240, 5%, 18%, 0.7)",
          }}
        >
          <div className="absolute top-[-30%] left-[-20%] w-60 h-60 rounded-full bg-zinc-500/5 blur-[80px] pointer-events-none" />

          <div>
            <h3 className="text-sm font-extrabold text-white tracking-wide">
              📊 Confronto Mese Corrente (Budget vs Spese Reali)
            </h3>
            <p className="text-[10px] text-zinc-500 mt-1">Confronto in tempo reale delle categorie preventivate contro le transazioni effettuate nel mese.</p>
          </div>

          <div className="flex-1 overflow-x-auto pr-1 relative z-10 space-y-4">
            {categoryBudgetComparison.length === 0 ? (
              <div className="text-center py-16 text-slate-500 flex flex-col items-center justify-center">
                <span className="text-3xl mb-2">📈</span>
                <p className="text-xs">Pianifica le uscite fisse o ipotetiche per attivare il confronto.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {categoryBudgetComparison.map((item, idx) => {
                  const percent = item.budgetAmt > 0 ? (item.realAmt / item.budgetAmt) * 100 : 0;
                  const isOver = percent > 100;
                  
                  // Scelta del colore barra neon
                  let barColor = "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]";
                  if (percent > 80 && percent <= 100) {
                    barColor = "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]";
                  } else if (percent > 100) {
                    barColor = "bg-rose-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]";
                  }

                  const badge = COLOR_MAP[item.color] || COLOR_MAP.slate;

                  return (
                    <div key={idx} className="space-y-2 border-b border-zinc-800/40 pb-4">
                      {/* Categoria, Budget e Spesa Reale */}
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className="px-2 py-0.5 rounded border text-[9px] font-extrabold"
                            style={{
                              backgroundColor: badge.bg,
                              color: badge.text,
                              borderColor: badge.border,
                            }}
                          >
                            {item.categoryName}
                          </span>
                        </div>
                        <div className="text-[10px] font-medium text-slate-400">
                          Reale: <span className="text-white font-black">{formatCurrency(item.realAmt)}</span> / Budget: <span className="text-zinc-500">{formatCurrency(item.budgetAmt)}</span>
                        </div>
                      </div>

                      {/* Barra di Progresso */}
                      <div className="relative h-2 w-full bg-zinc-950 rounded-full overflow-hidden border border-white/5">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                          style={{ width: `${Math.min(percent, 100)}%` }}
                        />
                      </div>

                      {/* Differenza o Sforamento */}
                      <div className="flex justify-between items-center text-[9px]">
                        <span className="text-zinc-500 font-bold">
                          {percent > 0 ? `${Math.round(percent)}% utilizzato` : "Nessun budget definito per categoria"}
                        </span>
                        {item.budgetAmt > 0 && (
                          <span className={`font-black ${isOver ? "text-rose-400" : "text-emerald-400"}`}>
                            {isOver 
                              ? `Sforato di ${formatCurrency(item.realAmt - item.budgetAmt)}` 
                              : `Rimanenti ${formatCurrency(item.budgetAmt - item.realAmt)}`
                            }
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Ripartizione Consigliata 50/30/20 & Elenco Voci Budget */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Pannello Suggerimento Potere di Spesa 50/30/20 (Neon Purple) */}
        <div
          className="rounded-2xl p-6 border shadow-2xl relative overflow-hidden group backdrop-blur-xl animate-fade-in"
          style={{
            background: "linear-gradient(135deg, hsla(270, 60%, 15%, 0.08), hsla(240, 10%, 10%, 0.7))",
            borderColor: "hsla(270, 60%, 50%, 0.15)",
          }}
        >
          <div className="absolute top-[-30%] left-[-20%] w-40 h-40 rounded-full bg-purple-500/5 blur-[50px] pointer-events-none" />

          <h3 className="text-sm font-extrabold text-white tracking-wide mb-4">
            💡 Ripartizione Consigliata (Regola 50/30/20)
          </h3>

          {ruleAnalysis ? (
            <div className="space-y-4 text-xs z-10 relative">
              <p className="text-[10px] text-slate-400 leading-relaxed">
                La regola suggerisce di dividere le entrate mensili nette in questo modo:
              </p>
              
              {/* Bisogni (Spese Fisse) */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold">
                  <span className="text-rose-400">Bisogni (Spese Fisse) - 50% max</span>
                  <span className="text-white">{ruleAnalysis.fixedPercent}%</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden border border-white/5">
                  <div className="h-full bg-rose-500 rounded-full" style={{ width: `${Math.min(ruleAnalysis.fixedPercent, 100)}%` }} />
                </div>
              </div>

              {/* Desideri (Spese Variabili) */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold">
                  <span className="text-sky-400">Desideri (Spese Variabili) - 30% max</span>
                  <span className="text-white">{ruleAnalysis.variablePercent}%</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden border border-white/5">
                  <div className="h-full bg-sky-500 rounded-full" style={{ width: `${Math.min(ruleAnalysis.variablePercent, 100)}%` }} />
                </div>
              </div>

              {/* Risparmio */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold">
                  <span className="text-emerald-400">Risparmio / Investimento - 20% min</span>
                  <span className="text-white">{ruleAnalysis.savingsPercent}%</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden border border-white/5">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.max(0, Math.min(ruleAnalysis.savingsPercent, 100))}%` }} />
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-800 text-[10px] text-slate-400 leading-relaxed">
                {ruleAnalysis.fixedPercent > 50 ? (
                  <span className="text-rose-400 font-semibold">⚠️ Le tue spese fisse superano il 50% consigliato. Cerca di ottimizzare contratti o ridurre abbonamenti per liberare potere di spesa.</span>
                ) : ruleAnalysis.savingsPercent < 20 ? (
                  <span className="text-amber-400 font-semibold">⚠️ Stai risparmiando meno del 20% consigliato. Prova a stringere leggermente sulle spese ipotetiche e variabili.</span>
                ) : (
                  <span className="text-emerald-400 font-semibold">✨ Ottima allocazione! La tua struttura di budget è sana ed equilibrata.</span>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-6 text-center">Inserisci prima un'entrata mensile per calcolare la ripartizione consigliata.</p>
          )}
        </div>

        {/* Elenco Voci Pianificate (2 Colonne, Neon Slate/Zinc) */}
        <div
          className="lg:col-span-2 rounded-2xl p-6 border flex flex-col space-y-4 shadow-2xl relative overflow-hidden group backdrop-blur-xl animate-fade-in"
          style={{
            background: "linear-gradient(135deg, hsla(240, 10%, 12%, 0.5), hsla(240, 10%, 10%, 0.8))",
            borderColor: "hsla(240, 5%, 18%, 0.7)",
          }}
        >
          <div className="absolute top-[-30%] left-[-20%] w-60 h-60 rounded-full bg-zinc-500/5 blur-[80px] pointer-events-none" />

          <h3 className="text-sm font-extrabold text-white tracking-wide">
            📋 Voci di Budget Pianificate
          </h3>

          <div className="flex-1 overflow-x-auto pr-1 relative z-10 max-h-[300px] overflow-y-auto">
            {budgets.length === 0 ? (
              <p className="text-xs text-slate-500 py-12 text-center">Nessuna voce programmata nel budget.</p>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b" style={{ borderColor: "hsl(240 5% 18% / 0.7)" }}>
                    <th className="pb-3 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Descrizione</th>
                    <th className="pb-3 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Tipo</th>
                    <th className="pb-3 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Categoria</th>
                    <th className="pb-3 font-bold text-slate-400 uppercase tracking-wider text-[9px] text-right">Importo Mensile</th>
                    <th className="pb-3 font-bold text-slate-400 uppercase tracking-wider text-[9px] text-center">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "hsl(240 5% 18% / 0.3)" }}>
                  {budgets.map((b) => {
                    const catName = b.expense_categories?.name || "Generica / Altro";
                    const catColor = b.expense_categories?.color || "slate";
                    const badge = COLOR_MAP[catColor] || COLOR_MAP.slate;

                    return (
                      <tr key={b.id} className="hover:bg-white/2 transition-colors duration-150 group">
                        <td className="py-3 font-bold text-white whitespace-nowrap">{b.label}</td>
                        <td className="py-3">
                          <span className={`text-[10px] font-bold ${
                            b.type === "income" ? "text-emerald-400" : b.type === "fixed" ? "text-rose-400" : "text-sky-400"
                          }`}>
                            {b.type === "income" ? "Entrata" : b.type === "fixed" ? "Spesa Fissa" : "Spesa Variabile"}
                          </span>
                        </td>
                        <td className="py-3">
                          {b.type !== "income" ? (
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded text-[8px] font-bold border"
                              style={{
                                backgroundColor: badge.bg,
                                color: badge.text,
                                borderColor: badge.border,
                              }}
                            >
                              {catName}
                            </span>
                          ) : (
                            <span className="text-[10px] text-zinc-600">-</span>
                          )}
                        </td>
                        <td className={`py-3 text-right font-black text-xs ${b.type === "income" ? "text-emerald-400" : "text-white"}`}>
                          {b.type === "income" ? "+" : "-"}{formatCurrency(b.amount)}
                        </td>
                        <td className="py-3 text-center">
                          <button
                            onClick={() => handleDelete(b.id)}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
                            title="Elimina"
                          >
                            <DeleteIcon size={12} />
                          </button>
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
