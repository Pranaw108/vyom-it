import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { AuditLog } from '../../../server/admin/audit';
import { AccountTokens, TOKEN_HOURS } from '../../../server/admin/account-tokens';
import { UserStore } from '../../../server/admin/users';
import { SessionStore } from '../../../server/admin/sessions';
import { USERNAME_RE } from '../../../server/admin/password';
import { ROLE_LABELS, isRole, sanitiseGrants } from '../../../server/admin/permissions';
import { errorResponse, redirectWithMessage, requireAdmin } from '../../../server/admin/http';
import { cookie, signValue } from '../../../server/admin/session';

export const prerender = false;

const BACK = '/admin/users';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const LINK_COOKIE = 'vyom_link';

/**
 * Redirects back to Users with a one-time link shown once to the Owner. The link travels in a short-lived,
 * signed, HttpOnly cookie scoped to the Users page, never in the URL.
 */
async function backWithLink(origin: string, message: string, link: { token: string; username: string; purpose: 'setup' | 'reset' }, secure: boolean) {
  const value = await signValue(env.CSRF_SECRET, {
    url: `${origin}/auth/setup?token=${link.token}`,
    username: link.username,
    purpose: link.purpose,
    exp: Date.now() + 2 * 60_000,
  });
  const response = redirectWithMessage(BACK, message);
  response.headers.append('Set-Cookie', cookie(LINK_COOKIE, value, 120, secure, BACK));
  return response;
}

// Account management: Owners only (users.manage). There is no public sign-up anywhere.
export const POST: APIRoute = async ({ request, locals, url }) => {
  try {
    const admin = requireAdmin(locals, 'users.manage');
    const form = await request.formData();
    const users = new UserStore(env.DB);
    const audit = new AuditLog(env.DB);
    const sessions = new SessionStore(env.DB);
    const tokens = new AccountTokens(env.DB);
    const secure = url.protocol === 'https:';
    const action = form.get('action');

    if (action === 'create') {
      const username = String(form.get('username') ?? '').trim().toLowerCase();
      const name = String(form.get('name') ?? '').trim();
      const email = String(form.get('email') ?? '').trim().toLowerCase();
      const role = form.get('role');
      if (!USERNAME_RE.test(username)) return redirectWithMessage(BACK, 'Usernames are 3–32 characters: lowercase letters, numbers, dots, hyphens or underscores.', 'error');
      if (name.length < 2 || name.length > 80) return redirectWithMessage(BACK, 'Enter the person’s name.', 'error');
      if (!EMAIL_RE.test(email)) return redirectWithMessage(BACK, 'Enter the person’s email address.', 'error');
      if (!isRole(role)) return redirectWithMessage(BACK, 'Choose a role.', 'error');
      if (await users.findByUsername(username)) return redirectWithMessage(BACK, 'That username is already taken.', 'error');
      if (await users.findByEmail(email)) return redirectWithMessage(BACK, 'That email already belongs to an account.', 'error');
      const permissions = role === 'client' ? sanitiseGrants(form.getAll('permissions')) : [];
      const created = await users.create({ username, email, name, role, permissions, invitedBy: admin.user.id });
      const token = await tokens.issue(created.id, 'setup', admin.user.id);
      await audit.record(admin.actor, 'user.create', 'user', created.id, `${username} created as ${ROLE_LABELS[role]}${permissions.length ? ` (${permissions.join(', ')})` : ''}; setup link issued`);
      return backWithLink(url.origin, `${name} added as ${ROLE_LABELS[role]}. Send them the setup link below.`, { token, username, purpose: 'setup' }, secure);
    }

    const id = Number(form.get('id'));
    const target = Number.isInteger(id) ? await users.get(id) : null;
    if (!target) return redirectWithMessage(BACK, 'That account could not be found.', 'error');
    const isActiveOwner = target.role === 'owner' && target.status === 'active';
    const lastOwner = isActiveOwner && (await users.activeOwnerCount()) <= 1;

    if (action === 'role') {
      const role = form.get('role');
      if (!isRole(role)) return redirectWithMessage(BACK, 'Choose a role.', 'error');
      if (lastOwner && role !== 'owner') return redirectWithMessage(BACK, 'There must always be at least one Owner. Make someone else an Owner first.', 'error');
      const permissions = role === 'client' ? sanitiseGrants(form.getAll('permissions')) : [];
      await users.update(id, { role, permissions });
      await audit.record(admin.actor, 'user.role', 'user', id, `${target.username}: ${ROLE_LABELS[target.role]} → ${ROLE_LABELS[role]}${role === 'client' ? ` (${permissions.join(', ') || 'no extra permissions'})` : ''}`);
      return redirectWithMessage(BACK, `${target.name} is now ${ROLE_LABELS[role]}.`);
    }

    if (action === 'disable' || action === 'enable') {
      if (action === 'disable' && lastOwner) return redirectWithMessage(BACK, 'You cannot disable the last Owner.', 'error');
      await users.update(id, { status: action === 'disable' ? 'disabled' : 'active' });
      const revoked = action === 'disable' ? await sessions.revokeAll(id) : 0;
      await audit.record(admin.actor, `user.${action}`, 'user', id, `${target.username}${revoked ? `; ${revoked} session(s) signed out` : ''}`);
      return redirectWithMessage(BACK, action === 'disable' ? `${target.name} can no longer sign in and has been signed out everywhere.` : `${target.name} has access again.`);
    }

    if (action === 'revoke') {
      // Signing yourself out everywhere keeps this browser signed in.
      const keep = id === admin.user.id ? (admin.sessionTokenHash ?? undefined) : undefined;
      const revoked = await sessions.revokeAll(id, keep);
      await audit.record(admin.actor, 'user.sessions_revoked', 'user', id, `${revoked} session(s) signed out for ${target.username}`);
      return redirectWithMessage(BACK, `${revoked} session(s) signed out for ${target.name}.`);
    }

    if (action === 'reset') {
      if (target.status !== 'active') return redirectWithMessage(BACK, 'Enable the account before sending a reset link.', 'error');
      const token = await tokens.issue(id, target.hasPassword ? 'reset' : 'setup', admin.user.id);
      await audit.record(admin.actor, 'user.reset_link', 'user', id, `One-time ${target.hasPassword ? 'reset' : 'setup'} link issued for ${target.username} (valid ${TOKEN_HOURS[target.hasPassword ? 'reset' : 'setup']} h)`);
      return backWithLink(url.origin, `New link created for ${target.name}. Earlier links for this account no longer work.`, { token, username: target.username, purpose: target.hasPassword ? 'reset' : 'setup' }, secure);
    }

    return redirectWithMessage(BACK, 'Unknown action.', 'error');
  } catch (error) {
    return errorResponse(error, BACK);
  }
};
