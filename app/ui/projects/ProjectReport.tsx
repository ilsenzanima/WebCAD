"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { getWalls, get3DBox } from "@/app/actions/projects";
import { getAllProjectFieldNotes } from "@/app/actions/field-notes";
import type { FieldNote } from "@/app/actions/field-notes";

// Import dei componenti modulari del report
import ReportHeader from "./report/ReportHeader";
import ReportOverview from "./report/ReportOverview";
import ReportNesting from "./report/ReportNesting";
import ReportFieldNotes from "./report/ReportFieldNotes";
import ReportOutOfPlumb from "./report/ReportOutOfPlumb";

interface Props {
  projectId: string;
}

export default function ProjectReport({ projectId }: Props) {
  const [isPending, startTransition] = useTransition();
  const [projectData, setProjectData] = useState<any>(null);
  
  // Dati geometrici
  const [allWalls, setAllWalls] = useState<any[]>([]);
  const [all3DBoxes, setAll3DBoxes] = useState<any[]>([]);
  
  // Appunti e note di cantiere
  const [allNotes, setAllNotes] = useState<FieldNote[]>([]);
  const [allLevels, setAllLevels] = useState<any[]>([]);

  // Stati per la navigazione e visualizzazione
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [activeLightboxUrl, setActiveLightboxUrl] = useState<string | null>(null);

  // Caricamento dei dati del cantiere
  useEffect(() => {
    if (!projectId) return;

    const loadData = async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      // 1. Carica info progetto
      const { data: proj } = (await supabase
        .from("projects")
        .select("id, name, notes, created_at, updated_at")
        .eq("id", projectId)
        .single()) as any;
      if (proj) setProjectData(proj);

      // 2. Carica tutti gli appunti e note del cantiere
      const notesList = await getAllProjectFieldNotes(projectId);
      setAllNotes(notesList);

      // 3. Carica tutti i disegni (levels)
      const { data: levels } = (await supabase
        .from("levels")
        .select("id, name, drawing_type, piano")
        .eq("project_id", projectId)) as any;

      if (levels && levels.length > 0) {
        setAllLevels(levels);
        const loadedWalls: any[] = [];
        const loaded3D: any[] = [];

        for (const lvl of levels) {
          if (lvl.drawing_type === "3d_box") {
            const box = await get3DBox(lvl.id);
            if (box) loaded3D.push({ ...box, levelName: lvl.name });
          } else {
            const walls = await getWalls(lvl.id);
            if (walls && walls.length > 0) {
              loadedWalls.push(...walls.map((w: any) => ({ ...w, levelName: lvl.name })));
            }
          }
        }
        setAllWalls(loadedWalls);
        setAll3DBoxes(loaded3D);
      }
    };

    loadData();
  }, [projectId]);

  // Controlli per l'abilitazione delle tab
  const hasPiecesInNotes = allNotes.some((note) =>
    (note.field_note_items ?? []).some((item) => item.item_type === "dim_quadrata")
  );
  const hasNesting = allWalls.length > 0 || hasPiecesInNotes;
  
  // Un appunto è considerato un rilievo fuori bolla se contiene i parametri di inclinazione o la marcatura della livella
  const hasOutOfPlumb = allNotes.some((note) => {
    return (note.field_note_items ?? []).some(
      (item) =>
        item.item_type === "nota" &&
        (item.value_text?.includes("📐 Livella a Bolla") ||
          item.value_text?.includes("Beta =") ||
          item.value_text?.includes("Gamma ="))
    );
  });

  // Statistiche per il riepilogo
  const totalNotes = allNotes.length;
  const completedNotesCount = allNotes.filter((n) => n.completed).length;

  return (
    <div className="min-h-screen bg-[hsl(228_39%_6%)] text-white p-4 sm:p-8 w-full overflow-y-auto print:bg-white print:text-black print:p-0">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Intestazione e Controlli del Report */}
        <ReportHeader
          projectName={projectData?.name ?? "Caricamento cantiere..."}
          projectId={projectId}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          hasNesting={hasNesting}
          hasOutOfPlumb={hasOutOfPlumb}
        />

        {/* ── SEZIONE 1: WEB TABS (Visualizzazione a schede sullo schermo) ── */}
        <div className="w-full space-y-6 print:hidden">
          {activeTab === "overview" && (
            <ReportOverview
              projectNotes={projectData?.notes}
              totalLevels={allLevels.length}
              totalNotes={totalNotes}
              completedNotesCount={completedNotesCount}
            />
          )}

          {activeTab === "nesting" && hasNesting && (
            <ReportNesting allWalls={allWalls} all3DBoxes={all3DBoxes} notes={allNotes} />
          )}

          {activeTab === "outOfPlumb" && hasOutOfPlumb && (
            <ReportOutOfPlumb
              notes={allNotes}
              levels={allLevels}
              onImageClick={setActiveLightboxUrl}
            />
          )}

          {activeTab === "notes" && (
            <ReportFieldNotes
              notes={allNotes}
              levels={allLevels}
              onImageClick={setActiveLightboxUrl}
            />
          )}
        </div>

        {/* ── SEZIONE 2: STAMPA SEQUENZIALE CONTINUA (Attivata solo da window.print()) ── */}
        <div className="hidden print:block space-y-12 w-full">
          {/* A. Panoramica del Progetto */}
          <div className="break-inside-avoid">
            <ReportOverview
              projectNotes={projectData?.notes}
              totalLevels={allLevels.length}
              totalNotes={totalNotes}
              completedNotesCount={completedNotesCount}
            />
          </div>

          {/* B. Nesting Ottimizzazione di Taglio */}
          {hasNesting && (
            <div className="break-inside-avoid pt-8 border-t border-gray-200">
              <ReportNesting allWalls={allWalls} all3DBoxes={all3DBoxes} notes={allNotes} />
            </div>
          )}

          {/* C. Rilievi Fuori Bolla */}
          {hasOutOfPlumb && (
            <div className="break-inside-avoid pt-8 border-t border-gray-200">
              <ReportOutOfPlumb
                notes={allNotes}
                levels={allLevels}
                onImageClick={setActiveLightboxUrl}
              />
            </div>
          )}

          {/* D. Registro Appunti di Cantiere */}
          <div className="break-inside-avoid pt-8 border-t border-gray-200">
            <ReportFieldNotes
              notes={allNotes}
              levels={allLevels}
              onImageClick={setActiveLightboxUrl}
            />
          </div>
        </div>

      </div>

      {/* Modale Lightbox Premium per ingrandire gli snapshot */}
      {activeLightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md cursor-pointer animate-fade-in print:hidden"
          onClick={() => setActiveLightboxUrl(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] p-4 flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeLightboxUrl}
              alt="Dettaglio rilievo"
              className="max-w-full max-h-[80vh] object-contain rounded-2xl border border-white/10 shadow-2xl"
            />
            <button
              onClick={() => setActiveLightboxUrl(null)}
              className="absolute top-6 right-6 text-white text-3xl font-light hover:scale-110 transition-transform bg-white/5 hover:bg-white/10 px-4 py-2 rounded-full cursor-pointer"
            >
              ×
            </button>
            <p className="text-white/60 text-xs mt-4">Fai clic in un punto qualsiasi per chiudere</p>
          </div>
        </div>
      )}
    </div>
  );
}
