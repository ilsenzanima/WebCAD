"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Project, ProjectMaterial, ProjectSketch, ProjectModel } from "@/lib/types/database";
import {
  updateProject,
  updateProjectStatus,
  updateProjectNotes,
  deleteProject,
  createProjectMaterial,
  updateProjectMaterial,
  deleteProjectMaterial,
  createProjectSketch,
  deleteProjectSketch,
  createProjectModel,
  deleteProjectModel,
} from "@/app/actions/projects";
import { formatCurrency, formatDate } from "@/lib/format";
import { DeleteIcon, EditIcon, ArrowLeftIcon, CheckIcon } from "./icons";
import RichTextEditor from "./RichTextEditor";
import SketchThumbnail from "./SketchThumbnail";

interface ProjectDetailClientProps {
  project: Project;
  initialMaterials: ProjectMaterial[];
  initialSketches: ProjectSketch[];
  initialModels: ProjectModel[];
}

const STATUS_OPTIONS: { value: Project["status"]; label: string; icon: string; badgeClass: string }[] = [
  { value: "bozza", label: "Bozza", icon: "📝", badgeClass: "bg-zinc-500/15 text-zinc-200 border-zinc-500/30" },
  { value: "in_corso", label: "In corso", icon: "🔧", badgeClass: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  { value: "finito", label: "Finito", icon: "✅", badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
];

const cardStyle = { background: "linear-gradient(135deg, hsla(240, 10%, 12%, 0.5), hsla(240, 10%, 10%, 0.8))", borderColor: "hsla(240, 5%, 18%, 0.7)" };

export default function ProjectDetailClient({ project: initialProject, initialMaterials, initialSketches, initialModels }: ProjectDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [project, setProject] = useState<Project>(initialProject);
  const [materials, setMaterials] = useState<ProjectMaterial[]>(initialMaterials);
  const [sketches, setSketches] = useState<ProjectSketch[]>(initialSketches);
  const [models, setModels] = useState<ProjectModel[]>(initialModels);
  const [activeTab, setActiveTab] = useState<"info" | "materials" | "sketch" | "model">("info");

  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(project.name);
  const [descDraft, setDescDraft] = useState(project.description || "");

  const currentStatus = STATUS_OPTIONS.find((s) => s.value === project.status) || STATUS_OPTIONS[0];

  const handleStartEdit = () => {
    setNameDraft(project.name);
    setDescDraft(project.description || "");
    setEditing(true);
  };

  const handleCancelEdit = () => setEditing(false);

  const handleSaveEdit = () => {
    if (!nameDraft.trim()) { alert("Il nome non può essere vuoto"); return; }
    startTransition(async () => {
      const res = await updateProject(project.id, { name: nameDraft.trim(), description: descDraft || null });
      if (!res.success || !res.data) { alert(res.error); return; }
      setProject(res.data as Project);
      setEditing(false);
    });
  };

  const handleSetStatus = (status: Project["status"]) => {
    if (status === project.status) return;
    const previous = project.status;
    setProject((p) => ({ ...p, status }));
    startTransition(async () => {
      const res = await updateProjectStatus(project.id, status);
      if (!res.success) { alert(res.error); setProject((p) => ({ ...p, status: previous })); }
    });
  };

  const handleSaveNotes = async (html: string) => {
    const res = await updateProjectNotes(project.id, html);
    if (!res.success) console.error(res.error);
  };

  const handleCreateSketch = () => {
    startTransition(async () => {
      const res = await createProjectSketch(project.id);
      if (!res.success || !res.data) { alert(res.error); return; }
      router.push(`/sketch/${(res.data as ProjectSketch).id}`);
    });
  };

  const handleDeleteSketch = (id: string) => {
    if (!confirm("Eliminare questo disegno?")) return;
    setSketches((prev) => prev.filter((s) => s.id !== id));
    startTransition(async () => {
      const res = await deleteProjectSketch(id);
      if (!res.success) alert(res.error);
    });
  };

  const handleCreateModel = () => {
    startTransition(async () => {
      const res = await createProjectModel(project.id);
      if (!res.success || !res.data) { alert(res.error); return; }
      router.push(`/model/${(res.data as ProjectModel).id}`);
    });
  };

  const handleDeleteModel = (id: string) => {
    if (!confirm("Eliminare questo modello?")) return;
    setModels((prev) => prev.filter((m) => m.id !== id));
    startTransition(async () => {
      const res = await deleteProjectModel(id);
      if (!res.success) alert(res.error);
    });
  };

  const handleDeleteProject = () => {
    if (!confirm("Eliminare questo progetto, le note e la lista materiali?")) return;
    startTransition(async () => {
      const res = await deleteProject(project.id);
      if (!res.success) { alert(res.error); return; }
      router.push("/dashboard/projects");
    });
  };

  const handleAddMaterial = () => {
    startTransition(async () => {
      const res = await createProjectMaterial(project.id, { name: "Nuovo materiale" });
      if (!res.success || !res.data) { alert(res.error); return; }
      setMaterials((prev) => [...prev, res.data as ProjectMaterial]);
    });
  };

  const handleUpdateMaterial = (id: string, fields: Partial<ProjectMaterial>) => {
    setMaterials((prev) => prev.map((m) => (m.id === id ? { ...m, ...fields } : m)));
    startTransition(async () => {
      const res = await updateProjectMaterial(id, fields as any);
      if (!res.success) alert(res.error);
    });
  };

  const handleDeleteMaterial = (id: string) => {
    if (!confirm("Eliminare questo materiale?")) return;
    setMaterials((prev) => prev.filter((m) => m.id !== id));
    startTransition(async () => {
      const res = await deleteProjectMaterial(id);
      if (!res.success) alert(res.error);
    });
  };

  const totalPrice = materials.reduce((sum, m) => sum + m.quantity * (m.unit_price ?? 0), 0);
  const provisionalPrice = materials.filter((m) => m.purchased).reduce((sum, m) => sum + m.quantity * (m.unit_price ?? 0), 0);

  // Fa crescere in altezza le celle testuali della tabella materiali (nome, note) invece di tagliare il testo su una riga.
  const autoGrow = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  const tabClass = (active: boolean) =>
    `px-4 py-2 rounded-xl text-xs font-bold transition-all ${active ? "bg-white/10 text-white shadow-lg" : "text-zinc-400 hover:text-white"}`;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
      <Link href="/dashboard/projects" className="inline-flex items-center gap-1.5 text-[11px] font-bold text-zinc-400 hover:text-white transition-all">
        <ArrowLeftIcon size={12} /> Progetti
      </Link>

      {/* Header */}
      <div className="animate-fade-in flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent truncate">
            📁 {project.name}
          </h1>
          <span className={`px-2 py-1 rounded-lg text-[10px] font-bold border flex-shrink-0 ${currentStatus.badgeClass}`}>
            {currentStatus.icon} {currentStatus.label}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {editing ? (
            <>
              <button onClick={handleSaveEdit} disabled={isPending}
                className="px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-500 transition-all">
                💾 Salva
              </button>
              <button onClick={handleCancelEdit}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 bg-zinc-800 hover:bg-zinc-700 transition-all">
                Annulla
              </button>
            </>
          ) : (
            <>
              <button onClick={handleStartEdit}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-all flex items-center gap-1.5">
                <EditIcon size={12} /> Modifica
              </button>
              <button onClick={handleDeleteProject}
                className="px-4 py-2 rounded-xl text-xs font-bold text-rose-300 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all flex items-center gap-1.5">
                <DeleteIcon size={12} /> Elimina
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-zinc-950/80 border border-white/10 rounded-2xl w-fit animate-fade-in">
        <button type="button" onClick={() => setActiveTab("info")} className={tabClass(activeTab === "info")}>
          ℹ️ Info
        </button>
        <button type="button" onClick={() => setActiveTab("materials")} className={tabClass(activeTab === "materials")}>
          🧾 Lista materiali
        </button>
        <button type="button" onClick={() => setActiveTab("sketch")} className={tabClass(activeTab === "sketch")}>
          🎨 Disegno
        </button>
        <button type="button" onClick={() => setActiveTab("model")} className={tabClass(activeTab === "model")}>
          🧊 Modello 3D
        </button>
      </div>

      {/* Tab Info */}
      {activeTab === "info" && (
        <div className="space-y-6 animate-fade-in">
          {/* Stato progetto */}
          <div className="rounded-2xl p-5 border shadow-2xl backdrop-blur-xl" style={cardStyle}>
            <h3 className="text-sm font-extrabold text-white mb-3">Stato del progetto</h3>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSetStatus(opt.value)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                    project.status === opt.value ? opt.badgeClass : "text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:text-white"
                  }`}
                >
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Informazioni */}
          <div className="rounded-2xl p-5 border shadow-2xl backdrop-blur-xl space-y-3" style={cardStyle}>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Nome</label>
              {editing ? (
                <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg text-xs text-white border border-zinc-800 bg-zinc-950/80" />
              ) : (
                <p className="text-sm text-white font-semibold">{project.name}</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Descrizione</label>
              {editing ? (
                <textarea value={descDraft} onChange={(e) => setDescDraft(e.target.value)} rows={4}
                  className="w-full px-3 py-2.5 rounded-lg text-xs text-white border border-zinc-800 bg-zinc-950/80 resize-none" />
              ) : (
                <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">{project.description || "Nessuna descrizione."}</p>
              )}
            </div>
          </div>

          {/* Note */}
          <div className="rounded-2xl p-5 border shadow-2xl backdrop-blur-xl space-y-3" style={cardStyle}>
            <h3 className="text-sm font-extrabold text-white">📝 Note</h3>
            <RichTextEditor initialHtml={project.notes_html || ""} onSave={handleSaveNotes} />
          </div>
        </div>
      )}

      {/* Tab Lista materiali */}
      {activeTab === "materials" && (
        <div className="rounded-2xl border shadow-2xl backdrop-blur-xl animate-fade-in overflow-hidden" style={cardStyle}>
          <div className="flex items-center justify-between p-5 pb-3">
            <h3 className="text-sm font-extrabold text-white">🧾 Lista materiali</h3>
            <button type="button" onClick={handleAddMaterial}
              className="px-3 py-2 rounded-lg text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-all">
              ＋ Aggiungi materiale
            </button>
          </div>

          <div className="overflow-x-auto px-5">
            <table className="w-full text-xs border-collapse min-w-[880px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
                  <th className="py-2 pr-2 w-8">✓</th>
                  <th className="py-2 pr-2">Materiale</th>
                  <th className="py-2 pr-2 w-24">Quantità</th>
                  <th className="py-2 pr-2 w-28">Prezzo unit.</th>
                  <th className="py-2 pr-2 w-24">Totale</th>
                  <th className="py-2 pr-2 w-44">Link utile</th>
                  <th className="py-2 pr-2">Note</th>
                  <th className="py-2 pl-2 w-8" />
                </tr>
              </thead>
              <tbody>
                {materials.map((m) => {
                  const rowTotal = m.quantity * (m.unit_price ?? 0);
                  return (
                    <tr key={m.id} className="border-b border-zinc-800/60">
                      <td className="py-1.5 pr-2 align-top">
                        <button
                          type="button"
                          onClick={() => handleUpdateMaterial(m.id, { purchased: !m.purchased })}
                          className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                            m.purchased ? "bg-emerald-500 border-emerald-500" : "border-zinc-700"
                          }`}
                          title="Acquistato"
                        >
                          {m.purchased && <CheckIcon size={11} className="text-white" />}
                        </button>
                      </td>
                      <td className="py-1.5 pr-2 align-top">
                        <textarea
                          rows={1}
                          defaultValue={m.name}
                          ref={autoGrow}
                          onInput={(e) => autoGrow(e.currentTarget)}
                          onBlur={(e) => handleUpdateMaterial(m.id, { name: e.target.value })}
                          className={`w-full px-2 py-1.5 rounded-lg text-xs text-white border border-transparent hover:border-zinc-800 focus:border-zinc-600 bg-transparent focus:bg-zinc-950/80 transition-all resize-none overflow-hidden break-words ${
                            m.purchased ? "line-through text-zinc-500" : ""
                          }`}
                        />
                      </td>
                      <td className="py-1.5 pr-2 align-top">
                        <input
                          type="number" step="0.01" min="0"
                          defaultValue={m.quantity}
                          onBlur={(e) => handleUpdateMaterial(m.id, { quantity: e.target.value === "" ? 1 : Number(e.target.value) })}
                          className="w-full px-2 py-1.5 rounded-lg text-xs text-white border border-transparent hover:border-zinc-800 focus:border-zinc-600 bg-transparent focus:bg-zinc-950/80 transition-all"
                        />
                      </td>
                      <td className="py-1.5 pr-2 align-top">
                        <input
                          type="number" step="0.01" min="0" placeholder="€"
                          defaultValue={m.unit_price ?? ""}
                          onBlur={(e) => handleUpdateMaterial(m.id, { unit_price: e.target.value === "" ? null : Number(e.target.value) })}
                          className="w-full px-2 py-1.5 rounded-lg text-xs text-white border border-transparent hover:border-zinc-800 focus:border-zinc-600 bg-transparent focus:bg-zinc-950/80 transition-all"
                        />
                      </td>
                      <td className="py-1.5 pr-2 align-top text-zinc-300 font-semibold whitespace-nowrap">{formatCurrency(rowTotal)}</td>
                      <td className="py-1.5 pr-2 align-top">
                        <div className="flex items-start gap-1">
                          <input
                            defaultValue={m.link ?? ""}
                            placeholder="https://…"
                            onBlur={(e) => handleUpdateMaterial(m.id, { link: e.target.value })}
                            className="w-full px-2 py-1.5 rounded-lg text-xs text-white border border-transparent hover:border-zinc-800 focus:border-zinc-600 bg-transparent focus:bg-zinc-950/80 transition-all"
                          />
                          {m.link && (
                            <a href={m.link} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-indigo-300 flex-shrink-0 px-0.5 py-1.5" title="Apri link">
                              🔗
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="py-1.5 pr-2 align-top">
                        <textarea
                          rows={1}
                          defaultValue={m.notes ?? ""}
                          ref={autoGrow}
                          onInput={(e) => autoGrow(e.currentTarget)}
                          onBlur={(e) => handleUpdateMaterial(m.id, { notes: e.target.value })}
                          className="w-full px-2 py-1.5 rounded-lg text-xs text-white border border-transparent hover:border-zinc-800 focus:border-zinc-600 bg-transparent focus:bg-zinc-950/80 transition-all resize-none overflow-hidden break-words"
                        />
                      </td>
                      <td className="py-1.5 pl-2 align-top">
                        <button type="button" onClick={() => handleDeleteMaterial(m.id)} className="p-1.5 rounded text-slate-500 hover:text-rose-400 transition-all" title="Elimina materiale">
                          <DeleteIcon size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {materials.length === 0 && <p className="text-[11px] text-zinc-500 py-4">Nessun materiale ancora aggiunto.</p>}
          </div>

          {/* Riepilogo */}
          <div className="flex flex-col sm:flex-row gap-3 border-t border-zinc-800 p-5 mt-2">
            <div className="flex-1 p-3 rounded-xl border border-zinc-800/80 bg-zinc-950/40">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Prezzo totale</span>
              <span className="text-lg font-black text-white">{formatCurrency(totalPrice)}</span>
            </div>
            <div className="flex-1 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
              <span className="text-[9px] font-bold text-emerald-400/80 uppercase tracking-widest block">Prezzo provvisorio (già acquistato)</span>
              <span className="text-lg font-black text-emerald-300">{formatCurrency(provisionalPrice)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab Disegno */}
      {activeTab === "sketch" && (
        <div className="rounded-2xl p-5 border shadow-2xl backdrop-blur-xl animate-fade-in space-y-4" style={cardStyle}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-white">🎨 Disegni</h3>
            <button type="button" onClick={handleCreateSketch} disabled={isPending}
              className="px-3 py-2 rounded-lg text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-all">
              ＋ Nuovo disegno
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sketches.map((s) => (
              <div key={s.id} className="relative group">
                <Link href={`/sketch/${s.id}`}
                  className="block rounded-xl border border-zinc-800/80 bg-zinc-950/40 overflow-hidden hover:border-zinc-600 transition-all">
                  <SketchThumbnail strokes={s.strokes} />
                  <div className="p-2.5">
                    <div className="text-xs font-bold text-white truncate flex items-center gap-1">
                      {s.name}
                      {s.drive_link && <span title="Salvato su Drive">☁️</span>}
                    </div>
                    <div className="text-[10px] text-zinc-500">{formatDate(s.updated_at)}</div>
                  </div>
                </Link>
                <button
                  onClick={(e) => { e.preventDefault(); handleDeleteSketch(s.id); }}
                  className="absolute top-2 right-2 p-1 rounded text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-950/80"
                  title="Elimina disegno"
                >
                  <DeleteIcon size={12} />
                </button>
              </div>
            ))}
          </div>
          {sketches.length === 0 && <p className="text-[11px] text-zinc-500">Nessun disegno ancora aggiunto.</p>}
        </div>
      )}

      {/* Tab Modello 3D */}
      {activeTab === "model" && (
        <div className="rounded-2xl p-5 border shadow-2xl backdrop-blur-xl animate-fade-in space-y-4" style={cardStyle}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-white">🧊 Modelli 3D</h3>
              <p className="text-[10px] text-zinc-500 mt-0.5">La modellazione CAD è disponibile solo da PC.</p>
            </div>
            <button type="button" onClick={handleCreateModel} disabled={isPending}
              className="px-3 py-2 rounded-lg text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-all">
              ＋ Nuovo modello
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {models.map((m) => (
              <div key={m.id} className="relative group">
                <Link href={`/model/${m.id}`}
                  className="block rounded-xl border border-zinc-800/80 bg-zinc-950/40 overflow-hidden hover:border-zinc-600 transition-all">
                  {m.thumbnail ? (
                    <img src={m.thumbnail} alt={m.name} className="w-full aspect-[4/3] object-cover bg-zinc-900" />
                  ) : (
                    <div className="w-full aspect-[4/3] flex items-center justify-center text-3xl bg-zinc-900">🧊</div>
                  )}
                  <div className="p-2.5">
                    <div className="text-xs font-bold text-white truncate flex items-center gap-1">
                      {m.name}
                      {m.drive_link && <span title="Salvato su Drive">☁️</span>}
                    </div>
                    <div className="text-[10px] text-zinc-500">{formatDate(m.updated_at)}</div>
                  </div>
                </Link>
                <button
                  onClick={(e) => { e.preventDefault(); handleDeleteModel(m.id); }}
                  className="absolute top-2 right-2 p-1 rounded text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-950/80"
                  title="Elimina modello"
                >
                  <DeleteIcon size={12} />
                </button>
              </div>
            ))}
          </div>
          {models.length === 0 && <p className="text-[11px] text-zinc-500">Nessun modello ancora aggiunto.</p>}
        </div>
      )}
    </div>
  );
}
