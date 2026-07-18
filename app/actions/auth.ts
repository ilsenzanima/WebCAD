"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// ============================================
// Schemi Zod di validazione
// ============================================

const LoginSchema = z.object({
  email: z.string().email({ message: "Inserisci un indirizzo email valido." }),
  password: z
    .string()
    .min(6, { message: "La password deve essere di almeno 6 caratteri." }),
});

const RegisterSchema = z.object({
  full_name: z
    .string()
    .min(2, { message: "Il nome deve essere di almeno 2 caratteri." })
    .trim(),
  email: z
    .string()
    .email({ message: "Inserisci un indirizzo email valido." })
    .refine((val) => val.endsWith("@opifiresafe.com"), {
      message: "Registrazione consentita solo con email aziendale @opifiresafe.com.",
    }),
  password: z
    .string()
    .min(8, { message: "La password deve essere di almeno 8 caratteri." })
    .regex(/[A-Z]/, { message: "Deve contenere almeno una lettera maiuscola." })
    .regex(/[0-9]/, { message: "Deve contenere almeno un numero." }),
});

// ============================================
// Tipi per lo stato del form
// ============================================

export type AuthFormState =
  | {
      errors?: Record<string, string[]>;
      message?: string;
    }
  | undefined;

// ============================================
// Server Action: login
// ============================================

export async function login(
  _state: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return {
      message:
        error.message === "Invalid login credentials"
          ? "Email o password non corretti. Riprova."
          : "Errore durante il login. Riprova più tardi.",
    };
  }

  redirect("/dashboard");
}

// ============================================
// Server Action: register (Disabilitata)
// ============================================

export async function register(
  _state: AuthFormState,
  _formData: FormData
): Promise<AuthFormState> {
  return {
    message: "La registrazione autonoma è disabilitata per questo gestionale privato.",
  };
}

// ============================================
// Server Action: logout
// ============================================

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// ============================================
// Server Action: cambio password
// ============================================

export async function changePassword(password: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autenticato" };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { success: false, error: error.message };

  return { success: true };
}
