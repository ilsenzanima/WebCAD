"use client";

import { useState } from "react";
import LogoutButton from "./LogoutButton";

export default function MobileMenu() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all"
        style={{ color: "hsl(215 20% 55%)" }}
      >
        <span className="text-xl leading-none">☰</span>
        <span className="text-[10px] font-medium leading-none">Menu</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <div
            className="relative w-full rounded-t-3xl p-6 pb-12 animate-slide-up"
            style={{
              background: "hsl(220 32% 10%)",
              borderTop: "1px solid hsl(220 20% 16%)",
            }}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-white font-bold text-lg">Menu</h2>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white bg-white/10"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-2">
              <LogoutButton
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: "hsl(220 26% 14%)",
                  color: "hsl(0 80% 65%)",
                  border: "1px solid hsl(220 20% 20%)",
                }}
              >
                <span className="text-xl leading-none">↩</span>
                <span>Esci dall'account</span>
              </LogoutButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}