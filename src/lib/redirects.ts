// Rules for the redirect manager. Pure functions: shared by the admin API and the Worker.

/** Paths the site itself owns; they can never be redirected. */
const RESERVED = ['/admin', '/api', '/auth', '/media', '/_astro', '/cdn-cgi'];

export type RedirectStatus = 301 | 302;

/** "/Old-Page/?x=1" → "/Old-Page". Returns null for anything that is not a plain site path. */
export function normalisePath(input: string): string | null {
  const value = input.trim();
  if (!value.startsWith('/') || value.startsWith('//') || value.length > 300 || /\s/.test(value)) return null;
  let path: string;
  try {
    path = new URL(value, 'https://site.invalid').pathname;
  } catch {
    return null;
  }
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

export function isReserved(path: string): boolean {
  return path === '/' || RESERVED.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/** Where a redirect may point: a path on this site, or a full https address. */
export function normaliseTarget(input: string): string | null {
  const value = input.trim();
  if (value.startsWith('/')) return normalisePath(value);
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && value.length <= 500 ? url.toString() : null;
  } catch {
    return null;
  }
}

/** True if adding from → to would send a visitor round in a circle. */
export function createsLoop(existing: Map<string, string>, from: string, to: string): boolean {
  let next: string | undefined = to;
  for (let hops = 0; next && hops <= existing.size + 1; hops++) {
    if (next === from) return true;
    next = existing.get(next);
  }
  return false;
}

/** Problems with a new redirect, in plain words; empty when it can be saved. */
export function redirectProblems(fromInput: string, toInput: string, existing: Map<string, string>): { from: string | null; to: string | null; problems: string[] } {
  const from = normalisePath(fromInput);
  const to = normaliseTarget(toInput);
  const problems: string[] = [];
  if (!from) problems.push('“From” must be an address on this site that starts with /, for example /old-services.');
  else if (isReserved(from)) problems.push('That address belongs to the website itself and cannot be redirected.');
  else if (existing.has(from)) problems.push(`There is already a redirect from ${from}. Delete it first to change it.`);
  if (!to) problems.push('“To” must be an address on this site (starting with /) or a full https:// link.');
  if (from && to && createsLoop(existing, from, to)) problems.push('That would send visitors round in a circle. Check the other redirects.');
  return { from, to, problems };
}

/** The address to send a visitor to, keeping their query string when the target has none. */
export function redirectLocation(target: string, search: string): string {
  return search && !target.includes('?') ? `${target}${search}` : target;
}
