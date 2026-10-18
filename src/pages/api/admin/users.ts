import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { AuditLog } from '../../../server/admin/audit';
import { UserStore } from '../../../server/admin/users';
import { ROLE_LABELS, isRole } from '../../../server/admin/permissions';
import { errorResponse, redirectWithMessage, requireAdmin } from '../../../server/admin/http';

export const prerender = false;

const BACK = '/admin/users';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const admin = requireAdmin(locals, 'users.manage');
    const form = await request.formData();
    const users = new UserStore(env.DB);
    const audit = new AuditLog(env.DB);
    const action = form.get('action');

    if (action === 'invite') {
      const email = String(form.get('email') ?? '').trim().toLowerCase();
      const name = String(form.get('name') ?? '').trim();
      const role = form.get('role');
      if (!EMAIL_RE.test(email)) return redirectWithMessage(BACK, 'Enter a valid email address.', 'error');
      if (name.length < 2) return redirectWithMessage(BACK, 'Enter the person’s name.', 'error');
      if (!isRole(role)) return redirectWithMessage(BACK, 'Choose a role.', 'error');
      if (await users.findByEmail(email)) return redirectWithMessage(BACK, 'That email already has access.', 'error');
      const created = await users.create(email, name, role, admin.user.id);
      await audit.record(admin.actor, 'user.invite', 'user', created.id, `${email} added as ${ROLE_LABELS[role]}`);
      return redirectWithMessage(BACK, `${name} added as ${ROLE_LABELS[role]}. They can now sign in with Google as ${email}.`);
    }

    const id = Number(form.get('id'));
    const target = Number.isInteger(id) ? await users.get(id) : null;
    if (!target) return redirectWithMessage(BACK, 'That user could not be found.', 'error');
    const removesAnOwner = target.role === 'owner' && target.status === 'active';

    if (action === 'role') {
      const role = form.get('role');
      if (!isRole(role)) return redirectWithMessage(BACK, 'Choose a role.', 'error');
      if (removesAnOwner && role !== 'owner' && (await users.activeOwnerCount()) <= 1) {
        return redirectWithMessage(BACK, 'There must always be at least one Owner. Make someone else an Owner first.', 'error');
      }
      await users.update(id, { role });
      await audit.record(admin.actor, 'user.role', 'user', id, `${target.email}: ${ROLE_LABELS[target.role]} → ${ROLE_LABELS[role]}`);
      return redirectWithMessage(BACK, `${target.name} is now ${ROLE_LABELS[role]}.`);
    }

    if (action === 'disable' || action === 'enable') {
      if (action === 'disable' && removesAnOwner && (await users.activeOwnerCount()) <= 1) {
        return redirectWithMessage(BACK, 'You cannot disable the last Owner.', 'error');
      }
      await users.update(id, { status: action === 'disable' ? 'disabled' : 'active' });
      await audit.record(admin.actor, `user.${action}`, 'user', id, target.email);
      return redirectWithMessage(BACK, action === 'disable' ? `${target.name} can no longer sign in.` : `${target.name} has access again.`);
    }

    return redirectWithMessage(BACK, 'Unknown action.', 'error');
  } catch (error) {
    return errorResponse(error, BACK);
  }
};
