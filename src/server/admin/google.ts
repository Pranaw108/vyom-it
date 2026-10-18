import { verifyJwt, type Jwk } from './jwt';

// "Sign in with Google" (OpenID Connect, authorization-code flow). Google verifies the person,
// including their 2-step verification; our users table decides whether they get in and with which role.

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function googleAuthUrl(config: GoogleConfig, state: string, nonce: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    nonce,
    prompt: 'select_account',
  });
  return `${AUTH_URL}?${params}`;
}

/** Exchanges the one-time code for an ID token and returns the verified email, or null. */
export async function finishGoogleSignIn(
  config: GoogleConfig,
  code: string,
  expectedNonce: string,
  deps: { fetchKeys?: (url: string) => Promise<{ keys: Jwk[] }>; fetchToken?: typeof fetch } = {},
): Promise<{ email: string } | { error: string }> {
  const fetchToken = deps.fetchToken ?? fetch;
  const response = await fetchToken(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!response.ok) return { error: `Google token exchange failed (${response.status})` };
  const { id_token: idToken } = (await response.json()) as { id_token?: string };
  if (!idToken) return { error: 'Google returned no ID token' };

  const payload = await verifyJwt(idToken, {
    jwksUrl: JWKS_URL,
    issuers: ISSUERS,
    audience: config.clientId,
    ...(deps.fetchKeys ? { fetchKeys: deps.fetchKeys } : {}),
  });
  if (!payload) return { error: 'Google ID token failed verification' };
  if (payload.nonce !== expectedNonce) return { error: 'Sign-in request did not match (nonce)' };
  if (payload.email_verified !== true || typeof payload.email !== 'string') return { error: 'Google account email is not verified' };
  return { email: payload.email.toLowerCase() };
}
