"use client";

import { useMemo } from "react";
import Link from "next/link";
import { type Expense, type PaymentSchedule, type Account, type Budget, type BudgetOverride, type AccountBalanceAdjustment } from "@/lib/types/database";
import { formatCurrency, formatDate } from "@/lib/format";
import { getEffectiveAmount, isBudgetEnded } from "@/lib/budgetCalc";
import { ExpensesIcon, SchedulesIcon, OverviewIcon, WalletIcon } from "./icons";
import { getCategoryGradient } from "@/lib/categoryColors";
import { computeAccountBalances } from "@/lib/accountBalance";

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

interface ScheduleWithRelations extends Omit<PaymentSchedule, "amount"> {
  amount: number;
  expense_categories?: {
    name: string;
    color: string;
  } | null;
  suppliers?: {
    name: string;
  } | null;
}

interface OverviewClientProps {
  expenses: any[];
  schedules: any[];
  accounts: Account[];
  budgets: Budget[];
  budgetOverrides: BudgetOverride[];
  accountAdjustments: AccountBalanceAdjustment[];
}

export default function OverviewClient({ expenses, schedules, accounts, budgets, budgetOverrides, accountAdjustments }: OverviewClientProps) {
  const accountBalances = useMemo(() => {
    const balanceMap = computeAccountBalances(accounts, expenses, accountAdjustments);
    return accounts.map(acc => ({ ...acc, balance: balanceMap[acc.id] ?? Number(acc.initial_balance) }));
  }, [accounts, expenses, accountAdjustments]);

  const totalBalance = useMemo(
    () => accountBalances.reduce((sum, a) => sum + a.balance, 0),
    [accountBalances]
  );

  const stats = useMemo(() => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // Spese ed Entrate reali del mese corrente (nettamente divise)
    const currentMonthExpensesList = expenses.filter((e: ExpenseWithRelations) => {
      const d = new Date(e.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear && !e.is_income;
    });

    const currentMonthIncomesList = expenses.filter((e: ExpenseWithRelations) => {
      const d = new Date(e.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear && !!e.is_income;
    });

    const totalCurrentMonthExpenses = currentMonthExpensesList.reduce((sum, e) => sum + Number(e.amount), 0);
    const totalCurrentMonthIncomes = currentMonthIncomesList.reduce((sum, e) => sum + Number(e.amount), 0);
    const netBalance = totalCurrentMonthIncomes - totalCurrentMonthExpenses;

    // Pagamenti in scadenza (prossimi 30 giorni, non pagati)
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(today.getDate() + 30);

    const pendingSchedules = schedules.filter((s: ScheduleWithRelations) => {
      if (s.is_paid) return false;
      const d = new Date(s.due_date);
      return d >= today && d <= thirtyDaysLater;
    });

    const totalPendingSchedules = pendingSchedules.reduce((sum, s) => sum + Number(s.amount), 0);

    // Spese per categoria (solo USCIITE del mese corrente)
    const categoryMap: Record<string, { value: number; color: string }> = {};
    currentMonthExpensesList.forEach((e: ExpenseWithRelations) => {
      const catName = e.expense_categories?.name || e.category;
      const catColor = e.expense_categories?.color || "slate";
      
      if (!categoryMap[catName]) {
        categoryMap[catName] = { value: 0, color: catColor };
      }
      categoryMap[catName].value += Number(e.amount);
    });

    const categoriesData = Object.entries(categoryMap)
      .map(([name, data]) => ({ name, value: data.value, color: data.color }))
      .sort((a, b) => b.value - a.value);

    // Ultime 5 transazioni (evidenziate se entrata o spesa)
    const recentExpenses = expenses.slice(0, 5);

    // Scadenze imminenti (prossime 5 non pagate)
    const upcomingSchedules = schedules
      .filter((s: ScheduleWithRelations) => !s.is_paid)
      .slice(0, 5);

    return {
      totalCurrentMonthExpenses,
      totalCurrentMonthIncomes,
      netBalance,
      totalPendingSchedules,
      categoriesData,
      recentExpenses,
      upcomingSchedules,
    };
  }, [expenses, schedules]);

  // Budget pianificato per il mese corrente (previsto), confrontato con le spese/entrate reali gia' calcolate sopra
  const budgetStats = useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;

    let plannedIncome = 0;
    let plannedOutgoings = 0;
    const items: { id: string; label: string; amount: number; registered: boolean }[] = [];

    budgets.forEach((b) => {
      const amt = getEffectiveAmount(b, budgetOverrides, year, month);
      if (amt <= 0) return;
      if (b.type === "income") {
        plannedIncome += amt;
        return;
      }
      plannedOutgoings += amt;
      const registered = expenses.some((e: ExpenseWithRelations) => {
        if (e.budget_id !== b.id || e.is_income) return false;
        const d = new Date(e.date);
        return d.getFullYear() === year && d.getMonth() + 1 === month;
      });
      items.push({ id: b.id, label: b.label, amount: amt, registered });
    });

    items.sort((a, b) => b.amount - a.amount);

    return {
      hasBudget: budgets.length > 0,
      plannedIncome,
      plannedOutgoings,
      remaining: plannedOutgoings - stats.totalCurrentMonthExpenses,
      outgoingsPercent: plannedOutgoings > 0 ? (stats.totalCurrentMonthExpenses / plannedOutgoings) * 100 : 0,
      items,
    };
  }, [budgets, budgetOverrides, expenses, stats.totalCurrentMonthExpenses]);

  // Voci di budget con un giorno fisso del mese non ancora registrate ne' generate come scadenza vera:
  // vengono mostrate come "previste" tra le prossime scadenze, cosi' da vederle senza doverle generare a mano.
  const plannedUpcoming = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const windowEnd = new Date(today);
    windowEnd.setDate(today.getDate() + 30);

    const items: { id: string; label: string; amount: number; dueDate: Date }[] = [];

    budgets.forEach((b) => {
      if (b.type === "income" || !b.day_of_month) return;

      for (const offset of [0, 1]) {
        const ref = new Date(today.getFullYear(), today.getMonth() + offset, 1);
        const year = ref.getFullYear();
        const month = ref.getMonth() + 1;
        if (isBudgetEnded(b, year, month)) continue;

        const daysInMonth = new Date(year, month, 0).getDate();
        const day = Math.min(b.day_of_month, daysInMonth);
        const dueDate = new Date(year, month - 1, day);
        if (dueDate < today || dueDate > windowEnd) continue;

        const alreadyHandled =
          schedules.some((s: any) => {
            if (s.budget_id !== b.id) return false;
            const d = new Date(s.due_date);
            return d.getFullYear() === year && d.getMonth() + 1 === month;
          }) ||
          expenses.some((e: any) => {
            if (e.budget_id !== b.id || e.is_income) return false;
            const d = new Date(e.date);
            return d.getFullYear() === year && d.getMonth() + 1 === month;
          });
        if (alreadyHandled) break;

        items.push({
          id: `${b.id}-${year}-${month}`,
          label: b.label,
          amount: getEffectiveAmount(b, budgetOverrides, year, month),
          dueDate,
        });
        break;
      }
    });

    return items.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }, [budgets, budgetOverrides, schedules, expenses]);

  // Elenco combinato di scadenze reali + voci di budget previste, ordinato per data
  const combinedUpcoming = useMemo(() => {
    const real = stats.upcomingSchedules.map((s: ScheduleWithRelations) => ({
      key: `real-${s.id}`,
      label: s.description || s.category,
      amount: Number(s.amount),
      date: new Date(s.due_date),
      planned: false,
    }));
    const planned = plannedUpcoming.map(p => ({
      key: `planned-${p.id}`,
      label: p.label,
      amount: p.amount,
      date: p.dueDate,
      planned: true,
    }));
    return [...real, ...planned].sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 6);
  }, [stats.upcomingSchedules, plannedUpcoming]);

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="animate-fade-in space-y-1">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
          Panoramica Finanziaria
        </h1>
        <p className="text-sm text-slate-400">
          Monitora le tue entrate, spese e pagamenti imminenti in tempo reale.
        </p>
      </div>

      {/* Saldi Conti */}
      {accounts.length > 0 && (
        <div
          className="rounded-2xl p-6 border relative overflow-hidden animate-fade-in"
          style={{
            background: "linear-gradient(135deg, hsla(200, 60%, 15%, 0.1), hsla(240, 10%, 10%, 0.6))",
            borderColor: "hsla(200, 60%, 50%, 0.15)",
          }}
        >
          <div className="flex items-center justify-between mb-4 relative z-10">
            <h2 className="text-sm font-extrabold text-white tracking-wide flex items-center gap-2">
              <span className="text-sky-400"><WalletIcon size={16} /></span> Saldi Conti
            </h2>
            <Link href="/dashboard/accounts" className="text-xs font-bold text-sky-400 hover:text-sky-300 transition-colors">
              Gestisci →
            </Link>
          </div>
          <div className="flex flex-wrap gap-4 relative z-10">
            <div className="min-w-[120px]">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Totale</span>
              <span className={`text-xl font-black ${totalBalance >= 0 ? "text-white" : "text-rose-400"}`}>
                {formatCurrency(totalBalance)}
              </span>
            </div>
            {accountBalances.map(acc => (
              <div key={acc.id} className="min-w-[120px]">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block truncate">{acc.name}</span>
                <span className={`text-sm font-bold ${acc.balance >= 0 ? "text-slate-200" : "text-rose-400"}`}>
                  {formatCurrency(acc.balance)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Budget del Mese */}
      <div
        className="rounded-2xl p-6 border relative overflow-hidden animate-fade-in"
        style={{
          background: "linear-gradient(135deg, hsla(270, 60%, 15%, 0.1), hsla(240, 10%, 10%, 0.6))",
          borderColor: "hsla(270, 60%, 50%, 0.15)",
        }}
      >
        <div className="flex items-center justify-between mb-4 relative z-10">
          <h2 className="text-sm font-extrabold text-white tracking-wide flex items-center gap-2">
            <span className="text-purple-400">📋</span> Budget del Mese
          </h2>
          <Link href="/dashboard/budget" className="text-xs font-bold text-purple-400 hover:text-purple-300 transition-colors">
            Gestisci →
          </Link>
        </div>

        {budgetStats.hasBudget ? (
          <div className="relative z-10 space-y-3">
            <div className="flex flex-wrap justify-between items-center gap-2 text-xs">
              <span className="text-slate-400 font-medium">
                Uscite reali: <span className="text-white font-black">{formatCurrency(stats.totalCurrentMonthExpenses)}</span> / previste: <span className="text-zinc-400">{formatCurrency(budgetStats.plannedOutgoings)}</span>
              </span>
              {budgetStats.plannedOutgoings > 0 && (
                <span className={`font-black ${budgetStats.remaining >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {budgetStats.remaining >= 0
                    ? `Disponibili ${formatCurrency(budgetStats.remaining)}`
                    : `Sforato di ${formatCurrency(-budgetStats.remaining)}`
                  }
                </span>
              )}
            </div>
            <div className="relative h-2 w-full bg-zinc-950 rounded-full overflow-hidden border border-white/5">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  budgetStats.outgoingsPercent > 100
                    ? "bg-rose-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]"
                    : budgetStats.outgoingsPercent > 80
                      ? "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]"
                      : "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                }`}
                style={{ width: `${Math.min(budgetStats.outgoingsPercent, 100)}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-500 font-medium">
              Entrate previste questo mese: <span className="text-zinc-300 font-bold">{formatCurrency(budgetStats.plannedIncome)}</span> (reali finora: {formatCurrency(stats.totalCurrentMonthIncomes)})
            </div>

            {budgetStats.items.length > 0 && (
              <div className="pt-2 border-t border-white/5 flex flex-wrap gap-1.5">
                {budgetStats.items.map((item) => (
                  <span
                    key={item.id}
                    title={item.registered ? "Gia' registrata come spesa reale questo mese" : "Ancora da pagare/registrare questo mese"}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold border ${
                      item.registered
                        ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-300"
                        : "bg-zinc-950/60 border-zinc-800 text-zinc-300"
                    }`}
                  >
                    {item.registered && "✓ "}{item.label} · {formatCurrency(item.amount)}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-500 relative z-10">
            Non hai ancora pianificato un budget.{" "}
            <Link href="/dashboard/budget" className="text-purple-400 hover:text-purple-300 font-bold">Creane uno →</Link>
          </p>
        )}
      </div>

      {/* Grid delle schede KPI (Entrate, Uscite, Bilancio Netto, Scadenze) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* KPI 1: Uscite Mese Corrente */}
        <div
          className="rounded-2xl p-6 transition-all duration-300 hover:translate-y-[-4px] border relative overflow-hidden group shadow-lg"
          style={{
            background: "linear-gradient(135deg, hsla(350, 60%, 15%, 0.15), hsla(240, 10%, 10%, 0.6))",
            borderColor: "hsla(350, 60%, 50%, 0.15)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div className="absolute top-[-50%] right-[-30%] w-60 h-60 rounded-full bg-rose-500/10 blur-[60px] pointer-events-none transition-transform duration-500 group-hover:scale-110" />
          
          <div className="flex justify-between items-start">
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Uscite Mese Corrente</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center border border-rose-500/20 text-rose-400">
              <ExpensesIcon size={16} />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl md:text-3xl font-black text-white tracking-tight drop-shadow-[0_2px_10px_rgba(244,63,94,0.15)]">
              {formatCurrency(stats.totalCurrentMonthExpenses)}
            </span>
          </div>
          <div className="mt-3 text-[10px] text-rose-400 flex items-center gap-1.5 font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            </span>
            Spese effettive del mese
          </div>
        </div>

        {/* KPI 2: Entrate Mese Corrente */}
        <div
          className="rounded-2xl p-6 transition-all duration-300 hover:translate-y-[-4px] border relative overflow-hidden group shadow-lg"
          style={{
            background: "linear-gradient(135deg, hsla(150, 60%, 15%, 0.15), hsla(240, 10%, 10%, 0.6))",
            borderColor: "hsla(150, 60%, 50%, 0.15)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div className="absolute top-[-50%] right-[-30%] w-60 h-60 rounded-full bg-emerald-500/10 blur-[60px] pointer-events-none transition-transform duration-500 group-hover:scale-110" />
          
          <div className="flex justify-between items-start">
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Entrate Mese Corrente</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400 font-bold">
              💰
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl md:text-3xl font-black text-white tracking-tight drop-shadow-[0_2px_10px_rgba(16,185,129,0.15)]">
              {formatCurrency(stats.totalCurrentMonthIncomes)}
            </span>
          </div>
          <div className="mt-3 text-[10px] text-emerald-400 flex items-center gap-1.5 font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Entrate incassate
          </div>
        </div>

        {/* KPI 3: Bilancio Netto Mensile */}
        <div
          className="rounded-2xl p-6 transition-all duration-300 hover:translate-y-[-4px] border relative overflow-hidden group shadow-lg"
          style={{
            background: stats.netBalance >= 0
              ? "linear-gradient(135deg, hsla(200, 60%, 15%, 0.15), hsla(240, 10%, 10%, 0.6))"
              : "linear-gradient(135deg, hsla(38, 60%, 15%, 0.15), hsla(240, 10%, 10%, 0.6))",
            borderColor: stats.netBalance >= 0 ? "hsla(200, 60%, 50%, 0.15)" : "hsla(38, 60%, 50%, 0.15)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div className="absolute top-[-50%] right-[-30%] w-60 h-60 rounded-full bg-sky-500/10 blur-[60px] pointer-events-none transition-transform duration-500 group-hover:scale-110" />
          
          <div className="flex justify-between items-start">
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Bilancio Netto Mese</span>
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center border border-sky-500/20 text-sky-400 font-bold">
              📊
            </div>
          </div>
          <div className="mt-4">
            <span className={`text-2xl md:text-3xl font-black tracking-tight ${stats.netBalance >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {stats.netBalance >= 0 ? "+" : ""}{formatCurrency(stats.netBalance)}
            </span>
          </div>
          <div className="mt-3 text-[10px] text-slate-400 font-semibold">
            Entrate minus Uscite mensili
          </div>
        </div>

        {/* KPI 4: Scadenze Prossimi 30 giorni */}
        <div
          className="rounded-2xl p-6 transition-all duration-300 hover:translate-y-[-4px] border relative overflow-hidden group shadow-lg"
          style={{
            background: "linear-gradient(135deg, hsla(38, 60%, 15%, 0.15), hsla(240, 10%, 10%, 0.6))",
            borderColor: "hsla(38, 60%, 50%, 0.15)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div className="absolute top-[-50%] right-[-30%] w-60 h-60 rounded-full bg-amber-500/10 blur-[60px] pointer-events-none transition-transform duration-500 group-hover:scale-110" />
          
          <div className="flex justify-between items-start">
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Scadenze (30gg)</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-400">
              <SchedulesIcon size={16} />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl md:text-3xl font-black text-white tracking-tight drop-shadow-[0_2px_10px_rgba(245,158,11,0.15)]">
              {formatCurrency(stats.totalPendingSchedules)}
            </span>
          </div>
          <div className="mt-3 text-[10px] text-amber-400/90 flex items-center gap-1.5 font-medium">
            Pagamenti in arrivo
          </div>
        </div>

      </div>

      {/* Sezione Categorie Spese & Scadenze */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Ripartizione Uscite per Categoria */}
        <div
          className="lg:col-span-2 rounded-2xl p-6 border shadow-2xl relative overflow-hidden group backdrop-blur-xl animate-fade-in"
          style={{
            background: "linear-gradient(135deg, hsla(240, 10%, 12%, 0.5), hsla(240, 10%, 10%, 0.8))",
            borderColor: "hsla(240, 5%, 18%, 0.7)",
          }}
        >
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-base font-extrabold text-white tracking-tight">
                Ripartizione Uscite Mese Corrente
              </h2>
              <p className="text-xs text-slate-400">Classificazione uscite per categoria</p>
            </div>
            <Link
              href="/dashboard/expenses"
              className="text-xs font-bold text-rose-400 hover:text-rose-300 transition-colors"
            >
              Vedi tutte le spese →
            </Link>
          </div>

          {stats.categoriesData.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p className="text-xs">Nessuna spesa registrata nel mese corrente.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {stats.categoriesData.map((cat) => {
                const percentage = Math.round((cat.value / stats.totalCurrentMonthExpenses) * 100) || 0;
                const barGradient = getCategoryGradient(cat.color);

                return (
                  <div key={cat.name} className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-200">{cat.name}</span>
                      <span className="font-black text-white">
                        {formatCurrency(cat.value)} <span className="text-[10px] text-slate-400 font-semibold">({percentage}%)</span>
                      </span>
                    </div>
                    <div className="relative h-2 w-full bg-zinc-950 rounded-full overflow-hidden border border-white/5">
                      <div
                        className="h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(255,255,255,0.1)]"
                        style={{
                          width: `${percentage}%`,
                          background: barGradient,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Scadenze Imminenti */}
        <div
          className="rounded-2xl p-6 border shadow-2xl relative overflow-hidden group backdrop-blur-xl animate-fade-in flex flex-col justify-between"
          style={{
            background: "linear-gradient(135deg, hsla(38, 60%, 15%, 0.05), hsla(240, 10%, 10%, 0.8))",
            borderColor: "hsla(38, 60%, 50%, 0.15)",
          }}
        >
          <div>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
                <span className="text-amber-400"><SchedulesIcon size={16} /></span>
                Prossime Scadenze
              </h2>
              <Link
                href="/dashboard/expenses?tab=scadenze"
                className="text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors"
              >
                Vedi tutte →
              </Link>
            </div>

            {combinedUpcoming.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">Nessuna scadenza in programma.</p>
            ) : (
              <div className="space-y-3">
                {combinedUpcoming.map((item) => (
                  <div
                    key={item.key}
                    className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                      item.planned
                        ? "border-dashed border-zinc-700 bg-zinc-950/20 hover:border-purple-500/40"
                        : "border-zinc-800/80 bg-zinc-950/40 hover:border-amber-500/30"
                    }`}
                  >
                    <div>
                      <h4 className="text-xs font-bold text-white line-clamp-1 flex items-center gap-1.5">
                        {item.label}
                        {item.planned && (
                          <span className="text-[7px] uppercase font-extrabold tracking-widest text-purple-400 border border-purple-500/30 rounded px-1 py-0.5">
                            Previsto
                          </span>
                        )}
                      </h4>
                      <span className="text-[10px] text-slate-400">
                        {item.planned ? "Previsto per il" : "Scadenza:"} {item.date.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" })}
                      </span>
                    </div>
                    <span className={`text-xs font-black whitespace-nowrap ${item.planned ? "text-purple-300" : "text-amber-400"}`}>
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Link
            href="/dashboard/calendar"
            className="w-full py-3 mt-4 rounded-xl text-xs font-extrabold text-center text-white bg-zinc-900 border border-zinc-800 hover:border-amber-500/40 hover:bg-amber-500/10 transition-all flex items-center justify-center gap-2"
          >
            <span>📅 Apri Calendario Unificato</span>
          </Link>
        </div>

      </div>

      {/* Ultime Transazioni Registrate (Entrate vs Spese) */}
      <div
        className="rounded-2xl p-6 border shadow-2xl relative overflow-hidden group backdrop-blur-xl animate-fade-in"
        style={{
          background: "linear-gradient(135deg, hsla(240, 10%, 12%, 0.5), hsla(240, 10%, 10%, 0.8))",
          borderColor: "hsla(240, 5%, 18%, 0.7)",
        }}
      >
        <div className="flex justify-between items-center mb-5">
          <div>
            <h2 className="text-base font-extrabold text-white tracking-tight">
              Ultime Transazioni Registrate
            </h2>
            <p className="text-xs text-slate-400">Registro veloce delle entrate e delle uscite recenti</p>
          </div>
          <Link
            href="/dashboard/expenses"
            className="text-xs font-bold text-sky-400 hover:text-sky-300 transition-colors"
          >
            Gestisci Transazioni →
          </Link>
        </div>

        {stats.recentExpenses.length === 0 ? (
          <p className="text-xs text-slate-500 py-8 text-center">Nessuna transazione registrata.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-800/80">
                  <th className="pb-3 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Data</th>
                  <th className="pb-3 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Tipo</th>
                  <th className="pb-3 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Fornitore / Note</th>
                  <th className="pb-3 font-bold text-slate-400 uppercase tracking-wider text-[9px] text-right">Importo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {stats.recentExpenses.map((exp: ExpenseWithRelations) => (
                  <tr key={exp.id} className="hover:bg-white/2 transition-colors">
                    <td className="py-3 text-slate-300 font-semibold whitespace-nowrap">
                      {formatDate(exp.date)}
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold border ${
                        exp.is_income
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                      }`}>
                        {exp.is_income ? "Entrata" : "Uscita / Spesa"}
                      </span>
                    </td>
                    <td className="py-3 text-white font-medium max-w-[200px] truncate">
                      {exp.is_income ? (exp.description || "Stipendio / Rendita") : (exp.suppliers?.name || exp.description || "Nessun fornitore")}
                    </td>
                    <td className={`py-3 text-right font-black ${exp.is_income ? "text-emerald-400" : "text-rose-400"}`}>
                      {exp.is_income ? "+" : "-"}{formatCurrency(exp.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
