"use client";

import { useEffect, useState } from "react";

type SaveToastProps = {
  message: string;
};

export default function SaveToast({ message }: SaveToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setVisible(false);
    }, 3500);

    return () => window.clearTimeout(timeoutId);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed right-6 top-6 z-50 animate-fade-in">
      <div
        className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg"
        style={{
          background: "linear-gradient(135deg, hsl(142 70% 35%), hsl(160 84% 30%))",
          border: "1px solid hsl(160 60% 45%)",
        }}
      >
        <span aria-hidden="true">✅</span>
        <span>{message}</span>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="ml-2 rounded-md px-2 py-0.5 text-xs"
          style={{ background: "hsl(0 0% 100% / 0.15)" }}
          aria-label="Chiudi notifica"
        >
          Chiudi
        </button>
      </div>
    </div>
  );
}
