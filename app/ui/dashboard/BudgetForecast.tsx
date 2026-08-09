"use client";

import { useMemo } from "react";
import { type Budget, type BudgetOverride } from "@/lib/types/database";
import { formatCurrency } from "@/lib/format";
import { getEffectiveAmount } from "@/lib/budgetCalc";
import { getNextDueDate, isRecurrenceEnded } from "@/lib/recurrence";

interface BudgetWithRelations extends Omit<Budget, "amount"> {
  amount: number;
  expense_categories?: { name: string; color: string } | null;
  suppliers?: { name: string } | null;
}

interface BudgetForecastProps {
  budgets: BudgetWithRelations[];
  overrides: BudgetOverride[];
  schedules: any[];
  baseYear: number;
  baseMonth: number; // 1-12, di solito il mese corrente reale
  onSelectMonth: (year: number, month: number) => void;
  selectedYear: number;
  selectedMonth: number;
}

const MONTH_SHORT = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
const MONTHS_AHEAD = 6;

function addMonths(year: number, month: number, delta: number) {
  let m = month + delta;
  let y = year;
  while (m > 12) { m -= 12; y += 1; }
  while (m < 1) { m += 12; y -= 1; }
  return { year: y, month: m };
}

// Le uscite non vivono piu' nelle voci di budget: si proietta in avanti la ricorrenza di ogni
// scadenza non ancora saldata (unica occorrenza "attiva" per ogni impegno ricorrente, dato che
// pagarla ne genera subito una nuova per il ciclo successivo) per capire se ricade nel mese
// richiesto, fermandosi alla sua eventuale data di fine (es. ultima rata di un finanziamento).
function amountForMonth(schedule: any, year: number, month: number): number | null {
  const due = new Date(schedule.due_date);
  const dueYear = due.getFullYear();
  const dueMonth = due.getMonth() + 1;

  if (dueYear === year && dueMonth === month) return Number(schedule.amount);
  if (schedule.recurrence === "one-time") return null;

  const isAfter = year > dueYear || (year === dueYear && month > dueMonth);
  if (!isAfter) return null;

  let cursor = schedule.due_date;
  for (let i = 0; i < 24; i++) {
    cursor = getNextDueDate(cursor, schedule.recurrence);
    if (isRecurrenceEnded(cursor, schedule.end_month, schedule.end_year)) return null;
    const d = new Date(cursor);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    if (y === year && m === month) return Number(schedule.amount);
    if (y > year || (y === year && m > month)) return null;
  }
  return null;
}

export default function BudgetForecast({
  budgets, overrides, schedules, baseYear, baseMonth, onSelectMonth, selectedYear, selectedMonth,
}: BudgetForecastProps) {
  const months = useMemo(() => {
    return Array.from({ length: MONTHS_AHEAD }, (_, i) => addMonths(baseYear, baseMonth, i));
  }, [baseYear, baseMonth]);

  // Solo le scadenze non ancora saldate: quella pagata ha gia' generato la successiva occorrenza
  // (se ricorrente), quindi usarle entrambe come base di proiezione conterebbe gli stessi mesi due volte.
  const activeSchedules = useMemo(() => schedules.filter((s: any) => !s.is_paid), [schedules]);

  const monthsData = useMemo(() => {
    return months.map(({ year, month }) => {
      const income = budgets
        .filter(b => b.type === "income")
        .reduce((sum, b) => sum + getEffectiveAmount(b, overrides, year, month), 0);

      const outgoingItems = activeSchedules
        .map((s: any) => {
          const amount = amountForMonth(s, year, month);
          if (amount === null) return null;
          return { key: `sched-${s.id}`, label: s.description || s.category, amount };
        })
        .filter((x): x is { key: string; label: string; amount: number } => x !== null)
        .sort((a, b) => b.amount - a.amount);

      const outgoings = outgoingItems.reduce((s, x) => s + x.amount, 0);

      return { year, month, income, outgoings, saldo: income - outgoings, outgoingItems };
    });
  }, [months, budgets, overrides, activeSchedules]);

  return (
    <div
      className="rounded-2xl p-6 border shadow-2xl relative overflow-hidden backdrop-blur-xl animate-fade-in"
      style={{
        background: "linear-gradient(135deg, hsla(200, 60%, 12%, 0.06), hsla(240, 10%, 10%, 0.8))",
        borderColor: "hsla(200, 60%, 50%, 0.15)",
      }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 relative z-10">
        <div>
          <h3 className="text-sm font-extrabold text-white tracking-wide">🗓️ Panoramica Prossimi Mesi</h3>
          <p className="text-[10px] text-zinc-500 mt-1">
            Confronta entrate previste e uscite proiettate dalle Scadenze ricorrenti dei prossimi {MONTHS_AHEAD} mesi. Per spostare un impegno a un mese diverso, ripianificalo direttamente in Scadenze.
          </p>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 relative z-10 snap-x">
        {monthsData.map(({ year, month, income, outgoings, saldo, outgoingItems }) => {
          const isSelected = year === selectedYear && month === selectedMonth;
          const isBase = year === baseYear && month === baseMonth;

          return (
            <div
              key={`${year}-${month}`}
              className="min-w-[190px] max-w-[190px] flex-shrink-0 snap-start rounded-xl border p-3 space-y-2 transition-all"
              style={{
                background: isSelected ? "hsla(245, 85%, 55%, 0.1)" : "hsl(240 10% 8% / 0.6)",
                borderColor: isSelected ? "hsla(245, 85%, 55%, 0.4)" : "hsl(240 5% 18% / 0.7)",
              }}
            >
              <button
                type="button"
                onClick={() => onSelectMonth(year, month)}
                className="w-full text-left"
                title="Vedi il dettaglio di questo mese"
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-extrabold ${isSelected ? "text-indigo-300" : "text-white"}`}>
                    {MONTH_SHORT[month - 1]} {year}
                  </span>
                  {isBase && <span className="text-[7px] font-bold text-emerald-400 uppercase">Oggi</span>}
                </div>
                <div className="mt-1 space-y-0.5">
                  <div className="flex justify-between text-[9px]">
                    <span className="text-zinc-500">Entrate</span>
                    <span className="text-emerald-400 font-bold">{formatCurrency(income)}</span>
                  </div>
                  <div className="flex justify-between text-[9px]">
                    <span className="text-zinc-500">Uscite</span>
                    <span className="text-rose-400 font-bold">{formatCurrency(outgoings)}</span>
                  </div>
                  <div className="flex justify-between text-[9px] pt-0.5 border-t border-zinc-800/60">
                    <span className="text-zinc-400 font-bold">Saldo</span>
                    <span className={`font-black ${saldo >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {formatCurrency(saldo)}
                    </span>
                  </div>
                </div>
              </button>

              {outgoingItems.length > 0 && (
                <div className="pt-1 border-t border-zinc-800/40 space-y-1 max-h-28 overflow-y-auto">
                  {outgoingItems.map((item) => (
                    <div key={item.key} className="flex items-center justify-between gap-1">
                      <span className="text-[8px] text-zinc-400 truncate flex-1" title={item.label}>
                        📅 {item.label}
                      </span>
                      <span className="text-[8px] text-zinc-300 font-semibold whitespace-nowrap">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
