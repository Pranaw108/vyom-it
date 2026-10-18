import { describe, expect, it } from 'vitest';
import { DUMMY_HASH, MAX_ITERATIONS, hashPassword, needsRehash, passwordProblems, verifyPassword } from '../../src/server/admin/password';
import { CLIENT_GRANTABLE, can, permissionsOf, sanitiseGrants } from '../../src/server/admin/permissions';

const PEPPER = 'test-pepper-0123456789';

describe('password hashing', () => {
  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await hashPassword('correct horse battery staple', PEPPER, 1000);
    expect(hash.startsWith('pbkdf2-sha256$1000$')).toBe(true);
    expect(await verifyPassword('correct horse battery staple', hash, PEPPER)).toBe(true);
    expect(await verifyPassword('correct horse battery stapl', hash, PEPPER)).toBe(false);
  });

  it('salts every hash, so the same password never produces the same hash', async () => {
    const [a, b] = await Promise.all([hashPassword('same password twice', PEPPER, 1000), hashPassword('same password twice', PEPPER, 1000)]);
    expect(a).not.toBe(b);
  });

  it('needs the pepper: a stolen database alone cannot verify passwords', async () => {
    const hash = await hashPassword('correct horse battery staple', PEPPER, 1000);
    expect(await verifyPassword('correct horse battery staple', hash, 'other-pepper')).toBe(false);
    await expect(hashPassword('x'.repeat(12), '')).rejects.toThrow('PASSWORD_PEPPER');
  });

  it('caps iterations at the Workers limit and flags old hashes for upgrade', async () => {
    const hash = await hashPassword('correct horse battery staple', PEPPER, 10_000_000);
    expect(hash.split('$')[1]).toBe(String(MAX_ITERATIONS));
    expect(needsRehash('pbkdf2-sha256$1000$x$y')).toBe(true);
    expect(needsRehash(hash)).toBe(false);
  });

  it('rejects malformed or unknown hashes, including the dummy hash', async () => {
    expect(await verifyPassword('anything at all', 'bcrypt$whatever', PEPPER)).toBe(false);
    expect(await verifyPassword('anything at all', null, PEPPER)).toBe(false);
    expect(await verifyPassword('anything at all', DUMMY_HASH, PEPPER)).toBe(false);
  });
});

describe('password rules', () => {
  it('requires length and blocks obvious choices', () => {
    expect(passwordProblems('short', 'pranawgautam')).toContain('Use at least 12 characters.');
    expect(passwordProblems('pranawgautam2026!', 'pranawgautam')).toContain('Do not include your username.');
    expect(passwordProblems('aaaaaaaaaaaaaa', 'x')).toContain('Do not repeat a single character.');
    expect(passwordProblems('password123', 'x').length).toBeGreaterThan(0);
    expect(passwordProblems('river-lantern-copper-71', 'pranawgautam')).toEqual([]);
  });
});

describe('client permissions', () => {
  it('a client only gets what was granted, never Owner-only powers', () => {
    const client = { role: 'client' as const, permissions: ['leads.view', 'users.manage', 'audit.view', 'settings.edit', 'leads.erase'] };
    expect(can(client, 'leads.view')).toBe(true);
    expect(can(client, 'leads.update')).toBe(false);
    for (const ownerOnly of ['users.manage', 'audit.view', 'settings.edit', 'leads.erase'] as const) expect(can(client, ownerOnly)).toBe(false);
    expect(permissionsOf({ role: 'client' })).toEqual(['dashboard.view']);
  });

  it('only grantable permissions survive from a submitted form', () => {
    expect(sanitiseGrants(['content.view', 'users.manage', 'content.view', 42])).toEqual(['content.view']);
    expect(CLIENT_GRANTABLE.some((g) => ['users.manage', 'audit.view', 'settings.edit', 'leads.erase'].includes(g.permission))).toBe(false);
  });

  it('the owner keeps every permission', () => {
    expect(can({ role: 'owner' }, 'users.manage')).toBe(true);
    expect(can('owner', 'leads.erase')).toBe(true);
  });
});
