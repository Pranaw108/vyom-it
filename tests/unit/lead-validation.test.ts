import { describe, expect, it } from 'vitest';
import { leadReference, normalisePhone, stepErrors, validateLead } from '../../src/lib/leads/validation';

const base = {
  formType: 'quote',
  submissionId: '3f2b8c1e-4a5d-4e6f-8a7b-9c0d1e2f3a4b',
  name: 'Priya Sharma',
  email: 'Priya@Example.com',
  message: 'We need a booking app for our clinics with online payments.',
  services: ['mobile-app-development'],
  projectType: 'new',
  platforms: 'both',
  timeline: 'asap',
  budget: 'prefer-not-to-say',
  preferredContact: 'email',
  consentContact: true,
};

describe('validateLead', () => {
  it('accepts a complete quote and normalises the email', () => {
    const result = validateLead(base);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.email).toBe('priya@example.com');
  });

  it('requires consent', () => {
    const result = validateLead({ ...base, consentContact: false });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.consentContact).toBeDefined();
  });

  it('requires platforms only when mobile is chosen', () => {
    expect(validateLead({ ...base, platforms: '' }).ok).toBe(false);
    expect(validateLead({ ...base, services: ['website-development'], platforms: '' }).ok).toBe(true);
  });

  it('rejects values outside the allowed lists', () => {
    const result = validateLead({ ...base, budget: 'a million', services: ['hacking'] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.budget).toBeDefined();
      expect(result.errors.services).toBeDefined();
    }
  });

  it('rejects non-https links and bad submission ids', () => {
    const result = validateLead({ ...base, link: 'javascript:alert(1)', submissionId: 'abc' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.link).toBeDefined();
      expect(result.errors.submissionId).toBeDefined();
    }
  });

  it('needs a phone number when the visitor asks for a call', () => {
    const result = validateLead({ ...base, preferredContact: 'phone' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.phone).toBeDefined();
  });

  it('applies the shorter message rule to the contact form and ignores quote fields', () => {
    const result = validateLead({ formType: 'contact', submissionId: base.submissionId, name: 'Ravi', email: 'ravi@example.in', message: 'Hello there team', consentContact: true });
    expect(result.ok).toBe(true);
  });

  it('drops unknown fields instead of storing them', () => {
    const result = validateLead({ ...base, isAdmin: true });
    expect(result.ok && 'isAdmin' in result.data).toBe(false);
  });
});

describe('helpers', () => {
  it('normalises Indian and international phone numbers', () => {
    expect(normalisePhone('98765 43210')).toBe('+919876543210');
    expect(normalisePhone('+44 20 7946 0958')).toBe('+442079460958');
    expect(normalisePhone('12')).toBeNull();
  });

  it('reports only the errors for the current quote step', () => {
    expect(Object.keys(stepErrors({ services: [], projectType: '' }, ['services', 'projectType']))).toEqual(['services', 'projectType']);
  });

  it('formats references', () => {
    expect(leadReference(42, '2026-10-17T10:00:00.000Z')).toBe('VY-26-0042');
  });
});
