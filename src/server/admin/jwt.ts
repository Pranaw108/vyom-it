// RS256 JSON Web Token verification against a published key set (JWKS).
// Used for Cloudflare Access tokens and Google sign-in ID tokens.

export interface Jwk {
  kid: string;
  kty: string;
  n: string;
  e: string;
  alg?: string;
}

export interface JwtCheck {
  jwksUrl: string;
  issuers: string[];
  audience: string;
  fetchKeys?: (url: string) => Promise<{ keys: Jwk[] }>;
  now?: () => number;
}

export type JwtPayload = Record<string, unknown> & { email?: string; exp?: number; nbf?: number; aud?: string | string[]; iss?: string };

const keyCache = new Map<string, { keys: Jwk[]; fetchedAt: number }>();
const KEY_TTL_MS = 60 * 60 * 1000;

export function base64UrlDecode(input: string): Uint8Array<ArrayBuffer> {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

export function base64UrlEncode(bytes: Uint8Array | ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function loadKeys(check: JwtCheck, forceRefresh = false): Promise<Jwk[]> {
  const cached = keyCache.get(check.jwksUrl);
  const now = check.now?.() ?? Date.now();
  if (!forceRefresh && cached && now - cached.fetchedAt < KEY_TTL_MS) return cached.keys;
  const fetchKeys = check.fetchKeys ?? (async (u: string) => (await fetch(u)).json() as Promise<{ keys: Jwk[] }>);
  const { keys } = await fetchKeys(check.jwksUrl);
  keyCache.set(check.jwksUrl, { keys, fetchedAt: now });
  return keys;
}

/** Returns the verified payload, or null if the token is missing, forged, expired, or for another app/issuer. */
export async function verifyJwt(token: string | null, check: JwtCheck): Promise<JwtPayload | null> {
  if (!token || !check.audience || !check.jwksUrl) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];

  try {
    const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(headerB64))) as { kid?: string; alg?: string };
    if (header.alg !== 'RS256' || !header.kid) return null;

    let jwk = (await loadKeys(check)).find((k) => k.kid === header.kid);
    // Keys rotate; refresh once before rejecting.
    if (!jwk) jwk = (await loadKeys(check, true)).find((k) => k.kid === header.kid);
    if (!jwk) return null;

    const key = await crypto.subtle.importKey(
      'jwk',
      { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, base64UrlDecode(signatureB64), new TextEncoder().encode(`${headerB64}.${payloadB64}`));
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64))) as JwtPayload;
    const nowSeconds = Math.floor((check.now?.() ?? Date.now()) / 1000);
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audiences.includes(check.audience)) return null;
    if (!payload.iss || !check.issuers.includes(payload.iss)) return null;
    if (!payload.exp || payload.exp < nowSeconds) return null;
    if (payload.nbf && payload.nbf > nowSeconds + 60) return null;
    return payload;
  } catch (error) {
    console.error('JWT verification failed', error);
    return null;
  }
}

/** Test helper: clears the key cache. */
export const clearJwtKeyCache = () => keyCache.clear();
