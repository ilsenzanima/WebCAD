"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { type Budget, type BudgetOverride, type ExpenseCategory, type Supplier } from "@/lib/types/database";
import { createBudget, updateBudget, deleteBudget, upsertBudgetOverride, deleteBudgetOverride, confirmBudgetExpense } from "@/app/actions/budget";
import { updateCategoryBudget, updateCategoryBudgetPercent } from "@/app/actions/categories";
import { generateScheduleFromBudget } from "@/app/actions/schedules";
import { formatCurrency } from "@/lib/format";
import { getMonthlyEquivalent as getMonthlyEquivalentBase, isBudgetEnded as isBudgetEndedBase, getEffectiveAmount as getEffectiveAmountBase } from "@/lib/budgetCalc";
import { DeleteIcon, ExpensesIcon, SchedulesIcon } from "./icons";
import BudgetForecast from "./BudgetForecast";

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
  suppliers: Supplier[];
  initialSchedules: any[];
}

const MONTH_LABELS = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

const COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  indigo: { bg: "rgba(99,102,241,0.12)", text: "hsl(245 85% 75%)", border: "rgba(99,102,241,0.2)" },
  rose: { bg: "rgba(239,68,68,0.12)", text: "hsl(0 80% 75%)", border: "rgba(239,68,68,0.2)" },
  emerald: { bg: "rgba(16,185,129,0.12)", text: "hsl(150 70% 70%)", border: "rgba(16,185,129,0.2)" },
  amber: { bg: "rgba(245,158,11,0.12)", text: "hsl(38 90% 70%)", border: "rgba(245,158,11,0.2)" },
  sky: { bg: "rgba(14,165,233,0.12)", text: "hsl(200 85% 70%)", border: "rgba(14,165,233,0.2)" },
  pink: { bg: "rgba(236,72,153,0.12)", text: "hsl(330 80% 75%)", border: "rgba(236,72,153,0.2)" },
  purple: { bg: "rgba(168,85,247,0.12)", text: "hsl(270 80% 75%)", border: "rgba(168,85,247,0.2)" },
  slate: { bg: "rgba(107,114,128,0.15)", text: "hsl(215 15% 75%)", border: "rgba(107,114,128,0.25)" },
  red: { bg: "rgba(220,38,38,0.12)", text: "hsl(0 74% 72%)", border: "rgba(220,38,38,0.2)" },
  orange: { bg: "rgba(249,115,22,0.12)", text: "hsl(24 94% 70%)", border: "rgba(249,115,22,0.2)" },
  yellow: { bg: "rgba(234,179,8,0.12)", text: "hsl(45 90% 65%)", border: "rgba(234,179,8,0.2)" },
  lime: { bg: "rgba(132,204,22,0.12)", text: "hsl(83 70% 65%)", border: "rgba(132,204,22,0.2)" },
  green: { bg: "rgba(34,197,94,0.12)", text: "hsl(142 65% 65%)", border: "rgba(34,197,94,0.2)" },
  teal: { bg: "rgba(20,184,166,0.12)", text: "hsl(173 65% 62%)", border: "rgba(20,184,166,0.2)" },
  cyan: { bg: "rgba(6,182,212,0.12)", text: "hsl(189 80% 65%)", border: "rgba(6,182,212,0.2)" },
  blue: { bg: "rgba(59,130,246,0.12)", text: "hsl(217 85% 72%)", border: "rgba(59,130,246,0.2)" },
  violet: { bg: "rgba(139,92,246,0.12)", text: "hsl(258 85% 75%)", border: "rgba(139,92,246,0.2)" },
  fuchsia: { bg: "rgba(217,70,239,0.12)", text: "hsl(292 80% 72%)", border: "rgba(217,70,239,0.2)" },
};

const PERIODS = [
  { value: "weekly", label: "Settimanale" },
  { value: "monthly", label: "Mensile" },
  { value: "bimonthly", label: "Bimestrale" },
  { value: "quarterly", label: "Trimestrale" },
  { value: "semiannual", label: "Semestrale" },
  { value: "annual", label: "Annuale" },
];

