import { base64UrlDecode, base64UrlEncode } from './jwt';

// Small signed values for short-lived browser state: the Google sign-in handshake and one-time
// messages. Admin sessions themselves are stored server-side (sessions.ts).
const enc = new TextEncoder();

async function hmacKey(secret: string) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

/** Signs a small JSON payload: `<payload>.<signature>`, both base64url. */
export async function signValue(secret: string, payload: Record<string, unknown>): Promise<string> {
  const body = base64UrlEncode(enc.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(body));
  return `${body}.${base64UrlEncode(signature)}`;
}

/** Returns the payload if the signature is valid and it has not expired (constant-time check). */
export async function readSignedValue<T extends { exp: number }>(secret: string, value: string | null | undefined, now = Date.now()): Promise<T | null> {
  if (!secret || !value) return null;
  const [body, signature] = value.split('.');
  if (!body || !signature) return null;
  try {
    const valid = await crypto.subtle.verify('HMAC', await hmacKey(secret), base64UrlDecode(signature), enc.encode(body));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(body))) as T;
    return typeof payload.exp === 'number' && payload.exp > now ? payload : null;
  } catch {
    return null;
  }
}

export function readCookie(request: Request, name: string): string | null {
  const match = request.headers.get('Cookie')?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match?.[1] ?? null;
}

/** Cookie attributes: not readable by scripts, HTTPS only (except on local http), not sent cross-site. */
export function cookie(name: string, value: string, maxAgeSeconds: number, secure: boolean, path = '/'): string {
  return `${name}=${value}; Path=${path}; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}
