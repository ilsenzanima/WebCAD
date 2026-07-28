import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { GOOGLE_CONFIG } from "@/lib/gdrive";
import { buildGoogleAuthUrl } from "@/lib/google-oauth";

/**
 * Avvia il flusso OAuth2 diretto con Google (Drive + Calendar) per l'utente corrente.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = searchParams.get("next") ?? "/dashboard/suppliers";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  const state = randomUUID();
  const redirectUri = `${origin}/api/google/callback`;
  const authUrl = buildGoogleAuthUrl({
    redirectUri,
    state,
    scopes: [GOOGLE_CONFIG.scopes.drive, GOOGLE_CONFIG.scopes.calendar],
  });

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  response.cookies.set("google_oauth_next", next, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
