import { base64UrlDecode, base64UrlEncode } from './jwt';

// Password hashing for Cloudflare Workers.
// Argon2id/bcrypt are too CPU-heavy for the Workers runtime, so we use the built-in PBKDF2-SHA256
// (Workers allows at most 100,000 iterations) with a random salt per password, plus a secret
// "pepper" kept outside the database. Each hash records its iteration count, so it can be raised later.

export const MAX_ITERATIONS = 100_000; // Workers runtime limit for PBKDF2
export const DEFAULT_ITERATIONS = 100_000;
const KEY_BITS = 256;
const enc = new TextEncoder();

async function peppered(password: string, pepper: string): Promise<Uint8Array<ArrayBuffer>> {
  if (!pepper) throw new Error('PASSWORD_PEPPER is not configured');
  // HMAC with the pepper first: a stolen database alone cannot be attacked offline.
  const key = await crypto.subtle.importKey('raw', enc.encode(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(password.normalize('NFKC'))));
}

async function derive(password: string, pepper: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey('raw', await peppered(password, pepper), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, material, KEY_BITS));
}

/** Returns "pbkdf2-sha256$<iterations>$<salt>$<hash>". */
export async function hashPassword(password: string, pepper: string, iterations = DEFAULT_ITERATIONS): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, pepper, salt, Math.min(iterations, MAX_ITERATIONS));
  return `pbkdf2-sha256$${Math.min(iterations, MAX_ITERATIONS)}$${base64UrlEncode(salt)}$${base64UrlEncode(hash)}`;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

export async function verifyPassword(password: string, stored: string | null, pepper: string): Promise<boolean> {
  const parts = stored?.split('$');
  if (!parts || parts.length !== 4 || parts[0] !== 'pbkdf2-sha256') return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > MAX_ITERATIONS) return false;
  const actual = await derive(password, pepper, base64UrlDecode(parts[2]!), iterations);
  return timingSafeEqual(actual, base64UrlDecode(parts[3]!));
}

/** True when the stored hash uses fewer iterations than today's setting (rehash after a successful login). */
export function needsRehash(stored: string | null, iterations = DEFAULT_ITERATIONS): boolean {
  const n = Number(stored?.split('$')[1]);
  return !Number.isInteger(n) || n < Math.min(iterations, MAX_ITERATIONS);
}

// A fixed, valid hash checked when the username does not exist, so response time does not reveal
// which usernames exist. Its password is random and never used.
export const DUMMY_HASH = 'pbkdf2-sha256$100000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

const COMMON = new Set(['password', 'password1', 'password123', '123456789012', 'qwertyuiop', 'iloveyou', 'admin123456', 'welcome12345', 'letmein12345', 'vyomit', 'vyom-it']);

/** Password rules (NIST 800-63B style): length matters most; reject obvious and personal choices. */
export function passwordProblems(password: string, username: string): string[] {
  const problems: string[] = [];
  if (password.length < 12) problems.push('Use at least 12 characters.');
  if (password.length > 128) problems.push('Use at most 128 characters.');
  if (/^(.)\1+$/.test(password)) problems.push('Do not repeat a single character.');
  const lower = password.toLowerCase();
  if (username && lower.includes(username.toLowerCase())) problems.push('Do not include your username.');
  if (COMMON.has(lower) || /^(?:0123456789|1234567890|abcdefghij)/.test(lower)) problems.push('This password is too common.');
  return problems;
}

export const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;
