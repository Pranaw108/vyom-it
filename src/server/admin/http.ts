import type { AdminContext } from './context';
import type { Permission } from './permissions';

// Small helpers shared by admin routes.

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function requireAdmin(locals: App.Locals, permission?: Permission): AdminContext {
  const admin = locals.admin;
  if (!admin) throw new HttpError(401, 'Please sign in.');
  if (permission && !admin.can(permission)) throw new HttpError(403, 'Your role does not allow this action.');
  return admin;
}

/** Post-redirect-get back to an admin page with a short message for the visitor. */
export function redirectWithMessage(path: string, message: string, tone: 'ok' | 'error' = 'ok'): Response {
  const url = new URL(path, 'http://x');
  url.searchParams.set(tone === 'ok' ? 'msg' : 'err', message);
  return new Response(null, { status: 303, headers: { Location: `${url.pathname}${url.search}` } });
}

export function errorResponse(error: unknown, fallbackPath?: string): Response {
  if (error instanceof HttpError) {
    return fallbackPath ? redirectWithMessage(fallbackPath, error.message, 'error') : Response.json({ error: error.message }, { status: error.status });
  }
  console.error('admin request failed', error);
  const message = 'Something went wrong. Please try again.';
  return fallbackPath ? redirectWithMessage(fallbackPath, message, 'error') : Response.json({ error: message }, { status: 500 });
}

/** Only same-site admin paths are allowed as redirect targets. */
export function safeReturnPath(value: FormDataEntryValue | null, fallback: string): string {
  return typeof value === 'string' && value.startsWith('/admin') && !value.startsWith('//') ? value : fallback;
}
