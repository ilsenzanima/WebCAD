"use client";

import { formatCurrency } from "@/lib/format";

interface AllocationInput {
  need: number;
  want: number;
  emergency: number;
  income: number; // base su cui calcolare le percentuali (per il reale, gia' con eventuale fallback alla stima)
}

interface BudgetAllocationDonutProps {
  previsto: AllocationInput;
  reale: AllocationInput;
}

// Stessi colori gia' usati altrove in questa pagina per Bisogno/Desiderio/Imprevisto/Risparmio
// (badge del Confronto per Categoria, testate della Ripartizione 50/30/20): l'identita' del
// colore resta fissa qui, non viene mai riassegnata in base alla posizione della fetta.
const SLICES = [
  { key: "need", label: "Bisogni", color: "#f43f5e" },
  { key: "want", label: "Desideri", color: "#0ea5e9" },
  { key: "emergency", label: "Imprevisti", color: "#f59e0b" },
  { key: "savings", label: "Risparmio", color: "#10b981" },
] as const;

const SIZE = 220;
const CENTER = SIZE / 2;
const OUTER_R = 88;
const INNER_R = 60;
const RING_W = 22;
const GAP_PX = 3;

function amounts(a: AllocationInput) {
  const savings = a.income - a.need - a.want - a.emergency;
  return { need: a.need, want: a.want, emergency: a.emergency, savings };
}

function ringSegments(a: AllocationInput, radius: number) {
  const { need, want, emergency, savings } = amounts(a);
  const values = { need, want, emergency, savings };
  const circumference = 2 * Math.PI * radius;
  let cumulative = 0;
  return SLICES.map((slice) => {
    const raw = values[slice.key as keyof typeof values];
    const clamped = Math.max(0, raw);
    const frac = a.income > 0 ? clamped / a.income : 0;
    const length = circumference * frac;
    const drawLength = Math.max(0, length - GAP_PX);
    const seg = {
      key: slice.key,
      color: slice.color,
      dasharray: `${drawLength} ${Math.max(0, circumference - drawLength)}`,
      dashoffset: -cumulative,
    };
    cumulative += length;
    return seg;
  });
}

function Ring({ radius, segments, label }: { radius: number; segments: ReturnType<typeof ringSegments>; label: string }) {
  const circumference = 2 * Math.PI * radius;
  return (
    <g transform={`translate(${CENTER} ${CENTER}) rotate(-90)`}>
      <circle r={radius} fill="none" stroke="hsl(240 8% 20%)" strokeWidth={RING_W} strokeOpacity={0.4} />
      {segments.map((seg) => (
        <circle
          key={seg.key}
          r={radius}
          fill="none"
          stroke={seg.color}
          strokeWidth={RING_W}
          strokeDasharray={seg.dasharray}
          strokeDashoffset={seg.dashoffset}
          strokeLinecap="butt"
        >
          <title>{label}</title>
        </circle>
      ))}
      <circle r={radius} fill="none" stroke="transparent" strokeWidth={circumference}>
        <title>{label}</title>
      </circle>
    </g>
  );
}

export default function BudgetAllocationDonut({ previsto, reale }: BudgetAllocationDonutProps) {
  const outerSegments = ringSegments(previsto, OUTER_R);
  const innerSegments = ringSegments(reale, INNER_R);
  const previstoAmounts = amounts(previsto);
  const realeAmounts = amounts(reale);

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative flex-shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} role="img" aria-label="Allocazione Bisogni, Desideri, Imprevisti e Risparmio: anello esterno previsto, anello interno reale">
          <Ring radius={OUTER_R} segments={outerSegments} label="Previsto" />
          <Ring radius={INNER_R} segments={innerSegments} label="Reale" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
          <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">Entrate</span>
          <span className="text-sm font-black text-white leading-tight">{formatCurrency(previsto.income)}</span>
          <span className="text-[9px] font-bold text-emerald-400 leading-tight">{formatCurrency(reale.income)} reale</span>
        </div>
      </div>

      <div className="w-full space-y-2">
        <div className="flex items-center gap-3 text-[8px] font-bold text-zinc-500 uppercase tracking-widest">
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full border border-zinc-500" />Esterno = Previsto</span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-zinc-500" />Interno = Reale</span>
        </div>
        {SLICES.map((slice) => {
          const p = previstoAmounts[slice.key as keyof typeof previstoAmounts];
          const r = realeAmounts[slice.key as keyof typeof realeAmounts];
          const pPercent = previsto.income > 0 ? Math.round((p / previsto.income) * 100) : 0;
          const rPercent = reale.income > 0 ? Math.round((r / reale.income) * 100) : 0;
          return (
            <div key={slice.key} className="flex items-center justify-between gap-2 text-[10px]">
              <span className="flex items-center gap-1.5 font-bold text-zinc-400 flex-shrink-0">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: slice.color }} />
                {slice.label}
              </span>
              <span className="text-right">
                <span className="text-zinc-500">Previsto </span>
                <span className={`font-bold ${p < 0 ? "text-rose-400" : "text-zinc-300"}`}>{formatCurrency(p)}</span>
                <span className="text-zinc-600"> ({pPercent}%)</span>
                <span className="mx-1.5 text-zinc-700">·</span>
                <span className="text-zinc-500">Reale </span>
                <span className={`font-bold ${r < 0 ? "text-rose-400" : "text-zinc-300"}`}>{formatCurrency(r)}</span>
                <span className="text-zinc-600"> ({rPercent}%)</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
