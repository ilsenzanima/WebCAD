"use client";

import { useMemo, useState, useTransition } from "react";
import { type Budget, type BudgetOverride } from "@/lib/types/database";
import { upsertBudgetOverride } from "@/app/actions/budget";
import { formatCurrency } from "@/lib/format";
import { getEffectiveAmount } from "@/lib/budgetCalc";

interface BudgetWithRelations extends Omit<Budget, "amount"> {
  amount: number;
  expense_categories?: { name: string; color: string } | null;
  suppliers?: { name: string } | null;
}

interface BudgetForecastProps {
  budgets: BudgetWithRelations[];
  overrides: BudgetOverride[];
  setOverrides: React.Dispatch<React.SetStateAction<BudgetOverride[]>>;
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

export default function BudgetForecast({
  budgets, overrides, setOverrides, baseYear, baseMonth, onSelectMonth, selectedYear, selectedMonth,
}: BudgetForecastProps) {
  const [isPending, startTransition] = useTransition();
  const [movingKey, setMovingKey] = useState<string | null>(null);

  const months = useMemo(() => {
    return Array.from({ length: MONTHS_AHEAD }, (_, i) => addMonths(baseYear, baseMonth, i));
  }, [baseYear, baseMonth]);

  const monthsData = useMemo(() => {
    return months.map(({ year, month }) => {
      const items = budgets
        .map(b => ({ budget: b, amount: getEffectiveAmount(b, overrides, year, month) }))
        .filter(x => x.amount > 0);

      const income = items.filter(x => x.budget.type === "income").reduce((s, x) => s + x.amount, 0);
      const outgoings = items.filter(x => x.budget.type !== "income").reduce((s, x) => s + x.amount, 0);

      const outgoingItems = items
        .filter(x => x.budget.type !== "income")
        .sort((a, b) => b.amount - a.amount);

      return { year, month, income, outgoings, saldo: income - outgoings, outgoingItems };
    });
  }, [months, budgets, overrides]);

  const moveToNextMonth = (b: BudgetWithRelations, year: number, month: number, amount: number) => {
    const { year: nextYear, month: nextMonth } = addMonths(year, month, 1);
    const nextCurrent = getEffectiveAmount(b, overrides, nextYear, nextMonth);
    const nextTotal = nextCurrent + amount;

    if (!confirm(
      `Spostare "${b.label}" (${formatCurrency(amount)}) da ${MONTH_SHORT[month - 1]} ${year} a ${MONTH_SHORT[nextMonth - 1]} ${nextYear}?\n\n` +
      `${MONTH_SHORT[month - 1]}: passera' a 0€ per questa voce.\n` +
      `${MONTH_SHORT[nextMonth - 1]}: passera' da ${formatCurrency(nextCurrent)} a ${formatCurrency(nextTotal)}.`
    )) {
      return;
    }

    const key = `${b.id}-${year}-${month}`;
    setMovingKey(key);
    startTransition(async () => {
      try {
        const res1 = await upsertBudgetOverride({ budget_id: b.id, year, month, amount: 0 });
        if (!res1.success || !res1.data) {
          alert(res1.error || "Errore durante lo spostamento");
          return;
        }
        const res2 = await upsertBudgetOverride({ budget_id: b.id, year: nextYear, month: nextMonth, amount: nextTotal });
        if (!res2.success || !res2.data) {
          alert(res2.error || "Errore durante lo spostamento");
          return;
        }
        setOverrides(prev => {
          const filtered = prev.filter(o =>
            !(o.budget_id === b.id && o.year === year && o.month === month) &&
            !(o.budget_id === b.id && o.year === nextYear && o.month === nextMonth)
          );
          return [...filtered, res1.data, res2.data];
        });
      } catch (err: any) {
        alert(err.message || "Errore durante lo spostamento");
      } finally {
        setMovingKey(null);
      }
    });
  };

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
            Confronta entrate e uscite previste dei prossimi {MONTHS_AHEAD} mesi. Passa il mouse su una voce per spostarla al mese successivo.
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
                  {outgoingItems.map(({ budget: b, amount }) => {
                    const key = `${b.id}-${year}-${month}`;
                    return (
                      <div key={b.id} className="flex items-center justify-between gap-1 group/item">
                        <span className="text-[8px] text-zinc-400 truncate flex-1" title={b.label}>{b.label}</span>
                        <span className="text-[8px] text-zinc-300 font-semibold whitespace-nowrap">{formatCurrency(amount)}</span>
                        <button
                          type="button"
                          onClick={() => moveToNextMonth(b, year, month, amount)}
                          disabled={isPending && movingKey === key}
                          className="opacity-0 group-hover/item:opacity-100 text-[9px] text-amber-500 hover:text-amber-300 transition-all disabled:opacity-50 flex-shrink-0"
                          title={`Sposta "${b.label}" al mese successivo`}
                        >
                          {isPending && movingKey === key ? "…" : "➡"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
