import { GOOGLE_CONFIG } from "./gdrive";

/**
 * Costruisce l'URL di autorizzazione OAuth2 di Google per il flusso Authorization Code.
 */
export function buildGoogleAuthUrl({
  redirectUri,
  state,
  scopes,
}: {
  redirectUri: string;
  state: string;
  scopes: string[];
}) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", GOOGLE_CONFIG.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

/**
 * Scambia il codice di autorizzazione ricevuto da Google con access/refresh token.
 * Usare solo lato server: richiede il client secret.
 */
export async function exchangeGoogleAuthCode({
  code,
  redirectUri,
}: {
  code: string;
  redirectUri: string;
}) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CONFIG.clientId,
      client_secret: GOOGLE_CONFIG.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Errore durante lo scambio del codice OAuth Google: ${errText}`);
  }

  const result = await response.json();
  return {
    accessToken: result.access_token as string,
    refreshToken: (result.refresh_token as string | undefined) ?? null,
    expiresIn: (result.expires_in as number) ?? 3600,
  };
}
