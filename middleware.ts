import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware di autenticazione Supabase SSR.
 * FONDAMENTALE: senza questo file, i cookie di sessione non vengono
 * mai aggiornati, causando il crash dei Server Components in produzione
 * quando il token scade.
 *
 * Questo middleware:
 * 1. Legge i cookie di sessione dalla richiesta in entrata
 * 2. Li passa al client Supabase per eventuale refresh
 * 3. Propaga i cookie aggiornati nella risposta uscente
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANTE: non rimuovere questa chiamata.
  // Refresha la sessione se scaduta — necessario affinché i Server Components
  // possano leggere la sessione aggiornata dai cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protezione delle route della dashboard: redirect al login se non autenticato
  const { pathname } = request.nextUrl;
  const isDashboardRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/catalog") ||
    pathname.startsWith("/projects");

  if (isDashboardRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirect dalla home/login se già autenticato
  if (user && (pathname === "/" || pathname === "/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Escludi:
     * - _next/static (file statici)
     * - _next/image (ottimizzazione immagini)
     * - favicon.ico
     * - File con estensioni comuni (immagini, font, ecc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
