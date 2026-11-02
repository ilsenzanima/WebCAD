"use client";

import { useState, useTransition, useMemo } from "react";
import { type Budget, type BudgetOverride, type ExpenseCategory } from "@/lib/types/database";
import { updateCategoryBudget, updateCategoryBudgetPercent, updateCategoryBudgetType } from "@/app/actions/categories";
import { formatCurrency } from "@/lib/format";
import { getEffectiveAmount as getEffectiveAmountBase } from "@/lib/budgetCalc";
import BudgetForecast from "./BudgetForecast";
import BudgetAllocationDonut from "./BudgetAllocationDonut";
import { getCategoryBadgeStyle } from "@/lib/categoryColors";

interface BudgetWithRelations extends Omit<Budget, "amount"> {
  amount: number;
  expense_categories?: {
    name: string;
    color: string;
  } | null;
  suppliers?: {
    name: string;
  } | null;
}

interface BudgetClientProps {
  initialBudgets: any[];
  categories: ExpenseCategory[];
  initialExpenses: any[];
  initialOverrides: BudgetOverride[];
  initialSchedules: any[];
}

// Movimenti minimi perche' un mese passato conti come "tracciato" nel riporto per categoria
const MIN_TRACKED_MOVEMENTS = 10;
// Mesi passati considerati per riporto e media di una categoria
const HISTORY_MONTHS = 6;

const MONTH_LABELS = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

