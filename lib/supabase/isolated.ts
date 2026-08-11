import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

/**
 * Client Supabase isolato, senza persistenza di sessione ne' cookie.
 * Usato dalle azioni admin che devono creare un account per un altro
 * utente (es. un familiare) senza sovrascrivere la sessione di chi
 * sta eseguendo l'azione.
 */
export function createIsolatedClient() {
  return createSupabaseClient<Database>(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim(),
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim(),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}
