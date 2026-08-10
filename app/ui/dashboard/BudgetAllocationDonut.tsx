"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/format";

interface BreakdownItem {
  label: string;
  amount: number;
}

interface AllocationInput {
  need: number;
  want: number;
  emergency: number;
  income: number; // base su cui calcolare le percentuali (per il reale, gia' con eventuale fallback alla stima)
  // Per ogni fetta (tranne il Risparmio, che e' un residuo), le voci che la compongono
  // (categoria/scadenza per il previsto, categoria per il reale), dalla piu' grande.
  breakdown?: { need: BreakdownItem[]; want: BreakdownItem[]; emergency: BreakdownItem[] };
}

interface BudgetAllocationDonutProps {
  previsto: AllocationInput;
  reale: AllocationInput;
}

type SliceKey = "need" | "want" | "emergency" | "savings";

// Stessi colori gia' usati altrove in questa pagina per Bisogno/Desiderio/Imprevisto/Risparmio
// (badge del Confronto per Categoria, testate della Ripartizione 50/30/20): l'identita' del
// colore resta fissa qui, non viene mai riassegnata in base alla posizione della fetta.
const SLICES: { key: SliceKey; label: string; color: string }[] = [
  { key: "need", label: "Bisogni", color: "#f43f5e" },
  { key: "want", label: "Desideri", color: "#0ea5e9" },
  { key: "emergency", label: "Imprevisti", color: "#f59e0b" },
  { key: "savings", label: "Risparmio", color: "#10b981" },
];

const SIZE = 360;
const CENTER = SIZE / 2;
const OUTER_RING = { outer: 150, inner: 116 };
const INNER_RING = { outer: 104, inner: 70 };
const GAP_DEG = 2.5;
const POP_DIST = 10;
const MAX_BREAKDOWN_ITEMS = 5;

