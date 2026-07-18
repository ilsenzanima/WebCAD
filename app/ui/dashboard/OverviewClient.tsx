"use client";

import { useMemo } from "react";
import Link from "next/link";
import { type Expense, type PaymentSchedule } from "@/lib/types/database";

interface OverviewClientProps {
  expenses: Expense[];
  schedules: PaymentSchedule[];
}

export default function OverviewClient({ expenses, schedules }: OverviewClientProps) {
  // Calcolo delle statistiche
  const stats = useMemo(() => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // Spese mese corrente
    const currentMonthExpenses = expenses.filter((e) => {
      const d = new Date(e.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const totalCurrentMonth = currentMonthExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

    // Pagamenti in scadenza (prossimi 30 giorni, non pagati)
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(today.getDate() + 30);

    const pendingSchedules = schedules.filter((s) => {
      if (s.is_paid) return false;
      const d = new Date(s.due_date);
      return d >= today && d <= thirtyDaysLater;
    });

    const totalPendingSchedules = pendingSchedules.reduce((sum, s) => sum + Number(s.amount), 0);

    // Spese per categoria (mese corrente)
    const categoryMap: Record<string, number> = {};
    currentMonthExpenses.forEach((e) => {
      categoryMap[e.category] = (categoryMap[e.category] || 0) + Number(e.amount);
    });

    const categoriesData = Object.entries(categoryMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Ultime 5 spese
    const recentExpenses = expenses.slice(0, 5);

    // Scadenze imminenti (prossime 5 non pagate)
    const upcomingSchedules = schedules
      .filter((s) => !s.is_paid)
      .slice(0, 5);

    return {
      totalCurrentMonth,
      totalPendingSchedules,
      categoriesData,
      recentExpenses,
      upcomingSchedules,
    };
  }, [expenses, schedules]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(val);
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Panoramica Finanziaria</h1>
        <p className="text-sm text-gray-400 mt-1">
          Monitora le tue spese personali e pianifica i pagamenti imminenti.
        </p>
      </div>

      {/* Grid delle schede KPI */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* KPI 1: Spese Mese Corrente */}
        <div
          className="rounded-2xl p-6 transition-all duration-300 hover:translate-y-[-2px] border"
          style={{
            background: "linear-gradient(135deg, hsl(220 32% 12%), hsl(220 32% 10%))",
            borderColor: "hsl(220 20% 16%)",
          }}
        >
          <div className="flex justify-between items-start">
            <span className="text-gray-400 text-sm font-medium">Spese Mese Corrente</span>
            <span className="text-xl">💸</span>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-white">
              {formatCurrency(stats.totalCurrentMonth)}
            </span>
          </div>
          <div className="mt-2 text-xs text-emerald-400 flex items-center gap-1">
            <span>Aggiornato a oggi</span>
          </div>
        </div>

        {/* KPI 2: Pagamenti Imminenti */}
        <div
          className="rounded-2xl p-6 transition-all duration-300 hover:translate-y-[-2px] border"
          style={{
            background: "linear-gradient(135deg, hsl(220 32% 12%), hsl(220 32% 10%))",
            borderColor: "hsl(220 20% 16%)",
          }}
        >
          <div className="flex justify-between items-start">
            <span className="text-gray-400 text-sm font-medium">Scadenze a 30 Giorni</span>
            <span className="text-xl">📅</span>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-white">
              {formatCurrency(stats.totalPendingSchedules)}
            </span>
          </div>
          <div className="mt-2 text-xs text-amber-400">
            Da pagare nel prossimo mese
          </div>
        </div>

        {/* KPI 3: Risparmio / Stato rapido */}
        <div
          className="rounded-2xl p-6 transition-all duration-300 hover:translate-y-[-2px] border md:col-span-2 lg:col-span-1"
          style={{
            background: "linear-gradient(135deg, hsl(220 32% 12%), hsl(220 32% 10%))",
            borderColor: "hsl(220 20% 16%)",
          }}
        >
          <div className="flex justify-between items-start">
            <span className="text-gray-400 text-sm font-medium">Transazioni Totali</span>
            <span className="text-xl">📊</span>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-white">
              {expenses.length}
            </span>
            <span className="text-gray-400 text-sm ml-2">spese salvate</span>
          </div>
          <div className="mt-2 text-xs text-blue-400">
            {schedules.filter(s => !s.is_paid).length} scadenze attive nello scadenziario
          </div>
        </div>
      </div>

      {/* Sezione Dettagli (Grafico Categorie e Liste) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Distribuzione Spese per Categoria */}
        <div
          className="lg:col-span-1 rounded-2xl p-6 border flex flex-col"
          style={{
            background: "hsl(220 32% 10%)",
            borderColor: "hsl(220 20% 16%)",
          }}
        >
          <h2 className="text-lg font-bold text-white mb-4">Spese per Categoria</h2>
          
          {stats.categoriesData.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-gray-500">
              <span className="text-3xl mb-2">🍽️</span>
              <p className="text-xs">Nessuna spesa registrata in questo mese.</p>
            </div>
          ) : (
            <div className="space-y-4 flex-1 overflow-y-auto max-h-[300px] pr-1">
              {stats.categoriesData.map((cat) => {
                const percentage = stats.totalCurrentMonth > 0 
                  ? (cat.value / stats.totalCurrentMonth) * 100 
                  : 0;
                return (
                  <div key={cat.name} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-white">
                      <span>{cat.name}</span>
                      <span>{formatCurrency(cat.value)} ({percentage.toFixed(0)}%)</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-gray-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${percentage}%`,
                          background: "linear-gradient(90deg, hsl(220 90% 56%), hsl(215 85% 48%))",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Ultime Spese Inserite */}
        <div
          className="lg:col-span-1 rounded-2xl p-6 border flex flex-col"
          style={{
            background: "hsl(220 32% 10%)",
            borderColor: "hsl(220 20% 16%)",
          }}
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-white">Ultime Spese</h2>
            <Link href="/dashboard/expenses" className="text-xs text-blue-400 hover:underline">
              Vedi tutte
            </Link>
          </div>

          {stats.recentExpenses.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-gray-500">
              <span className="text-3xl mb-2">💸</span>
              <p className="text-xs">Nessuna spesa salvata.</p>
            </div>
          ) : (
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[300px]">
              {stats.recentExpenses.map((exp) => (
                <div
                  key={exp.id}
                  className="flex justify-between items-center p-3 rounded-xl border transition-colors hover:bg-white/5"
                  style={{
                    background: "hsl(220 26% 14%)",
                    borderColor: "hsl(220 20% 20%)",
                  }}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white truncate">
                      {exp.description || "Senza descrizione"}
                    </div>
                    <div className="text-[10px] text-gray-400 flex gap-2 mt-1">
                      <span>{exp.category}</span>
                      <span>•</span>
                      <span>{new Date(exp.date).toLocaleDateString("it-IT")}</span>
                    </div>
                  </div>
                  <div className="text-sm font-bold text-red-400 flex-shrink-0">
                    -{formatCurrency(exp.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Scadenze Imminenti */}
        <div
          className="lg:col-span-1 rounded-2xl p-6 border flex flex-col"
          style={{
            background: "hsl(220 32% 10%)",
            borderColor: "hsl(220 20% 16%)",
          }}
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-white">Prossime Scadenze</h2>
            <Link href="/dashboard/schedules" className="text-xs text-blue-400 hover:underline">
              Gestisci
            </Link>
          </div>

          {stats.upcomingSchedules.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-gray-500">
              <span className="text-3xl mb-2">📆</span>
              <p className="text-xs">Nessun pagamento programmato.</p>
            </div>
          ) : (
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[300px]">
              {stats.upcomingSchedules.map((sched) => {
                const today = new Date();
                const dueDate = new Date(sched.due_date);
                const isOverdue = dueDate < today;
                
                return (
                  <div
                    key={sched.id}
                    className="flex justify-between items-center p-3 rounded-xl border transition-colors hover:bg-white/5"
                    style={{
                      background: "hsl(220 26% 14%)",
                      borderColor: isOverdue ? "hsl(0 80% 60% / 0.3)" : "hsl(220 20% 20%)",
                    }}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">
                        {sched.description || "Pagamento programmato"}
                      </div>
                      <div className="text-[10px] flex gap-2 mt-1">
                        <span style={{ color: isOverdue ? "hsl(0 80% 70%)" : "hsl(215 15% 55%)" }}>
                          Scadenza: {dueDate.toLocaleDateString("it-IT")}
                        </span>
                        <span className="text-gray-500">•</span>
                        <span className="text-gray-400 uppercase tracking-widest text-[8px]">{sched.recurrence}</span>
                      </div>
                    </div>
                    <div className="text-sm font-bold text-white flex-shrink-0">
                      {formatCurrency(sched.amount)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
