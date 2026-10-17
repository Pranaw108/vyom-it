// Lead form rules, shared by the browser and the server. No dependencies, so it stays tiny in the browser.
// The server result is the one that counts; browser checks only save the visitor a round trip.

export const SERVICE_OPTIONS = [
  { value: 'website-development', label: 'Website development' },
  { value: 'mobile-app-development', label: 'Mobile app development' },
  { value: 'ui-ux-design', label: 'UI/UX design' },
  { value: 'digital-marketing-seo', label: 'Digital marketing and SEO' },
  { value: 'not-sure', label: 'Not sure yet' },
] as const;

export const PROJECT_TYPES = [
  { value: 'new', label: 'A new product or website' },
  { value: 'redesign', label: 'A redesign' },
  { value: 'improve', label: 'Improving something that exists' },
  { value: 'not-sure', label: 'Not sure yet' },
] as const;

export const PLATFORMS = [
  { value: 'ios', label: 'iOS' },
  { value: 'android', label: 'Android' },
  { value: 'both', label: 'Both' },
  { value: 'not-sure', label: 'Not sure' },
] as const;

export const TIMELINES = [
  { value: 'asap', label: 'As soon as possible' },
  { value: '1-month', label: 'Within 1 month' },
  { value: '1-3-months', label: '1 to 3 months' },
  { value: '3-6-months', label: '3 to 6 months' },
  { value: 'flexible', label: 'Flexible' },
] as const;

// Budget ranges in Indian rupees, with options to skip (client decision Q-02).
export const BUDGETS = [
  { value: 'under-50k', label: 'Under ₹50,000' },
  { value: '50k-1l', label: '₹50,000 – ₹1,00,000' },
  { value: '1l-3l', label: '₹1,00,000 – ₹3,00,000' },
  { value: '3l-10l', label: '₹3,00,000 – ₹10,00,000' },
  { value: 'above-10l', label: 'Above ₹10,00,000' },
  { value: 'not-sure', label: 'Not sure yet' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' },
] as const;

export const CONTACT_METHODS = [
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone call' },
  { value: 'whatsapp', label: 'WhatsApp' },
] as const;

export const CONSENT_VERSION = '2026-10-17';
export const MIN_FILL_MS = 3000;

type Values<T extends readonly { value: string }[]> = T[number]['value'];

export type FormType = 'contact' | 'quote';

export interface LeadSource {
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  landingPage: string | null;
}

export interface LeadData {
  formType: FormType;
  submissionId: string;
  intent: 'general' | 'audit';
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  country: string | null;
  message: string;
  services: Values<typeof SERVICE_OPTIONS>[];
  projectType: Values<typeof PROJECT_TYPES> | null;
  platforms: Values<typeof PLATFORMS> | null;
  link: string | null;
  timeline: Values<typeof TIMELINES> | null;
  budget: Values<typeof BUDGETS> | null;
  preferredContact: Values<typeof CONTACT_METHODS>;
  consentContact: true;
  consentMarketing: boolean;
  consentVersion: string;
  source: LeadSource;
}

export type FieldErrors = Partial<Record<string, string>>;
export type ValidationResult = { ok: true; data: LeadData } | { ok: false; errors: FieldErrors };

export const MESSAGES = {
  name: 'Enter your name (at least 2 letters).',
  email: 'Enter an email address like name@company.com.',
  phone: 'Enter a phone number with country code, like +91 98765 43210.',
  company: 'Company name must be 100 characters or fewer.',
  country: 'Country must be 60 characters or fewer.',
  services: 'Choose at least one service, or pick "Not sure yet".',
  projectType: 'Choose what kind of project this is.',
  platforms: 'Choose which phones the app is for.',
  messageContact: 'Write a short message (at least 10 characters).',
  messageQuote: 'Tell us a little more (at least 30 characters) so we can reply properly.',
  messageLong: 'Please keep your message under 2,000 characters.',
  link: 'Enter a full link starting with https://.',
  timeline: 'Choose a timeline. "Flexible" is fine.',
  budget: 'Choose a budget range. "Not sure yet" or "Prefer not to say" are fine.',
  preferredContact: 'Choose how you would like us to contact you.',
  consentContact: 'Please confirm we can contact you about this request.',
} as const;

const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const optional = (v: unknown, max: number): string | null => {
  const s = str(v).slice(0, max);
  return s.length ? s : null;
};
const oneOf = <T extends readonly { value: string }[]>(options: T, v: unknown): Values<T> | null =>
  options.some((o) => o.value === v) ? (v as Values<T>) : null;

/** Normalises a phone number to E.164 (+ and digits). Returns null if it is not plausible. */
export function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/[\s()-]/g, '');
  if (!/^\+?\d{7,15}$/.test(digits)) return null;
  if (digits.startsWith('+')) return digits;
  // A bare 10-digit number is treated as Indian.
  return digits.length === 10 ? `+91${digits}` : `+${digits}`;
}

