"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface RichTextEditorProps {
  initialHtml: string;
  onSave: (html: string) => Promise<void>;
}

// Editor "in stile Word" leggero: usa contentEditable + execCommand per
// grassetto/corsivo/sottolineato/barrato/colore, senza dipendenze esterne.
// Non e' controllato da React (l'HTML si aggiorna solo al mount) per non
// far saltare il cursore ad ogni digitazione.
export default function RichTextEditor({ initialHtml, onSave }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = initialHtml || "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scheduleSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setStatus("saving");
    debounceRef.current = setTimeout(async () => {
      const html = editorRef.current?.innerHTML || "";
      await onSave(html);
      setStatus("saved");
    }, 900);
  }, [onSave]);

  const exec = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    scheduleSave();
  };

  const toolbarBtn = "w-7 h-7 rounded-lg text-xs font-bold text-zinc-300 hover:bg-white/10 hover:text-white transition-all flex items-center justify-center";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 flex-wrap p-1.5 rounded-xl border border-zinc-800 bg-zinc-950/60">
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")} className={toolbarBtn} title="Grassetto">B</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("italic")} className={`${toolbarBtn} italic`} title="Corsivo">I</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("underline")} className={`${toolbarBtn} underline`} title="Sottolineato">U</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("strikeThrough")} className={`${toolbarBtn} line-through`} title="Barrato">S</button>
        <div className="w-px h-5 bg-zinc-800 mx-1" />
        <label className="relative w-7 h-7 rounded-lg flex items-center justify-center text-zinc-300 hover:bg-white/10 hover:text-white transition-all cursor-pointer" title="Colore testo">
          🎨
          <input
            type="color"
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => exec("foreColor", e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </label>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("removeFormat")} className="px-2 h-7 rounded-lg text-[10px] font-bold text-zinc-400 hover:bg-white/10 hover:text-white transition-all" title="Rimuovi formattazione">
          Pulisci
        </button>
        <span className="ml-auto text-[10px] text-zinc-500 pr-1">
          {status === "saving" ? "Salvataggio…" : status === "saved" ? "Salvato ✓" : ""}
        </span>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={scheduleSave}
        data-placeholder="Scrivi liberamente le tue note su questo progetto…"
        className="rich-text-editor w-full min-h-[420px] px-4 py-3 rounded-xl text-xs text-zinc-100 border border-zinc-800 bg-zinc-950/80 leading-relaxed focus:outline-none focus:border-zinc-600"
      />
    </div>
  );
}
