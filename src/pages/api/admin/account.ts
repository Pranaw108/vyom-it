import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { AuditLog } from '../../../server/admin/audit';
import { UserStore } from '../../../server/admin/users';
import { SessionStore } from '../../../server/admin/sessions';
import { hashPassword, passwordProblems, verifyPassword } from '../../../server/admin/password';
import { errorResponse, redirectWithMessage, requireAdmin } from '../../../server/admin/http';

export const prerender = false;

const BACK = '/admin/account';

// The signed-in person's own account: change password, sign out other devices.
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const admin = requireAdmin(locals, 'dashboard.view');
    const form = await request.formData();
    const users = new UserStore(env.DB);
    const sessions = new SessionStore(env.DB);
    const audit = new AuditLog(env.DB);
    const keep = admin.sessionTokenHash ?? undefined;

    if (form.get('action') === 'password') {
      if (!env.PASSWORD_PEPPER) return redirectWithMessage(BACK, 'Password sign-in is not set up on the server yet.', 'error');
      const stored = await users.passwordHash(admin.user.id);
      if (stored && !(await verifyPassword(String(form.get('current') ?? ''), stored, env.PASSWORD_PEPPER))) {
        await audit.record(admin.actor, 'auth.password_change_failed', 'user', admin.user.id, 'Wrong current password');
        return redirectWithMessage(BACK, 'Your current password is not right.', 'error');
      }
      const password = String(form.get('password') ?? '');
      const problems = passwordProblems(password, admin.user.username);
      if (password !== String(form.get('confirm') ?? '')) problems.push('The two new passwords do not match.');
      if (problems.length) return redirectWithMessage(BACK, problems.join(' '), 'error');
      await users.setPasswordHash(admin.user.id, await hashPassword(password, env.PASSWORD_PEPPER));
      const revoked = await sessions.revokeAll(admin.user.id, keep);
      await audit.record(admin.actor, 'auth.password_changed', 'user', admin.user.id, `${revoked} other session(s) signed out`);
      return redirectWithMessage(BACK, `Password changed.${revoked ? ` ${revoked} other device(s) signed out.` : ''}`);
    }

    if (form.get('action') === 'sign-out-others') {
      const revoked = await sessions.revokeAll(admin.user.id, keep);
      await audit.record(admin.actor, 'user.sessions_revoked', 'user', admin.user.id, `Signed out ${revoked} other session(s)`);
      return redirectWithMessage(BACK, `${revoked} other session(s) signed out.`);
    }

    return redirectWithMessage(BACK, 'Unknown action.', 'error');
  } catch (error) {
    return errorResponse(error, BACK);
  }
};
