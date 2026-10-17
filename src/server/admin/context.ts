import { verifyAccessToken } from './access';
import { AuditLog, type AuditActor } from './audit';
import { createCsrfToken } from './csrf';
import { UserStore, type AdminUser } from './users';
import { hashIp } from '../security/hash';
import { can, type Permission } from './permissions';

export interface AdminContext {
  user: AdminUser;
  actor: AuditActor;
  csrf: string;
  can: (permission: Permission) => boolean;
}

export type AdminResolution =
  | { ok: true; admin: AdminContext }
  | { ok: false; reason: 'signed-out' | 'no-access' | 'disabled'; email: string | null };

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

/** Who is signed in? Developer sign-in only ever works on localhost, so it can never apply in production. */
async function signedInEmail(request: Request, env: Env): Promise<string | null> {
  const host = new URL(request.url).hostname;
  if (env.DEV_ADMIN_EMAIL && LOCAL_HOSTS.has(host)) {
    // Local tests may act as another user to check role rules.
    return (request.headers.get('X-Dev-Admin-Email') ?? env.DEV_ADMIN_EMAIL).toLowerCase();
  }
  const cookie = request.headers.get('Cookie')?.match(/(?:^|;\s*)CF_Authorization=([^;]+)/)?.[1] ?? null;
  const token = request.headers.get('Cf-Access-Jwt-Assertion') ?? cookie;
  return verifyAccessToken(token, { teamDomain: env.ACCESS_TEAM_DOMAIN, audience: env.ACCESS_AUD });
}

export async function resolveAdmin(request: Request, env: Env): Promise<AdminResolution> {
  const email = await signedInEmail(request, env);
  if (!email) return { ok: false, reason: 'signed-out', email: null };

  const users = new UserStore(env.DB);
  const ipHash = await hashIp(request.headers.get('CF-Connecting-IP'), env.IP_HASH_SALT);
  let user = await users.findByEmail(email);

  // First run: the configured initial Owner is created on their first visit (no hard-coded accounts).
  if (!user && env.INITIAL_OWNER_EMAIL && email === env.INITIAL_OWNER_EMAIL.toLowerCase() && (await users.count()) === 0) {
    user = await users.create(email, email.split('@')[0] ?? email, 'owner', null);
    await new AuditLog(env.DB).record({ id: user.id, email, ipHash }, 'user.bootstrap', 'user', user.id, 'Initial Owner created from INITIAL_OWNER_EMAIL');
  }
  if (!user) return { ok: false, reason: 'no-access', email };
  if (user.status !== 'active') return { ok: false, reason: 'disabled', email };

  if (!user.lastSeenAt || Date.now() - Date.parse(user.lastSeenAt) > 5 * 60_000) await users.touch(user.id);

  const signedInUser = user;
  return {
    ok: true,
    admin: {
      user: signedInUser,
      actor: { id: signedInUser.id, email: signedInUser.email, ipHash },
      csrf: await createCsrfToken(env.CSRF_SECRET, signedInUser.email),
      can: (permission) => can(signedInUser.role, permission),
    },
  };
}
