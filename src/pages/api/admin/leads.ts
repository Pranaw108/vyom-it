import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { LEAD_STATUSES, LeadAdmin, type LeadStatus } from '../../../server/admin/leads';
import { errorResponse, redirectWithMessage, requireAdmin, safeReturnPath } from '../../../server/admin/http';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const form = await request.formData();
  const id = Number(form.get('id'));
  const back = safeReturnPath(form.get('return'), `/admin/leads/${id}`);
  try {
    const leads = new LeadAdmin(env.DB);
    const action = form.get('action');
    if (!Number.isInteger(id) || id < 1) return redirectWithMessage('/admin/leads', 'That lead could not be found.', 'error');

    if (action === 'status') {
      const admin = requireAdmin(locals, 'leads.update');
      const status = String(form.get('status')) as LeadStatus;
      if (!LEAD_STATUSES.includes(status)) return redirectWithMessage(back, 'Choose a valid status.', 'error');
      const changed = await leads.setStatus(admin, id, status);
      return redirectWithMessage(back, changed ? `Status changed to ${status}.` : 'No change made.');
    }

    if (action === 'note') {
      const admin = requireAdmin(locals, 'leads.update');
      const body = String(form.get('body') ?? '').trim();
      if (body.length < 2 || body.length > 2000) return redirectWithMessage(back, 'Notes must be between 2 and 2,000 characters.', 'error');
      await leads.addNote(admin, id, body);
      return redirectWithMessage(back, 'Note added.');
    }

    if (action === 'erase') {
      const admin = requireAdmin(locals, 'leads.erase');
      const reason = String(form.get('reason') ?? '').trim();
      if (form.get('confirm') !== 'ERASE') return redirectWithMessage(back, 'Type ERASE in capitals to confirm.', 'error');
      if (reason.length < 5) return redirectWithMessage(back, 'Give a short reason, e.g. "Deletion request by email on 3 Nov".', 'error');
      const erased = await leads.erase(admin, id, reason.slice(0, 300));
      return redirectWithMessage(back, erased ? 'Personal data erased. The record of the request is kept.' : 'This lead was already erased.');
    }

    return redirectWithMessage(back, 'Unknown action.', 'error');
  } catch (error) {
    return errorResponse(error, back);
  }
};
