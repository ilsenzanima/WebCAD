"use client";

import { useActionState } from "react";
import Link from "next/link";
import { register, type AuthFormState } from "@/app/actions/auth";

export default function RegisterPage() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    register,
    undefined
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-white">Crea il tuo account</h1>
        <p style={{ color: "hsl(215 20% 65%)" }} className="text-sm">
          Inizia a progettare con WebCAD Antincendio
        </p>
      </div>

      {/* Messaggio errore globale */}
      {state?.message && (
        <div
          className="flex items-start gap-3 rounded-xl p-4 text-sm animate-fade-in"
          style={{
            background: "hsl(0 84% 60% / 0.12)",
            border: "1px solid hsl(0 84% 60% / 0.3)",
            color: "hsl(0 84% 75%)",
          }}
          role="alert"
        >
          <span className="mt-0.5">⚠️</span>
          <span>{state.message}</span>
        </div>
      )}

      {/* Form */}
      <form action={action} className="space-y-5">
        {/* Nome completo */}
        <div className="space-y-1.5">
          <label
            htmlFor="full_name"
            className="block text-sm font-medium"
            style={{ color: "hsl(215 20% 75%)" }}
          >
            Nome e Cognome
          </label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            autoComplete="name"
            placeholder="Mario Rossi"
            required
            className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-[hsl(215_15%_40%)] transition-all duration-200"
            style={{
              background: "hsl(220 26% 14%)",
              border: `1px solid ${state?.errors?.full_name ? "hsl(0 84% 60% / 0.5)" : "hsl(220 20% 22%)"}`,
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "hsl(220 90% 56% / 0.7)";
              e.currentTarget.style.boxShadow = "0 0 0 3px hsl(220 90% 56% / 0.12)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = state?.errors?.full_name
                ? "hsl(0 84% 60% / 0.5)"
                : "hsl(220 20% 22%)";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
          {state?.errors?.full_name && (
            <p className="text-xs" style={{ color: "hsl(0 84% 70%)" }}>
              {state.errors.full_name[0]}
            </p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="block text-sm font-medium"
            style={{ color: "hsl(215 20% 75%)" }}
          >
            Email professionale
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="nome@azienda.it"
            required
            className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-[hsl(215_15%_40%)] transition-all duration-200"
            style={{
              background: "hsl(220 26% 14%)",
              border: `1px solid ${state?.errors?.email ? "hsl(0 84% 60% / 0.5)" : "hsl(220 20% 22%)"}`,
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "hsl(220 90% 56% / 0.7)";
              e.currentTarget.style.boxShadow = "0 0 0 3px hsl(220 90% 56% / 0.12)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = state?.errors?.email
                ? "hsl(0 84% 60% / 0.5)"
                : "hsl(220 20% 22%)";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
          {state?.errors?.email && (
            <p className="text-xs" style={{ color: "hsl(0 84% 70%)" }}>
              {state.errors.email[0]}
            </p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label
            htmlFor="password"
            className="block text-sm font-medium"
            style={{ color: "hsl(215 20% 75%)" }}
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="Min. 8 caratteri"
            required
            className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-[hsl(215_15%_40%)] transition-all duration-200"
            style={{
              background: "hsl(220 26% 14%)",
              border: `1px solid ${state?.errors?.password ? "hsl(0 84% 60% / 0.5)" : "hsl(220 20% 22%)"}`,
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "hsl(220 90% 56% / 0.7)";
              e.currentTarget.style.boxShadow = "0 0 0 3px hsl(220 90% 56% / 0.12)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = state?.errors?.password
                ? "hsl(0 84% 60% / 0.5)"
                : "hsl(220 20% 22%)";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
          {state?.errors?.password && (
            <ul className="text-xs space-y-0.5" style={{ color: "hsl(0 84% 70%)" }}>
              {state.errors.password.map((err) => (
                <li key={err}>· {err}</li>
              ))}
            </ul>
          )}
          {/* Requisiti password */}
          {!state?.errors?.password && (
            <p className="text-xs" style={{ color: "hsl(215 15% 45%)" }}>
              Min. 8 caratteri, 1 maiuscola, 1 numero
            </p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          id="btn-register"
          disabled={pending}
          className="w-full py-3 px-4 rounded-xl font-semibold text-sm text-white transition-all duration-200"
          style={{
            background: pending
              ? "hsl(16 80% 45%)"
              : "linear-gradient(135deg, hsl(16 100% 58%), hsl(0 84% 50%))",
            boxShadow: pending ? "none" : "0 4px 20px hsl(16 100% 58% / 0.35)",
            cursor: pending ? "not-allowed" : "pointer",
          }}
        >
          {pending ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Registrazione…
            </span>
          ) : (
            "Crea account"
          )}
        </button>

        {/* Privacy note */}
        <p className="text-xs text-center" style={{ color: "hsl(215 15% 45%)" }}>
          Creando un account accetti i nostri{" "}
          <Link href="#" style={{ color: "hsl(220 90% 65%)" }}>Termini di servizio</Link>
          {" "}e la{" "}
          <Link href="#" style={{ color: "hsl(220 90% 65%)" }}>Privacy Policy</Link>.
        </p>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-px" style={{ background: "hsl(220 20% 22%)" }} />
        <span className="text-xs" style={{ color: "hsl(215 15% 45%)" }}>Hai già un account?</span>
        <div className="flex-1 h-px" style={{ background: "hsl(220 20% 22%)" }} />
      </div>

      <Link
        href="/login"
        id="link-login"
        className="flex items-center justify-center w-full py-3 px-4 rounded-xl text-sm font-medium transition-all duration-200"
        style={{
          border: "1px solid hsl(220 20% 22%)",
          color: "hsl(215 20% 65%)",
        }}
      >
        Accedi →
      </Link>
    </div>
  );
}
