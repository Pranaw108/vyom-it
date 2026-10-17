// CSRF tokens for admin forms (FR-152): an HMAC of the user's email and the day.
// Combined with the same-origin check, a page on another site cannot submit admin actions.

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const day = (offset: number, now: Date) => new Date(now.getTime() - offset * 86_400_000).toISOString().slice(0, 10);

export async function createCsrfToken(secret: string, email: string, now = new Date()): Promise<string> {
  return hmac(secret, `${email}:${day(0, now)}`);
}

/** Accepts today's or yesterday's token, so a form left open over midnight still works. */
export async function verifyCsrfToken(secret: string, email: string, token: string | null, now = new Date()): Promise<boolean> {
  if (!secret || !token || token.length !== 64) return false;
  for (const offset of [0, 1]) {
    if ((await hmac(secret, `${email}:${day(offset, now)}`)) === token) return true;
  }
  return false;
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('Origin');
  return Boolean(origin) && origin === new URL(request.url).origin;
}
