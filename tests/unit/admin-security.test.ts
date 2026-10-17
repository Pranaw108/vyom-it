import { beforeEach, describe, expect, it } from 'vitest';
import { clearAccessKeyCache, verifyAccessToken } from '../../src/server/admin/access';
import { createCsrfToken, isSameOrigin, verifyCsrfToken } from '../../src/server/admin/csrf';
import { ROLES, can } from '../../src/server/admin/permissions';
import { csvCell } from '../../src/server/admin/leads';

const TEAM = 'https://vyom-it.cloudflareaccess.com';
const AUD = 'test-audience-tag';

const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const encode = (obj: object) => b64url(new TextEncoder().encode(JSON.stringify(obj)));

async function keyPair() {
  const pair = (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey('jwk', pair.publicKey)) as JsonWebKey;
  return { pair, jwk: { kid: 'key-1', kty: 'RSA', n: jwk.n!, e: jwk.e! } };
}

async function sign(privateKey: CryptoKey, payload: object, kid = 'key-1') {
  const head = encode({ alg: 'RS256', kid, typ: 'JWT' });
  const body = encode(payload);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64url(signature)}`;
}

describe('Cloudflare Access token check (TC-030)', () => {
  let keys: Awaited<ReturnType<typeof keyPair>>;
  const now = Date.now();
  const valid = () => ({ aud: [AUD], iss: TEAM, email: 'Owner@Vyom.test', exp: Math.floor(now / 1000) + 600 });
  const config = () => ({ teamDomain: TEAM, audience: AUD, fetchKeys: async () => ({ keys: [keys.jwk] }), now: () => now });

  beforeEach(async () => {
    clearAccessKeyCache();
    keys = await keyPair();
  });

  it('accepts a valid token and returns the lowercased email', async () => {
    expect(await verifyAccessToken(await sign(keys.pair.privateKey, valid()), config())).toBe('owner@vyom.test');
  });

  it('rejects a token signed by another key', async () => {
    const other = await keyPair();
    expect(await verifyAccessToken(await sign(other.pair.privateKey, valid()), config())).toBeNull();
  });

  it('rejects expired, wrong-audience and wrong-issuer tokens', async () => {
    expect(await verifyAccessToken(await sign(keys.pair.privateKey, { ...valid(), exp: Math.floor(now / 1000) - 1 }), config())).toBeNull();
    expect(await verifyAccessToken(await sign(keys.pair.privateKey, { ...valid(), aud: ['another-app'] }), config())).toBeNull();
    expect(await verifyAccessToken(await sign(keys.pair.privateKey, { ...valid(), iss: 'https://evil.cloudflareaccess.com' }), config())).toBeNull();
  });

  it('rejects a tampered payload and garbage input', async () => {
    const token = await sign(keys.pair.privateKey, valid());
    const [h, , s] = token.split('.');
    const tampered = `${h}.${encode({ ...valid(), email: 'attacker@evil.test' })}.${s}`;
    expect(await verifyAccessToken(tampered, config())).toBeNull();
    expect(await verifyAccessToken('not-a-token', config())).toBeNull();
    expect(await verifyAccessToken(null, config())).toBeNull();
  });

  it('rejects everything when Access is not configured', async () => {
    expect(await verifyAccessToken(await sign(keys.pair.privateKey, valid()), { ...config(), audience: '' })).toBeNull();
  });
});

describe('CSRF tokens (FR-152)', () => {
  it('accepts today and yesterday, rejects other users and old tokens', async () => {
    const now = new Date('2026-10-17T10:00:00Z');
    const token = await createCsrfToken('secret', 'a@x.test', now);
    expect(await verifyCsrfToken('secret', 'a@x.test', token, now)).toBe(true);
    expect(await verifyCsrfToken('secret', 'a@x.test', token, new Date('2026-10-18T10:00:00Z'))).toBe(true);
    expect(await verifyCsrfToken('secret', 'a@x.test', token, new Date('2026-10-19T10:00:00Z'))).toBe(false);
    expect(await verifyCsrfToken('secret', 'b@x.test', token, now)).toBe(false);
    expect(await verifyCsrfToken('', 'a@x.test', token, now)).toBe(false);
  });

  it('checks the request origin', () => {
    expect(isSameOrigin(new Request('https://site.test/api/admin/x', { method: 'POST', headers: { Origin: 'https://site.test' } }))).toBe(true);
    expect(isSameOrigin(new Request('https://site.test/api/admin/x', { method: 'POST', headers: { Origin: 'https://evil.test' } }))).toBe(false);
    expect(isSameOrigin(new Request('https://site.test/api/admin/x', { method: 'POST' }))).toBe(false);
  });
});

describe('role permissions (SOW permission matrix)', () => {
  it('only Owners manage users, export or erase leads, and see the audit log', () => {
    for (const role of ROLES) {
      const owner = role === 'owner';
      expect(can(role, 'users.manage')).toBe(owner);
      expect(can(role, 'leads.export')).toBe(owner);
      expect(can(role, 'leads.erase')).toBe(owner);
      expect(can(role, 'audit.view')).toBe(owner);
    }
  });

  it('contributors edit but cannot publish; sales see leads but not content', () => {
    expect(can('contributor', 'content.edit')).toBe(true);
    expect(can('contributor', 'content.publish')).toBe(false);
    expect(can('sales', 'leads.update')).toBe(true);
    expect(can('sales', 'content.view')).toBe(false);
    expect(can('viewer', 'content.edit')).toBe(false);
  });
});

describe('CSV export', () => {
  it('quotes cells and neutralises spreadsheet formulas', () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(csvCell('Priya, Sharma')).toBe('"Priya, Sharma"');
    expect(csvCell(null)).toBe('""');
  });
});
