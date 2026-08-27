"use client";

import { useState } from "react";
import { CAD_SNIPPET_CATEGORIES } from "@/lib/cadSnippets";

interface CadSnippetsPanelProps {
  onInsert: (code: string) => void;
  onClose: () => void;
}

export default function CadSnippetsPanel({ onInsert, onClose }: CadSnippetsPanelProps) {
  const [copiedName, setCopiedName] = useState<string | null>(null);

  const handleCopy = async (name: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedName(name);
      setTimeout(() => setCopiedName((prev) => (prev === name ? null : prev)), 1500);
    } catch {
      // Clipboard non disponibile: nessun problema, resta il pulsante "Inserisci".
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 animate-fade-in" onClick={onClose}>
      <div
        className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border shadow-2xl backdrop-blur-xl animate-fade-in"
        style={{ background: "linear-gradient(135deg, hsla(245, 60%, 15%, 0.1), hsla(240, 10%, 10%, 0.97))", borderColor: "hsla(245, 60%, 50%, 0.15)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/70 flex-shrink-0">
          <div>
            <h2 className="text-sm font-extrabold text-white">📚 Guida comandi CAD</h2>
            <p className="text-[10px] text-zinc-500 mt-0.5">Clicca "➕ Inserisci" per aggiungerlo al codice, o copialo e incollalo dove vuoi.</p>
          </div>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-white text-lg leading-none" aria-label="Chiudi">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {CAD_SNIPPET_CATEGORIES.map((category) => (
            <div key={category.title} className="space-y-2.5">
              <h3 className="text-xs font-extrabold text-white">{category.title}</h3>
              <div className="space-y-2">
                {category.snippets.map((snippet) => (
                  <div key={snippet.name} className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-white">{snippet.name}</div>
                        <div className="text-[10px] text-zinc-500">{snippet.description}</div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button type="button" onClick={() => handleCopy(snippet.name, snippet.code)}
                          className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-zinc-300 border border-zinc-800 hover:border-zinc-600 hover:text-white transition-all">
                          {copiedName === snippet.name ? "✓ Copiato" : "📋 Copia"}
                        </button>
                        <button type="button" onClick={() => onInsert(snippet.code)}
                          className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-all">
                          ➕ Inserisci
                        </button>
                      </div>
                    </div>
                    <pre className="text-[10px] font-mono text-zinc-300 whitespace-pre-wrap break-words bg-zinc-950/60 rounded-lg p-2 overflow-x-auto">{snippet.code}</pre>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
