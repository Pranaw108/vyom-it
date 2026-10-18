import { beforeEach, describe, expect, it } from 'vitest';
import { finishGoogleSignIn } from '../../src/server/admin/google';
import { clearJwtKeyCache } from '../../src/server/admin/jwt';
import { SESSION_COOKIE, createSession, readSession, readSignedValue, signValue } from '../../src/server/admin/session';

const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const encode = (obj: object) => b64url(new TextEncoder().encode(JSON.stringify(obj)));

describe('admin session cookie', () => {
  const request = (value: string) => new Request('https://site.test/admin', { headers: { Cookie: `other=1; ${SESSION_COOKIE}=${value}` } });

  it('round-trips the signed-in email', async () => {
    expect(await readSession('secret', request(await createSession('secret', 'Owner@X.test')))).toBe('owner@x.test');
  });

  it('rejects tampered, re-signed and expired sessions', async () => {
    const value = await createSession('secret', 'owner@x.test', 1_000);
    const [, sig] = value.split('.');
    const forged = `${encode({ email: 'attacker@x.test', exp: Date.now() + 999_999 })}.${sig}`;
    expect(await readSession('secret', request(forged))).toBeNull();
    expect(await readSession('other-secret', request(value))).toBeNull();
    expect(await readSession('secret', request(value), 1_000 + 13 * 3_600_000)).toBeNull();
    expect(await readSignedValue('secret', 'garbage')).toBeNull();
  });

  it('signs arbitrary payloads used for the sign-in handshake', async () => {
    const v = await signValue('s', { state: 'abc', exp: Date.now() + 1000 });
    expect((await readSignedValue<{ state: string; exp: number }>('s', v))?.state).toBe('abc');
  });
});

describe('Sign in with Google', () => {
  const config = { clientId: 'client-123.apps.googleusercontent.com', clientSecret: 'shh', redirectUri: 'https://site.test/auth/google/callback' };
  let pair: CryptoKeyPair;
  let jwk: { kid: string; kty: string; n: string; e: string };

  beforeEach(async () => {
    clearJwtKeyCache();
    pair = (await crypto.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['sign', 'verify'],
    )) as CryptoKeyPair;
    const exported = (await crypto.subtle.exportKey('jwk', pair.publicKey)) as JsonWebKey;
    jwk = { kid: 'g1', kty: 'RSA', n: exported.n!, e: exported.e! };
  });

  async function idToken(overrides: Record<string, unknown> = {}) {
    const head = encode({ alg: 'RS256', kid: 'g1', typ: 'JWT' });
    const body = encode({
      iss: 'https://accounts.google.com',
      aud: config.clientId,
      email: 'Owner@Gmail.com',
      email_verified: true,
      nonce: 'n-1',
      exp: Math.floor(Date.now() / 1000) + 600,
      ...overrides,
    });
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(`${head}.${body}`));
    return `${head}.${body}.${b64url(sig)}`;
  }

  const run = async (token: string, nonce = 'n-1', status = 200) =>
    finishGoogleSignIn(config, 'code', nonce, {
      fetchKeys: async () => ({ keys: [jwk] }),
      fetchToken: (async () => new Response(JSON.stringify({ id_token: token }), { status })) as unknown as typeof fetch,
    });

  it('returns the verified, lowercased email', async () => {
    expect(await run(await idToken())).toEqual({ email: 'owner@gmail.com' });
  });

  it('refuses a token for another app, a replayed nonce, or an unverified email', async () => {
    expect('error' in (await run(await idToken({ aud: 'someone-elses-client' })))).toBe(true);
    expect('error' in (await run(await idToken(), 'different-nonce'))).toBe(true);
    expect('error' in (await run(await idToken({ email_verified: false })))).toBe(true);
    expect('error' in (await run(await idToken({ iss: 'https://evil.example' })))).toBe(true);
  });

  it('reports a failed code exchange instead of signing in', async () => {
    expect(await run('x', 'n-1', 400)).toEqual({ error: 'Google token exchange failed (400)' });
  });
});
