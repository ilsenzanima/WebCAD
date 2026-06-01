"use client";

interface ReportOverviewProps {
  projectNotes: string | null;
  totalLevels: number;
  totalNotes: number;
  completedNotesCount: number;
}

export default function ReportOverview({
  projectNotes,
  totalLevels,
  totalNotes,
  completedNotesCount,
}: ReportOverviewProps) {
  const completionPercentage = totalNotes > 0 ? Math.round((completedNotesCount / totalNotes) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Griglia Metriche / Statistiche */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Piani / Livelli */}
        <div
          className="p-5 rounded-3xl border bg-white/5 border-white/5 print:border-gray-200 print:text-black"
          style={{ background: "hsl(220 26% 12% / 0.2)" }}
        >
          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Disegni & Piani</span>
          <div className="text-3xl font-extrabold text-blue-400 mt-1">
            {totalLevels} <span className="text-sm font-medium text-white print:text-black">Livelli</span>
          </div>
          <p className="text-xs text-gray-400 mt-2 print:text-gray-600">
            Piani 2D estrusione e cavedi 3D mappati
          </p>
        </div>

        {/* Appunti Totali */}
        <div
          className="p-5 rounded-3xl border bg-white/5 border-white/5 print:border-gray-200 print:text-black"
          style={{ background: "hsl(220 26% 12% / 0.2)" }}
        >
          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Note & Rilievi Totali</span>
          <div className="text-3xl font-extrabold text-orange-400 mt-1">
            {totalNotes} <span className="text-sm font-medium text-white print:text-black">Appunti</span>
          </div>
          <p className="text-xs text-gray-400 mt-2 print:text-gray-600">
            Foto, misure e rilevamenti effettuati sul campo
          </p>
        </div>

        {/* Avanzamento Cantiere */}
        <div
          className="p-5 rounded-3xl border bg-white/5 border-white/5 print:border-gray-200 print:text-black"
          style={{ background: "hsl(220 26% 12% / 0.2)" }}
        >
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Avanzamento Cantiere</span>
              <div className="text-3xl font-extrabold text-emerald-400 mt-1">
                {completionPercentage}%
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/10 print:text-emerald-600">
              {completedNotesCount} / {totalNotes} OK
            </span>
          </div>

          {/* Barra di avanzamento grafica */}
          <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden mt-3.5 border border-white/5 print:border-gray-300">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Note Generali in Calce al Progetto */}
      {projectNotes && projectNotes.trim() !== "" && (
        <div
          className="p-6 rounded-3xl border print:border-none print:p-0"
          style={{
            background: "hsl(220 26% 12% / 0.2)",
            borderColor: "hsl(220 20% 16%)",
          }}
        >
          <h3 className="text-xs font-bold uppercase tracking-wider text-orange-400 mb-3 print:text-black print:font-bold">
            📋 Note & Disposizioni Generali di Cantiere
          </h3>
          <p className="text-sm leading-relaxed text-gray-300 whitespace-pre-wrap print:text-gray-800">
            {projectNotes}
          </p>
        </div>
      )}
    </div>
  );
}
