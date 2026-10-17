import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { AuditLog } from '../../../server/admin/audit';
import { errorResponse, requireAdmin } from '../../../server/admin/http';

export const prerender = false;

const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };
const MAX_BYTES = 5 * 1024 * 1024;

// Image upload (FR-108, Phase 1 basic upload). SVG is refused because it can carry scripts.
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const admin = requireAdmin(locals, 'media.upload');
    const form = await request.formData();
    const file = form.get('file');
    const alt = String(form.get('alt') ?? '').trim();
    if (!(file instanceof File)) return Response.json({ error: 'Choose an image to upload.' }, { status: 400 });
    const ext = TYPES[file.type];
    if (!ext) return Response.json({ error: 'Images must be JPG, PNG, WebP or AVIF.' }, { status: 415 });
    if (file.size > MAX_BYTES) return Response.json({ error: 'Images must be under 5 MB.' }, { status: 413 });
    if (alt.length < 3) return Response.json({ error: 'Describe the image for people who cannot see it.' }, { status: 422 });

    const key = `uploads/${crypto.randomUUID()}.${ext}`;
    await env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=31536000, immutable' } });
    const width = Number(form.get('width')) || null;
    const height = Number(form.get('height')) || null;
    await env.DB.prepare('INSERT INTO media (r2_key, filename, mime, bytes, width, height, alt, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(key, file.name.slice(0, 200), file.type, file.size, width, height, alt.slice(0, 300), admin.user.id)
      .run();
    await new AuditLog(env.DB).record(admin.actor, 'media.upload', 'media', key, file.name.slice(0, 100));
    return Response.json({ url: `/media/${key}`, alt });
  } catch (error) {
    return errorResponse(error);
  }
};
