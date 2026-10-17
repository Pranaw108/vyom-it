import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { LeadAdmin } from '../../../server/admin/leads';
import { errorResponse, requireAdmin } from '../../../server/admin/http';

export const prerender = false;

// CSV export of the filtered leads list. Owners only; every export is written to the audit log.
export const GET: APIRoute = async ({ url, locals }) => {
  try {
    const admin = requireAdmin(locals, 'leads.export');
    const csv = await new LeadAdmin(env.DB).exportCsv(admin, {
      status: url.searchParams.get('status') ?? '',
      formType: url.searchParams.get('type') ?? '',
      q: url.searchParams.get('q') ?? '',
    });
    const date = new Date().toISOString().slice(0, 10);
    return new Response(`﻿${csv}`, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="leads-${date}.csv"`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
};
