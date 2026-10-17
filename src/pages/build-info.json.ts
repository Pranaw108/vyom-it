import type { APIRoute } from 'astro';

// Written at build time. The admin dashboard compares it with the last publish to show
// whether the live site already includes the latest changes.
export const GET: APIRoute = () =>
  new Response(JSON.stringify({ builtAt: new Date().toISOString() }), { headers: { 'Content-Type': 'application/json' } });
