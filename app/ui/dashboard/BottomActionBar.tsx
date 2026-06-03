"use client";

interface BottomActionBarProps {
  onNote: () => void;
  onPhoto?: () => void;
  onCalc?: () => void;
}

export default function BottomActionBar({ onNote, onPhoto, onCalc }: BottomActionBarProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        padding: "10px 12px",
        paddingBottom: "calc(10px + env(safe-area-inset-bottom))",
        background: "hsl(220 32% 10%)",
        borderTop: "1px solid hsl(220 20% 22%)",
        flexShrink: 0,
      }}
    >
      {/* + Appunto — pulsante primario */}
      <button
        onClick={onNote}
        style={{
          flex: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 3,
          padding: "10px 0",
          borderRadius: 14,
          border: "none",
          background: "hsl(220 90% 56%)",
          color: "#fff",
          cursor: "pointer",
          fontSize: 14,
          minHeight: 52,
        }}
      >
        <span style={{ fontSize: 22, lineHeight: 1, fontWeight: 300 }}>+</span>
        <span style={{ fontSize: 11, fontWeight: 700 }}>Appunto</span>
      </button>

      {/* Pulsanti secondari */}
      {[
        { icon: "📷", label: "Foto", fn: onPhoto },
        { icon: "🧮", label: "Calc", fn: onCalc },
      ].map((b) => (
        <button
          key={b.label}
          onClick={b.fn}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 3,
            padding: "10px 0",
            borderRadius: 14,
            border: "none",
            background: "hsl(220 22% 18%)",
            color: "hsl(215 20% 65%)",
            cursor: "pointer",
            minHeight: 52,
          }}
        >
          <span style={{ fontSize: 18 }}>{b.icon}</span>
          <span style={{ fontSize: 11, fontWeight: 700 }}>{b.label}</span>
        </button>
      ))}
    </div>
  );
}
