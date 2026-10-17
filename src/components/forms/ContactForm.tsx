import { useEffect, useState } from 'preact/hooks';
import { CONTACT_METHODS, MESSAGES, validateLead, type FieldErrors } from '../../lib/leads/validation';
import { ChoiceGroup, ErrorSummary, FailurePanel, Field, Honeypot, SuccessPanel } from './fields';
import Turnstile from './Turnstile';
import { useLeadSubmit } from './useLeadSubmit';

interface Props {
  siteKey: string;
  email: string | null;
  replyTime: string;
}

const LABELS: Record<string, string> = {
  name: 'Name',
  email: 'Email',
  phone: 'Phone',
  company: 'Company',
  message: 'Message',
  preferredContact: 'Preferred contact',
  consentContact: 'Consent',
};

export default function ContactForm({ siteKey, email, replyTime }: Props) {
  const [values, setValues] = useState({ name: '', email: '', phone: '', company: '', message: '', preferredContact: 'email', website: '' });
  const [consent, setConsent] = useState({ contact: false, marketing: false });
  const [intent, setIntent] = useState<'general' | 'audit'>('general');
  const [token, setToken] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const { state, serverErrors, submit } = useLeadSubmit();

  useEffect(() => {
    if (new URL(location.href).searchParams.get('intent') === 'audit') {
      setIntent('audit');
      setValues((v) => (v.message ? v : { ...v, message: 'Please review my website: ' }));
    }
  }, []);
  useEffect(() => setErrors((e) => ({ ...e, ...serverErrors })), [serverErrors]);
  useEffect(() => {
    if (state.phase === 'success') document.getElementById('form-success')?.focus();
  }, [state.phase]);

  const set = (key: keyof typeof values) => (e: Event) => setValues({ ...values, [key]: (e.currentTarget as HTMLInputElement).value });
  const payload = () => ({ ...values, formType: 'contact', intent, consentContact: consent.contact, consentMarketing: consent.marketing, turnstileToken: token });

  function onBlur(field: string) {
    const result = validateLead({ ...payload(), submissionId: '00000000-0000-4000-8000-000000000000' });
    setErrors((e) => ({ ...e, [field]: result.ok ? undefined : result.errors[field] }));
  }

  function onSubmit(event: Event) {
    event.preventDefault();
    const result = validateLead({ ...payload(), submissionId: '00000000-0000-4000-8000-000000000000' });
    if (!result.ok) {
      setErrors(result.errors);
      requestAnimationFrame(() => document.getElementById('error-summary')?.focus());
      return;
    }
    setErrors({});
    submit(payload());
  }

  if (state.phase === 'success') return <SuccessPanel reference={state.reference} name={values.name} replyTime={replyTime} />;

  const visibleErrors = Object.fromEntries(Object.entries(errors).filter(([k]) => k in LABELS));
  return (
    <form class="lead-form" noValidate onSubmit={onSubmit} aria-label="Contact form">
      <ErrorSummary errors={visibleErrors} labels={LABELS} />
      {intent === 'audit' && <p class="intent-note">You're requesting a free website audit. Include your website address in the message.</p>}
      <div class="grid gap-5 sm:grid-cols-2">
        <Field id="name" label="Your name" error={errors.name}>
          {(d) => <input id="name" name="name" autoComplete="name" required value={values.name} onInput={set('name')} onBlur={() => onBlur('name')} aria-invalid={errors.name ? 'true' : undefined} aria-describedby={d} />}
        </Field>
        <Field id="email" label="Email" error={errors.email}>
          {(d) => <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required value={values.email} onInput={set('email')} onBlur={() => onBlur('email')} aria-invalid={errors.email ? 'true' : undefined} aria-describedby={d} />}
        </Field>
        <Field id="phone" label="Phone" optional error={errors.phone} hint="With country code, e.g. +91 98765 43210">
          {(d) => <input id="phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" value={values.phone} onInput={set('phone')} onBlur={() => onBlur('phone')} aria-invalid={errors.phone ? 'true' : undefined} aria-describedby={d} />}
        </Field>
        <Field id="company" label="Company" optional error={errors.company}>
          {(d) => <input id="company" name="company" autoComplete="organization" value={values.company} onInput={set('company')} aria-describedby={d} />}
        </Field>
      </div>
      <Field id="message" label="How can we help?" error={errors.message}>
        {(d) => (
          <>
            <textarea id="message" name="message" rows={6} required maxLength={2000} value={values.message} onInput={set('message')} onBlur={() => onBlur('message')} aria-invalid={errors.message ? 'true' : undefined} aria-describedby={d} />
            <p class="field-counter" aria-live="polite">{values.message.length} / 2,000</p>
          </>
        )}
      </Field>
      <ChoiceGroup name="preferredContact" legend="How should we reply?" options={CONTACT_METHODS} selected={[values.preferredContact]} error={errors.preferredContact} onChange={([v]) => setValues({ ...values, preferredContact: v ?? 'email' })} />

      <div class="consents">
        <label class="check">
          <input id="consentContact" type="checkbox" checked={consent.contact} onChange={(e) => setConsent({ ...consent, contact: e.currentTarget.checked })} aria-invalid={errors.consentContact ? 'true' : undefined} aria-describedby={errors.consentContact ? 'consentContact-error' : undefined} />
          <span>I agree that the team may contact me about this enquiry.</span>
        </label>
        {errors.consentContact && <p id="consentContact-error" class="field-error">{MESSAGES.consentContact}</p>}
        <label class="check">
          <input type="checkbox" checked={consent.marketing} onChange={(e) => setConsent({ ...consent, marketing: e.currentTarget.checked })} />
          <span>Send me occasional updates and articles (optional).</span>
        </label>
      </div>

      <Honeypot value={values.website} onInput={(v) => setValues({ ...values, website: v })} />
      <Turnstile siteKey={siteKey} onToken={setToken} />
      {state.phase === 'error' && <FailurePanel message={state.message} email={email} />}

      <div class="form-actions">
        <button type="submit" class="submit-btn" aria-busy={state.phase === 'sending'} disabled={state.phase === 'sending'}>
          {state.phase === 'sending' ? <><span class="spinner" aria-hidden="true" />Sending…</> : 'Send message'}
        </button>
        <p class="privacy-note">We use your details only to reply to you. See our <a href="/privacy">privacy policy</a>.</p>
      </div>
    </form>
  );
}
