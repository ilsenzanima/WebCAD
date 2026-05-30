"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";
import CalcolatriceWidget from "./CalcolatriceWidget";

interface MobileHeaderMenuProps {
  initials: string;
}

export default function MobileHeaderMenu({ initials }: MobileHeaderMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCalc, setShowCalc] = useState(false);
  const pathname = usePathname();

  const menuItems = [
    { href: "/projects", icon: "📐", label: "Note di Cantiere" },
    { href: "/sketches", icon: "🎨", label: "Sketch" },
    { href: "/settings", icon: "⚙️", label: "Impostazioni" },
  ];

  return (
    <>
      {/* Testata Mobile Interattiva */}
      <header
        className="md:hidden flex items-center justify-between px-4 py-3 flex-shrink-0 relative z-40"
        style={{
          background: "hsl(220 32% 10%)",
          borderBottom: "1px solid hsl(220 20% 16%)",
        }}
      >
        {/* Logo Cliccabile */}
        <div
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2.5 cursor-pointer active:scale-95 transition-all select-none animate-pulse-subtle"
        >
          <div
            className="w-8.5 h-8.5 rounded-xl flex items-center justify-center text-base shadow-md shadow-orange-500/10"
            style={{ background: "linear-gradient(135deg, hsl(16 100% 58%), hsl(0 84% 60%))" }}
          >
            🔥
          </div>
          <div className="flex flex-col">
            <span className="text-white font-extrabold text-sm tracking-wide flex items-center gap-1">
              WebCAD <span className="text-[9px] bg-orange-500/20 border border-orange-500/30 text-orange-400 px-1.5 py-0.5 rounded-full font-bold">MENU</span>
            </span>
            <span className="text-[9px] text-white/40 leading-none -mt-0.5">Tocca per il menu</span>
          </div>
        </div>

        {/* Badge Profilo */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-lg"
          style={{ background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))" }}
        >
          {initials}
        </div>
      </header>

      {/* Menu a comparsa dal basso (Mobile Bottom Sheet) */}
      {isOpen && (
        <div className="fixed inset-0 z-[2000] md:hidden">
          {/* Sfondo Oscurato con Blur */}
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity duration-300 animate-fade-in"
            onClick={() => setIsOpen(false)}
          />

          {/* Pannello Bottom Sheet */}
          <aside
            className="absolute bottom-0 left-0 right-0 rounded-t-3xl flex flex-col p-6 pb-10 space-y-6 shadow-2xl animate-slide-up"
            style={{
              background: "hsl(220 35% 8% / 0.98)",
              backdropFilter: "blur(20px)",
              borderTop: "1px solid hsl(220 20% 16%)",
            }}
          >
            {/* Barretta decorativa per trascinamento */}
            <div className="w-12 h-1 bg-white/10 rounded-full mx-auto -mt-2 mb-2" />

            {/* Header del Menu */}
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-base"
                  style={{ background: "linear-gradient(135deg, hsl(16 100% 58%), hsl(0 84% 60%))" }}
                >
                  🔥
                </div>
                <div className="flex flex-col">
                  <span className="text-white font-extrabold text-sm uppercase tracking-wider">WebCAD Menu</span>
                  <span className="text-[9px] text-white/40 leading-none">Strumenti e Navigazione</span>
                </div>
              </div>
              
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 bg-white/5 border border-white/10 hover:text-white transition-all active:scale-90"
              >
                ✕
              </button>
            </div>

            {/* Griglia di Navigazione Premium (Control Center Style) */}
            <div className="grid grid-cols-2 gap-3.5">
              {menuItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className="flex flex-col items-center justify-center p-4 rounded-2xl border text-center transition-all active:scale-95"
                    style={{
                      background: isActive ? "hsl(220 90% 56% / 0.15)" : "hsl(220 26% 12%)",
                      borderColor: isActive ? "hsl(220 90% 56% / 0.4)" : "hsl(220 20% 18%)",
                    }}
                  >
                    <span className="text-2xl mb-2 block">{item.icon}</span>
                    <span className={`text-xs font-bold ${isActive ? "text-white" : "text-white/70"}`}>
                      {item.label}
                    </span>
                  </Link>
                );
              })}

              {/* Pulsante Calcolatrice nella Griglia */}
              <button
                onClick={() => {
                  setIsOpen(false);
                  setShowCalc(true);
                }}
                className="flex flex-col items-center justify-center p-4 rounded-2xl border text-center transition-all active:scale-95 cursor-pointer"
                style={{
                  background: "hsl(220 26% 12%)",
                  borderColor: "hsl(220 20% 18%)",
                }}
              >
                <span className="text-2xl mb-2 block">🧮</span>
                <span className="text-xs font-bold text-white/70">
                  Calcolatrice
                </span>
              </button>
            </div>

            {/* Pulsante Esci in fondo */}
            <div className="border-t border-white/5 pt-4">
              <LogoutButton
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-xs font-bold transition-all bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 active:scale-95 cursor-pointer"
              >
                ↩ Esci dall'account
              </LogoutButton>
            </div>
          </aside>
        </div>
      )}

      {/* Calcolatrice Globale Mobile */}
      <CalcolatriceWidget
        isOpen={showCalc}
        onClose={() => setShowCalc(false)}
        showImportButton={false}
      />
    </>
  );
}
