import { useEffect, useRef, useState } from 'preact/hooks';
import {
  BUDGETS,
  CONTACT_METHODS,
  MESSAGES,
  PLATFORMS,
  PROJECT_TYPES,
  SERVICE_OPTIONS,
  TIMELINES,
  labelFor,
  stepErrors,
  type FieldErrors,
} from '../../lib/leads/validation';
import { ChoiceGroup, ErrorSummary, FailurePanel, Field, Honeypot, SuccessPanel } from './fields';
import Turnstile from './Turnstile';
import { useLeadSubmit } from './useLeadSubmit';

interface Props {
  siteKey: string;
  email: string | null;
  replyTime: string;
}

const DRAFT_KEY = 'vyom-quote-draft';
const STEPS = ['What you need', 'Your project', 'Your details'] as const;
const STEP_FIELDS = [
  ['services', 'projectType'],
  ['platforms', 'message', 'link', 'timeline', 'budget'],
  ['name', 'email', 'phone', 'company', 'country', 'preferredContact', 'consentContact'],
];
const LABELS: Record<string, string> = {
  services: 'Services',
  projectType: 'Project type',
  platforms: 'Platforms',
  message: 'Project description',
  link: 'Link',
  timeline: 'Timeline',
  budget: 'Budget',
  name: 'Name',
  email: 'Email',
  phone: 'Phone',
  company: 'Company',
  country: 'Country',
  preferredContact: 'Preferred contact',
  consentContact: 'Consent',
};

interface Values {
  services: string[];
  projectType: string;
  platforms: string;
  message: string;
  link: string;
  timeline: string;
  budget: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  country: string;
  preferredContact: string;
  consentContact: boolean;
  consentMarketing: boolean;
  website: string;
}

const EMPTY: Values = {
  services: [], projectType: '', platforms: '', message: '', link: '', timeline: '', budget: '',
  name: '', email: '', phone: '', company: '', country: 'India', preferredContact: 'email',
  consentContact: false, consentMarketing: false, website: '',
};

// Session storage can be blocked (private mode); the form must work without it.
function loadDraft(): Partial<Values> {
  try {
    return JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? '{}');
  } catch {
    return {};
  }
}
function saveDraft(values: Values) {
  try {
    const { website: _hp, consentContact: _c, ...rest } = values;
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(rest));
  } catch {
    /* storage unavailable */
  }
}
function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* storage unavailable */
  }
}

