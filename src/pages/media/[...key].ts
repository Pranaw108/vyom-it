import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const prerender = false;

// Serves uploaded images from R2. Keys are random, so files are cached for a year.
export const GET: APIRoute = async ({ params }) => {
  const key = params.key ?? '';
  if (!/^uploads\/[0-9a-f-]{36}\.(jpg|png|webp|avif)$/.test(key)) return new Response('Not found', { status: 404 });
  const media = (env as Partial<Env>).MEDIA;
  if (!media) return new Response('Not found', { status: 404 });
  const object = await media.get(key);
  if (!object) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  return new Response(object.body, { headers });
};