function sanitiseSource(raw: unknown): LeadSource {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    referrer: optional(s.referrer, 300),
    utmSource: optional(s.utmSource, 100),
    utmMedium: optional(s.utmMedium, 100),
    utmCampaign: optional(s.utmCampaign, 100),
    landingPage: optional(s.landingPage, 300),
  };
}

/** Validates one complete submission. Unknown fields are ignored. */
export function validateLead(raw: unknown): ValidationResult {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const errors: FieldErrors = {};
  const formType: FormType = input.formType === 'quote' ? 'quote' : 'contact';

  const submissionId = str(input.submissionId);
  if (!UUID_RE.test(submissionId)) errors.submissionId = 'Refresh the page and try again.';

  const name = str(input.name);
  if (name.length < 2 || name.length > 80 || !NAME_RE.test(name)) errors.name = MESSAGES.name;

  const email = str(input.email).toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) errors.email = MESSAGES.email;

  const phoneRaw = str(input.phone);
  const phone = phoneRaw ? normalisePhone(phoneRaw) : null;
  if (phoneRaw && !phone) errors.phone = MESSAGES.phone;

  const companyRaw = str(input.company);
  if (companyRaw.length > 100) errors.company = MESSAGES.company;
  const countryRaw = str(input.country);
  if (countryRaw.length > 60) errors.country = MESSAGES.country;

  const message = str(input.message);
  const minMessage = formType === 'quote' ? 30 : 10;
  if (message.length < minMessage) errors.message = formType === 'quote' ? MESSAGES.messageQuote : MESSAGES.messageContact;
  else if (message.length > 2000) errors.message = MESSAGES.messageLong;

  const linkRaw = str(input.link);
  let link: string | null = null;
  if (linkRaw) {
    try {
      const url = new URL(linkRaw);
      if (url.protocol !== 'https:' || linkRaw.length > 300) throw new Error('bad link');
      link = url.toString();
    } catch {
      errors.link = MESSAGES.link;
    }
  }

  const servicesRaw = Array.isArray(input.services) ? input.services : [];
  const services = [...new Set(servicesRaw.map((s) => oneOf(SERVICE_OPTIONS, s)).filter((s) => s !== null))];

  let projectType: LeadData['projectType'] = null;
  let platforms: LeadData['platforms'] = null;
  let timeline: LeadData['timeline'] = null;
  let budget: LeadData['budget'] = null;

  if (formType === 'quote') {
    if (services.length === 0) errors.services = MESSAGES.services;
    projectType = oneOf(PROJECT_TYPES, input.projectType);
    if (!projectType) errors.projectType = MESSAGES.projectType;
    if (services.includes('mobile-app-development')) {
      platforms = oneOf(PLATFORMS, input.platforms);
      if (!platforms) errors.platforms = MESSAGES.platforms;
    }
    timeline = oneOf(TIMELINES, input.timeline);
    if (!timeline) errors.timeline = MESSAGES.timeline;
    budget = oneOf(BUDGETS, input.budget);
    if (!budget) errors.budget = MESSAGES.budget;
  }

  const preferredContact = oneOf(CONTACT_METHODS, input.preferredContact ?? 'email');
  if (!preferredContact) errors.preferredContact = MESSAGES.preferredContact;
  if ((preferredContact === 'phone' || preferredContact === 'whatsapp') && !phone && !errors.phone) {
    errors.phone = 'Add a phone number so we can reach you that way.';
  }

  if (input.consentContact !== true) errors.consentContact = MESSAGES.consentContact;

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: {
      formType,
      submissionId: submissionId.toLowerCase(),
      intent: input.intent === 'audit' ? 'audit' : 'general',
      name,
      email,
      phone,
      company: companyRaw || null,
      country: countryRaw || null,
      message,
      services,
      projectType,
      platforms,
      link,
      timeline,
      budget,
      preferredContact: preferredContact!,
      consentContact: true,
      consentMarketing: input.consentMarketing === true,
      consentVersion: CONSENT_VERSION,
      source: sanitiseSource(input.source),
    },
  };
}

/** Errors for only the fields shown on one quote step, so the visitor can move on step by step. */
export function stepErrors(raw: Record<string, unknown>, fields: string[]): FieldErrors {
  const result = validateLead({ ...raw, formType: 'quote', submissionId: raw.submissionId ?? '00000000-0000-4000-8000-000000000000' });
  if (result.ok) return {};
  return Object.fromEntries(Object.entries(result.errors).filter(([k]) => fields.includes(k)));
}

export const labelFor = (options: readonly { value: string; label: string }[], value: string | null) =>
  options.find((o) => o.value === value)?.label ?? value ?? '';

/** Human reference for a stored lead, e.g. VY-26-0042. */
export const leadReference = (id: number, createdAt: string) => `VY-${createdAt.slice(2, 4)}-${String(id).padStart(4, '0')}`;