export default function QuoteForm({ siteKey, email, replyTime }: Props) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [token, setToken] = useState('');
  const [ready, setReady] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const { state, serverErrors, submit } = useLeadSubmit();

  // Restore the draft and pre-select a service from ?service= (FR-027, FR-063).
  useEffect(() => {
    const draft = loadDraft();
    const preset = new URL(location.href).searchParams.get('service');
    const services = draft.services?.length ? draft.services : SERVICE_OPTIONS.some((o) => o.value === preset) ? [preset!] : [];
    setValues({ ...EMPTY, ...draft, services });
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) saveDraft(values);
  }, [values, ready]);
  useEffect(() => {
    if (!Object.keys(serverErrors).length) return;
    setErrors(serverErrors);
    const firstStep = STEP_FIELDS.findIndex((fields) => fields.some((f) => serverErrors[f]));
    if (firstStep >= 0) setStep(firstStep);
  }, [serverErrors]);
  useEffect(() => {
    if (state.phase === 'success') {
      clearDraft();
      document.getElementById('form-success')?.focus();
    }
  }, [state.phase]);

  const update = (patch: Partial<Values>) => setValues((v) => ({ ...v, ...patch }));
  const input = (key: keyof Values) => (e: Event) => update({ [key]: (e.currentTarget as HTMLInputElement).value } as Partial<Values>);
  const needsPlatforms = values.services.includes('mobile-app-development');

  function checkStep(index: number): boolean {
    const found = stepErrors(values as unknown as Record<string, unknown>, STEP_FIELDS[index]!);
    setErrors(found);
    if (Object.keys(found).length) {
      requestAnimationFrame(() => document.getElementById('error-summary')?.focus());
      return false;
    }
    return true;
  }

  function goTo(index: number) {
    setStep(index);
    requestAnimationFrame(() => heading.current?.focus());
  }

  function onSubmit(event: Event) {
    event.preventDefault();
    if (step < 2) {
      if (checkStep(step)) goTo(step + 1);
      return;
    }
    // Final check covers every step, in case a draft skipped one.
    for (let i = 0; i < 3; i++) {
      if (!checkStep(i)) {
        if (i !== step) goTo(i);
        return;
      }
    }
    submit({ ...values, formType: 'quote', turnstileToken: token });
  }

  if (state.phase === 'success') return <SuccessPanel reference={state.reference} name={values.name} replyTime={replyTime} />;

  return (
    <form class="lead-form" noValidate onSubmit={onSubmit} aria-label="Request a quote">
      <ol class="stepper" aria-label="Progress">
        {STEPS.map((label, i) => (
          <li class={i === step ? 'is-current' : i < step ? 'is-done' : ''} aria-current={i === step ? 'step' : undefined}>
            <span class="stepper-dot">{i < step ? '✓' : i + 1}</span>
            <span class="stepper-label">{label}</span>
          </li>
        ))}
      </ol>
      <div class="stepper-bar" aria-hidden="true"><span style={{ width: `${((step + 1) / 3) * 100}%` }} /></div>

      <h2 ref={heading} tabIndex={-1} class="step-title">
        <span class="sr-only">Step {step + 1} of 3: </span>{STEPS[step]}
      </h2>
      <ErrorSummary errors={errors} labels={LABELS} />

      <div class="step-body" key={step}>
        {step === 0 && (
          <>
            <ChoiceGroup name="services" legend="Which services are you interested in?" multiple options={SERVICE_OPTIONS} selected={values.services} error={errors.services} onChange={(services) => update({ services })} />
            <ChoiceGroup name="projectType" legend="What kind of project is it?" options={PROJECT_TYPES} selected={[values.projectType]} error={errors.projectType} onChange={([projectType]) => update({ projectType: projectType ?? '' })} />
          </>
        )}

        {step === 1 && (
          <>
            {needsPlatforms && (
              <ChoiceGroup name="platforms" legend="Which phones is the app for?" options={PLATFORMS} selected={[values.platforms]} error={errors.platforms} onChange={([platforms]) => update({ platforms: platforms ?? '' })} />
            )}
            <Field id="message" label="Describe your project" error={errors.message} hint="Goals, main features, who it's for, and anything you already have.">
              {(d) => (
                <>
                  <textarea id="message" rows={7} maxLength={2000} value={values.message} onInput={input('message')} aria-invalid={errors.message ? 'true' : undefined} aria-describedby={d} />
                  <p class="field-counter" aria-live="polite">{values.message.length} / 2,000</p>
                </>
              )}
            </Field>
            <Field id="link" label="Link to your current site, app or brief" optional error={errors.link} hint="Share a brief via Google Drive or Dropbox; we don't accept file uploads here.">
              {(d) => <input id="link" type="url" inputMode="url" placeholder="https://" value={values.link} onInput={input('link')} aria-invalid={errors.link ? 'true' : undefined} aria-describedby={d} />}
            </Field>
            <div class="grid gap-5 sm:grid-cols-2">
              <Field id="timeline" label="When do you want to start?" error={errors.timeline}>
                {(d) => (
                  <select id="timeline" value={values.timeline} onChange={input('timeline')} aria-invalid={errors.timeline ? 'true' : undefined} aria-describedby={d}>
                    <option value="">Choose a timeline</option>
                    {TIMELINES.map((o) => <option value={o.value}>{o.label}</option>)}
                  </select>
                )}
              </Field>
              <Field id="budget" label="Approximate budget" error={errors.budget}>
                {(d) => (
                  <select id="budget" value={values.budget} onChange={input('budget')} aria-invalid={errors.budget ? 'true' : undefined} aria-describedby={d}>
                    <option value="">Choose a range</option>
                    {BUDGETS.map((o) => <option value={o.value}>{o.label}</option>)}
                  </select>
                )}
              </Field>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div class="grid gap-5 sm:grid-cols-2">
              <Field id="name" label="Your name" error={errors.name}>
                {(d) => <input id="name" autoComplete="name" value={values.name} onInput={input('name')} aria-invalid={errors.name ? 'true' : undefined} aria-describedby={d} />}
              </Field>
              <Field id="email" label="Email" error={errors.email}>
                {(d) => <input id="email" type="email" inputMode="email" autoComplete="email" value={values.email} onInput={input('email')} aria-invalid={errors.email ? 'true' : undefined} aria-describedby={d} />}
              </Field>
              <Field id="phone" label="Phone" optional={values.preferredContact === 'email'} error={errors.phone} hint="With country code, e.g. +91 98765 43210">
                {(d) => <input id="phone" type="tel" inputMode="tel" autoComplete="tel" value={values.phone} onInput={input('phone')} aria-invalid={errors.phone ? 'true' : undefined} aria-describedby={d} />}
              </Field>
              <Field id="company" label="Company" optional error={errors.company}>
                {(d) => <input id="company" autoComplete="organization" value={values.company} onInput={input('company')} aria-describedby={d} />}
              </Field>
              <Field id="country" label="Country" optional error={errors.country}>
                {(d) => <input id="country" autoComplete="country-name" value={values.country} onInput={input('country')} aria-describedby={d} />}
              </Field>
            </div>
            <ChoiceGroup name="preferredContact" legend="How should we contact you?" options={CONTACT_METHODS} selected={[values.preferredContact]} error={errors.preferredContact} onChange={([preferredContact]) => update({ preferredContact: preferredContact ?? 'email' })} />

            <div class="review">
              <p class="eyebrow text-muted">Your request</p>
              <dl>
                <div><dt>Services</dt><dd>{values.services.map((s) => labelFor(SERVICE_OPTIONS, s)).join(', ')}</dd></div>
                <div><dt>Project</dt><dd>{labelFor(PROJECT_TYPES, values.projectType)}</dd></div>
                <div><dt>Timeline</dt><dd>{labelFor(TIMELINES, values.timeline)}</dd></div>
                <div><dt>Budget</dt><dd>{labelFor(BUDGETS, values.budget)}</dd></div>
              </dl>
              <button type="button" class="link-btn" onClick={() => goTo(0)}>Edit</button>
            </div>

            <div class="consents">
              <label class="check">
                <input id="consentContact" type="checkbox" checked={values.consentContact} onChange={(e) => update({ consentContact: e.currentTarget.checked })} aria-invalid={errors.consentContact ? 'true' : undefined} aria-describedby={errors.consentContact ? 'consentContact-error' : undefined} />
                <span>I agree that the team may contact me about this request.</span>
              </label>
              {errors.consentContact && <p id="consentContact-error" class="field-error">{MESSAGES.consentContact}</p>}
              <label class="check">
                <input type="checkbox" checked={values.consentMarketing} onChange={(e) => update({ consentMarketing: e.currentTarget.checked })} />
                <span>Send me occasional updates and articles (optional).</span>
              </label>
            </div>
            <Honeypot value={values.website} onInput={(website) => update({ website })} />
          </>
        )}
      </div>

      {/* Mounted from the first step so the check has finished by the time the visitor sends. */}
      <Turnstile siteKey={siteKey} onToken={setToken} />
      {state.phase === 'error' && <FailurePanel message={state.message} email={email} />}

      <div class="form-actions">
        {step > 0 && <button type="button" class="back-btn" onClick={() => goTo(step - 1)}>Back</button>}
        <button type="submit" class="submit-btn" aria-busy={state.phase === 'sending'} disabled={state.phase === 'sending'}>
          {state.phase === 'sending' ? <><span class="spinner" aria-hidden="true" />Sending…</> : step < 2 ? 'Continue' : 'Send request'}
        </button>
      </div>
      {step === 2 && <p class="privacy-note">We use your details only to reply to your request. See our <a href="/privacy">privacy policy</a>.</p>}
    </form>
  );
}
