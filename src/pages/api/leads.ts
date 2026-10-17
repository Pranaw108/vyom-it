import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { deliverLeadEmails, submitLead } from '../../server/leads/service';
import { leadDepsFromEnv } from '../../server/leads/deps';

export const prerender = false;

const MAX_BODY_BYTES = 10_000;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  });

export const POST: APIRoute = async ({ request, locals }) => {
  const tooLarge = () => json(413, { error: 'too-large', message: 'Your message is too long. Please shorten it and try again.' });
  if (Number(request.headers.get('Content-Length') ?? 0) > MAX_BODY_BYTES) return tooLarge();
  // The (small) body is read before any other check, so every request completes cleanly.
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return tooLarge();

  // Only same-site JSON posts are accepted.
  const origin = request.headers.get('Origin');
  if (!origin || origin !== new URL(request.url).origin) return json(403, { error: 'forbidden' });
  if (!request.headers.get('Content-Type')?.includes('application/json')) return json(415, { error: 'unsupported' });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: 'bad-json', message: 'Something went wrong sending the form. Please try again.' });
  }

  const deps = leadDepsFromEnv(env);
  const ip = request.headers.get('CF-Connecting-IP');

  try {
    const outcome = await submitLead(body, ip, deps);
    switch (outcome.kind) {
      case 'created':
        // Emails go out after the reply, so the visitor is never kept waiting on the email provider.
        locals.cfContext.waitUntil(
          deliverLeadEmails(outcome.leadId, deps).catch((error) => console.error(`lead ${outcome.leadId}: delivery crashed`, error)),
        );
        return json(201, { reference: outcome.reference });
      case 'silently-dropped':
        return json(201, { reference: 'VY-RECEIVED' });
      case 'invalid':
        return json(422, { error: 'invalid', errors: outcome.errors });
      case 'not-human':
        return json(400, { error: 'verification', message: "We couldn't verify you're human. Please try again." });
      case 'rate-limited':
        return json(429, { error: 'rate-limited', message: 'Too many attempts. Please wait a few minutes and try again.' });
    }
  } catch (error) {
    // Most likely the database is unavailable. The visitor keeps their data and gets another way to reach us.
    console.error('lead submission failed', error);
    return json(503, { error: 'unavailable', message: 'Our form is having trouble right now. Your details are still here. Please try again in a moment.' });
  }
};

export const ALL: APIRoute = () => json(405, { error: 'method-not-allowed' });
