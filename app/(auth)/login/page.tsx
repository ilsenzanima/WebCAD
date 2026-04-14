"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login, type AuthFormState } from "@/app/actions/auth";

export default function LoginPage() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    login,
    undefined
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-white">Bentornato</h1>
        <p style={{ color: "hsl(215 20% 65%)" }} className="text-sm">
          Accedi al tuo account WebCAD
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
        {/* Email */}
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="block text-sm font-medium"
            style={{ color: "hsl(215 20% 75%)" }}
          >
            Email
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
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="block text-sm font-medium"
              style={{ color: "hsl(215 20% 75%)" }}
            >
              Password
            </label>
            <Link
              href="#"
              className="text-xs transition-colors hover:text-white"
              style={{ color: "hsl(220 90% 65%)" }}
            >
              Password dimenticata?
            </Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
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
            <p className="text-xs" style={{ color: "hsl(0 84% 70%)" }}>
              {state.errors.password[0]}
            </p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          id="btn-login"
          disabled={pending}
          className="w-full py-3 px-4 rounded-xl font-semibold text-sm text-white transition-all duration-200 relative overflow-hidden"
          style={{
            background: pending
              ? "hsl(220 90% 45%)"
              : "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
            boxShadow: pending ? "none" : "0 4px 20px hsl(220 90% 56% / 0.35)",
            cursor: pending ? "not-allowed" : "pointer",
          }}
        >
          {pending ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Accesso in corso…
            </span>
          ) : (
            "Accedi"
          )}
        </button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-px" style={{ background: "hsl(220 20% 22%)" }} />
        <span className="text-xs" style={{ color: "hsl(215 15% 45%)" }}>
          Nuovo su WebCAD?
        </span>
        <div className="flex-1 h-px" style={{ background: "hsl(220 20% 22%)" }} />
      </div>

      {/* Link registrazione */}
      <Link
        href="/register"
        id="link-register"
        className="flex items-center justify-center w-full py-3 px-4 rounded-xl text-sm font-medium transition-all duration-200 hover:text-white"
        style={{
          border: "1px solid hsl(220 20% 22%)",
          color: "hsl(215 20% 65%)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = "hsl(220 20% 32%)";
          (e.currentTarget as HTMLElement).style.background = "hsl(220 26% 14%)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = "hsl(220 20% 22%)";
          (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
      >
        Crea un nuovo account →
      </Link>
    </div>
  );
}
