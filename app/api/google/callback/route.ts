import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { exchangeGoogleAuthCode } from "@/lib/google-oauth";

/**
 * Callback del flusso OAuth2 diretto con Google: scambia il code per i token
 * e li persiste per l'utente corrente in user_google_tokens.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("google_oauth_state")?.value;
  const next = cookieStore.get("google_oauth_next")?.value || "/dashboard/suppliers";

  const fail = (reason: string) => {
    const response = NextResponse.redirect(`${origin}${next}?google_error=${encodeURIComponent(reason)}`);
    response.cookies.delete("google_oauth_state");
    response.cookies.delete("google_oauth_next");
    return response;
  };

  if (oauthError) return fail(oauthError);
  if (!code || !state || !expectedState || state !== expectedState) return fail("invalid_state");

  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  try {
    const redirectUri = `${origin}/api/google/callback`;
    const tokens = await exchangeGoogleAuthCode({ code, redirectUri });

    let refreshToken = tokens.refreshToken;
    if (!refreshToken) {
      // Google non sempre reinvia il refresh_token: conserva quello già salvato in precedenza.
      const { data: existing } = await supabase
        .from("user_google_tokens")
        .select("refresh_token")
        .eq("user_id", user.id)
        .maybeSingle();
      refreshToken = existing?.refresh_token ?? null;
    }

    const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000).toISOString();

    await supabase.from("user_google_tokens").upsert({
      user_id: user.id,
      access_token: tokens.accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Errore collegamento Google:", err.message);
    return fail("token_exchange_failed");
  }

  const response = NextResponse.redirect(`${origin}${next}`);
  response.cookies.delete("google_oauth_state");
  response.cookies.delete("google_oauth_next");
  return response;
}
