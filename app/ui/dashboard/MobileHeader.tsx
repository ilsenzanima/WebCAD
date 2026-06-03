"use client";

import { useRouter } from "next/navigation";

interface MobileHeaderProps {
  title: string;
  onMenu?: () => void;
  onBack?: () => void;
  right?: React.ReactNode;
}

export default function MobileHeader({ title, onMenu, onBack, right }: MobileHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: 52,
        padding: "0 12px 0 6px",
        flexShrink: 0,
        background: "hsl(220 32% 10%)",
        borderBottom: "1px solid hsl(220 20% 22%)",
        position: "sticky",
        top: 0,
        zIndex: 40,
      }}
    >
      {/* Slot sinistro: hamburger se root, freccia se sub-screen */}
      {onBack !== undefined ? (
        <button
          onClick={handleBack}
          style={{
            width: 44,
            height: 44,
            border: "none",
            background: "transparent",
            color: "hsl(220 90% 56%)",
            fontSize: 28,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            paddingLeft: 6,
            flexShrink: 0,
          }}
          aria-label="Torna indietro"
        >
          ‹
        </button>
      ) : (
        <button
          onClick={onMenu}
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
      )}

      {/* Titolo centrato */}
      <span
        style={{
          flex: 1,
          fontSize: 16,
          fontWeight: 700,
          color: "hsl(210 40% 96%)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          padding: "0 8px",
        }}
      >
        {title}
      </span>

      {/* Slot destro via prop */}
      {right}
    </div>
  );
}
