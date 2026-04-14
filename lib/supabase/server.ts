import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/types/database";

/**
 * Client Supabase per componenti server-side (Server Components, Route Handlers, Server Actions).
 * Gestisce automaticamente i cookie per l'autenticazione.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Il metodo setAll è stato chiamato da un Server Component.
            // Può essere ignorato se si ha un middleware che refresha le sessioni.
          }
        },
      },
    }
  );
}
