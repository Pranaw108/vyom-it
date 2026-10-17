import {
  BUDGETS,
  CONTACT_METHODS,
  PLATFORMS,
  PROJECT_TYPES,
  SERVICE_OPTIONS,
  TIMELINES,
  labelFor,
} from '../../lib/leads/validation';
import type { StoredLead } from '../leads/store';
import type { MailMessage } from './mailer';

// Everything a visitor typed is escaped before it goes into HTML (TC-010).
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function rows(lead: StoredLead): [string, string][] {
  const list: [string, string | null][] = [
    ['Name', lead.name],
    ['Email', lead.email],
    ['Phone', lead.phone],
    ['Company', lead.company],
    ['Country', lead.country],
    ['Preferred contact', labelFor(CONTACT_METHODS, lead.preferredContact)],
    ['Services', lead.services.map((s) => labelFor(SERVICE_OPTIONS, s)).join(', ') || null],
    ['Project type', lead.projectType ? labelFor(PROJECT_TYPES, lead.projectType) : null],
    ['Platforms', lead.platforms ? labelFor(PLATFORMS, lead.platforms) : null],
    ['Timeline', lead.timeline ? labelFor(TIMELINES, lead.timeline) : null],
    ['Budget', lead.budget ? labelFor(BUDGETS, lead.budget) : null],
    ['Link', lead.link],
    ['Came from', [lead.source.utmSource, lead.source.utmCampaign, lead.source.referrer].filter(Boolean).join(' · ') || null],
    ['Landing page', lead.source.landingPage],
    ['Marketing emails', lead.consentMarketing ? 'Yes' : 'No'],
  ];
  return list.filter((r): r is [string, string] => Boolean(r[1]));
}

function layout(title: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f6f8fc;font-family:Arial,Helvetica,sans-serif;color:#0b1324">
<div style="max-width:620px;margin:0 auto;padding:24px">
<div style="background:#ffffff;border:1px solid #dfe5ef;border-radius:12px;padding:24px">
<h1 style="font-size:20px;margin:0 0 16px">${title}</h1>${body}</div></div></body></html>`;
}

export function notificationEmail(lead: StoredLead, reference: string, recipients: string[], adminUrl: string, companyName: string): MailMessage {
  const service = lead.services.map((s) => labelFor(SERVICE_OPTIONS, s)).join(', ') || (lead.formType === 'contact' ? 'General enquiry' : 'Quote');
  const kind = lead.intent === 'audit' ? 'Website audit request' : lead.formType === 'quote' ? 'New quote request' : 'New message';
  const subject = `${kind} · ${service} · ${lead.name} (${reference})`;
  const table = rows(lead)
    .map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#56607a;vertical-align:top;white-space:nowrap">${escapeHtml(k)}</td><td style="padding:6px 0">${escapeHtml(v)}</td></tr>`)
    .join('');
  const html = layout(
    `${escapeHtml(kind)} (${escapeHtml(reference)})`,
    `<table style="border-collapse:collapse;font-size:14px">${table}</table>
<h2 style="font-size:15px;margin:20px 0 8px">Message</h2>
<p style="white-space:pre-wrap;font-size:14px;line-height:1.6;margin:0">${escapeHtml(lead.message)}</p>
<p style="margin:24px 0 0"><a href="${escapeHtml(adminUrl)}" style="background:#2e5bff;color:#fff;padding:10px 16px;border-radius:999px;text-decoration:none;font-size:14px">Open in admin</a></p>
<p style="color:#56607a;font-size:12px;margin-top:16px">Reply to this email to answer ${escapeHtml(lead.name)} directly. Sent by the ${escapeHtml(companyName)} website.</p>`,
  );
  const text = [
    `${kind} (${reference})`,
    '',
    ...rows(lead).map(([k, v]) => `${k}: ${v}`),
    '',
    'Message:',
    lead.message,
    '',
    `Open in admin: ${adminUrl}`,
  ].join('\n');
  return { to: recipients, subject, html, text, replyTo: lead.email };
}

export function acknowledgementEmail(lead: StoredLead, reference: string, replyTime: string, companyName: string, replyTo?: string): MailMessage {
  const firstName = lead.name.split(/\s+/)[0] ?? lead.name;
  const subject = `We've received your request (${reference})`;
  const html = layout(
    `Thanks, ${escapeHtml(firstName)}`,
    `<p style="font-size:15px;line-height:1.6">We've received your ${lead.formType === 'quote' ? 'quote request' : 'message'} and will reply ${escapeHtml(replyTime)}.</p>
<p style="font-size:15px;line-height:1.6">Your reference is <strong>${escapeHtml(reference)}</strong>. Simply reply to this email if you want to add anything.</p>
<h2 style="font-size:15px;margin:20px 0 8px">What you sent</h2>
<p style="white-space:pre-wrap;font-size:14px;line-height:1.6;color:#56607a;margin:0">${escapeHtml(lead.message)}</p>
<p style="color:#56607a;font-size:12px;margin-top:24px">${escapeHtml(companyName)}. You are receiving this because you contacted us through our website.</p>`,
  );
  const text = `Thanks, ${firstName}\n\nWe've received your request and will reply ${replyTime}.\nYour reference is ${reference}.\n\nWhat you sent:\n${lead.message}\n\n${companyName}`;
  return { to: [lead.email], subject, html, text, ...(replyTo ? { replyTo } : {}) };
}
