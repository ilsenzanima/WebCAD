"use client";

import { useState } from "react";

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  itemLabel?: string;
}

// Numeri di pagina da mostrare: prima, ultima e quelle vicine alla corrente; "gap" per i salti
export function pageWindow(page: number, totalPages: number): (number | "gap")[] {
  const wanted = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  if (page <= 3) { wanted.add(2); wanted.add(3); }
  if (page >= totalPages - 2) { wanted.add(totalPages - 1); wanted.add(totalPages - 2); }
  const pages = Array.from(wanted).filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  pages.forEach((n, i) => {
    if (i > 0 && n - pages[i - 1] > 1) out.push("gap");
    out.push(n);
  });
  return out;
}

const btnBase =
  "h-8 min-w-8 px-2 rounded-lg text-xs font-bold border border-white/10 text-zinc-300 transition-all hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent";

export default function PaginationControls({ page, totalPages, onPageChange, totalItems, itemLabel }: PaginationControlsProps) {
  const [inputValue, setInputValue] = useState("");

  if (totalPages <= 1) return null;

  const handleJump = () => {
    const n = parseInt(inputValue);
    if (!isNaN(n) && n >= 1 && n <= totalPages) onPageChange(n);
    setInputValue("");
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3 pt-6">
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <button type="button" className={btnBase} aria-label="Prima pagina" onClick={() => onPageChange(1)} disabled={page === 1}>«</button>
        <button type="button" className={btnBase} aria-label="Pagina precedente" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1}>‹</button>

        {pageWindow(page, totalPages).map((n, i) =>
          n === "gap" ? (
            <span key={`gap-${i}`} className="px-1 text-zinc-500">…</span>
          ) : (
            <button
              key={n}
              type="button"
              aria-current={n === page ? "page" : undefined}
              className={`${btnBase} ${n === page ? "bg-white/15 text-white border-white/30" : ""}`}
              onClick={() => onPageChange(n)}
            >
              {n}
            </button>
          )
        )}

        <button type="button" className={btnBase} aria-label="Pagina successiva" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}>›</button>
        <button type="button" className={btnBase} aria-label="Ultima pagina" onClick={() => onPageChange(totalPages)} disabled={page === totalPages}>»</button>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-zinc-400">
        <span>
          Pagina {page} di {totalPages}
          {totalItems !== undefined && <span className="text-zinc-500"> ({totalItems} {itemLabel ?? "elementi"})</span>}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-500">Vai a</span>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJump()}
            placeholder={String(page)}
            className="w-16 h-8 rounded-lg text-xs text-center text-white border focus:outline-none"
            style={{ background: "hsl(240 10% 4% / 0.6)", borderColor: "hsl(240 5% 15% / 0.8)" }}
          />
          <button type="button" className={btnBase} onClick={handleJump}>Vai</button>
        </div>
      </div>
    </div>
  );
}
