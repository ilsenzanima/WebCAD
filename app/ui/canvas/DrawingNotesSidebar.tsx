"use client";

import { useState, useEffect, useRef } from "react";
import { getLevelNoteText, updateLevelNoteText } from "@/app/actions/field-notes";

interface Props {
  levelId: string;
  isOpen: boolean;
  onClose: () => void;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function DrawingNotesSidebar({ levelId, isOpen, onClose }: Props) {
  const [notes, setNotes] = useState("");
  const lastSavedRef = useRef("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const debouncedNotes = useDebounce(notes, 1000);

  useEffect(() => {
    let mounted = true;
    const loadNotes = async () => {
      const text = await getLevelNoteText(levelId);
      if (!mounted) return;
      setNotes(text);
      lastSavedRef.current = text;
      setSaveStatus("idle");
    };
    loadNotes();
    return () => {
      mounted = false;
    };
  }, [levelId]);

  useEffect(() => {
    if (debouncedNotes === lastSavedRef.current) return;

    const save = async () => {
      setSaveStatus("saving");
      const res = await updateLevelNoteText(levelId, debouncedNotes);
      if (res.success) {
        lastSavedRef.current = debouncedNotes;
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } else {
        setSaveStatus("error");
      }
    };

    save();
  }, [debouncedNotes, levelId]);

  return (
    <div className={`fixed top-0 right-0 h-full w-full sm:w-[400px] z-50 transition-transform duration-300 transform shadow-2xl flex flex-col ${
      isOpen ? "translate-x-0" : "translate-x-full"
    }`} style={{ background: "hsl(220 26% 12%)", borderLeft: "1px solid hsl(220 20% 20%)" }}>
      <div className="p-4 flex items-center justify-between border-b" style={{ borderColor: "hsl(220 20% 20%)" }}>
        <div className="flex items-center gap-2"><span className="text-lg">📋</span><h3 className="font-bold text-white text-sm uppercase tracking-wider">Appunti Livello</h3></div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5 cursor-pointer text-sm">✕ Chiudi</button>
      </div>
      <div className="px-4 py-2 text-xs flex justify-between items-center" style={{ background: "hsl(220 32% 10%)", borderBottom: "1px solid hsl(220 20% 20%)", color: "hsl(215 15% 45%)" }}>
        <span>Sincronizzato con Cloud</span>
        <div>
          {saveStatus === "saving" && <span className="text-yellow-500 animate-pulse">Salvataggio...</span>}
          {saveStatus === "saved" && <span className="text-green-400">Salvato ✓</span>}
          {saveStatus === "error" && <span className="text-red-500">Errore di salvataggio!</span>}
          {saveStatus === "idle" && <span className="opacity-60">Modifiche salvate automaticamente</span>}
        </div>
      </div>
      <div className="flex-1 p-4 flex flex-col h-full overflow-hidden">
        <textarea value={notes} onChange={(e) => { setNotes(e.target.value); if (saveStatus !== "saving") setSaveStatus("idle"); }} placeholder="Scrivi appunti per questo livello, misure rilevate da mobile, specifiche di installazione..." className="w-full flex-1 bg-transparent border-0 outline-none resize-none text-sm leading-relaxed" style={{ color: "hsl(210 40% 90%)" }} />
      </div>
    </div>
  );
}