export default function BudgetClient({ initialBudgets, categories: initialCategories, initialExpenses, initialOverrides, suppliers, initialSchedules }: BudgetClientProps) {
  const [budgets, setBudgets] = useState<BudgetWithRelations[]>(initialBudgets);
  const [overrides, setOverrides] = useState<BudgetOverride[]>(initialOverrides);
  const [expenses, setExpenses] = useState<any[]>(initialExpenses);
  const [categories, setCategories] = useState<ExpenseCategory[]>(initialCategories);
  const [schedules, setSchedules] = useState<any[]>(initialSchedules);
  const [isPending, startTransition] = useTransition();

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

  // Generazione di una scadenza da pagare a partire da una voce di budget ricorrente
  const [generatingScheduleBudgetId, setGeneratingScheduleBudgetId] = useState<string | null>(null);
  const [scheduleAmount, setScheduleAmount] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");

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

  // Stati del form (creazione/modifica voce di budget)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [type, setType] = useState<"income" | "need" | "want" | "emergency">("need");
  const [label, setLabel] = useState("");
  const [periodicity, setPeriodicity] = useState<"weekly" | "monthly" | "bimonthly" | "quarterly" | "semiannual" | "annual">("monthly");
  const [isEstimated, setIsEstimated] = useState(false);
  const [hasDuration, setHasDuration] = useState(false);
  const [endMonthInput, setEndMonthInput] = useState(now.getMonth() + 1);
  const [endYearInput, setEndYearInput] = useState(now.getFullYear());
  const [dayOfMonth, setDayOfMonth] = useState("");

  // Editing inline dell'importo effettivo (override mensile)
  const [editingOverrideBudgetId, setEditingOverrideBudgetId] = useState<string | null>(null);
  const [overrideDraft, setOverrideDraft] = useState("");

  // Conferma di una previsione come spesa/entrata reale del mese selezionato
  const [confirmingBudgetId, setConfirmingBudgetId] = useState<string | null>(null);
  const [confirmAmount, setConfirmAmount] = useState("");
  const [confirmDate, setConfirmDate] = useState("");

  const resetForm = () => {
    setEditingId(null);
    setAmount("");
    setCategoryId("");
    setSupplierId("");
    setLabel("");
    setPeriodicity("monthly");
    setIsEstimated(false);
    setHasDuration(false);
    setEndMonthInput(now.getMonth() + 1);
    setEndYearInput(now.getFullYear());
    setDayOfMonth("");
  };

  const startEditBudget = (b: BudgetWithRelations) => {
    setEditingId(b.id);
    setAmount(String(b.amount));
    setCategoryId(b.category_id || "");
    setSupplierId(b.supplier_id || "");
    setType(b.type);
    setLabel(b.label);
    setPeriodicity(b.periodicity);
    setIsEstimated(b.is_estimated);
    setDayOfMonth(b.day_of_month ? String(b.day_of_month) : "");
    if (b.end_year && b.end_month) {
      setHasDuration(true);
      setEndMonthInput(b.end_month);
      setEndYearInput(b.end_year);
    } else {
      setHasDuration(false);
      setEndMonthInput(now.getMonth() + 1);
      setEndYearInput(now.getFullYear());
    }
  };

  const getMonthlyEquivalent = getMonthlyEquivalentBase;

  // Trova l'eventuale override per una voce di budget in un mese/anno specifico
  const findOverride = (budgetId: string, year: number, month: number) =>
    overrides.find(o => o.budget_id === budgetId && o.year === year && o.month === month);

  // Una voce con scadenza (es. mutuo/finanziamento) e' conclusa se il mese richiesto e' oltre end_year/end_month
  const isBudgetEnded = (b: BudgetWithRelations, year: number, month: number) => isBudgetEndedBase(b, year, month);

  // Importo effettivo previsto per una voce in un mese specifico: usa l'override se presente,
  // altrimenti la stima di base (0 se la voce ha gia' una scadenza superata quel mese)
  const getEffectiveAmount = (b: BudgetWithRelations, year: number, month: number) => getEffectiveAmountBase(b, overrides, year, month);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      alert("Inserisci un importo valido");
      return;
    }
    if (!label.trim()) {
      alert("Inserisci una descrizione");
      return;
    }

    let endMonth: number | null = null;
    let endYear: number | null = null;
    if (hasDuration) {
      if (endYearInput < now.getFullYear() || (endYearInput === now.getFullYear() && endMonthInput < now.getMonth() + 1)) {
        alert("La data di fine non può essere nel passato");
        return;
      }
      endMonth = endMonthInput;
      endYear = endYearInput;
    }

    let dayOfMonthValue: number | null = null;
    if (dayOfMonth.trim()) {
      const d = parseInt(dayOfMonth, 10);
      if (!d || d < 1 || d > 31) {
        alert("Inserisci un giorno del mese valido (1-31)");
        return;
      }
      dayOfMonthValue = d;
    }

    startTransition(async () => {
      try {
        const payload = {
          amount: Number(amount),
          category_id: type === "income" ? null : (categoryId || null),
          supplier_id: type === "income" ? null : (supplierId || null),
          type,
          label: label.trim(),
          periodicity: type === "income" ? "monthly" : periodicity,
          is_estimated: isEstimated, // Abilitato anche per le entrate
          end_month: endMonth,
          end_year: endYear,
          day_of_month: dayOfMonthValue,
        };

        if (editingId) {
          const res = await updateBudget(editingId, payload);
          if (!res.success || !res.data) {
            alert(res.error || "Errore durante il salvataggio");
            return;
          }
          setBudgets(prev => prev.map(b => b.id === editingId ? res.data : b));
        } else {
          const res = await createBudget(payload);
          if (!res.success || !res.data) {
            alert(res.error || "Errore durante il salvataggio");
            return;
          }
          setBudgets(prev => [res.data, ...prev]);
        }

        resetForm();
      } catch (err: any) {
        alert(err.message || "Si è verificato un errore");
      }
    });
  };

  const startEditOverride = (b: BudgetWithRelations) => {
    setEditingOverrideBudgetId(b.id);
    setOverrideDraft(String(getEffectiveAmount(b, selectedYear, selectedMonth)));
  };

  const saveOverride = (b: BudgetWithRelations) => {
    const value = Number(overrideDraft);
    if (isNaN(value) || value < 0) {
      alert("Inserisci un importo valido");
      return;
    }

    startTransition(async () => {
      try {
        const res = await upsertBudgetOverride({
          budget_id: b.id,
          year: selectedYear,
          month: selectedMonth,
          amount: value,
        });
        if (!res.success || !res.data) {
          alert(res.error || "Errore durante il salvataggio della correzione mensile");
          return;
        }
        setOverrides(prev => {
          const withoutOld = prev.filter(o => !(o.budget_id === b.id && o.year === selectedYear && o.month === selectedMonth));
          return [...withoutOld, res.data];
        });
        setEditingOverrideBudgetId(null);
      } catch (err: any) {
        alert(err.message || "Errore durante il salvataggio della correzione mensile");
      }
    });
  };

  const resetOverride = (b: BudgetWithRelations) => {
    const ov = findOverride(b.id, selectedYear, selectedMonth);
    if (!ov) return;
    if (!confirm(`Ripristinare la stima di base per "${b.label}" in questo mese?`)) return;

    startTransition(async () => {
      try {
        const res = await deleteBudgetOverride(ov.id);
        if (!res.success) {
          alert(res.error || "Errore durante il ripristino");
          return;
        }
        setOverrides(prev => prev.filter(o => o.id !== ov.id));
      } catch (err: any) {
        alert(err.message || "Errore durante il ripristino");
      }
    });
  };

  // Trova l'eventuale spesa/entrata reale gia' collegata a questa voce di budget per il mese indicato
  const findLinkedExpense = (budgetId: string, year: number, month: number) =>
    expenses.find((e: any) => {
      if (e.budget_id !== budgetId) return false;
      const eDate = new Date(e.date);
      return eDate.getFullYear() === year && eDate.getMonth() + 1 === month;
    });

  const startConfirmExpense = (b: BudgetWithRelations) => {
    setConfirmingBudgetId(b.id);
    setConfirmAmount(String(getEffectiveAmount(b, selectedYear, selectedMonth)));
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const day = Math.min(b.day_of_month || Math.min(now.getDate(), daysInMonth), daysInMonth);
    setConfirmDate(`${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  };

  const cancelConfirmExpense = () => {
    setConfirmingBudgetId(null);
    setConfirmAmount("");
    setConfirmDate("");
  };

  const saveConfirmExpense = (b: BudgetWithRelations) => {
    const value = Number(confirmAmount);
    if (isNaN(value) || value <= 0) {
      alert("Inserisci un importo valido");
      return;
    }
    if (!confirmDate) {
      alert("Inserisci una data valida");
      return;
    }

    startTransition(async () => {
      try {
        const res = await confirmBudgetExpense(b.id, { amount: value, date: confirmDate });
        if (!res.success || !res.data) {
          alert(res.error || "Errore durante la conferma");
          return;
        }
        setExpenses(prev => [res.data, ...prev]);
        cancelConfirmExpense();
      } catch (err: any) {
        alert(err.message || "Errore durante la conferma");
      }
    });
  };

  // Trova l'eventuale scadenza gia' generata per questa voce di budget nel mese indicato
  const findLinkedSchedule = (budgetId: string, year: number, month: number) =>
    schedules.find((s: any) => {
      if (s.budget_id !== budgetId) return false;
      const sDate = new Date(s.due_date);
      return sDate.getFullYear() === year && sDate.getMonth() + 1 === month;
    });

  const startGenerateSchedule = (b: BudgetWithRelations) => {
    setGeneratingScheduleBudgetId(b.id);
    setScheduleAmount(String(getEffectiveAmount(b, selectedYear, selectedMonth)));
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const day = Math.min(b.day_of_month || Math.min(now.getDate(), daysInMonth), daysInMonth);
    setScheduleDate(`${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  };

  const cancelGenerateSchedule = () => {
    setGeneratingScheduleBudgetId(null);
    setScheduleAmount("");
    setScheduleDate("");
  };

  const saveGenerateSchedule = (b: BudgetWithRelations) => {
    const value = Number(scheduleAmount);
    if (isNaN(value) || value <= 0) {
      alert("Inserisci un importo valido");
      return;
    }
    if (!scheduleDate) {
      alert("Inserisci una data valida");
      return;
    }

    startTransition(async () => {
      try {
        const res = await generateScheduleFromBudget(b.id, { amount: value, due_date: scheduleDate, recurrence: "monthly" });
        if (!res.success || !res.data) {
          alert(res.error || "Errore durante la generazione della scadenza");
          return;
        }
        setSchedules(prev => [res.data, ...prev]);
        cancelGenerateSchedule();
      } catch (err: any) {
        alert(err.message || "Errore durante la generazione della scadenza");
      }
    });
  };

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
        if (editingId === id) resetForm();
      } catch (err: any) {
        alert(err.message || "Errore durante l'eliminazione");
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

  // Scadenze (Scadenze & Pagamenti) con categoria/data ma non collegate a nessuna voce di budget:
  // vanno comunque contate come spesa prevista del mese, altrimenti restano invisibili nel Budget.
  // Le scadenze scadute e non ancora saldate (es. una del mese scorso mai pagata) restano un
  // impegno di "adesso": vengono agganciate al mese corrente finche' non risultano saldate,
  // invece di sparire semplicemente perche' la loro data e' passata.
  const unlinkedScheduledItemsList = useMemo(() => {
    return schedules
      .filter((s: any) => {
        if (s.budget_id) return false; // gia' contato tramite la voce di budget collegata
        const sDate = new Date(s.due_date);
        const inSelectedMonth = sDate.getFullYear() === selectedYear && sDate.getMonth() + 1 === selectedMonth;
        const isOverdueUnpaid = !s.is_paid && isCurrentMonth && !inSelectedMonth && sDate < now;
        return inSelectedMonth || isOverdueUnpaid;
      })
      .map((s: any) => {
        const sDate = new Date(s.due_date);
        const inSelectedMonth = sDate.getFullYear() === selectedYear && sDate.getMonth() + 1 === selectedMonth;
        return { ...s, isOverdue: !inSelectedMonth };
      })
      .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  }, [schedules, selectedYear, selectedMonth, isCurrentMonth, now]);

  const unlinkedScheduledByCategory = useMemo(() => {
    const map: Record<string, { amount: number; items: { label: string; amount: number }[] }> = {};
    unlinkedScheduledItemsList.forEach((s: any) => {
      const catId = s.category_id || "unassigned";
      if (!map[catId]) map[catId] = { amount: 0, items: [] };
      map[catId].amount += Number(s.amount);
      const label = s.description || s.category;
      map[catId].items.push({ label: s.isOverdue ? `${label} (scaduta)` : label, amount: Number(s.amount) });
    });
    return map;
  }, [unlinkedScheduledItemsList]);

  const unplannedScheduledTotal = useMemo(
    () => Object.values(unlinkedScheduledByCategory).reduce((sum, v) => sum + v.amount, 0),
    [unlinkedScheduledByCategory]
  );

  // Calcoli Totali Budget per il mese selezionato (stima di base, corretta dagli eventuali override).
  // Le scadenze non collegate a nessuna voce di budget vengono sommate ai "Bisogni": sono comunque
  // spese obbligatorie previste quel mese (es. bollo auto, assicurazione) anche se non pianificate.
  const totals = useMemo(() => {
    let income = 0;
    let need = 0;
    let want = 0;
    let emergency = 0;

    budgets.forEach(b => {
      const monthlyAmt = getEffectiveAmount(b, selectedYear, selectedMonth);
      if (b.type === "income") income += monthlyAmt;
      else if (b.type === "need") need += monthlyAmt;
      else if (b.type === "want") want += monthlyAmt;
      else if (b.type === "emergency") emergency += monthlyAmt;
    });

    need += unplannedScheduledTotal;

    const totalOutgoings = need + want + emergency;
    const powerOfSpending = income - need; // Entrate - Bisogni
    const remainingBudget = income - totalOutgoings;

    return { income, need, want, emergency, totalOutgoings, powerOfSpending, remainingBudget };
  }, [budgets, overrides, selectedYear, selectedMonth, unplannedScheduledTotal]);

  // Analisi Regola 50/30/20 (Bisogni, Desideri, Risparmio/Imprevisti)
  const ruleAnalysis = useMemo(() => {
    if (totals.income === 0) return null;
    const needPercent = (totals.need / totals.income) * 100;
    const wantPercent = (totals.want / totals.income) * 100;
    
    // Il risparmio include la quota per gli imprevisti (emergency) + il risparmio residuo
    const savingsPercent = ((totals.income - totals.need - totals.want) / totals.income) * 100;

    return {
      needPercent: Math.round(needPercent),
      wantPercent: Math.round(wantPercent),
      savingsPercent: Math.round(savingsPercent),
    };
  }, [totals]);

  // Mese/anno piu' vecchio da cui esistono dati (spese o voci di budget), per calcolare il riporto
  const earliestPeriod = useMemo(() => {
    const dates: Date[] = [];
    expenses.forEach((e: any) => dates.push(new Date(e.date)));
    budgets.forEach(b => dates.push(new Date(b.created_at)));
    if (dates.length === 0) return null;
    const earliest = dates.reduce((min, d) => (d < min ? d : min), dates[0]);
    return { year: earliest.getFullYear(), month: earliest.getMonth() + 1 };
  }, [expenses, budgets]);

  // Elenco dei mesi precedenti al mese selezionato, dal piu' vecchio dato disponibile (max 36 mesi)
  const priorMonths = useMemo(() => {
    if (!earliestPeriod) return [];
    const months: { year: number; month: number }[] = [];
    let y = earliestPeriod.year;
    let m = earliestPeriod.month;
    let guard = 0;
    while ((y < selectedYear || (y === selectedYear && m < selectedMonth)) && guard < 36) {
      months.push({ year: y, month: m });
      m += 1;
      if (m > 12) { m = 1; y += 1; }
      guard += 1;
    }
    return months;
  }, [earliestPeriod, selectedYear, selectedMonth]);

  // Riporto per categoria: somma di (previsto - reale) di tutti i mesi precedenti,
  // per sapere quanto e' davvero disponibile questo mese oltre alla stima base.
  const categoryRollover = useMemo(() => {
    const map: Record<string, number> = {};

    priorMonths.forEach(({ year, month }) => {
      const actualByCat: Record<string, number> = {};
      expenses.forEach((e: any) => {
        if (e.is_income) return;
        const eDate = new Date(e.date);
        if (eDate.getFullYear() !== year || eDate.getMonth() + 1 !== month) return;
        const catId = e.category_id || "unassigned";
        actualByCat[catId] = (actualByCat[catId] || 0) + Number(e.amount);
      });

      const plannedByCat: Record<string, number> = {};
      budgets.forEach(b => {
        if (b.type === "income") return;
        const catId = b.category_id || "unassigned";
        plannedByCat[catId] = (plannedByCat[catId] || 0) + getEffectiveAmount(b, year, month);
      });

      const catIds = new Set([...Object.keys(plannedByCat), ...Object.keys(actualByCat)]);
      catIds.forEach(catId => {
        const delta = (plannedByCat[catId] || 0) - (actualByCat[catId] || 0);
        map[catId] = (map[catId] || 0) + delta;
      });
    });

    return map;
  }, [priorMonths, expenses, budgets, overrides]);

  // Consolidamento budget per categoria. Il "target" con cui confrontare il reale e', in ordine di priorita':
  // - una percentuale delle entrate previste del mese (categories.budget_percent), se impostata
  // - altrimenti il limite fisso impostato manualmente (categories.monthly_budget), se presente
  //   (es. "Utenze: 300€ di media" a prescindere da quante singole voci/fornitori la compongono)
  // - altrimenti, in mancanza di un limite esplicito, la somma delle voci di budget pianificate
  //   in quella categoria + le eventuali scadenze non pianificate in arrivo quel mese
  const categoryBudgetComparison = useMemo(() => {
    const map: Record<string, {
      categoryId: string; categoryName: string; color: string;
      budgetAmt: number; scheduledAmt: number; scheduledItems: { label: string; amount: number }[];
      realAmt: number; rollover: number; manualCap: number | null; percentTarget: number | null;
    }> = {};

    const ensure = (catId: string) => {
      if (map[catId]) return map[catId];
      const catObj = categories.find(c => c.id === catId);
      const scheduled = unlinkedScheduledByCategory[catId];
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
      };
      return map[catId];
    };

    budgets.forEach(b => {
      if (b.type === "income") return;
      const catId = b.category_id || "unassigned";
      const monthlyAmt = getEffectiveAmount(b, selectedYear, selectedMonth);
      ensure(catId).budgetAmt += monthlyAmt;
    });

    // Tutte le categorie sono sempre elencate (vista completa), non solo quelle con dati questo mese.
    categories.forEach(cat => ensure(cat.id));
    Object.keys(realExpensesByCategory).forEach(catId => ensure(catId));
    Object.keys(unlinkedScheduledByCategory).forEach(catId => ensure(catId));

    return Object.values(map)
      .map(item => ({
        ...item,
        targetAmt: item.percentTarget != null
          ? (totals.income * item.percentTarget) / 100
          : item.manualCap != null
            ? item.manualCap
            : item.budgetAmt + item.scheduledAmt,
      }))
      .sort((a, b) => a.categoryName.localeCompare(b.categoryName));
  }, [budgets, overrides, realExpensesByCategory, categories, categoryRollover, unlinkedScheduledByCategory, totals.income, selectedYear, selectedMonth]);

  // Percentuale realizzazione entrate
  const incomePercent = totals.income > 0 ? (realIncomeTotal / totals.income) * 100 : 0;

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
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

      {/* Panoramica Prossimi Mesi (previsione multi-mese + spostamento pagamenti) */}
      <BudgetForecast
        budgets={budgets}
        overrides={overrides}
        setOverrides={setOverrides}
        baseYear={now.getFullYear()}
        baseMonth={now.getMonth() + 1}
        onSelectMonth={(y, m) => { setSelectedYear(y); setSelectedMonth(m); }}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
      />

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
            Spese fisse e variabili obbligatorie
            {unplannedScheduledTotal > 0 && ` (incluse ${formatCurrency(unplannedScheduledTotal)} di scadenze non pianificate)`}
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
          <h4 className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Fondo Risparmio</h4>
          <p className={`text-2xl font-black mt-2 ${totals.remainingBudget >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {formatCurrency(totals.remainingBudget)}
          </p>
          <div className="text-[9px] text-slate-500 mt-1 font-semibold">Inclusi accantonamenti imprevisti ({formatCurrency(totals.emergency)})</div>
        </div>

      </div>

      {/* Riquadro di Confronto delle Entrate Reali vs Stimate */}
      <div
        className="rounded-2xl p-6 border shadow-2xl relative overflow-hidden group backdrop-blur-xl animate-fade-in"
        style={{
          background: "linear-gradient(135deg, hsla(150, 60%, 12%, 0.05), hsla(240, 10%, 10%, 0.8))",
          borderColor: "hsla(150, 60%, 50%, 0.15)",
        }}
      >
        <div className="absolute top-[-30%] right-[-20%] w-60 h-60 rounded-full bg-emerald-500/5 blur-[80px] pointer-events-none" />

        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 relative z-10">
          <div>
            <h3 className="text-sm font-extrabold text-white tracking-wide">
              💰 Entrate Mensili Realizzate contro Previsione
            </h3>
            <p className="text-[10px] text-zinc-500 mt-1">Confronta le entrate previste a budget con quelle reali registrate nel mese selezionato.</p>
          </div>
          <div className="text-right">
            <span className="text-xs font-semibold text-zinc-400">Reale: </span>
            <span className="text-sm font-black text-emerald-400">{formatCurrency(realIncomeTotal)}</span>
            <span className="text-[10px] text-zinc-600"> / Previsto: {formatCurrency(totals.income)}</span>
          </div>
        </div>

        <div className="mt-4 relative z-10 space-y-2">
          <div className="relative h-2.5 w-full bg-zinc-950 rounded-full overflow-hidden border border-white/5">
            <div
              className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] rounded-full transition-all duration-500"
              style={{ width: `${Math.min(incomePercent, 100)}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[9px] font-bold text-zinc-500">
            <span>{Math.round(incomePercent)}% del traguardo entrate raggiunto</span>
            <span className={realIncomeTotal >= totals.income ? "text-emerald-400" : "text-amber-500"}>
              {realIncomeTotal >= totals.income 
                ? `Eccedenza di +${formatCurrency(realIncomeTotal - totals.income)}` 
                : `Mancano ${formatCurrency(totals.income - realIncomeTotal)}`
              }
            </span>
          </div>
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

          <h2 className="text-base font-extrabold bg-gradient-to-r from-white to-zinc-300 bg-clip-text text-transparent mb-5 tracking-tight flex items-center gap-2 justify-between">
            <span className="flex items-center gap-2"><span>📊</span> {editingId ? "Modifica Voce" : "Aggiungi Previsione"}</span>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-[9px] font-bold text-zinc-500 hover:text-white normal-case tracking-normal"
              >
                Annulla
              </button>
            )}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
            {/* Tipo */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Tipo Voce</label>
              <select
                value={type}
                onChange={(e) => {
                  setType(e.target.value as any);
                  if (e.target.value === "income") {
                    setCategoryId("");
                    setPeriodicity("monthly");
                  }
                }}
                className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border select-custom transition-all"
                style={{
                  background: "hsl(240 10% 4% / 0.8)",
                  borderColor: "hsl(240 5% 18%)",
                }}
                onFocus={(e) => e.target.style.borderColor = "hsl(245 85% 55%)"}
                onBlur={(e) => e.target.style.borderColor = "hsl(240 5% 18%)"}
              >
                <option value="need" style={{ background: "hsl(240 10% 10%)" }}>Bisogno (Spesa Essenziale)</option>
                <option value="want" style={{ background: "hsl(240 10% 10%)" }}>Desiderio (Spesa Voluttuaria)</option>
                <option value="emergency" style={{ background: "hsl(240 10% 10%)" }}>Fondo Imprevisti / Emergenze</option>
                <option value="income" style={{ background: "hsl(240 10% 10%)" }}>Entrata Mensile</option>
              </select>
            </div>

            {/* Stima Importo (Certezza) */}
            <div className="space-y-1.5 animate-fade-in">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Stima Importo</label>
              <div className="flex gap-2 p-1 bg-zinc-950/60 border border-white/5 rounded-xl text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setIsEstimated(false)}
                  className="flex-1 py-2 rounded-lg transition-all"
                  style={{
                    background: !isEstimated ? "hsl(240 10% 15%)" : "transparent",
                    color: !isEstimated ? "white" : "hsl(240 5% 55%)",
                  }}
                >
                  Importo Certo
                </button>
                <button
                  type="button"
                  onClick={() => setIsEstimated(true)}
                  className="flex-1 py-2 rounded-lg transition-all"
                  style={{
                    background: isEstimated ? "hsla(38, 90%, 50%, 0.12)" : "transparent",
                    color: isEstimated ? "hsl(38 90% 60%)" : "hsl(240 5% 55%)",
                  }}
                >
                  Importo Stimato
                </button>
              </div>
            </div>

            {/* Frequenza di pagamento - Mostrato solo per uscite */}
            {type !== "income" && (
              <div className="space-y-1.5 animate-fade-in">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Frequenza Pagamento</label>
                <select
                  value={periodicity}
                  onChange={(e) => setPeriodicity(e.target.value as any)}
                  className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border select-custom transition-all"
                  style={{
                    background: "hsl(240 10% 4% / 0.8)",
                    borderColor: "hsl(240 5% 18%)",
                  }}
                  onFocus={(e) => e.target.style.borderColor = "hsl(245 85% 55%)"}
                  onBlur={(e) => e.target.style.borderColor = "hsl(240 5% 18%)"}
                >
                  {PERIODS.map((p) => (
                    <option key={p.value} value={p.value} style={{ background: "hsl(240 10% 10%)" }}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Categoria */}
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

            {/* Fornitore (preimpostato: verra' ereditato automaticamente quando confermi il pagamento reale) */}
            {type !== "income" && (
              <div className="space-y-1.5 animate-fade-in">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Fornitore (opzionale)</label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border select-custom transition-all"
                  style={{
                    background: "hsl(240 10% 4% / 0.8)",
                    borderColor: "hsl(240 5% 18%)",
                  }}
                  onFocus={(e) => e.target.style.borderColor = "hsl(245 85% 55%)"}
                  onBlur={(e) => e.target.style.borderColor = "hsl(240 5% 18%)"}
                >
                  <option value="" style={{ background: "hsl(240 10% 10%)" }}>Nessun fornitore</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id} style={{ background: "hsl(240 10% 10%)" }}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <p className="text-[9px] text-zinc-500 mt-1">
                  Se indicato, verra' associato automaticamente quando confermi il pagamento come spesa reale.
                </p>
              </div>
            )}

            {/* Durata Limitata (es. mutuo o finanziamento gia' in corso) */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 uppercase tracking-wider cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasDuration}
                  onChange={(e) => setHasDuration(e.target.checked)}
                  className="accent-indigo-500"
                />
                Ha una scadenza (mutuo, finanziamento...)
              </label>
              {hasDuration && (
                <div className="animate-fade-in space-y-1.5">
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={endMonthInput}
                      onChange={(e) => setEndMonthInput(Number(e.target.value))}
                      className="w-full px-3 py-3 rounded-xl text-xs text-white focus:outline-none border select-custom transition-all"
                      style={{ background: "hsl(240 10% 4% / 0.8)", borderColor: "hsl(240 5% 18%)" }}
                    >
                      {MONTH_LABELS.map((m, i) => (
                        <option key={m} value={i + 1} style={{ background: "hsl(240 10% 10%)" }}>{m}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={now.getFullYear()}
                      step="1"
                      value={endYearInput}
                      onChange={(e) => setEndYearInput(Number(e.target.value))}
                      placeholder="Anno"
                      className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border transition-all duration-200"
                      style={{ background: "hsl(240 10% 4% / 0.8)", borderColor: "hsl(240 5% 18%)" }}
                    />
                  </div>
                  <p className="text-[9px] text-zinc-500 mt-1">
                    Indica il mese/anno dell'ultima rata (es. quando finisce il mutuo). La voce smette di contare nelle previsioni dopo quella data.
                  </p>
                </div>
              )}
            </div>

            {/* Giorno del mese fisso (es. affitto il 5, stipendio il 27) */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Giorno del mese (opzionale)</label>
              <input
                type="number"
                min="1"
                max="31"
                step="1"
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(e.target.value)}
                placeholder="es. 27"
                className="w-full px-4 py-3 rounded-xl text-xs text-white focus:outline-none border transition-all duration-200"
                style={{
                  background: "hsl(240 10% 4% / 0.8)",
                  borderColor: "hsl(240 5% 18%)",
                }}
              />
              <p className="text-[9px] text-zinc-500 mt-1">
                Se la voce e' fissata in un giorno preciso del mese, indicalo qui: verra' proposto come data di default quando confermi il pagamento reale.
              </p>
            </div>

            {/* Descrizione */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Descrizione / Nome</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={type === "income" ? "es. Stipendio, Rendita" : "es. Mutuo, Gas, Spesa Alimentare, Fondo Imprevisti"}
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
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Importo {type !== "income" && PERIODS.find(p => p.value === periodicity)?.label.toLowerCase()} (€)
              </label>
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
              {isPending ? "Salvataggio..." : editingId ? "Salva Modifiche" : "Aggiungi al Budget"}
            </button>
          </form>
        </div>

        {/* Elenco Voci Pianificate */}
        <div
          className="lg:col-span-2 rounded-2xl p-6 border flex flex-col space-y-4 shadow-2xl relative overflow-hidden group backdrop-blur-xl animate-fade-in"
          style={{
            background: "linear-gradient(135deg, hsla(240, 10%, 12%, 0.5), hsla(240, 10%, 10%, 0.8))",
            borderColor: "hsla(240, 5%, 18%, 0.7)",
          }}
        >
          <div className="absolute top-[-30%] left-[-20%] w-60 h-60 rounded-full bg-zinc-500/5 blur-[80px] pointer-events-none" />

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-white tracking-wide">
              📋 Voci di Budget Pianificate
            </h3>
            <span className="text-[9px] font-bold text-zinc-500">
              Previsto per {MONTH_LABELS[selectedMonth - 1]} {selectedYear}
            </span>
          </div>

          <div className="flex-1 overflow-x-auto pr-1 relative z-10 overflow-y-auto">
            {budgets.length === 0 && unlinkedScheduledItemsList.length === 0 ? (
              <p className="text-xs text-slate-500 py-12 text-center">Nessuna voce programmata nel budget.</p>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b" style={{ borderColor: "hsl(240 5% 18% / 0.7)" }}>
                    <th className="pb-3 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Descrizione</th>
                    <th className="pb-3 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Tipo & Stima</th>
                    <th className="pb-3 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Frequenza</th>
                    <th className="pb-3 font-bold text-slate-400 uppercase tracking-wider text-[9px] text-right">Stima Base</th>
                    <th className="pb-3 font-bold text-slate-400 uppercase tracking-wider text-[9px] text-right">Previsto Mese</th>
                    <th className="pb-3 font-bold text-slate-400 uppercase tracking-wider text-[9px] text-center">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "hsl(240 5% 18% / 0.3)" }}>
                  {budgets.map((b) => {
                    const catName = b.expense_categories?.name || "Generica / Altro";
                    const catColor = b.expense_categories?.color || "slate";
                    const badge = COLOR_MAP[catColor] || COLOR_MAP.slate;
                    const monthlyEquivalent = getMonthlyEquivalent(b.amount, b.periodicity);
                    const override = findOverride(b.id, selectedYear, selectedMonth);
                    const ended = isBudgetEnded(b, selectedYear, selectedMonth);
                    const effectiveAmount = getEffectiveAmount(b, selectedYear, selectedMonth);
                    const isEditingOverride = editingOverrideBudgetId === b.id;
                    const linkedExpense = findLinkedExpense(b.id, selectedYear, selectedMonth);
                    const isConfirming = confirmingBudgetId === b.id;
                    const linkedSchedule = findLinkedSchedule(b.id, selectedYear, selectedMonth);
                    const isGeneratingSchedule = generatingScheduleBudgetId === b.id;

                    return (
                      <tr key={b.id} className="hover:bg-white/2 transition-colors duration-150 group animate-fade-in">
                        <td className="py-3 pr-2">
                          <div className="font-bold text-white truncate max-w-[120px]">{b.label}</div>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {b.type !== "income" && (
                              <span
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[7px] font-bold border"
                                style={{
                                  backgroundColor: badge.bg,
                                  color: badge.text,
                                  borderColor: badge.border,
                                }}
                              >
                                {catName}
                              </span>
                            )}
                            {b.suppliers?.name && (
                              <span
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[7px] font-bold border bg-sky-500/10 text-sky-300 border-sky-500/20"
                                title="Fornitore preimpostato per questa voce"
                              >
                                🏢 {b.suppliers.name}
                              </span>
                            )}
                            {b.end_year && b.end_month && (
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[7px] font-bold border ${
                                  ended
                                    ? "bg-zinc-800 text-zinc-500 border-zinc-700"
                                    : "bg-indigo-500/10 text-indigo-300 border-indigo-500/20"
                                }`}
                                title="Ultimo mese in cui questa voce e' attiva"
                              >
                                🏁 {ended ? "Concluso" : `fino a ${MONTH_LABELS[b.end_month - 1].slice(0, 3)} ${b.end_year}`}
                              </span>
                            )}
                            {b.day_of_month && (
                              <span
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[7px] font-bold border bg-zinc-800/50 text-zinc-400 border-zinc-700"
                                title="Giorno del mese in cui questa voce e' fissata"
                              >
                                📅 il {b.day_of_month}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className={`text-[9px] font-bold ${
                              b.type === "income"
                                ? "text-emerald-400"
                                : b.type === "need"
                                  ? "text-rose-400"
                                  : b.type === "want"
                                    ? "text-sky-400"
                                    : "text-purple-400"
                            }`}>
                              {b.type === "income" ? "Entrata" : b.type === "need" ? "Bisogno" : b.type === "want" ? "Desiderio" : "Imprevisto"}
                            </span>
                            <span className={`text-[7px] uppercase font-extrabold tracking-widest ${b.is_estimated ? "text-amber-500" : "text-zinc-500"}`}>
                              {b.is_estimated ? "Stimato" : "Certo"}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 text-slate-400 font-semibold uppercase tracking-wider text-[8px]">
                          {b.type === "income" ? "Mensile" : PERIODS.find(p => p.value === b.periodicity)?.label}
                        </td>
                        <td className={`py-3 text-right font-black text-xs ${b.type === "income" ? "text-emerald-400" : "text-white"}`}>
                          {b.type === "income" ? "+" : "-"}{formatCurrency(b.amount)}
                        </td>
                        <td className="py-3 text-right">
                          {isEditingOverride ? (
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="number"
                                step="0.01"
                                autoFocus
                                value={overrideDraft}
                                onChange={(e) => setOverrideDraft(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") saveOverride(b); if (e.key === "Escape") setEditingOverrideBudgetId(null); }}
                                className="w-20 px-1.5 py-1 rounded text-right text-xs text-white bg-zinc-950 border border-indigo-500/50 focus:outline-none"
                              />
                              <button onClick={() => saveOverride(b)} className="text-emerald-400 hover:text-emerald-300 text-[10px] font-bold px-1" title="Salva">✓</button>
                              <button onClick={() => setEditingOverrideBudgetId(null)} className="text-zinc-500 hover:text-white text-[10px] font-bold px-1" title="Annulla">✕</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEditOverride(b)}
                              className="group/ov inline-flex flex-col items-end"
                              title="Modifica l'importo previsto per questo mese"
                            >
                              <span className={`font-black text-xs group-hover/ov:underline ${
                                ended && !override ? "text-zinc-600" : b.type === "income" ? "text-emerald-400" : "text-zinc-300"
                              }`}>
                                {ended && !override ? "—" : `${b.type === "income" ? "+" : "-"}${formatCurrency(effectiveAmount)}`}
                              </span>
                              {override ? (
                                <span className="text-[7px] uppercase font-extrabold tracking-widest text-amber-500">
                                  Modificato
                                </span>
                              ) : ended ? (
                                <span className="text-[7px] uppercase font-extrabold tracking-widest text-zinc-600">
                                  Concluso
                                </span>
                              ) : null}
                              {linkedExpense && (
                                <span
                                  className="text-[7px] uppercase font-extrabold tracking-widest text-emerald-500"
                                  title={`Già registrata in Spese & Entrate il ${new Date(linkedExpense.date).toLocaleDateString("it-IT")}`}
                                >
                                  🔗 Registrata
                                </span>
                              )}
                              {linkedSchedule && (
                                <span
                                  className={`text-[7px] uppercase font-extrabold tracking-widest ${linkedSchedule.is_paid ? "text-emerald-500" : "text-amber-500"}`}
                                  title={`Scadenza ${linkedSchedule.is_paid ? "saldata" : "da pagare"} il ${new Date(linkedSchedule.due_date).toLocaleDateString("it-IT")}`}
                                >
                                  📅 {linkedSchedule.is_paid ? "Scadenza saldata" : "Scadenza generata"}
                                </span>
                              )}
                              {!linkedSchedule && !linkedExpense && b.type !== "income" && b.periodicity === "monthly" && !ended && (
                                <span
                                  className="text-[7px] uppercase font-extrabold tracking-widest text-zinc-600"
                                  title="Nessuna scadenza generata per questo mese: usa il pulsante 📅 per crearla in Scadenze"
                                >
                                  📅 Scadenza non generata
                                </span>
                              )}
                            </button>
                          )}
                        </td>
                        <td className="py-3 text-center">
                          {isConfirming ? (
                            <div className="flex flex-col gap-1 items-end animate-fade-in">
                              <input
                                type="number"
                                step="0.01"
                                autoFocus
                                value={confirmAmount}
                                onChange={(e) => setConfirmAmount(e.target.value)}
                                placeholder="Importo"
                                className="w-24 px-1.5 py-1 rounded text-right text-[10px] text-white bg-zinc-950 border border-emerald-500/50 focus:outline-none"
                              />
                              <input
                                type="date"
                                value={confirmDate}
                                onChange={(e) => setConfirmDate(e.target.value)}
                                className="w-32 px-1.5 py-1 rounded text-[10px] text-white bg-zinc-950 border border-emerald-500/50 focus:outline-none"
                              />
                              <div className="flex gap-1">
                                <button onClick={() => saveConfirmExpense(b)} className="text-emerald-400 hover:text-emerald-300 text-[9px] font-bold px-1" title="Registra in Spese & Entrate">✓ Registra</button>
                                <button onClick={cancelConfirmExpense} className="text-zinc-500 hover:text-white text-[9px] font-bold px-1" title="Annulla">✕</button>
                              </div>
                            </div>
                          ) : isGeneratingSchedule ? (
                            <div className="flex flex-col gap-1 items-end animate-fade-in">
                              <input
                                type="number"
                                step="0.01"
                                autoFocus
                                value={scheduleAmount}
                                onChange={(e) => setScheduleAmount(e.target.value)}
                                placeholder="Importo"
                                className="w-24 px-1.5 py-1 rounded text-right text-[10px] text-white bg-zinc-950 border border-amber-500/50 focus:outline-none"
                              />
                              <input
                                type="date"
                                value={scheduleDate}
                                onChange={(e) => setScheduleDate(e.target.value)}
                                className="w-32 px-1.5 py-1 rounded text-[10px] text-white bg-zinc-950 border border-amber-500/50 focus:outline-none"
                              />
                              <div className="flex gap-1">
                                <button onClick={() => saveGenerateSchedule(b)} className="text-amber-400 hover:text-amber-300 text-[9px] font-bold px-1" title="Genera in Scadenze">✓ Genera</button>
                                <button onClick={cancelGenerateSchedule} className="text-zinc-500 hover:text-white text-[9px] font-bold px-1" title="Annulla">✕</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                              {!linkedExpense && (
                                <button
                                  onClick={() => startConfirmExpense(b)}
                                  className="p-1 rounded text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all text-[10px]"
                                  title="Conferma come spesa/entrata reale in Spese & Entrate"
                                >
                                  ✅
                                </button>
                              )}
                              {b.type !== "income" && b.periodicity === "monthly" && !linkedSchedule && (
                                <button
                                  onClick={() => startGenerateSchedule(b)}
                                  className="p-1 rounded text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 transition-all text-[10px]"
                                  title="Genera una scadenza da pagare in Scadenze"
                                >
                                  📅
                                </button>
                              )}
                              {override && !isEditingOverride && (
                                <button
                                  onClick={() => resetOverride(b)}
                                  className="p-1 rounded text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 transition-all text-[10px]"
                                  title="Ripristina stima di base per questo mese"
                                >
                                  ↺
                                </button>
                              )}
                              <button
                                onClick={() => startEditBudget(b)}
                                className="p-1 rounded text-slate-500 hover:text-sky-400 hover:bg-sky-500/10 transition-all text-[10px]"
                                title="Modifica voce"
                              >
                                ✎
                              </button>
                              <button
                                onClick={() => handleDelete(b.id)}
                                className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                                title="Elimina"
                              >
                                <DeleteIcon size={12} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {unlinkedScheduledItemsList.map((s: any) => {
                    const catObj = categories.find(c => c.id === s.category_id);
                    const catName = catObj?.name || s.category || "Generica / Altro";
                    const catColor = catObj?.color || "slate";
                    const badge = COLOR_MAP[catColor] || COLOR_MAP.slate;
                    return (
                      <tr key={`sched-${s.id}`} className="hover:bg-white/2 transition-colors duration-150 group animate-fade-in">
                        <td className="py-3 pr-2">
                          <div className="font-bold text-white truncate max-w-[120px]">{s.description || s.category}</div>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            <span
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[7px] font-bold border"
                              style={{ backgroundColor: badge.bg, color: badge.text, borderColor: badge.border }}
                            >
                              {catName}
                            </span>
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[7px] font-bold border ${
                                s.isOverdue ? "bg-rose-500/10 text-rose-300 border-rose-500/20" : "bg-amber-500/10 text-amber-300 border-amber-500/20"
                              }`}
                              title={`Scadenza del ${new Date(s.due_date).toLocaleDateString("it-IT")}, non collegata a una voce di budget`}
                            >
                              📅 {s.isOverdue ? "Scaduta" : "Da Scadenze"}
                            </span>
                          </div>
                        </td>
                        <td className="py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] font-bold text-zinc-400">Bisogno</span>
                            <span className="text-[7px] uppercase font-extrabold tracking-widest text-zinc-500">Non pianificata</span>
                          </div>
                        </td>
                        <td className="py-3 text-slate-400 font-semibold uppercase tracking-wider text-[8px]">
                          {s.recurrence === "one-time" ? "Una tantum" : s.recurrence === "weekly" ? "Settimanale" : s.recurrence === "monthly" ? "Mensile" : "Annuale"}
                        </td>
                        <td className="py-3 text-right font-black text-xs text-white">-{formatCurrency(Number(s.amount))}</td>
                        <td className="py-3 text-right">
                          <span className="font-black text-xs text-zinc-300">-{formatCurrency(Number(s.amount))}</span>
                          {s.isOverdue && (
                            <div className="text-[7px] uppercase font-extrabold tracking-widest text-rose-500">Non saldata</div>
                          )}
                        </td>
                        <td className="py-3 text-center">
                          <Link
                            href="/dashboard/schedules"
                            className="p-1 rounded text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 text-[10px] inline-flex opacity-0 group-hover:opacity-100 transition-all"
                            title="Gestisci o salda in Scadenze & Pagamenti"
                          >
                            <SchedulesIcon size={12} />
                          </Link>
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

      {/* Ripartizione Consigliata & Elenco Voci */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Regola 50/30/20 */}
        <div
          className="rounded-2xl p-6 border shadow-2xl relative overflow-hidden group backdrop-blur-xl animate-fade-in"
          style={{
            background: "linear-gradient(135deg, hsla(270, 60%, 15%, 0.08), hsla(240, 10%, 10%, 0.7))",
            borderColor: "hsla(270, 60%, 50%, 0.15)",
          }}
        >
          <div className="absolute top-[-30%] left-[-20%] w-40 h-40 rounded-full bg-purple-500/5 blur-[50px] pointer-events-none" />

          <h3 className="text-sm font-extrabold text-white tracking-wide mb-4">
            💡 Ripartizione 50/30/20 (Normalizzata)
          </h3>

          {ruleAnalysis ? (
            <div className="space-y-4 text-xs z-10 relative">
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Ripartizione calcolata classificando le spese in base all'effettiva utilità reale (Bisogni, Desideri, Fondi Risparmio ed Emergenza):
              </p>
              
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold">
                  <span className="text-rose-400">Bisogni (Essenziali) - 50% max</span>
                  <span className="text-white">{ruleAnalysis.needPercent}%</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden border border-white/5">
                  <div className="h-full bg-rose-500 rounded-full" style={{ width: `${Math.min(ruleAnalysis.needPercent, 100)}%` }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold">
                  <span className="text-sky-400">Desideri (Voluttuarie) - 30% max</span>
                  <span className="text-white">{ruleAnalysis.wantPercent}%</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden border border-white/5">
                  <div className="h-full bg-sky-500 rounded-full" style={{ width: `${Math.min(ruleAnalysis.wantPercent, 100)}%` }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold">
                  <span className="text-emerald-400">Risparmio & Imprevisti - 20% min</span>
                  <span className="text-white">{ruleAnalysis.savingsPercent}%</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden border border-white/5">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.max(0, Math.min(ruleAnalysis.savingsPercent, 100))}%` }} />
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-800 text-[10px] text-slate-400 leading-relaxed">
                {ruleAnalysis.needPercent > 50 ? (
                  <span className="text-rose-400 font-semibold">⚠️ I tuoi bisogni essenziali superano il 50%. Valuta se ottimizzare spese fisse (bollette, affitti) o ridurre uscite variabili essenziali.</span>
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

                const badge = COLOR_MAP[item.color] || COLOR_MAP.slate;
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
                                <span className="text-zinc-500">Previsto: {formatCurrency(item.targetAmt)} (imposta un limite)</span>
                              )}
                            </button>
                          )}
                        </div>

                        <div className="relative h-2 w-full bg-zinc-950 rounded-full overflow-hidden border border-white/5">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                            style={{ width: `${Math.min(percent, 100)}%` }}
                          />
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
                            <span className="text-zinc-500 font-semibold">Scadenze non pianificate incluse: </span>
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

    </div>
  );
}
