import { verifyAccessToken } from './access';
import { AuditLog, type AuditActor } from './audit';
import { createCsrfToken } from './csrf';
import { UserStore, type AdminUser } from './users';
import { hashIp } from '../security/hash';
import { SessionStore, sessionToken } from './sessions';
import { can, type Permission } from './permissions';

export interface AdminContext {
  user: AdminUser;
  actor: AuditActor;
  csrf: string;
  /** Hash of the current session token; null when signed in through Cloudflare Access or local dev. */
  sessionTokenHash: string | null;
  can: (permission: Permission) => boolean;
}

export type AdminResolution =
  | { ok: true; admin: AdminContext }
  | { ok: false; reason: 'signed-out' | 'no-access' | 'disabled'; email: string | null };

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

type Identity = { kind: 'email'; email: string } | { kind: 'session'; userId: number; tokenHash: string };

/**
 * Who is signed in? In order: local developer sign-in (localhost only, so never in production),
 * Cloudflare Access (only when configured, token verified), then the server-side session cookie.
 * No client-supplied header is trusted unless it is verified.
 */
async function identify(request: Request, env: Env): Promise<Identity | null> {
  const host = new URL(request.url).hostname;
  if (env.DEV_ADMIN_EMAIL && LOCAL_HOSTS.has(host) && !request.headers.has('X-Dev-No-Bypass')) {
    // Local tests may act as another user to check role rules.
    return { kind: 'email', email: (request.headers.get('X-Dev-Admin-Email') ?? env.DEV_ADMIN_EMAIL).toLowerCase() };
  }
  const accessCookie = request.headers.get('Cookie')?.match(/(?:^|;\s*)CF_Authorization=([^;]+)/)?.[1] ?? null;
  const viaAccess = await verifyAccessToken(request.headers.get('Cf-Access-Jwt-Assertion') ?? accessCookie, {
    teamDomain: env.ACCESS_TEAM_DOMAIN,
    audience: env.ACCESS_AUD,
  });
  if (viaAccess) return { kind: 'email', email: viaAccess };

  const session = await new SessionStore(env.DB).find(sessionToken(request));
  return session ? { kind: 'session', userId: session.userId, tokenHash: session.tokenHash } : null;
}

/** Creates the first Owner from INITIAL_OWNER_EMAIL when no accounts exist yet (no hard-coded accounts). */
export async function bootstrapOwner(users: UserStore, env: Env, email: string, ipHash: string | null): Promise<AdminUser | null> {
  if (!env.INITIAL_OWNER_EMAIL || email !== env.INITIAL_OWNER_EMAIL.toLowerCase() || (await users.count()) !== 0) return null;
  const username = (email.split('@')[0] ?? 'owner').toLowerCase().replace(/[^a-z0-9._-]/g, '');
  const user = await users.create({ username, email, name: username, role: 'owner', invitedBy: null });
  await new AuditLog(env.DB).record({ id: user.id, email: user.username, ipHash }, 'user.bootstrap', 'user', user.id, 'Initial Owner created from INITIAL_OWNER_EMAIL');
  return user;
}

export async function resolveAdmin(request: Request, env: Env): Promise<AdminResolution> {
  const identity = await identify(request, env);
  if (!identity) return { ok: false, reason: 'signed-out', email: null };

  const users = new UserStore(env.DB);
  const ipHash = await hashIp(request.headers.get('CF-Connecting-IP'), env.IP_HASH_SALT);
  let user: AdminUser | null;
  if (identity.kind === 'session') {
    user = await users.get(identity.userId);
  } else {
    user = (await users.findByEmail(identity.email)) ?? (await bootstrapOwner(users, env, identity.email, ipHash));
  }
  const label = identity.kind === 'email' ? identity.email : (user?.username ?? null);
  if (!user) return { ok: false, reason: 'no-access', email: label };
  if (user.status !== 'active') return { ok: false, reason: 'disabled', email: label };

  if (!user.lastSeenAt || Date.now() - Date.parse(user.lastSeenAt) > 5 * 60_000) await users.touch(user.id);

  const signedInUser = user;
  return {
    ok: true,
    admin: {
      user: signedInUser,
      actor: { id: signedInUser.id, email: signedInUser.username, ipHash },
      csrf: await createCsrfToken(env.CSRF_SECRET, `user:${signedInUser.id}`),
      sessionTokenHash: identity.kind === 'session' ? identity.tokenHash : null,
      can: (permission) => can(signedInUser, permission),
    },
  };
}
