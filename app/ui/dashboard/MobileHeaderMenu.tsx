"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";

interface MobileHeaderMenuProps {
  initials: string;
  userName?: string;
  userEmail?: string;
}

export default function MobileHeaderMenu({ initials, userName, userEmail }: MobileHeaderMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const navItems = [
    { href: "/dashboard", icon: "📊", label: "Panoramica" },
    { href: "/dashboard/expenses", icon: "💸", label: "Spese" },
    { href: "/dashboard/schedules", icon: "📅", label: "Pagamenti" },
    { href: "/dashboard/settings", icon: "⚙️", label: "Impostazioni" },
  ];

  return (
    <>
      {/* ── Header Mobile ── */}
      <header
        className="md:hidden flex items-center justify-between px-3 flex-shrink-0 relative z-40"
        style={{
          height: 52,
          background: "hsl(220 32% 10%)",
          borderBottom: "1px solid hsl(220 20% 22%)",
        }}
      >
        {/* Hamburger */}
        <button
          onClick={() => setIsOpen(true)}
          style={{
            width: 44,
            height: 44,
            border: "none",
            background: "transparent",
            color: "hsl(210 40% 96%)",
            fontSize: 20,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
          aria-label="Apri menu"
        >
          ☰
        </button>

        {/* Logo centrato */}
        <div className="flex items-center gap-2 select-none">
          <span className="text-xl leading-none">💰</span>
          <span className="text-white font-extrabold text-sm tracking-wide">Finanza Privata</span>
        </div>

        {/* Profilo */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
          style={{ background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))" }}
        >
          {initials}
        </div>
      </header>

      {/* ── Menu Drawer Mobile ── */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden animate-fade-in">
          {/* Overlay di sfondo */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setIsOpen(false)}
          />

          {/* Pannello menu */}
          <div
            className="relative flex flex-col w-4/5 max-w-sm h-full p-6 shadow-2xl animate-slide-left"
            style={{
              background: "hsl(220 32% 10%)",
              borderRight: "1px solid hsl(220 20% 16%)",
            }}
          >
            {/* Header Drawer */}
            <div className="flex justify-between items-center pb-5 mb-5 border-b" style={{ borderColor: "hsl(220 20% 16%)" }}>
              <div className="flex items-center gap-2">
                <span className="text-xl leading-none">💰</span>
                <span className="text-white font-bold text-base">Finanza Privata</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white transition-colors"
                style={{ background: "hsl(220 20% 16%)" }}
              >
                ✕
              </button>
            </div>

            {/* Navigazione */}
            <nav className="flex-1 space-y-1">
              {navItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl font-medium transition-all duration-150 text-sm"
                    style={{
                      background: active ? "hsla(220, 90%, 56%, 0.12)" : "transparent",
                      color: active ? "hsl(220 90% 56%)" : "hsl(215 20% 65%)",
                    }}
                  >
                    <span className="text-base w-5 text-center">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Profilo & Logout a fondo pagina */}
            <div className="pt-4 border-t space-y-4" style={{ borderColor: "hsl(220 20% 16%)" }}>
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))" }}
                >
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-white text-xs font-semibold truncate">{userName || "Utente"}</div>
                  <div className="text-[10px] truncate" style={{ color: "hsl(215 15% 45%)" }}>{userEmail || ""}</div>
                </div>
              </div>
              
              <LogoutButton
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-medium transition-colors hover:text-white"
                style={{
                  background: "hsl(220 26% 14%)",
                  color: "hsl(0 80% 65%)",
                  border: "1px solid hsl(220 20% 20%)",
                }}
              >
                Esci dall'account
              </LogoutButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
