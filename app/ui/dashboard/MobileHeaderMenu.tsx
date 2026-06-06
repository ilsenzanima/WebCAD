"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";
import CalcolatriceWidget from "./CalcolatriceWidget";
import GlobalBollaTrigger from "./GlobalBollaTrigger";
import OfflineModeToggle from "./OfflineModeToggle";
import { APP_VERSION } from "@/lib/version";
import NotificationBell from "./NotificationBell";

interface MobileHeaderMenuProps {
  initials: string;
  userName?: string;
  userEmail?: string;
}

export default function MobileHeaderMenu({ initials, userName, userEmail }: MobileHeaderMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCalc, setShowCalc] = useState(false);
  const pathname = usePathname();
  const [localVersion, setLocalVersion] = useState(APP_VERSION);

  useEffect(() => {
    const getVersion = async () => {
      if (typeof window !== "undefined" && (window as any).Capacitor?.isNativePlatform()) {
        try {
          const { App } = await import("@capacitor/app");
          const info = await App.getInfo();
          if (info && info.version) {
            setLocalVersion(info.version);
          }
        } catch (err) {
          console.warn("Impossibile recuperare versione nativa in menu:", err);
        }
      }
    };
    getVersion();
  }, []);

  const navItems = [
    { href: "/projects", icon: "📐", label: "Progetti" },
    { href: "/settings", icon: "⚙️", label: "Impostazioni" },
  ];

  const tools = [
    { icon: "🧮", label: "Calcolatrice", action: () => { setIsOpen(false); setShowCalc(true); } },
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
          <img src="/logo.svg" alt="WebCAD" className="w-6 h-6 object-contain" />
          <span className="text-white font-extrabold text-sm tracking-wide">WebCAD</span>
        </div>

        {/* Sezione destra (Campana Notifiche + Profilo) */}
        <div className="flex items-center gap-3">
          <NotificationBell mode="mobile" />
          <div
            className="w-9 h-9 rounded-2xl flex items-center justify-center text-xs font-extrabold text-white flex-shrink-0"
            style={{ background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))" }}
          >
            {initials}
          </div>
        </div>
      </header>

      {/* ── Sidebar Slide-in ── */}
      {isOpen && (
        <div className="fixed inset-0 z-[2000] md:hidden flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(5px)" }}
            onClick={() => setIsOpen(false)}
          />

          {/* Pannello sidebar */}
          <aside
            className="relative flex flex-col animate-slide-in-left"
            style={{
              width: 272,
              height: "100%",
              background: "hsl(220 32% 10%)",
              borderRight: "1px solid hsl(220 20% 22%)",
              boxShadow: "8px 0 48px rgba(0,0,0,0.6)",
            }}
          >
            {/* Safe area spacer */}
            <div style={{ height: "env(safe-area-inset-top, 44px)", flexShrink: 0 }} />

            {/* Profilo */}
            <div
              style={{
                padding: "18px 20px 20px",
                borderBottom: "1px solid hsl(220 20% 22%)",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 16,
                  background: "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  fontWeight: 800,
                  color: "#fff",
                  marginBottom: 12,
                }}
              >
                {initials}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "hsl(210 40% 96%)" }}>
                {userName || "Utente"}
              </div>
              <div style={{ fontSize: 12, color: "hsl(215 20% 65%)", marginTop: 2 }}>
                {userEmail || ""}
              </div>
            </div>

            {/* Nav */}
            <nav
              style={{
                flex: 1,
                padding: 12,
                display: "flex",
                flexDirection: "column",
                gap: 4,
                overflowY: "auto",
              }}
            >
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "hsl(220 15% 35%)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  padding: "4px 10px 8px",
                }}
              >
                Menu
              </p>
              {navItems.map((item) => {
                const active = pathname === item.href || pathname?.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "13px 14px",
                      borderRadius: 14,
                      textDecoration: "none",
                      background: active ? "hsla(220,90%,56%,0.12)" : "transparent",
                      color: active ? "hsl(220 90% 56%)" : "hsl(215 20% 65%)",
                    }}
                  >
                    <span style={{ fontSize: 18, width: 22, textAlign: "center" }}>{item.icon}</span>
                    <span style={{ fontSize: 15, fontWeight: active ? 700 : 500 }}>{item.label}</span>
                  </Link>
                );
              })}

              <p
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "hsl(220 15% 35%)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  padding: "12px 10px 8px",
                }}
              >
                Strumenti
              </p>
              {tools.map((t) => (
                <button
                  key={t.label}
                  onClick={t.action}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "13px 14px",
                    borderRadius: 14,
                    border: "none",
                    background: "transparent",
                    color: "hsl(215 20% 65%)",
                    cursor: "pointer",
                    width: "100%",
                  }}
                >
                  <span style={{ fontSize: 18, width: 22, textAlign: "center" }}>{t.icon}</span>
                  <span style={{ fontSize: 15, fontWeight: 500 }}>{t.label}</span>
                </button>
              ))}
              <div onClick={() => setIsOpen(false)} style={{ paddingLeft: 2 }}>
                <GlobalBollaTrigger mode="mobile" />
              </div>
              <Link
                href="/sync"
                onClick={() => setIsOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "13px 14px",
                  borderRadius: 14,
                  textDecoration: "none",
                  color: pathname === "/sync" ? "hsl(220 90% 56%)" : "hsl(215 20% 65%)",
                  background: pathname === "/sync" ? "hsla(220,90%,56%,0.12)" : "transparent",
                }}
              >
                <span style={{ fontSize: 18, width: 22, textAlign: "center", fontWeight: "bold" }}>⇅</span>
                <span style={{ fontSize: 15, fontWeight: pathname === "/sync" ? 700 : 500 }}>Sincronizzazione</span>
              </Link>
            </nav>

            {/* Switch offline manuale */}
            <div className="border-t border-[hsl(220,20%,22%)] pt-2 flex-shrink-0">
              <OfflineModeToggle />
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "14px 20px 20px",
                borderTop: "1px solid hsl(220 20% 22%)",
                flexShrink: 0,
              }}
            >
              <LogoutButton
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 0",
                  border: "none",
                  background: "transparent",
                  color: "hsl(0 84% 60%)",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                  width: "100%",
                }}
              >
                Disconnetti
              </LogoutButton>
              <div
                style={{
                  fontSize: 10,
                  color: "hsl(220 15% 35%)",
                  marginTop: 8,
                  fontFamily: "monospace",
                }}
              >
                WebCAD v{localVersion}
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Calcolatrice Globale */}
      <CalcolatriceWidget
        isOpen={showCalc}
        onClose={() => setShowCalc(false)}
        showImportButton={false}
      />
    </>
  );
}
