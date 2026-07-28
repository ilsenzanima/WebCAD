import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Route Handler per il callback OAuth di Supabase.
 * Supabase reindirizza qui dopo la verifica email o OAuth.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/projects";

  if (code) {
    const supabase = (await createClient()) as any;
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const session = data.session as (typeof data.session & {
        provider_token?: string | null;
        provider_refresh_token?: string | null;
      }) | null;

      // Se il login/collegamento è avvenuto tramite Google con richiesta di accesso a Drive,
      // Supabase restituisce anche il provider_token (e refresh_token) di Google da persistere.
      if (session?.provider_token && session.user) {
        let refreshToken = session.provider_refresh_token ?? null;

        if (!refreshToken) {
          // Google non sempre reinvia il refresh_token: conserva quello già salvato in precedenza.
          const { data: existing } = await supabase
            .from("user_google_tokens")
            .select("refresh_token")
            .eq("user_id", session.user.id)
            .maybeSingle();
          refreshToken = existing?.refresh_token ?? null;
        }

        const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
        await supabase.from("user_google_tokens").upsert({
          user_id: session.user.id,
          access_token: session.provider_token,
          refresh_token: refreshToken,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        });
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Reindirizza alla login con messaggio di errore
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
