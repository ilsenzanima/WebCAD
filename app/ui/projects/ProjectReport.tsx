"use client";

import { useMemo } from "react";

type CutPiece1D = {
  id: string;
  label: string;
  length: number;
  color?: string;
};

type CutPiece2D = {
  id: string;
  label: string;
  width: number;
  height: number;
  x: number;
  y: number;
  color?: string;
};

type ProjectReportProps = {
  wastePercentage: number;
  pieces1D: CutPiece1D[];
  pieces2D: CutPiece2D[];
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export default function ProjectReport({ wastePercentage, pieces1D, pieces2D }: ProjectReportProps) {
  const normalizedWaste = clamp(wastePercentage, 0, 100);
  const ring = useMemo(() => {
    const radius = 58;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference - (normalizedWaste / 100) * circumference;

    return { radius, circumference, dashOffset };
  }, [normalizedWaste]);

  return (
    <section className="space-y-6">
      <style jsx>{`
        @keyframes pieceIn {
          from {
            opacity: 0;
            transform: translateY(14px) scale(0.96);
            filter: blur(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }

        @keyframes ringPulse {
          0%,
          100% {
            filter: drop-shadow(0 0 0 rgba(56, 189, 248, 0.35));
          }
          50% {
            filter: drop-shadow(0 0 10px rgba(56, 189, 248, 0.55));
          }
        }
      `}</style>

      <div className="grid gap-5 lg:grid-cols-3">
        <article className="rounded-3xl border border-white/30 bg-white/10 p-6 shadow-[0_20px_55px_-25px_rgba(15,23,42,0.85)] backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-100">Sfrido complessivo</h3>
            <span className="rounded-full border border-cyan-300/35 bg-cyan-400/10 px-2 py-1 text-xs font-medium text-cyan-100">
              KPI
            </span>
          </div>

          <div className="flex items-center justify-center">
            <svg
              viewBox="0 0 160 160"
              className="h-44 w-44"
              style={{ animation: "ringPulse 2.8s ease-in-out infinite" }}
              aria-label={`Sfrido ${normalizedWaste.toFixed(1)}%`}
            >
              <defs>
                <linearGradient id="wasteGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#22d3ee" />
                  <stop offset="100%" stopColor="#a78bfa" />
                </linearGradient>
              </defs>

              <circle cx="80" cy="80" r={ring.radius} fill="none" stroke="rgba(148, 163, 184, 0.22)" strokeWidth="14" />
              <circle
                cx="80"
                cy="80"
                r={ring.radius}
                fill="none"
                stroke="url(#wasteGradient)"
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={ring.circumference}
                strokeDashoffset={ring.dashOffset}
                transform="rotate(-90 80 80)"
              />
              <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" className="fill-slate-100 text-2xl font-bold">
                {normalizedWaste.toFixed(1)}%
              </text>
              <text x="50%" y="64%" dominantBaseline="middle" textAnchor="middle" className="fill-slate-300 text-[11px] tracking-[0.28em] uppercase">
                Waste
              </text>
            </svg>
          </div>
        </article>

        <article className="rounded-3xl border border-white/30 bg-white/10 p-6 shadow-[0_20px_55px_-25px_rgba(15,23,42,0.85)] backdrop-blur-xl lg:col-span-2">
          <h3 className="mb-4 text-lg font-semibold text-slate-100">Schema taglio 1D</h3>
          <div className="flex flex-wrap gap-2">
            {pieces1D.map((piece, index) => (
              <div
                key={piece.id}
                className="rounded-xl border border-white/20 px-3 py-2 text-sm text-slate-100"
                style={{
                  background: piece.color ?? "linear-gradient(120deg, rgba(34,211,238,0.22), rgba(167,139,250,0.2))",
                  animation: `pieceIn 420ms cubic-bezier(0.19, 1, 0.22, 1) ${index * 75}ms both`,
                }}
              >
                <div className="font-medium">{piece.label}</div>
                <div className="text-xs text-slate-200">{piece.length} mm</div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <article className="rounded-3xl border border-white/30 bg-white/10 p-6 shadow-[0_20px_55px_-25px_rgba(15,23,42,0.85)] backdrop-blur-xl">
        <h3 className="mb-4 text-lg font-semibold text-slate-100">Schema taglio 2D</h3>
        <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-slate-900/20 p-3">
          <div className="relative aspect-[16/9] w-full rounded-xl border border-dashed border-white/20 bg-slate-950/25">
            {pieces2D.map((piece, index) => (
              <div
                key={piece.id}
                className="absolute rounded-lg border border-white/20 p-1 text-[10px] text-white/90 shadow-lg"
                style={{
                  left: `${piece.x}%`,
                  top: `${piece.y}%`,
                  width: `${piece.width}%`,
                  height: `${piece.height}%`,
                  background: piece.color ?? "linear-gradient(145deg, rgba(56,189,248,0.35), rgba(59,130,246,0.28))",
                  animation: `pieceIn 480ms cubic-bezier(0.19, 1, 0.22, 1) ${index * 90}ms both`,
                }}
              >
                <div className="truncate font-semibold">{piece.label}</div>
              </div>
            ))}
          </div>
        </div>
      </article>
    </section>
  );
}
