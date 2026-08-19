"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ProjectModel, CascadeMeshData } from "@/lib/types/database";
import type { CascadeEngine } from "cascade-core";
import { updateProjectModel, renameProjectModel, deleteProjectModel, saveProjectModelToDrive } from "@/app/actions/projects";
import ModelViewer3D, { type ModelViewer3DHandle } from "./ModelViewer3D";
import { ArrowLeftIcon, DeleteIcon } from "./icons";
import { isNativeApp } from "@/lib/nativeUpdater";

interface ModelEditorClientProps {
  model: ProjectModel;
}

// Editor CAD 3D a tutta pagina (motore cascade-core/OpenCascade, ~21MB di
// WASM): disponibile solo da PC/browser desktop. Da telefono si vede solo
// l'ultima anteprima salvata, senza caricare il motore.
export default function ModelEditorClient({ model: initialModel }: ModelEditorClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const viewerRef = useRef<ModelViewer3DHandle>(null);
  const engineRef = useRef<CascadeEngine | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [model, setModel] = useState<ProjectModel>(initialModel);
  const [nameDraft, setNameDraft] = useState(initialModel.name);
  const [code, setCode] = useState(initialModel.code);
  const [meshData, setMeshData] = useState<CascadeMeshData | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [engineStatus, setEngineStatus] = useState<"loading" | "ready" | "running" | "error">("loading");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [driveStatus, setDriveStatus] = useState<"idle" | "saving" | "error">("idle");
  const [readOnly, setReadOnly] = useState(true);

  useEffect(() => {
    setReadOnly(isNativeApp() || window.innerWidth < 768);
  }, []);

  const appendLog = (line: string) => setLogs((prev) => [...prev.slice(-49), line]);

  // Carica il motore CAD (Worker + WASM) solo da PC: e' pesante, non ha senso caricarlo da telefono.
  useEffect(() => {
    if (readOnly) return;
    let cancelled = false;

    (async () => {
      const { CascadeEngine } = await import("cascade-core");
      const engine = new CascadeEngine({ workerUrl: "/cad/cascade-worker.js" });
      engineRef.current = engine;

      engine.on("error", (payload: any) => appendLog(`❌ ${typeof payload === "string" ? payload : payload?.message || JSON.stringify(payload)}`));
      engine.on("log", (payload: any) => appendLog(typeof payload === "string" ? payload : JSON.stringify(payload)));

      try {
        await engine.init();
        if (cancelled) return;
        setEngineStatus("ready");
        void handleRun(engine);
      } catch (err: any) {
        if (!cancelled) { setEngineStatus("error"); appendLog(`❌ Impossibile avviare il motore CAD: ${err.message}`); }
      }
    })();

    return () => {
      cancelled = true;
      engineRef.current?.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly]);

  const persistModel = (fields: { code?: string; thumbnail?: string | null }) => {
    startTransition(async () => {
      const res = await updateProjectModel(model.id, fields);
      if (!res.success) console.error(res.error);
    });
  };

  const scheduleSaveCode = (nextCode: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus("saving");
    saveTimer.current = setTimeout(() => {
      persistModel({ code: nextCode });
      setSaveStatus("saved");
    }, 800);
  };

  const handleCodeChange = (value: string) => {
    setCode(value);
    scheduleSaveCode(value);
  };

  const handleRun = async (engineOverride?: CascadeEngine) => {
    const engine = engineOverride || engineRef.current;
    if (!engine) return;

    setEngineStatus("running");
    setLogs([]);
    try {
      const result = await engine.evaluate(code);
      setMeshData(result.meshData);
      setEngineStatus("ready");

      // Cattura l'anteprima un istante dopo che il viewer ha ridisegnato la nuova mesh.
      setTimeout(() => {
        const thumbnail = viewerRef.current?.captureThumbnail() ?? null;
        if (thumbnail) setModel((m) => ({ ...m, thumbnail }));
        persistModel({ code, thumbnail });
      }, 150);
    } catch (err: any) {
      setEngineStatus("error");
      appendLog(`❌ ${err?.message || "Errore durante l'esecuzione del codice"}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      void handleRun();
    }
  };

  const handleRenameBlur = () => {
    const trimmed = nameDraft.trim() || "Modello senza titolo";
    setNameDraft(trimmed);
    if (trimmed === model.name) return;
    setModel((m) => ({ ...m, name: trimmed }));
    startTransition(async () => {
      const res = await renameProjectModel(model.id, trimmed);
      if (!res.success) alert(res.error);
    });
  };

  const handleDelete = () => {
    if (!confirm("Eliminare questo modello?")) return;
    startTransition(async () => {
      const res = await deleteProjectModel(model.id);
      if (!res.success) { alert(res.error); return; }
      router.push(`/dashboard/projects/${model.project_id}`);
    });
  };

  const handleSaveToDrive = () => {
    const engine = engineRef.current;
    if (!engine || !meshData) { alert("Esegui il modello prima di salvarlo su Drive"); return; }

    setDriveStatus("saving");
    startTransition(async () => {
      try {
        const stepText: string = await engine.exportSTEP();
        const blob = new Blob([stepText], { type: "application/step" });
        const fd = new FormData();
        fd.append("file", blob, `${model.name || "modello"}.step`);

        const res = await saveProjectModelToDrive(model.id, fd);
        if (!res.success) { setDriveStatus("error"); alert(res.error); return; }

        setModel((m) => ({ ...m, drive_link: res.data?.driveLink ?? m.drive_link, drive_file_id: res.data?.driveFileId ?? m.drive_file_id }));
        setDriveStatus("idle");
      } catch (err: any) {
        setDriveStatus("error");
        alert(err?.message || "Errore durante l'esportazione STEP");
      }
    });
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(240 10% 4%), hsl(240 10% 8%))" }}>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800/70 flex-shrink-0">
        <Link href={`/dashboard/projects/${model.project_id}`}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold text-zinc-400 hover:text-white transition-all flex-shrink-0">
          <ArrowLeftIcon size={12} /> Progetto
        </Link>
        <input
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={handleRenameBlur}
          disabled={readOnly}
          className="flex-1 min-w-0 bg-transparent text-sm font-extrabold text-white px-2 py-1.5 rounded-lg border border-transparent hover:border-zinc-800 focus:border-zinc-600 focus:bg-zinc-950/60 transition-all outline-none disabled:opacity-70"
        />
        {model.drive_link && (
          <a href={model.drive_link} target="_blank" rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-sky-300 hover:text-sky-200 transition-all flex-shrink-0">
            ☁️ Apri su Drive
          </a>
        )}
        <button onClick={handleDelete} disabled={isPending}
          className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-rose-300 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all flex-shrink-0 flex items-center gap-1.5">
          <DeleteIcon size={12} /> Elimina
        </button>
      </div>

      {readOnly ? (
        <div className="flex-1 overflow-auto p-3 md:p-5 flex items-center justify-center">
          <div className="max-w-sm text-center space-y-4">
            {model.thumbnail ? (
              <img src={model.thumbnail} alt={model.name} className="rounded-xl border border-zinc-800 w-full" />
            ) : (
              <div className="text-5xl">🧊</div>
            )}
            <p className="text-[11px] text-zinc-500">
              👁️ La modellazione 3D è disponibile solo da PC. Da telefono qui vedi solo l'ultima anteprima salvata.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Editor codice */}
          <div className="w-full lg:w-[420px] flex-shrink-0 flex flex-col border-b lg:border-b-0 lg:border-r border-zinc-800/70 min-h-[240px] lg:min-h-0">
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-zinc-800/70 flex-shrink-0">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Codice CAD</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-500">
                  {saveStatus === "saving" ? "Salvataggio…" : saveStatus === "saved" ? "Salvato ✓" : ""}
                </span>
                <button type="button" onClick={() => handleRun()} disabled={engineStatus === "loading" || engineStatus === "running"}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-extrabold text-white bg-indigo-600 hover:bg-indigo-500 transition-all disabled:opacity-50">
                  {engineStatus === "loading" ? "⏳ Avvio motore…" : engineStatus === "running" ? "⏳ Esecuzione…" : "▶ Esegui"}
                </button>
              </div>
            </div>
            <textarea
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              className="flex-1 w-full resize-none bg-zinc-950/60 text-zinc-100 text-xs font-mono leading-relaxed p-3 outline-none"
              placeholder="let box = Box(20, 20, 20);"
            />
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-zinc-800/70 flex-shrink-0">
              <span className="text-[9px] text-zinc-600">Ctrl/Cmd + Invio per eseguire</span>
              <button type="button" onClick={handleSaveToDrive} disabled={driveStatus === "saving" || !meshData}
                className="px-2.5 h-7 rounded-lg text-[10px] font-bold text-sky-300 hover:bg-sky-500/10 transition-all disabled:opacity-40 flex items-center gap-1">
                {driveStatus === "saving" ? "☁️ Salvataggio…" : "☁️ Salva su Drive (STEP)"}
              </button>
            </div>
            {logs.length > 0 && (
              <div className="max-h-32 overflow-y-auto border-t border-zinc-800/70 px-3 py-2 space-y-0.5 flex-shrink-0">
                {logs.map((line, i) => (
                  <p key={i} className="text-[10px] font-mono text-rose-300 break-words">{line}</p>
                ))}
              </div>
            )}
          </div>

          {/* Viewer 3D */}
          <div className="flex-1 min-h-[300px]">
            <ModelViewer3D ref={viewerRef} meshData={meshData} />
          </div>
        </div>
      )}
    </div>
  );
}
