import { describe, expect, it } from 'vitest';
import { createsLoop, isReserved, normalisePath, normaliseTarget, redirectLocation, redirectProblems } from '../../src/lib/redirects';

describe('normalisePath', () => {
  it('keeps the path and drops trailing slashes, query and hash', () => {
    expect(normalisePath('/old-services/')).toBe('/old-services');
    expect(normalisePath(' /a/b?x=1#top ')).toBe('/a/b');
    expect(normalisePath('/')).toBe('/');
  });

  it('refuses anything that is not a site path', () => {
    for (const bad of ['old', '//evil.example/x', 'https://x.com/a', '/has space', `/${'a'.repeat(301)}`]) expect(normalisePath(bad), bad).toBeNull();
  });
});

describe('isReserved', () => {
  it('protects the home page and the site’s own areas', () => {
    for (const path of ['/', '/admin', '/admin/users', '/api/leads', '/auth/login', '/media/a.webp', '/_astro/x.js']) expect(isReserved(path), path).toBe(true);
    expect(isReserved('/administrator-guide')).toBe(false);
    expect(isReserved('/services')).toBe(false);
  });
});

describe('normaliseTarget', () => {
  it('accepts site paths and https links only', () => {
    expect(normaliseTarget('/services/')).toBe('/services');
    expect(normaliseTarget('https://example.com/page')).toBe('https://example.com/page');
    expect(normaliseTarget('http://example.com')).toBeNull();
    expect(normaliseTarget('javascript:alert(1)')).toBeNull();
    expect(normaliseTarget('//evil.example')).toBeNull();
  });
});

describe('createsLoop', () => {
  const existing = new Map([['/b', '/c'], ['/c', '/a']]);
  it('finds direct and indirect loops', () => {
    expect(createsLoop(new Map(), '/a', '/a')).toBe(true);
    expect(createsLoop(existing, '/a', '/b')).toBe(true);
  });
  it('allows chains that end somewhere', () => {
    expect(createsLoop(existing, '/x', '/b')).toBe(false);
  });
});

describe('redirectProblems', () => {
  it('explains each problem', () => {
    expect(redirectProblems('/admin', '/services', new Map()).problems[0]).toContain('cannot be redirected');
    expect(redirectProblems('/old', '/new', new Map([['/old', '/x']])).problems[0]).toContain('already a redirect');
    expect(redirectProblems('/old', 'ftp://x', new Map()).problems[0]).toContain('“To”');
    expect(redirectProblems('/old/', '/services', new Map())).toEqual({ from: '/old', to: '/services', problems: [] });
  });
});

describe('redirectLocation', () => {
  it('carries the visitor’s query string over', () => {
    expect(redirectLocation('/services', '?utm_source=x')).toBe('/services?utm_source=x');
    expect(redirectLocation('https://x.com/?a=1', '?b=2')).toBe('https://x.com/?a=1');
    expect(redirectLocation('/services', '')).toBe('/services');
  });
});
