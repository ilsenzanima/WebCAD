import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware Next.js — Refresh automatico della sessione Supabase.
 * Essenziale in produzione: aggiorna i cookie di auth ad ogni richiesta
 * in modo che i Server Components trovino sempre una sessione valida.
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Prima scrivi i cookie nella request (per i Server Components)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Poi ricrea la response con i cookie aggiornati
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANTE: non rimuovere questa chiamata.
  // Refresha il token di sessione se scaduto.
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Escludi:
     * - _next/static (file statici)
     * - _next/image (immagini ottimizzate)
     * - favicon.ico
     * - Tutti i file con estensione (es. .png, .svg ecc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
