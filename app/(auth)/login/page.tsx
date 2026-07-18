"use client";

import { useActionState } from "react";
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
        <h1 className="text-2xl font-black text-white tracking-tight">Bentornato</h1>
        <p style={{ color: "hsl(240 5% 65%)" }} className="text-xs font-semibold">
          Accedi al tuo gestionale privato
        </p>
      </div>

      {/* Messaggio errore globale */}
      {state?.message && (
        <div
          className="flex items-start gap-3 rounded-xl p-3 text-xs animate-fade-in"
          style={{
            background: "rgba(220, 38, 38, 0.1)",
            border: "1px solid rgba(220, 38, 38, 0.2)",
            color: "hsl(0 80% 75%)",
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
            className="block text-[10px] font-bold uppercase text-slate-400"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="utente@esempio.it"
            required
            className="w-full px-4 py-3 rounded-xl text-xs text-white placeholder-[hsl(240_5%_35%)] transition-all duration-200 focus:outline-none focus:border-blue-500 border"
            style={{
              background: "hsl(240 10% 10% / 0.8)",
              borderColor: state?.errors?.email ? "rgba(220, 38, 38, 0.3)" : "hsl(240 5% 18%)",
            }}
          />
          {state?.errors?.email && (
            <p className="text-[10px] font-bold" style={{ color: "hsl(0 84% 70%)" }}>
              {state.errors.email[0]}
            </p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="block text-[10px] font-bold uppercase text-slate-400"
            >
              Password
            </label>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            required
            className="w-full px-4 py-3 rounded-xl text-xs text-white placeholder-[hsl(240_5%_35%)] transition-all duration-200 focus:outline-none focus:border-blue-500 border"
            style={{
              background: "hsl(240 10% 10% / 0.8)",
              borderColor: state?.errors?.password ? "rgba(220, 38, 38, 0.3)" : "hsl(240 5% 18%)",
            }}
          />
          {state?.errors?.password && (
            <p className="text-[10px] font-bold" style={{ color: "hsl(0 84% 70%)" }}>
              {state.errors.password[0]}
            </p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          id="btn-login"
          disabled={pending}
          className="w-full py-3 px-4 rounded-xl font-bold text-xs text-white transition-all duration-200 relative overflow-hidden active:scale-98"
          style={{
            background: pending
              ? "hsl(220 90% 45%)"
              : "linear-gradient(135deg, hsl(220 90% 56%), hsl(215 85% 48%))",
            cursor: pending ? "not-allowed" : "pointer",
          }}
        >
          {pending ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
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
    </div>
  );
}