function amounts(a: AllocationInput) {
  const savings = a.income - a.need - a.want - a.emergency;
  return { need: a.need, want: a.want, emergency: a.emergency, savings };
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function wedgePath(cx: number, cy: number, rOuter: number, rInner: number, startAngle: number, endAngle: number) {
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  const p1 = polar(cx, cy, rOuter, startAngle);
  const p2 = polar(cx, cy, rOuter, endAngle);
  const p3 = polar(cx, cy, rInner, endAngle);
  const p4 = polar(cx, cy, rInner, startAngle);
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${p4.x} ${p4.y}`,
    "Z",
  ].join(" ");
}

function popOffset(midAngle: number, dist: number) {
  const rad = ((midAngle - 90) * Math.PI) / 180;
  return { dx: dist * Math.cos(rad), dy: dist * Math.sin(rad) };
}

function ringSlices(a: AllocationInput, ring: { outer: number; inner: number }) {
  const vals = amounts(a);
  const totalGap = GAP_DEG * SLICES.length;
  const available = 360 - totalGap;
  let cursor = 0;
  return SLICES.map((slice) => {
    const raw = vals[slice.key as keyof typeof vals];
    const clamped = Math.max(0, raw);
    const frac = a.income > 0 ? clamped / a.income : 0;
    const sweep = available * frac;
    const startAngle = cursor + GAP_DEG / 2;
    const endAngle = startAngle + sweep;
    cursor += sweep + GAP_DEG;
    const mid = (startAngle + endAngle) / 2;
    return {
      key: slice.key,
      color: slice.color,
      label: slice.label,
      value: raw,
      frac,
      path: sweep > 0.1 ? wedgePath(CENTER, CENTER, ring.outer, ring.inner, startAngle, endAngle) : null,
      mid,
    };
  });
}

function BreakdownList({ items, total }: { items: BreakdownItem[]; total: number }) {
  if (items.length === 0) {
    return <p className="text-[9px] text-zinc-600 italic">Nessuna voce</p>;
  }
  const shown = items.slice(0, MAX_BREAKDOWN_ITEMS);
  const rest = items.length - shown.length;
  return (
    <ul className="space-y-0.5">
      {shown.map((it, i) => (
        <li key={i} className="flex justify-between gap-2 text-[9px]">
          <span className="text-zinc-400 truncate">{it.label}</span>
          <span className="text-zinc-300 font-semibold whitespace-nowrap">{formatCurrency(it.amount)}</span>
        </li>
      ))}
      {rest > 0 && <li className="text-[9px] text-zinc-600 italic">+{rest} altre voci</li>}
      {items.length > 1 && (
        <li className="flex justify-between gap-2 text-[9px] pt-0.5 border-t border-zinc-800/60">
          <span className="text-zinc-500 font-bold">Totale</span>
          <span className="text-zinc-300 font-bold">{formatCurrency(total)}</span>
        </li>
      )}
    </ul>
  );
}

export default function BudgetAllocationDonut({ previsto, reale }: BudgetAllocationDonutProps) {
  const [hoveredKey, setHoveredKey] = useState<SliceKey | null>(null);
  const [pinnedKey, setPinnedKey] = useState<SliceKey | null>(null);
  const activeKey = hoveredKey ?? pinnedKey;

  const outerSlices = ringSlices(previsto, OUTER_RING);
  const innerSlices = ringSlices(reale, INNER_RING);
  const previstoAmounts = amounts(previsto);
  const realeAmounts = amounts(reale);

  const toggle = (key: SliceKey) => setPinnedKey((prev) => (prev === key ? null : key));

  const activeSlice = SLICES.find((s) => s.key === activeKey) || null;
  const activeP = activeSlice ? previstoAmounts[activeSlice.key as keyof typeof previstoAmounts] : null;
  const activeR = activeSlice ? realeAmounts[activeSlice.key as keyof typeof realeAmounts] : null;

  return (
    <div className="flex flex-col lg:flex-row items-center lg:items-start gap-8">
      <div className="relative flex-shrink-0" style={{ width: SIZE, height: SIZE, maxWidth: "100%" }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" height="100%" role="img" aria-label="Allocazione Bisogni, Desideri, Imprevisti e Risparmio: anello esterno previsto, anello interno reale">
          <circle cx={CENTER} cy={CENTER} r={(OUTER_RING.outer + OUTER_RING.inner) / 2} fill="none" stroke="hsl(240 8% 20%)" strokeWidth={OUTER_RING.outer - OUTER_RING.inner} strokeOpacity={0.35} />
          <circle cx={CENTER} cy={CENTER} r={(INNER_RING.outer + INNER_RING.inner) / 2} fill="none" stroke="hsl(240 8% 20%)" strokeWidth={INNER_RING.outer - INNER_RING.inner} strokeOpacity={0.35} />
          {outerSlices.map((seg) => {
            if (!seg.path) return null;
            const isActive = activeKey === seg.key;
            const off = isActive ? popOffset(seg.mid, POP_DIST) : { dx: 0, dy: 0 };
            return (
              <path
                key={`o-${seg.key}`}
                d={seg.path}
                fill={seg.color}
                fillOpacity={activeKey && !isActive ? 0.35 : 1}
                className="cursor-pointer"
                style={{ transform: `translate(${off.dx}px, ${off.dy}px)`, transition: "transform 150ms ease, fill-opacity 150ms ease" }}
                onMouseEnter={() => setHoveredKey(seg.key)}
                onMouseLeave={() => setHoveredKey(null)}
                onClick={() => toggle(seg.key)}
              >
                <title>{`${seg.label} (previsto): ${formatCurrency(seg.value)}`}</title>
              </path>
            );
          })}
          {innerSlices.map((seg) => {
            if (!seg.path) return null;
            const isActive = activeKey === seg.key;
            const off = isActive ? popOffset(seg.mid, POP_DIST) : { dx: 0, dy: 0 };
            return (
              <path
                key={`i-${seg.key}`}
                d={seg.path}
                fill={seg.color}
                fillOpacity={activeKey && !isActive ? 0.35 : 1}
                className="cursor-pointer"
                style={{ transform: `translate(${off.dx}px, ${off.dy}px)`, transition: "transform 150ms ease, fill-opacity 150ms ease" }}
                onMouseEnter={() => setHoveredKey(seg.key)}
                onMouseLeave={() => setHoveredKey(null)}
                onClick={() => toggle(seg.key)}
              >
                <title>{`${seg.label} (reale): ${formatCurrency(seg.value)}`}</title>
              </path>
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-8">
          {activeSlice ? (
            <>
              <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: activeSlice.color }}>{activeSlice.label}</span>
              <span className="text-lg font-black text-white leading-tight mt-1">{formatCurrency(activeP ?? 0)}</span>
              <span className="text-[10px] text-zinc-500 leading-tight">previsto</span>
              <span className="text-base font-black text-emerald-400 leading-tight mt-1.5">{formatCurrency(activeR ?? 0)}</span>
              <span className="text-[10px] text-zinc-500 leading-tight">reale</span>
            </>
          ) : (
            <>
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Entrate</span>
              <span className="text-xl font-black text-white leading-tight mt-1">{formatCurrency(previsto.income)}</span>
              <span className="text-[10px] text-zinc-500 leading-tight">previsto</span>
              <span className="text-base font-black text-emerald-400 leading-tight mt-1.5">{formatCurrency(reale.income)}</span>
              <span className="text-[10px] text-zinc-500 leading-tight">reale</span>
            </>
          )}
        </div>
      </div>

      <div className="w-full lg:flex-1 space-y-2.5 min-w-0">
        <div className="flex items-center gap-4 text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border-2 border-zinc-500" />Esterno = Previsto</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-zinc-500" />Interno = Reale</span>
          <span className="text-zinc-600 normal-case tracking-normal font-semibold">Passa il mouse (o tocca) una fetta o una voce</span>
        </div>

        {SLICES.map((slice) => {
          const p = previstoAmounts[slice.key as keyof typeof previstoAmounts];
          const r = realeAmounts[slice.key as keyof typeof realeAmounts];
          const pPercent = previsto.income > 0 ? Math.round((p / previsto.income) * 100) : 0;
          const rPercent = reale.income > 0 ? Math.round((r / reale.income) * 100) : 0;
          const isActive = activeKey === slice.key;
          const previstoItems = slice.key !== "savings" ? previsto.breakdown?.[slice.key] || [] : [];
          const realeItems = slice.key !== "savings" ? reale.breakdown?.[slice.key] || [] : [];

          return (
            <div
              key={slice.key}
              className="rounded-xl border transition-colors cursor-pointer"
              style={{ borderColor: isActive ? `${slice.color}55` : "hsl(240 5% 18% / 0.5)", background: isActive ? `${slice.color}0d` : "transparent" }}
              onMouseEnter={() => setHoveredKey(slice.key)}
              onMouseLeave={() => setHoveredKey(null)}
              onClick={() => toggle(slice.key)}
            >
              <div className="flex items-center justify-between gap-2 text-[10px] px-3 py-2">
                <span className="flex items-center gap-1.5 font-bold text-zinc-300 flex-shrink-0">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: slice.color }} />
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

              {isActive && (
                <div className="px-3 pb-3 pt-1 border-t animate-fade-in" style={{ borderColor: `${slice.color}30` }}>
                  {slice.key === "savings" ? (
                    <p className="text-[9px] text-zinc-500 leading-relaxed">
                      Residuo: Entrate − Bisogni − Desideri − Imprevisti. Non e' una voce diretta, quindi non ha un elenco di spese.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Previsto</div>
                        <BreakdownList items={previstoItems} total={p} />
                      </div>
                      <div>
                        <div className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Reale</div>
                        <BreakdownList items={realeItems} total={r} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
