// Verifies the Cloudflare Access token on every admin request (FR-098). Access blocks
// unauthenticated visitors at the edge; this check means the app is safe even if Access is misconfigured.

interface Jwk {
  kid: string;
  kty: string;
  n: string;
  e: string;
  alg?: string;
}

interface AccessConfig {
  teamDomain: string; // e.g. https://vyom-it.cloudflareaccess.com
  audience: string; // the Access application's AUD tag
  fetchKeys?: (url: string) => Promise<{ keys: Jwk[] }>;
  now?: () => number;
}

const keyCache = new Map<string, { keys: Jwk[]; fetchedAt: number }>();
const KEY_TTL_MS = 60 * 60 * 1000;

function base64UrlDecode(input: string): Uint8Array<ArrayBuffer> {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
  const binary = atob(base64);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function loadKeys(config: AccessConfig, forceRefresh = false): Promise<Jwk[]> {
  const url = `${config.teamDomain.replace(/\/$/, '')}/cdn-cgi/access/certs`;
  const cached = keyCache.get(url);
  const now = config.now?.() ?? Date.now();
  if (!forceRefresh && cached && now - cached.fetchedAt < KEY_TTL_MS) return cached.keys;
  const fetchKeys = config.fetchKeys ?? (async (u: string) => (await fetch(u)).json() as Promise<{ keys: Jwk[] }>);
  const { keys } = await fetchKeys(url);
  keyCache.set(url, { keys, fetchedAt: now });
  return keys;
}

/** Returns the signed-in email, or null if the token is missing, forged, expired or for another app. */
export async function verifyAccessToken(token: string | null, config: AccessConfig): Promise<string | null> {
  if (!token || !config.teamDomain || !config.audience) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];

  try {
    const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(headerB64))) as { kid?: string; alg?: string };
    if (header.alg !== 'RS256' || !header.kid) return null;

    let keys = await loadKeys(config);
    let jwk = keys.find((k) => k.kid === header.kid);
    if (!jwk) {
      // Keys rotate; refresh once before rejecting.
      keys = await loadKeys(config, true);
      jwk = keys.find((k) => k.kid === header.kid);
    }
    if (!jwk) return null;

    const key = await crypto.subtle.importKey(
      'jwk',
      { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      base64UrlDecode(signatureB64),
      new TextEncoder().encode(`${headerB64}.${payloadB64}`),
    );
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64))) as {
      aud?: string | string[];
      iss?: string;
      exp?: number;
      nbf?: number;
      email?: string;
    };
    const nowSeconds = Math.floor((config.now?.() ?? Date.now()) / 1000);
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audiences.includes(config.audience)) return null;
    if (payload.iss !== config.teamDomain.replace(/\/$/, '')) return null;
    if (!payload.exp || payload.exp < nowSeconds) return null;
    if (payload.nbf && payload.nbf > nowSeconds + 60) return null;
    return typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
  } catch (error) {
    console.error('Access token verification failed', error);
    return null;
  }
}

/** Test helper: clears the key cache. */
export const clearAccessKeyCache = () => keyCache.clear();