export default function BudgetClient({ initialBudgets, categories: initialCategories, initialExpenses, initialOverrides, initialSchedules }: BudgetClientProps) {
  const [budgets] = useState<BudgetWithRelations[]>(initialBudgets);
  const [overrides] = useState<BudgetOverride[]>(initialOverrides);
  const [allExpenses] = useState<any[]>(initialExpenses);
  // Giroconti e importi straordinari restano nel registro ma non entrano in medie, riporto e confronti
  const expenses = useMemo(() => allExpenses.filter((e: any) => !e.is_extraordinary), [allExpenses]);
  const [categories, setCategories] = useState<ExpenseCategory[]>(initialCategories);
  const [schedules] = useState<any[]>(initialSchedules);
  const [, startTransition] = useTransition();

  // Editing inline del budget mensile per categoria (€ fisso oppure % delle entrate previste)
  const [editingCategoryBudgetId, setEditingCategoryBudgetId] = useState<string | null>(null);
  const [categoryBudgetDraft, setCategoryBudgetDraft] = useState("");
  const [categoryBudgetMode, setCategoryBudgetMode] = useState<"amount" | "percent">("amount");

  // Categorie espanse nella vista "Confronto per Categoria" (vista veloce collassata di default)
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(new Set());
  const toggleCategoryExpanded = (categoryId: string) => {
    setExpandedCategoryIds(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  // Mese selezionato per l'analisi previsto/reale (default: mese corrente)
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1); // 1-12

  const goToMonth = (delta: number) => {
    let m = selectedMonth + delta;
    let y = selectedYear;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setSelectedMonth(m);
    setSelectedYear(y);
  };

  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth() + 1;

  // Importo effettivo previsto per una voce di budget in un mese specifico: usa l'override se
  // presente, altrimenti la stima di base (0 se la voce ha gia' una scadenza superata quel
  // mese). Restano solo eventuali vecchie voci non ancora migrate a Scadenze; non c'e' piu'
  // un'interfaccia per crearne di nuove.
  const getEffectiveAmount = (b: BudgetWithRelations, year: number, month: number) => getEffectiveAmountBase(b, overrides, year, month);

  const startEditCategoryBudget = (cat: ExpenseCategory) => {
    setEditingCategoryBudgetId(cat.id);
    if (cat.budget_percent != null) {
      setCategoryBudgetMode("percent");
      setCategoryBudgetDraft(String(cat.budget_percent));
    } else {
      setCategoryBudgetMode("amount");
      setCategoryBudgetDraft(cat.monthly_budget != null ? String(cat.monthly_budget) : "");
    }
  };

  const cancelEditCategoryBudget = () => {
    setEditingCategoryBudgetId(null);
    setCategoryBudgetDraft("");
  };

  // Classificazione Bisogno/Desiderio/Imprevisto della categoria, usata per la Ripartizione
  // 50/30/20 per assegnare le spese reali non collegate a una voce di budget specifica.
  const setCategoryBudgetType = (cat: ExpenseCategory, type: "need" | "want" | "emergency" | null) => {
    startTransition(async () => {
      try {
        const res = await updateCategoryBudgetType(cat.id, type);
        if (!res.success || !res.data) {
          alert(res.error || "Errore durante il salvataggio del tipo categoria");
          return;
        }
        setCategories(prev => prev.map(c => c.id === cat.id ? res.data : c));
      } catch (err: any) {
        alert(err.message || "Errore durante il salvataggio del tipo categoria");
      }
    });
  };

  const saveCategoryBudget = (cat: ExpenseCategory) => {
    const trimmed = categoryBudgetDraft.trim();
    const value = trimmed === "" ? null : Number(trimmed);

    if (categoryBudgetMode === "percent") {
      if (value !== null && (isNaN(value) || value < 0 || value > 100)) {
        alert("Inserisci una percentuale valida (0-100)");
        return;
      }
      startTransition(async () => {
        try {
          const res = await updateCategoryBudgetPercent(cat.id, value);
          if (!res.success || !res.data) {
            alert(res.error || "Errore durante il salvataggio del budget per categoria");
            return;
          }
          setCategories(prev => prev.map(c => c.id === cat.id ? res.data : c));
          cancelEditCategoryBudget();
        } catch (err: any) {
          alert(err.message || "Errore durante il salvataggio del budget per categoria");
        }
      });
      return;
    }

    if (value !== null && (isNaN(value) || value < 0)) {
      alert("Inserisci un importo valido");
      return;
    }

    startTransition(async () => {
      try {
        const res = await updateCategoryBudget(cat.id, value);
        if (!res.success || !res.data) {
          alert(res.error || "Errore durante il salvataggio del budget per categoria");
          return;
        }
        setCategories(prev => prev.map(c => c.id === cat.id ? res.data : c));
        cancelEditCategoryBudget();
      } catch (err: any) {
        alert(err.message || "Errore durante il salvataggio del budget per categoria");
      }
    });
  };

  // Spese ed Entrate reali del mese selezionato
  const currentMonthTransactions = useMemo(() => {
    return expenses.filter(e => {
      const eDate = new Date(e.date);
      return eDate.getFullYear() === selectedYear && eDate.getMonth() + 1 === selectedMonth;
    });
  }, [expenses, selectedYear, selectedMonth]);

  // Raggruppa uscite reali per categoria
  const realExpensesByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    currentMonthTransactions
      .filter(t => !t.is_income)
      .forEach(e => {
        const catId = e.category_id || "unassigned";
        map[catId] = (map[catId] || 0) + Number(e.amount);
      });
    return map;
  }, [currentMonthTransactions]);

  // Entrate reali del mese selezionato
  const realIncomeTotal = useMemo(() => {
    return currentMonthTransactions
      .filter(t => t.is_income)
      .reduce((sum, t) => sum + Number(t.amount), 0);
  }, [currentMonthTransactions]);

  // Classificazione Bisogno/Desiderio/Imprevisto delle spese reali del mese, per il confronto
  // pianificato/reale nella Ripartizione 50/30/20: una spesa segnata "Imprevisto" al momento
  // della registrazione (spunta in Spese & Entrate) conta sempre come tale; altrimenti usa il
  // tipo impostato sulla sua categoria (Confronto Uscite per Categoria); se la categoria non ha
  // un tipo impostato resta "non classificata".
  const realSpendingByType = useMemo(() => {
    let need = 0, want = 0, emergency = 0, unclassified = 0;
    currentMonthTransactions.filter(t => !t.is_income).forEach((e: any) => {
      const type = e.is_emergency ? "emergency" : (categories.find(c => c.id === e.category_id)?.budget_type || null);
      const amt = Number(e.amount);
      if (type === "need") need += amt;
      else if (type === "want") want += amt;
      else if (type === "emergency") emergency += amt;
      else unclassified += amt;
    });

    return { need, want, emergency, unclassified };
  }, [currentMonthTransactions, categories]);

  // Stessa classificazione di realSpendingByType, ma raggruppata per categoria: alimenta il
  // dettaglio "Reale" del grafico ad allocazione (quali categorie compongono ogni fetta).
  const realSpendingBreakdown = useMemo(() => {
    const buckets: Record<"need" | "want" | "emergency", Record<string, number>> = { need: {}, want: {}, emergency: {} };
    currentMonthTransactions.filter(t => !t.is_income).forEach((e: any) => {
      const type = e.is_emergency ? "emergency" : (categories.find(c => c.id === e.category_id)?.budget_type || null);
      if (!type) return;
      const catName = categories.find(c => c.id === e.category_id)?.name || "Generica / Altro";
      buckets[type as "need" | "want" | "emergency"][catName] = (buckets[type as "need" | "want" | "emergency"][catName] || 0) + Number(e.amount);
    });
    const toList = (rec: Record<string, number>) =>
      Object.entries(rec).map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount);
    return { need: toList(buckets.need), want: toList(buckets.want), emergency: toList(buckets.emergency) };
  }, [currentMonthTransactions, categories]);

  // Scadenze (Scadenze & Pagamenti) del mese selezionato: sono l'unica fonte del previsto in
  // uscita (Bisogno/Desiderio/Imprevisto), dato che le voci di budget non gestiscono piu' le
  // uscite. Una scadenza conta solo per il mese della sua data di scadenza: se e' scaduta e non
  // ancora saldata NON viene trascinata nel mese corrente (niente doppio conteggio) finche'
  // l'utente non la salda o la ripianifica (pulsante "Ripianifica" in Scadenze) a una nuova data.
  // Le scadenze di tipo entrata (es. stipendio) sono escluse: contribuiscono a totals.income,
  // non alle uscite Bisogno/Desiderio/Imprevisto.
  const scheduledItemsList = useMemo(() => {
    return schedules
      .filter((s: any) => {
        if (s.is_income) return false;
        const sDate = new Date(s.due_date);
        return sDate.getFullYear() === selectedYear && sDate.getMonth() + 1 === selectedMonth;
      })
      .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  }, [schedules, selectedYear, selectedMonth]);

  // Entrate ricorrenti previste dalle Scadenze (es. stipendio) per il mese selezionato: stessa
  // logica delle uscite, cosi' un'entrata inserita una volta sola in Scadenze si proietta da
  // sola nel Previsto senza doverla reinserire anche qui come voce di budget separata.
  const scheduledIncomeItemsList = useMemo(() => {
    return schedules
      .filter((s: any) => {
        if (!s.is_income) return false;
        const sDate = new Date(s.due_date);
        return sDate.getFullYear() === selectedYear && sDate.getMonth() + 1 === selectedMonth;
      })
      .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  }, [schedules, selectedYear, selectedMonth]);

  const scheduledIncomeTotal = useMemo(
    () => scheduledIncomeItemsList.reduce((sum, s: any) => sum + Number(s.amount), 0),
    [scheduledIncomeItemsList]
  );

  const scheduledByCategory = useMemo(() => {
    const map: Record<string, { amount: number; items: { label: string; amount: number }[] }> = {};
    scheduledItemsList.forEach((s: any) => {
      const catId = s.category_id || "unassigned";
      if (!map[catId]) map[catId] = { amount: 0, items: [] };
      map[catId].amount += Number(s.amount);
      map[catId].items.push({ label: s.description || s.category, amount: Number(s.amount) });
    });
    return map;
  }, [scheduledItemsList]);

  // Entrate previste di un mese: scadenze di tipo entrata piu' eventuali vecchie voci di budget
  // di tipo entrata non ancora migrate.
  const plannedIncomeFor = (year: number, month: number) => {
    let income = schedules
      .filter((s: any) => {
        if (!s.is_income) return false;
        const d = new Date(s.due_date);
        return d.getFullYear() === year && d.getMonth() + 1 === month;
      })
      .reduce((sum: number, s: any) => sum + Number(s.amount), 0);
    budgets.forEach(b => {
      if (b.type === "income") income += getEffectiveAmount(b, year, month);
    });
    return income;
  };

  const plannedIncome = useMemo(
    () => plannedIncomeFor(selectedYear, selectedMonth),
    [schedules, budgets, overrides, selectedYear, selectedMonth]
  );

  // Previsto di una categoria in un mese: le scadenze (e le eventuali vecchie voci di budget)
  // sono il minimo certo; se la categoria ha un limite (percentuale delle entrate oppure
  // importo fisso) il previsto e' il limite, che copre anche la spesa variabile non
  // schedulata (alimentari, carburante...). Se le scadenze superano il limite vale il maggiore.
  const plannedForCategory = (cat: ExpenseCategory | undefined, baseAmt: number, income: number, averageAmt = 0) => {
    const cap = cat?.budget_percent != null
      ? (income * Number(cat.budget_percent)) / 100
      : cat?.monthly_budget != null
        ? Number(cat.monthly_budget)
        : null;
    // Senza limite, la spesa variabile e' stimata con la media dei mesi tracciati precedenti
    return cap != null ? Math.max(cap, baseAmt) : Math.max(baseAmt, averageAmt);
  };

  // Mesi "tracciati" prima del mese selezionato, contigui all'indietro (max HISTORY_MONTHS): un mese conta
  // solo se ha abbastanza movimenti registrati, cosi' i mesi vuoti o con un solo movimento
  // isolato non generano un riporto fittizio. I mesi futuri non hanno ancora un consuntivo,
  // quindi si parte dall'ultimo mese concluso.
  const priorMonths = useMemo(() => {
    const counts: Record<string, number> = {};
    expenses.forEach((e: any) => {
      const d = new Date(e.date);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    const cy = now.getFullYear();
    const cm = now.getMonth() + 1;
    let y = selectedYear;
    let m = selectedMonth;
    if (y > cy || (y === cy && m > cm)) { y = cy; m = cm; }
    const months: { year: number; month: number }[] = [];
    for (let i = 0; i < HISTORY_MONTHS; i++) {
      m -= 1;
      if (m < 1) { m = 12; y -= 1; }
      if ((counts[`${y}-${m}`] || 0) < MIN_TRACKED_MOVEMENTS) break;
      months.push({ year: y, month: m });
    }
    return months;
  }, [expenses, selectedYear, selectedMonth]);

  // Riporto per categoria con un limite: somma di (previsto - reale) dei mesi precedenti
  // tracciati, per sapere quanto e' davvero disponibile questo mese oltre al limite base.
  // Le categorie senza limite non hanno un budget da riportare.
  const categoryRollover = useMemo(() => {
    const map: Record<string, number> = {};

    priorMonths.forEach(({ year, month }) => {
      const income = plannedIncomeFor(year, month);
      const actualByCat: Record<string, number> = {};
      expenses.forEach((e: any) => {
        if (e.is_income) return;
        const eDate = new Date(e.date);
        if (eDate.getFullYear() !== year || eDate.getMonth() + 1 !== month) return;
        const catId = e.category_id || "unassigned";
        actualByCat[catId] = (actualByCat[catId] || 0) + Number(e.amount);
      });

      const baseByCat: Record<string, number> = {};
      schedules.forEach((s: any) => {
        if (s.is_income) return;
        const d = new Date(s.due_date);
        if (d.getFullYear() !== year || d.getMonth() + 1 !== month) return;
        const catId = s.category_id || "unassigned";
        baseByCat[catId] = (baseByCat[catId] || 0) + Number(s.amount);
      });
      budgets.forEach(b => {
        if (b.type === "income") return;
        const catId = b.category_id || "unassigned";
        baseByCat[catId] = (baseByCat[catId] || 0) + getEffectiveAmount(b, year, month);
      });

      categories.forEach(cat => {
        if (cat.budget_percent == null && cat.monthly_budget == null) return;
        const planned = plannedForCategory(cat, baseByCat[cat.id] || 0, income);
        map[cat.id] = (map[cat.id] || 0) + (planned - (actualByCat[cat.id] || 0));
      });
    });

    return map;
  }, [priorMonths, expenses, schedules, budgets, overrides, categories]);

  // Media mensile reale per categoria sui mesi tracciati precedenti (max HISTORY_MONTHS)
  const categoryAverage = useMemo(() => {
    const map: Record<string, number> = {};
    if (priorMonths.length === 0) return map;
    expenses.forEach((e: any) => {
      if (e.is_income) return;
      const d = new Date(e.date);
      if (!priorMonths.some(p => p.year === d.getFullYear() && p.month === d.getMonth() + 1)) return;
      const catId = e.category_id || "unassigned";
      map[catId] = (map[catId] || 0) + Number(e.amount);
    });
    Object.keys(map).forEach(k => { map[k] = map[k] / priorMonths.length; });
    return map;
  }, [priorMonths, expenses]);

  const applyAverageAsLimit = (cat: ExpenseCategory, average: number) => {
    startTransition(async () => {
      try {
        const res = await updateCategoryBudget(cat.id, Math.round(average));
        if (!res.success || !res.data) {
          alert(res.error || "Errore durante il salvataggio del budget per categoria");
          return;
        }
        setCategories(prev => prev.map(c => c.id === cat.id ? res.data : c));
      } catch (err: any) {
        alert(err.message || "Errore durante il salvataggio del budget per categoria");
      }
    });
  };

  // Confronto per categoria: il "target" con cui confrontare il reale e' il previsto della
  // categoria (limite se impostato, altrimenti scadenze + eventuali vecchie voci di budget).
  const categoryBudgetComparison = useMemo(() => {
    const map: Record<string, {
      categoryId: string; categoryName: string; color: string;
      budgetAmt: number; scheduledAmt: number; scheduledItems: { label: string; amount: number }[];
      realAmt: number; rollover: number; manualCap: number | null; percentTarget: number | null;
      averageAmt: number;
    }> = {};

    const ensure = (catId: string) => {
      if (map[catId]) return map[catId];
      const catObj = categories.find(c => c.id === catId);
      const scheduled = scheduledByCategory[catId];
      map[catId] = {
        categoryId: catId,
        categoryName: catObj ? catObj.name : "Generica / Altro",
        color: catObj ? catObj.color : "slate",
        budgetAmt: 0,
        scheduledAmt: scheduled?.amount || 0,
        scheduledItems: scheduled?.items || [],
        realAmt: realExpensesByCategory[catId] || 0,
        rollover: categoryRollover[catId] || 0,
        manualCap: catObj ? catObj.monthly_budget : null,
        percentTarget: catObj ? catObj.budget_percent : null,
        averageAmt: categoryAverage[catId] || 0,
      };
      return map[catId];
    };

    budgets.forEach(b => {
      if (b.type === "income") return;
      const catId = b.category_id || "unassigned";
      ensure(catId).budgetAmt += getEffectiveAmount(b, selectedYear, selectedMonth);
    });

    // Tutte le categorie sono sempre elencate (vista completa), non solo quelle con dati questo mese.
    categories.forEach(cat => ensure(cat.id));
    Object.keys(realExpensesByCategory).forEach(catId => ensure(catId));
    Object.keys(scheduledByCategory).forEach(catId => ensure(catId));

    return Object.values(map)
      .map(item => ({
        ...item,
        targetAmt: plannedForCategory(categories.find(c => c.id === item.categoryId), item.budgetAmt + item.scheduledAmt, plannedIncome, item.averageAmt),
      }))
      .sort((a, b) => a.categoryName.localeCompare(b.categoryName));
  }, [budgets, overrides, realExpensesByCategory, categories, categoryRollover, categoryAverage, scheduledByCategory, plannedIncome, selectedYear, selectedMonth]);

  // Previsto del mese ripartito tra Bisogno/Desiderio/Imprevisto con il tipo impostato sulla
  // categoria (default Bisogno), anche per il dettaglio "Previsto" del grafico ad allocazione.
  const plannedByType = useMemo(() => {
    const totalsByType = { need: 0, want: 0, emergency: 0 };
    const buckets: Record<"need" | "want" | "emergency", Record<string, number>> = { need: {}, want: {}, emergency: {} };
    categoryBudgetComparison.forEach(item => {
      if (item.targetAmt <= 0) return;
      const type = (categories.find(c => c.id === item.categoryId)?.budget_type || "need") as "need" | "want" | "emergency";
      totalsByType[type] += item.targetAmt;
      buckets[type][item.categoryName] = (buckets[type][item.categoryName] || 0) + item.targetAmt;
    });
    const toList = (rec: Record<string, number>) =>
      Object.entries(rec).map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount);
    return {
      ...totalsByType,
      breakdown: { need: toList(buckets.need), want: toList(buckets.want), emergency: toList(buckets.emergency) },
    };
  }, [categoryBudgetComparison, categories]);

  // Calcoli Totali per il mese selezionato: entrate dalle Scadenze di tipo entrata, uscite
  // (Bisogno/Desiderio/Imprevisto) dal previsto per categoria (scadenze + limiti).
  const totals = useMemo(() => {
    const income = plannedIncome;
    const { need, want, emergency } = plannedByType;
    const totalOutgoings = need + want + emergency;
    const powerOfSpending = income - need; // Entrate - Bisogni
    const remainingBudget = income - totalOutgoings;

    return { income, need, want, emergency, totalOutgoings, powerOfSpending, remainingBudget };
  }, [plannedIncome, plannedByType]);

  // Analisi Regola 50/30/20 (Bisogni, Desideri, Risparmio/Imprevisti)
  const ruleAnalysis = useMemo(() => {
    if (totals.income === 0) return null;
    const needPercent = (totals.need / totals.income) * 100;
    const wantPercent = (totals.want / totals.income) * 100;

    // Il risparmio e' il residuo dopo Bisogni, Desideri e Imprevisti: un imprevisto pianificato
    // o speso davvero riduce il risparmio reale/previsto, non e' un "extra" invisibile.
    const savingsPercent = ((totals.income - totals.need - totals.want - totals.emergency) / totals.income) * 100;

    // Target in euro dalle entrate stimate del mese: utili per decidere, PRIMA di creare una
    // voce di budget, se rientra ancora tra i Bisogni o va classificata come Desiderio.
    const needTarget = totals.income * 0.5;
    const wantTarget = totals.income * 0.3;
    const savingsTarget = totals.income * 0.2;

    // Confronto con i dati reali del mese: se non ci sono ancora entrate registrate si usa la
    // stima come base, cosi' la percentuale resta leggibile invece di dividere per zero.
    const realBase = realIncomeTotal > 0 ? realIncomeTotal : totals.income;
    const realSavings = realIncomeTotal - realSpendingByType.need - realSpendingByType.want - realSpendingByType.emergency;

    return {
      needPercent: Math.round(needPercent),
      wantPercent: Math.round(wantPercent),
      savingsPercent: Math.round(savingsPercent),
      needTarget,
      wantTarget,
      savingsTarget,
      realNeed: realSpendingByType.need,
      realWant: realSpendingByType.want,
      realEmergency: realSpendingByType.emergency,
      realSavings,
      realNeedPercent: Math.round((realSpendingByType.need / realBase) * 100),
      realWantPercent: Math.round((realSpendingByType.want / realBase) * 100),
      realSavingsPercent: Math.round((realSavings / realBase) * 100),
      unclassified: realSpendingByType.unclassified,
    };
  }, [totals, realIncomeTotal, realSpendingByType]);

  // Percentuale realizzazione entrate
  const incomePercent = totals.income > 0 ? (realIncomeTotal / totals.income) * 100 : 0;

  // Uscite reali del mese (tutte le spese registrate, a prescindere dalla classificazione),
  // per il confronto Previsto/Reale simmetrico a quello delle entrate.
  const realOutgoingsTotal = useMemo(
    () => currentMonthTransactions.filter(t => !t.is_income).reduce((sum, t: any) => sum + Number(t.amount), 0),
    [currentMonthTransactions]
  );
  const outgoingsPercent = totals.totalOutgoings > 0 ? (realOutgoingsTotal / totals.totalOutgoings) * 100 : 0;

  // Proiezione di fine mese (solo mese corrente): le uscite gia' pagate da scadenze e le scadenze
  // ancora da pagare restano com'e', la spesa variabile (senza scadenza) si proietta a ritmo
  // giornaliero sul numero di giorni del mese.
  const monthProjection = useMemo(() => {
    if (!isCurrentMonth) return null;
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const elapsed = Math.max(1, now.getDate());
    const outgoings = currentMonthTransactions.filter((t: any) => !t.is_income);
    const fromSchedules = outgoings.filter((t: any) => t.schedule_id).reduce((sum, t: any) => sum + Number(t.amount), 0);
    const variable = outgoings.filter((t: any) => !t.schedule_id).reduce((sum, t: any) => sum + Number(t.amount), 0);
    const upcoming = scheduledItemsList.filter((s: any) => !s.is_paid).reduce((sum, s: any) => sum + Number(s.amount), 0);
    return fromSchedules + upcoming + (variable / elapsed) * daysInMonth;
  }, [isCurrentMonth, currentMonthTransactions, scheduledItemsList, selectedYear, selectedMonth]);

  // Avvisi sulle categorie con un limite esplicito che hanno raggiunto l'80% (o superato il 100%)
  const limitAlerts = useMemo(() => {
    if (!isCurrentMonth) return [];
    return categoryBudgetComparison
      .filter(i => (i.manualCap != null || i.percentTarget != null) && i.targetAmt > 0 && i.realAmt / i.targetAmt >= 0.8)
      .map(i => ({ id: i.categoryId, name: i.categoryName, real: i.realAmt, target: i.targetAmt, ratio: i.realAmt / i.targetAmt }))
      .sort((a, b) => b.ratio - a.ratio);
  }, [isCurrentMonth, categoryBudgetComparison]);

  // Storico reale degli ultimi mesi, fino al mese selezionato incluso
  const history = useMemo(() => {
    const months: { key: string; label: string; income: number; outgoings: number }[] = [];
    let y = selectedYear;
    let m = selectedMonth;
    for (let i = 0; i < HISTORY_MONTHS; i++) {
      let income = 0;
      let outgoings = 0;
      expenses.forEach((e: any) => {
        const d = new Date(e.date);
        if (d.getFullYear() !== y || d.getMonth() + 1 !== m) return;
        if (e.is_income) income += Number(e.amount);
        else outgoings += Number(e.amount);
      });
      months.unshift({ key: `${y}-${m}`, label: MONTH_LABELS[m - 1].slice(0, 3), income, outgoings });
      m -= 1;
      if (m < 1) { m = 12; y -= 1; }
    }
    return months;
  }, [expenses, selectedYear, selectedMonth]);
  const historyMax = Math.max(1, ...history.map(h => Math.max(h.income, h.outgoings)));

  // Riepilogo in parole semplici del mese selezionato: quanto e' entrato, quanto e' uscito,
  // quanto c'e' ancora da pagare in scadenza e quanto resta.
  const upcomingDueTotal = useMemo(
    () => scheduledItemsList.filter((s: any) => !s.is_paid).reduce((sum, s: any) => sum + Number(s.amount), 0),
    [scheduledItemsList]
  );
  const summaryIncome = Math.max(realIncomeTotal, totals.income);
  const summaryLeft = summaryIncome - realOutgoingsTotal - upcomingDueTotal;

  // Righe della tabella "Dove sono andati i soldi": solo categorie con spesa o previsto
  const spendingRows = useMemo(
    () => categoryBudgetComparison
      .filter(i => i.realAmt > 0 || i.targetAmt > 0)
      .map(i => {
        const base = i.budgetAmt + i.scheduledAmt;
        const basis = i.percentTarget != null || i.manualCap != null
          ? "limite impostato"
          : i.averageAmt > base ? `media ultimi ${priorMonths.length} mesi` : "scadenze del mese";
        return { ...i, basis };
      })
      .sort((a, b) => b.realAmt - a.realAmt || b.targetAmt - a.targetAmt),
    [categoryBudgetComparison, priorMonths]
  );

  // Base per le percentuali reali del grafico ad allocazione: se non ci sono ancora entrate
  // registrate questo mese si usa la stima come base, come gia' fa ruleAnalysis.realBase.
  const realIncomeBase = realIncomeTotal > 0 ? realIncomeTotal : totals.income;

  return (
    <div className="p-4 md:p-8 space-y-8 w-full">
      {/* Header */}
      <div className="animate-fade-in flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            Budget & Previsioni
          </h1>
          <p className="text-sm text-slate-400">Classifica entrate e uscite (Bisogni, Desideri, Imprevisti) e confronta lo stimato con il reale.</p>
        </div>

        {/* Navigatore Mese */}
        <div className="flex items-center gap-2 p-1.5 bg-zinc-950/80 border border-zinc-800 rounded-xl">
          <button
            type="button"
            onClick={() => goToMonth(-1)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all text-xs font-bold"
            title="Mese precedente"
          >
            ←
          </button>
          <span className={`text-xs font-extrabold px-2 min-w-[130px] text-center ${isCurrentMonth ? "text-indigo-300" : "text-white"}`}>
            {MONTH_LABELS[selectedMonth - 1]} {selectedYear}
          </span>
          <button
            type="button"
            onClick={() => goToMonth(1)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all text-xs font-bold"
            title="Mese successivo"
          >
            →
          </button>
          {!isCurrentMonth && (
            <button
              type="button"
              onClick={() => { setSelectedYear(now.getFullYear()); setSelectedMonth(now.getMonth() + 1); }}
              className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 px-1.5"
            >
              Oggi
            </button>
          )}
        </div>
      </div>

      {/* Riepilogo in parole semplici */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
        <div className="rounded-2xl p-4 border" style={{ background: "hsla(150, 60%, 15%, 0.06)", borderColor: "hsla(150, 60%, 50%, 0.15)" }}>
          <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Entrate</h4>
          <p className="text-2xl font-black text-white mt-1.5">{formatCurrency(realIncomeTotal)}</p>
          <p className="text-[10px] text-slate-500 mt-1">incassate{totals.income > 0 ? `, su ${formatCurrency(totals.income)} previste` : ""}</p>
        </div>
        <div className="rounded-2xl p-4 border" style={{ background: "hsla(350, 60%, 15%, 0.06)", borderColor: "hsla(350, 60%, 50%, 0.15)" }}>
          <h4 className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">Speso</h4>
          <p className="text-2xl font-black text-white mt-1.5">{formatCurrency(realOutgoingsTotal)}</p>
          <p className="text-[10px] text-slate-500 mt-1">uscite registrate nel mese</p>
        </div>
        <div className="rounded-2xl p-4 border" style={{ background: "hsla(38, 90%, 50%, 0.06)", borderColor: "hsla(38, 90%, 50%, 0.15)" }}>
          <h4 className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Ancora da pagare</h4>
          <p className="text-2xl font-black text-white mt-1.5">{formatCurrency(upcomingDueTotal)}</p>
          <p className="text-[10px] text-slate-500 mt-1">scadenze del mese non ancora saldate</p>
        </div>
        <div className="rounded-2xl p-4 border" style={{ background: "hsla(200, 60%, 15%, 0.06)", borderColor: "hsla(200, 60%, 50%, 0.15)" }}>
          <h4 className="text-[10px] font-bold text-sky-400 uppercase tracking-widest">Ti restano</h4>
          <p className={`text-2xl font-black mt-1.5 ${summaryLeft >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{formatCurrency(summaryLeft)}</p>
          <p className="text-[10px] text-slate-500 mt-1">entrate − speso − ancora da pagare</p>
        </div>
      </div>

      {/* Dove sono andati i soldi */}
      <div
        className="rounded-2xl p-6 border shadow-2xl animate-fade-in"
        style={{ background: "linear-gradient(135deg, hsla(240, 10%, 12%, 0.5), hsla(240, 10%, 10%, 0.8))", borderColor: "hsla(240, 5%, 18%, 0.7)" }}
      >
        <h3 className="text-sm font-extrabold text-white tracking-wide">🧾 Dove sono andati i soldi</h3>
        <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">
          <b className="text-zinc-300">Speso</b> = quello che hai realmente pagato nel mese. <b className="text-zinc-300">Previsto</b> = quanto contavi di spendere (il limite che hai impostato, altrimenti la media dei mesi scorsi o le scadenze). <b className="text-zinc-300">Rimane</b> = previsto − speso: se è rosso hai speso più del previsto.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-[9px] uppercase tracking-wider text-slate-400">
                <th className="pb-2.5 font-bold">Categoria</th>
                <th className="pb-2.5 font-bold text-right">Speso</th>
                <th className="pb-2.5 font-bold text-right">Previsto</th>
                <th className="pb-2.5 font-bold text-right">Rimane</th>
                <th className="pb-2.5 font-bold hidden md:table-cell pl-4">Previsto calcolato su</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {spendingRows.map(r => {
                const badge = getCategoryBadgeStyle(r.color);
                const left = r.targetAmt - r.realAmt;
                const pct = r.targetAmt > 0 ? Math.min((r.realAmt / r.targetAmt) * 100, 100) : r.realAmt > 0 ? 100 : 0;
                return (
                  <tr key={r.categoryId}>
                    <td className="py-2.5 pr-3">
                      <span className="px-2 py-0.5 rounded border text-[10px] font-extrabold" style={{ backgroundColor: badge.bg, color: badge.text, borderColor: badge.border }}>
                        {r.categoryName}
                      </span>
                      <div className="mt-1.5 h-1 w-full max-w-[160px] bg-zinc-950 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${left < 0 ? "bg-rose-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </td>
                    <td className="py-2.5 text-right font-black text-white whitespace-nowrap">{formatCurrency(r.realAmt)}</td>
                    <td className="py-2.5 text-right text-slate-300 whitespace-nowrap">{r.targetAmt > 0 ? formatCurrency(r.targetAmt) : "—"}</td>
                    <td className={`py-2.5 text-right font-bold whitespace-nowrap ${r.targetAmt <= 0 ? "text-zinc-600" : left < 0 ? "text-rose-400" : "text-emerald-400"}`}>
                      {r.targetAmt > 0 ? formatCurrency(left) : "—"}
                    </td>
                    <td className="py-2.5 pl-4 text-[10px] text-zinc-500 hidden md:table-cell">{r.targetAmt > 0 ? r.basis : "nessun previsto"}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-zinc-700">
                <td className="pt-3 font-extrabold text-white">Totale</td>
                <td className="pt-3 text-right font-black text-white whitespace-nowrap">{formatCurrency(realOutgoingsTotal)}</td>
                <td className="pt-3 text-right font-bold text-slate-300 whitespace-nowrap">{formatCurrency(totals.totalOutgoings)}</td>
                <td className={`pt-3 text-right font-black whitespace-nowrap ${totals.totalOutgoings - realOutgoingsTotal < 0 ? "text-rose-400" : "text-emerald-400"}`}>
                  {formatCurrency(totals.totalOutgoings - realOutgoingsTotal)}
                </td>
                <td className="hidden md:table-cell" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Analisi avanzata: tutto il resto, chiuso di default */}
      <details className="group rounded-2xl border border-zinc-800 bg-zinc-950/40">
        <summary className="cursor-pointer select-none px-5 py-4 text-sm font-extrabold text-white tracking-wide">
          📊 Analisi avanzata (previsione mesi, 50/30/20, limiti per categoria, storico)
        </summary>
        <div className="space-y-8 p-4 md:p-6 pt-2">

      {/* Panoramica Prossimi Mesi (previsione multi-mese + spostamento pagamenti) */}
      <BudgetForecast
        budgets={budgets}
        overrides={overrides}
        schedules={schedules}
        baseYear={now.getFullYear()}
        baseMonth={now.getMonth() + 1}
        onSelectMonth={(y, m) => { setSelectedYear(y); setSelectedMonth(m); }}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
      />

      {/* Avvisi limiti categoria */}
      {limitAlerts.length > 0 && (
        <div className="rounded-2xl p-4 border border-amber-500/20 bg-amber-500/5 space-y-1.5 animate-fade-in">
          <h4 className="text-[10px] font-bold text-amber-300 uppercase tracking-widest">Limiti di categoria</h4>
          {limitAlerts.map(a => (
            <div key={a.id} className="flex justify-between items-center text-[11px] gap-3">
              <span className="text-zinc-300 truncate">{a.name}</span>
              <span className={`font-bold whitespace-nowrap ${a.ratio > 1 ? "text-rose-400" : "text-amber-400"}`}>
                {formatCurrency(a.real)} / {formatCurrency(a.target)} ({Math.round(a.ratio * 100)}%)
                {a.ratio > 1 ? " · sforato" : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* KPI Cards (Design Premium Neon) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in">
        
        {/* Entrate Previste */}
        <div
          className="rounded-2xl p-5 border relative overflow-hidden group shadow-[0_0_20px_rgba(16,185,129,0.02)]"
          style={{
            background: "linear-gradient(135deg, hsla(150, 60%, 15%, 0.05), hsla(240, 10%, 10%, 0.6))",
            borderColor: "hsla(150, 60%, 50%, 0.12)",
          }}
        >
          <div className="absolute top-[-30%] right-[-20%] w-32 h-32 rounded-full bg-emerald-500/5 blur-[40px]" />
          <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Entrate Preventivate</h4>
          <p className="text-2xl font-black text-white mt-2">{formatCurrency(totals.income)}</p>
          <div className="text-[9px] text-slate-500 mt-1 font-semibold">{MONTH_LABELS[selectedMonth - 1]} {selectedYear} (Certe + Stimate)</div>
        </div>

        {/* Bisogni Previsti */}
        <div
          className="rounded-2xl p-5 border relative overflow-hidden group shadow-[0_0_20px_rgba(244,63,94,0.02)]"
          style={{
            background: "linear-gradient(135deg, hsla(350, 60%, 15%, 0.05), hsla(240, 10%, 10%, 0.6))",
            borderColor: "hsla(350, 60%, 50%, 0.12)",
          }}
        >
          <div className="absolute top-[-30%] right-[-20%] w-32 h-32 rounded-full bg-rose-500/5 blur-[40px]" />
          <h4 className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">Bisogni (Essenziali)</h4>
          <p className="text-2xl font-black text-white mt-2">{formatCurrency(totals.need)}</p>
          <div className="text-[9px] text-slate-500 mt-1 font-semibold">
            Scadenze e limiti delle categorie essenziali
          </div>
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
          <div className="text-[9px] text-slate-500 mt-1 font-semibold">Entrate - Spese Essenziali (Bisogni)</div>
        </div>

        {/* Risparmio & Imprevisti */}
        <div
          className="rounded-2xl p-5 border relative overflow-hidden group shadow-[0_0_20px_rgba(168,85,247,0.02)]"
          style={{
            background: "linear-gradient(135deg, hsla(270, 60%, 15%, 0.05), hsla(240, 10%, 10%, 0.6))",
            borderColor: "hsla(270, 60%, 50%, 0.12)",
          }}
        >
          <div className="absolute top-[-30%] right-[-20%] w-32 h-32 rounded-full bg-purple-500/5 blur-[40px]" />
          <h4 className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Risparmio Previsto</h4>
          <p className={`text-2xl font-black mt-2 ${totals.remainingBudget >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {formatCurrency(totals.remainingBudget)}
          </p>
          <div className="text-[9px] text-slate-500 mt-1 font-semibold leading-relaxed">
            Entrate − Bisogni − Desideri − Imprevisti ({formatCurrency(totals.emergency)}): quanto resterebbe a fine mese se rispetti tutto il previsto.
          </div>
        </div>

      </div>

      {/* Ripartizione 50/30/20: grafico ad allocazione, a piena larghezza per lasciare spazio
          all'interazione (fette che si sollevano al passaggio del mouse/tocco, con il dettaglio
          delle voci che le compongono). */}
      <div
        className="rounded-2xl p-6 border shadow-2xl relative overflow-hidden group backdrop-blur-xl animate-fade-in"
        style={{
          background: "linear-gradient(135deg, hsla(270, 60%, 15%, 0.08), hsla(240, 10%, 10%, 0.7))",
          borderColor: "hsla(270, 60%, 50%, 0.15)",
        }}
      >
        <div className="absolute top-[-30%] left-[-20%] w-40 h-40 rounded-full bg-purple-500/5 blur-[50px] pointer-events-none" />

        <h3 className="text-sm font-extrabold text-white tracking-wide mb-4">
          💡 Ripartizione 50/30/20
        </h3>

        {ruleAnalysis ? (
          <div className="space-y-4 text-xs z-10 relative">
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Anello esterno = previsto, anello interno = reale. Bisogni max 50%, Desideri max 30%, Risparmio min 20%.
            </p>

            <BudgetAllocationDonut
              previsto={{ need: totals.need, want: totals.want, emergency: totals.emergency, income: totals.income, breakdown: plannedByType.breakdown }}
              reale={{ need: ruleAnalysis.realNeed, want: ruleAnalysis.realWant, emergency: ruleAnalysis.realEmergency, income: realIncomeBase, breakdown: realSpendingBreakdown }}
            />

            {ruleAnalysis.unclassified > 0 && (
              <div className="text-[9px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 leading-relaxed">
                ⚠️ {formatCurrency(ruleAnalysis.unclassified)} di spese reali non classificate (categoria senza un tipo impostato). Assegna Bisogno/Desiderio/Imprevisto alla categoria dal "Confronto Uscite per Categoria" qui sotto per includerle nel confronto.
              </div>
            )}

            <div className="pt-3 border-t border-zinc-800 text-[10px] text-slate-400 leading-relaxed">
              {ruleAnalysis.needPercent > 50 ? (
                <span className="text-rose-400 font-semibold">⚠️ I tuoi bisogni essenziali superano il 50% pianificato. Valuta se ottimizzare spese fisse (bollette, affitti) o ridurre uscite variabili essenziali.</span>
              ) : ruleAnalysis.savingsPercent < 20 ? (
                <span className="text-amber-400 font-semibold">⚠️ Stai accantonando meno del 20% raccomandato. Prova a tagliare leggermente le spese voluttuarie (Desideri).</span>
              ) : (
                <span className="text-emerald-400 font-semibold">✨ Allocazione ottimale! Il tuo bilancio preventivo rispetta appieno i parametri di stabilità finanziaria.</span>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500 py-6 text-center">Inserisci prima un'entrata mensile per calcolare la ripartizione consigliata.</p>
        )}
      </div>

      {/* Confronto Reale/Previsto (Entrate & Uscite) + Elenco per Categoria */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Entrate & Uscite: Reale contro Previsione */}
        <div
          className="rounded-2xl p-6 border shadow-2xl relative overflow-hidden group backdrop-blur-xl animate-fade-in"
          style={{
            background: "linear-gradient(135deg, hsla(150, 60%, 12%, 0.05), hsla(240, 10%, 10%, 0.8))",
            borderColor: "hsla(150, 60%, 50%, 0.15)",
          }}
        >
          <div className="absolute top-[-30%] right-[-20%] w-60 h-60 rounded-full bg-emerald-500/5 blur-[80px] pointer-events-none" />

          <h3 className="text-sm font-extrabold text-white tracking-wide relative z-10">
            💰 Reale contro Previsione
          </h3>
          <p className="text-[10px] text-zinc-500 mt-1 relative z-10">Entrate e uscite del mese selezionato, previste contro effettivamente registrate.</p>

          <div className="mt-4 relative z-10 space-y-1.5">
            <div className="flex justify-between items-baseline text-[10px] font-bold">
              <span className="text-emerald-400">Entrate</span>
              <span className="text-zinc-500">{formatCurrency(realIncomeTotal)} <span className="text-zinc-700">/</span> {formatCurrency(totals.income)}</span>
            </div>
            <div className="relative h-2 w-full bg-zinc-950 rounded-full overflow-hidden border border-white/5">
              <div
                className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] rounded-full transition-all duration-500"
                style={{ width: `${Math.min(incomePercent, 100)}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[9px] font-bold text-zinc-500">
              <span>{Math.round(incomePercent)}% raggiunto</span>
              <span className={realIncomeTotal >= totals.income ? "text-emerald-400" : "text-amber-500"}>
                {realIncomeTotal >= totals.income
                  ? `+${formatCurrency(realIncomeTotal - totals.income)}`
                  : `Mancano ${formatCurrency(totals.income - realIncomeTotal)}`
                }
              </span>
            </div>
          </div>

          <div className="mt-4 relative z-10 space-y-1.5">
            <div className="flex justify-between items-baseline text-[10px] font-bold">
              <span className="text-rose-400">Uscite</span>
              <span className="text-zinc-500">{formatCurrency(realOutgoingsTotal)} <span className="text-zinc-700">/</span> {formatCurrency(totals.totalOutgoings)}</span>
            </div>
            <div className="relative h-2 w-full bg-zinc-950 rounded-full overflow-hidden border border-white/5">
              <div
                className="h-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)] rounded-full transition-all duration-500"
                style={{ width: `${Math.min(outgoingsPercent, 100)}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[9px] font-bold text-zinc-500">
              <span>{Math.round(outgoingsPercent)}% del previsto speso</span>
              <span className={realOutgoingsTotal <= totals.totalOutgoings ? "text-emerald-400" : "text-rose-400"}>
                {realOutgoingsTotal <= totals.totalOutgoings
                  ? `Restano ${formatCurrency(totals.totalOutgoings - realOutgoingsTotal)}`
                  : `Sforato di ${formatCurrency(realOutgoingsTotal - totals.totalOutgoings)}`
                }
              </span>
            </div>
          </div>

          {monthProjection != null && (
            <div className="mt-4 relative z-10 pt-3 border-t border-zinc-800 flex justify-between items-baseline text-[10px] font-bold">
              <span className="text-zinc-400">📈 Proiezione a fine mese</span>
              <span className={monthProjection <= totals.totalOutgoings ? "text-emerald-400" : "text-rose-400"}>
                {formatCurrency(monthProjection)} <span className="text-zinc-600">/</span> <span className="text-zinc-500">{formatCurrency(totals.totalOutgoings)}</span>
              </span>
            </div>
          )}
        </div>

        {/* Confronto Budget vs Spese Reali (2 Colonne) */}
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
              📊 Confronto Uscite per Categoria
            </h3>
            <p className="text-[10px] text-zinc-500 mt-1">Tutte le categorie, vista veloce collassata: clicca su una riga per espanderla e vedere i dettagli, impostare un limite fisso o una percentuale delle entrate.</p>
          </div>

          <div className="flex-1 overflow-x-auto pr-1 relative z-10 space-y-2">
            {categoryBudgetComparison.length === 0 ? (
              <div className="text-center py-16 text-slate-500 flex flex-col items-center justify-center">
                <span className="text-3xl mb-2">📈</span>
                <p className="text-xs">Crea una categoria in Impostazioni per attivare il confronto.</p>
              </div>
            ) : (
              categoryBudgetComparison.map((item) => {
                const percent = item.targetAmt > 0 ? (item.realAmt / item.targetAmt) * 100 : 0;
                const isOver = percent > 100;

                let barColor = "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]";
                if (percent > 80 && percent <= 100) {
                  barColor = "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]";
                } else if (percent > 100) {
                  barColor = "bg-rose-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]";
                }

                const badge = getCategoryBadgeStyle(item.color);
                const isEditingCap = editingCategoryBudgetId === item.categoryId;
                const catObj = categories.find(c => c.id === item.categoryId);
                const isExpanded = expandedCategoryIds.has(item.categoryId);

                return (
                  <div
                    key={item.categoryId}
                    className="rounded-xl border overflow-hidden transition-colors"
                    style={{ borderColor: isExpanded ? "hsla(245, 60%, 55%, 0.3)" : "hsl(240 5% 18% / 0.5)" }}
                  >
                    {/* Vista veloce collassata */}
                    <button
                      type="button"
                      onClick={() => toggleCategoryExpanded(item.categoryId)}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-white/[0.03] transition-colors"
                    >
                      <span
                        className="px-2 py-0.5 rounded border text-[9px] font-extrabold flex-shrink-0 truncate max-w-[110px]"
                        style={{ backgroundColor: badge.bg, color: badge.text, borderColor: badge.border }}
                        title={item.categoryName}
                      >
                        {item.categoryName}
                      </span>
                      <div className="flex-1 min-w-[40px]">
                        <div className="relative h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden border border-white/5">
                          <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.min(percent, 100)}%` }} />
                        </div>
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap flex-shrink-0">
                        {formatCurrency(item.realAmt)} <span className="text-zinc-600">/</span> {item.targetAmt > 0 ? formatCurrency(item.targetAmt) : "—"}
                      </span>
                      <span className={`text-[9px] text-zinc-500 flex-shrink-0 inline-block transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}>
                        ▶
                      </span>
                    </button>

                    {/* Dettaglio espanso */}
                    {isExpanded && (
                      <div className="px-3 pb-3.5 pt-1 space-y-2.5 border-t animate-fade-in" style={{ borderColor: "hsl(240 5% 18% / 0.5)" }}>
                        <div className="flex justify-between items-center text-[10px] font-medium text-slate-400 flex-wrap gap-y-1.5 pt-2">
                          <span>Reale: <span className="text-white font-black">{formatCurrency(item.realAmt)}</span></span>
                          {isEditingCap ? (
                            <div className="inline-flex items-center gap-1">
                              <div className="flex rounded overflow-hidden border border-zinc-700 text-[9px] font-bold flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setCategoryBudgetMode("amount")}
                                  className="px-1.5 py-0.5 transition-colors"
                                  style={{ background: categoryBudgetMode === "amount" ? "hsla(245, 85%, 55%, 0.3)" : "transparent", color: categoryBudgetMode === "amount" ? "white" : "hsl(240 5% 55%)" }}
                                >
                                  €
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCategoryBudgetMode("percent")}
                                  className="px-1.5 py-0.5 transition-colors"
                                  style={{ background: categoryBudgetMode === "percent" ? "hsla(245, 85%, 55%, 0.3)" : "transparent", color: categoryBudgetMode === "percent" ? "white" : "hsl(240 5% 55%)" }}
                                >
                                  %
                                </button>
                              </div>
                              <input
                                type="number"
                                step={categoryBudgetMode === "percent" ? "1" : "0.01"}
                                autoFocus
                                value={categoryBudgetDraft}
                                onChange={(e) => setCategoryBudgetDraft(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter" && catObj) saveCategoryBudget(catObj); if (e.key === "Escape") cancelEditCategoryBudget(); }}
                                placeholder={categoryBudgetMode === "percent" ? "es. 15" : "Nessun limite"}
                                className="w-16 px-1.5 py-0.5 rounded text-right text-[10px] text-white bg-zinc-950 border border-indigo-500/50 focus:outline-none"
                              />
                              <button onClick={() => catObj && saveCategoryBudget(catObj)} className="text-emerald-400 hover:text-emerald-300 text-[10px] font-bold px-0.5" title="Salva">✓</button>
                              <button onClick={cancelEditCategoryBudget} className="text-zinc-500 hover:text-white text-[10px] font-bold px-0.5" title="Annulla">✕</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => catObj && startEditCategoryBudget(catObj)}
                              className="hover:underline"
                              title="Imposta un limite mensile fisso in euro oppure una percentuale delle entrate previste"
                            >
                              {item.percentTarget != null ? (
                                <span className="text-zinc-300">{item.percentTarget}% delle entrate ({formatCurrency(item.targetAmt)})</span>
                              ) : item.manualCap != null ? (
                                <span className="text-zinc-300">Limite categoria: {formatCurrency(item.manualCap)}</span>
                              ) : (
                                <span className="text-zinc-500">
                                  Previsto: {formatCurrency(item.targetAmt)}
                                  {item.averageAmt > item.budgetAmt + item.scheduledAmt ? ` (media ultimi ${priorMonths.length} mesi)` : " (imposta un limite)"}
                                </span>
                              )}
                            </button>
                          )}
                          {!isEditingCap && item.percentTarget == null && item.manualCap == null && item.averageAmt > 0 && catObj && (
                            <button
                              type="button"
                              onClick={() => applyAverageAsLimit(catObj, item.averageAmt)}
                              className="text-indigo-400 hover:text-indigo-300 text-[9px] font-bold"
                              title="Imposta come limite mensile la media reale dei mesi precedenti"
                            >
                              Usa la media ({formatCurrency(Math.round(item.averageAmt))}) come limite
                            </button>
                          )}
                        </div>

                        <div className="relative h-2 w-full bg-zinc-950 rounded-full overflow-hidden border border-white/5">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                            style={{ width: `${Math.min(percent, 100)}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[9px] gap-2 flex-wrap">
                          <span
                            className="text-zinc-500 font-semibold"
                            title="Classifica tutte le spese reali di questa categoria, tranne quelle segnate 'Imprevisto' al momento della registrazione in Spese & Entrate, che contano sempre come Imprevisto a prescindere da questa impostazione."
                          >
                            Utilità reale (per la Ripartizione 50/30/20) ⓘ:
                          </span>
                          <div className="flex gap-1">
                            {([
                              { value: "need" as const, label: "Bisogno", active: "bg-rose-500/20 text-rose-300 border-rose-500/40" },
                              { value: "want" as const, label: "Desiderio", active: "bg-sky-500/20 text-sky-300 border-sky-500/40" },
                              { value: "emergency" as const, label: "Imprevisto", active: "bg-amber-500/20 text-amber-300 border-amber-500/40" },
                            ]).map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => catObj && setCategoryBudgetType(catObj, catObj.budget_type === opt.value ? null : opt.value)}
                                className={`px-1.5 py-0.5 rounded text-[8px] font-bold border transition-all ${
                                  catObj?.budget_type === opt.value ? opt.active : "text-zinc-500 border-zinc-700 hover:text-white"
                                }`}
                                title={`Classifica questa categoria come "${opt.label}" ai fini della Ripartizione 50/30/20`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex justify-between items-center text-[9px]">
                          <span className="text-zinc-500 font-bold">
                            {percent > 0 ? `${Math.round(percent)}% utilizzato` : "Nessun budget definito per categoria"}
                          </span>
                          {item.targetAmt > 0 && (
                            <span className={`font-black ${isOver ? "text-rose-400" : "text-emerald-400"}`}>
                              {isOver
                                ? `Sforato di ${formatCurrency(item.realAmt - item.targetAmt)}`
                                : `Rimanenti ${formatCurrency(item.targetAmt - item.realAmt)}`
                              }
                            </span>
                          )}
                        </div>

                        {item.rollover !== 0 && (
                          <div className="flex justify-between items-center text-[9px] pt-1 border-t border-zinc-800/30">
                            <span className="text-zinc-500 font-semibold">
                              Riporto mesi precedenti:{" "}
                              <span className={item.rollover >= 0 ? "text-emerald-400" : "text-rose-400"}>
                                {item.rollover >= 0 ? "+" : ""}{formatCurrency(item.rollover)}
                              </span>
                            </span>
                            <span className={`font-black ${(item.targetAmt + item.rollover - item.realAmt) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              Disponibile: {formatCurrency(item.targetAmt + item.rollover - item.realAmt)}
                            </span>
                          </div>
                        )}

                        {item.scheduledItems.length > 0 && (
                          <div className="text-[9px] pt-1 border-t border-zinc-800/30">
                            <span className="text-zinc-500 font-semibold">Scadenze del mese incluse: </span>
                            {item.scheduledItems.map((s, i) => (
                              <span key={i} className="text-amber-400">
                                {s.label} ({formatCurrency(s.amount)}){i < item.scheduledItems.length - 1 ? ", " : ""}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* Storico reale ultimi mesi */}
      <div
        className="rounded-2xl p-6 border shadow-2xl relative overflow-hidden backdrop-blur-xl animate-fade-in"
        style={{
          background: "linear-gradient(135deg, hsla(240, 10%, 12%, 0.5), hsla(240, 10%, 10%, 0.8))",
          borderColor: "hsla(240, 5%, 18%, 0.7)",
        }}
      >
        <h3 className="text-sm font-extrabold text-white tracking-wide">📅 Storico ultimi {HISTORY_MONTHS} mesi</h3>
        <p className="text-[10px] text-zinc-500 mt-1">Entrate e uscite reali fino al mese selezionato (giroconti e importi straordinari esclusi).</p>
        <div className="mt-5 grid grid-cols-3 sm:grid-cols-6 gap-4">
          {history.map(h => (
            <button
              key={h.key}
              type="button"
              onClick={() => { const [y, m] = h.key.split("-").map(Number); setSelectedYear(y); setSelectedMonth(m); }}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="flex items-end gap-1.5 h-24">
                <div className="w-4 rounded-t bg-emerald-500/70 group-hover:bg-emerald-400 transition-colors" style={{ height: `${(h.income / historyMax) * 100}%`, minHeight: h.income > 0 ? 2 : 0 }} title={`Entrate ${formatCurrency(h.income)}`} />
                <div className="w-4 rounded-t bg-rose-500/70 group-hover:bg-rose-400 transition-colors" style={{ height: `${(h.outgoings / historyMax) * 100}%`, minHeight: h.outgoings > 0 ? 2 : 0 }} title={`Uscite ${formatCurrency(h.outgoings)}`} />
              </div>
              <span className="text-[10px] font-bold text-zinc-400">{h.label}</span>
              <span className="text-[9px] text-emerald-400">{formatCurrency(h.income)}</span>
              <span className="text-[9px] text-rose-400">{formatCurrency(h.outgoings)}</span>
            </button>
          ))}
        </div>
      </div>

        </div>
      </details>

    </div>
  );
}
