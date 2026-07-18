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
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header con gradiente e animazione */}
      <div className="animate-fade-in space-y-1">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
          Panoramica Finanziaria
        </h1>
        <p className="text-sm text-slate-400">
          Monitora le tue spese personali e pianifica i pagamenti imminenti con precisione.
        </p>
      </div>

      {/* Grid delle schede KPI con Glassmorphism & Gradienti Neon */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* KPI 1: Spese Mese Corrente (Neon Rose/Red) */}
        <div
          className="rounded-2xl p-6 transition-all duration-300 hover:translate-y-[-4px] border relative overflow-hidden group shadow-lg"
          style={{
            background: "linear-gradient(135deg, hsla(350, 60%, 15%, 0.15), hsla(220, 32%, 10%, 0.6))",
            borderColor: "hsla(350, 60%, 50%, 0.15)",
            backdropFilter: "blur(12px)",
          }}
        >
          {/* Effetto bagliore nello sfondo */}
          <div className="absolute top-[-50%] right-[-30%] w-60 h-60 rounded-full bg-rose-500/10 blur-[60px] pointer-events-none transition-transform duration-500 group-hover:scale-110" />
          
          <div className="flex justify-between items-start">
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Spese Mese Corrente</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center border border-rose-500/20 text-sm">
              💸
            </div>
          </div>
          <div className="mt-5">
            <span className="text-3xl md:text-4xl font-black text-white tracking-tight drop-shadow-[0_2px_10px_rgba(244,63,94,0.15)]">
              {formatCurrency(stats.totalCurrentMonth)}
            </span>
          </div>
          <div className="mt-3 text-xs text-rose-400/90 flex items-center gap-1.5 font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            </span>
            <span>Mese in corso</span>
          </div>
        </div>

        {/* KPI 2: Pagamenti Imminenti (Neon Amber) */}
        <div
          className="rounded-2xl p-6 transition-all duration-300 hover:translate-y-[-4px] border relative overflow-hidden group shadow-lg"
          style={{
            background: "linear-gradient(135deg, hsla(38, 60%, 12%, 0.15), hsla(220, 32%, 10%, 0.6))",
            borderColor: "hsla(38, 60%, 50%, 0.15)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div className="absolute top-[-50%] right-[-30%] w-60 h-60 rounded-full bg-amber-500/10 blur-[60px] pointer-events-none transition-transform duration-500 group-hover:scale-110" />
          
          <div className="flex justify-between items-start">
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Scadenze a 30 Giorni</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-sm">
              📅
            </div>
          </div>
          <div className="mt-5">
            <span className="text-3xl md:text-4xl font-black text-white tracking-tight drop-shadow-[0_2px_10px_rgba(245,158,11,0.15)]">
              {formatCurrency(stats.totalPendingSchedules)}
            </span>
          </div>
          <div className="mt-3 text-xs text-amber-400 flex items-center gap-1.5 font-medium">
            <span>Da saldare a breve</span>
          </div>
        </div>

        {/* KPI 3: Transazioni Totali (Neon Violet) */}
        <div
          className="rounded-2xl p-6 transition-all duration-300 hover:translate-y-[-4px] border relative overflow-hidden group md:col-span-2 lg:col-span-1 shadow-lg"
          style={{
            background: "linear-gradient(135deg, hsla(245, 60%, 15%, 0.1), hsla(220, 32%, 10%, 0.6))",
            borderColor: "hsla(245, 60%, 50%, 0.15)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div className="absolute top-[-50%] right-[-30%] w-60 h-60 rounded-full bg-indigo-500/10 blur-[60px] pointer-events-none transition-transform duration-500 group-hover:scale-110" />
          
          <div className="flex justify-between items-start">
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Transazioni Totali</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-sm">
              📊
            </div>
          </div>
          <div className="mt-5 flex items-baseline gap-2">
            <span className="text-3xl md:text-4xl font-black text-white tracking-tight drop-shadow-[0_2px_10px_rgba(99,102,241,0.15)]">
              {expenses.length}
            </span>
            <span className="text-slate-400 text-sm font-semibold">spese salvate</span>
          </div>
          <div className="mt-3 text-xs text-indigo-400 flex items-center gap-1.5 font-medium">
            <span>{schedules.filter(s => !s.is_paid).length} scadenze nello scadenziario</span>
          </div>
        </div>
      </div>

      {/* Sezione Dettagli con Glassmorphism */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Distribuzione Spese per Categoria */}
        <div
          className="lg:col-span-1 rounded-2xl p-6 border flex flex-col shadow-lg backdrop-blur-md"
          style={{
            background: "hsl(220 32% 10% / 0.8)",
            borderColor: "hsl(220 20% 16% / 0.7)",
          }}
        >
          <h2 className="text-base font-bold text-white mb-5 tracking-tight flex items-center gap-2">
            <span className="text-lg">📈</span> Categorie Spesa
          </h2>
          
          {stats.categoriesData.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500">
              <span className="text-3xl mb-2">🍽️</span>
              <p className="text-xs">Nessuna spesa registrata in questo mese.</p>
            </div>
          ) : (
            <div className="space-y-4 flex-1 overflow-y-auto max-h-[300px] pr-1 scrollbar-thin">
              {stats.categoriesData.map((cat, index) => {
                const percentage = stats.totalCurrentMonth > 0 
                  ? (cat.value / stats.totalCurrentMonth) * 100 
                  : 0;
                
                // Colorazioni gradienti alternate per rendere il design dinamico
                const gradientColors = [
                  "linear-gradient(90deg, hsl(220 90% 56%), hsl(215 85% 48%))",
                  "linear-gradient(90deg, hsl(350 85% 55%), hsl(340 75% 45%))",
                  "linear-gradient(90deg, hsl(142 70% 45%), hsl(150 60% 40%))",
                  "linear-gradient(90deg, hsl(38 90% 50%), hsl(30 80% 45%))",
                  "linear-gradient(90deg, hsl(270 80% 55%), hsl(250 75% 50%))"
                ];
                const gradient = gradientColors[index % gradientColors.length];

                return (
                  <div key={cat.name} className="space-y-1.5 animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
                    <div className="flex justify-between text-xs font-semibold text-slate-300">
                      <span>{cat.name}</span>
                      <span className="text-white">{formatCurrency(cat.value)} <span className="text-slate-400 font-normal">({percentage.toFixed(0)}%)</span></span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-white/5">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${percentage}%`,
                          background: gradient,
                          boxShadow: "0 0 8px rgba(99,102,241,0.2)",
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
          className="lg:col-span-1 rounded-2xl p-6 border flex flex-col shadow-lg backdrop-blur-md"
          style={{
            background: "hsl(220 32% 10% / 0.8)",
            borderColor: "hsl(220 20% 16% / 0.7)",
          }}
        >
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span className="text-lg">💸</span> Ultime Spese
            </h2>
            <Link href="/dashboard/expenses" className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors">
              Vedi tutte →
            </Link>
          </div>

          {stats.recentExpenses.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500">
              <span className="text-3xl mb-2">💸</span>
              <p className="text-xs">Nessuna spesa salvata.</p>
            </div>
          ) : (
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[300px] pr-1">
              {stats.recentExpenses.map((exp, index) => (
                <div
                  key={exp.id}
                  className="flex justify-between items-center p-3 rounded-xl border transition-all duration-200 hover:bg-white/5 hover:translate-x-1 animate-fade-in"
                  style={{
                    background: "hsl(220 26% 14% / 0.6)",
                    borderColor: "hsl(220 20% 20% / 0.5)",
                    animationDelay: `${index * 50}ms`,
                  }}
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <div className="text-xs font-bold text-white truncate">
                      {exp.description || "Senza descrizione"}
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-1 font-medium">
                      <span>{exp.category}</span>
                      <span>•</span>
                      <span>{new Date(exp.date).toLocaleDateString("it-IT", { day: "numeric", month: "short" })}</span>
                    </div>
                  </div>
                  <div className="text-sm font-extrabold text-rose-400 flex-shrink-0">
                    -{formatCurrency(exp.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Scadenze Imminenti */}
        <div
          className="lg:col-span-1 rounded-2xl p-6 border flex flex-col shadow-lg backdrop-blur-md"
          style={{
            background: "hsl(220 32% 10% / 0.8)",
            borderColor: "hsl(220 20% 16% / 0.7)",
          }}
        >
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span className="text-lg">📆</span> Scadenze Vicine
            </h2>
            <Link href="/dashboard/schedules" className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors">
              Gestisci →
            </Link>
          </div>

          {stats.upcomingSchedules.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500">
              <span className="text-3xl mb-2">📆</span>
              <p className="text-xs">Nessun pagamento programmato.</p>
            </div>
          ) : (
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[300px] pr-1">
              {stats.upcomingSchedules.map((sched, index) => {
                const today = new Date();
                const dueDate = new Date(sched.due_date);
                const isOverdue = dueDate < today;
                
                return (
                  <div
                    key={sched.id}
                    className="flex justify-between items-center p-3 rounded-xl border transition-all duration-200 hover:bg-white/5 hover:translate-x-1 animate-fade-in"
                    style={{
                      background: "hsl(220 26% 14% / 0.6)",
                      borderColor: isOverdue ? "hsla(0, 80%, 60%, 0.25)" : "hsl(220 20% 20% / 0.5)",
                      animationDelay: `${index * 50}ms`,
                    }}
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <div className="text-xs font-bold text-white truncate">
                        {sched.description || "Pagamento programmato"}
                      </div>
                      <div className="text-[10px] flex items-center gap-1.5 mt-1 font-semibold">
                        <span style={{ color: isOverdue ? "hsl(0 84% 70%)" : "hsl(215 20% 65%)" }} className="flex items-center gap-1">
                          {isOverdue && <span className="animate-pulse">⚠️</span>}
                          {dueDate.toLocaleDateString("it-IT", { day: "numeric", month: "short" })}
                        </span>
                        <span className="text-slate-600">•</span>
                        <span className="text-slate-500 uppercase tracking-widest text-[8px]">{sched.recurrence}</span>
                      </div>
                    </div>
                    <div className="text-sm font-extrabold text-white flex-shrink-0">
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
