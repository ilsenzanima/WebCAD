"use client";

import Link from "next/link";

interface ReportHeaderProps {
  projectName: string;
  projectId: string;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  hasNesting: boolean;
  hasOutOfPlumb: boolean;
}

export default function ReportHeader({
  projectName,
  projectId,
  activeTab,
  setActiveTab,
  hasNesting,
  hasOutOfPlumb,
}: ReportHeaderProps) {
  const tabs = [
    { id: "overview", label: "📋 Panoramica", enabled: true },
    { id: "nesting", label: "✂️ Nesting di Taglio", enabled: hasNesting },
    { id: "outOfPlumb", label: "📐 Rilievi Fuori Bolla", enabled: hasOutOfPlumb },
    { id: "notes", label: "📝 Appunti Cantiere", enabled: true },
  ];

  return (
    <div className="w-full space-y-6">
      {/* Navbar Interattiva (Nascosta in Stampa) */}
      <div
        className="flex items-center justify-between pb-4 border-b print:hidden"
        style={{ borderColor: "hsl(220 20% 16%)" }}
      >
        <div className="flex items-center gap-3">
          <Link
            href={`/projects/${projectId}`}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-white transition-colors"
          >
            ← Torna al Progetto
          </Link>
          <span className="text-gray-400">/</span>
          <span className="text-sm font-semibold text-gray-300">Report & Rilievi di Cantiere</span>
        </div>

        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-colors shadow-lg cursor-pointer"
        >
          🖨️ Stampa Report / Salva PDF
        </button>
      </div>

      {/* Intestazione Stampabile e Web */}
      <div
        className="p-6 sm:p-8 rounded-3xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-6 print:border-none print:p-0 print:bg-transparent"
        style={{
          background: "hsl(220 26% 12% / 0.4)",
          borderColor: "hsl(220 20% 20%)",
        }}
      >
        <div>
          <span className="text-xs uppercase font-bold text-orange-400 tracking-wider">Report Tecnico Ufficiale</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1 print:text-black">
            {projectName || "Caricamento..."}
          </h1>
          <p className="text-xs text-gray-400 mt-2 print:text-gray-600">
            ID Cantiere: {projectId} | Generato il: {new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })}
          </p>
        </div>

        <div className="text-left md:text-right text-xs text-gray-400 print:text-gray-600">
          <p className="font-semibold text-white print:text-black">WebCAD Antincendio Premium</p>
          <p className="mt-1">Rilievi di Precisione & Ottimizzazione Taglio</p>
          <p className="mt-1">Calcoli conformi a standard commerciali Europei</p>
        </div>
      </div>

      {/* Selettore Schede (Tabs) - Nascosto in Stampa */}
      <div className="flex flex-wrap gap-1.5 p-1 bg-white/5 rounded-2xl border border-white/5 print:hidden">
        {tabs
          .filter((tab) => tab.enabled)
          .map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  active
                    ? "bg-white text-black shadow-md"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
      </div>
    </div>
  );
}
