import type { APIRoute } from 'astro';

// Preview and temporary deployments must never be indexed (FR-113).
export const GET: APIRoute = ({ site }) => {
  const indexing = import.meta.env.PUBLIC_INDEXING !== 'false';
  const body = indexing
    ? `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${new URL('/sitemap-index.xml', site)}\n`
    : 'User-agent: *\nDisallow: /\n';
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
