import type { ComponentChildren } from 'preact';

// Accessible form building blocks: visible labels, hints, and errors linked with aria-describedby.

interface FieldProps {
  id: string;
  label: string;
  error?: string | undefined;
  hint?: string;
  optional?: boolean;
  children: (describedBy: string | undefined) => ComponentChildren;
}

export function Field({ id, label, error, hint, optional, children }: FieldProps) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <div class="field">
      <label for={id} class="field-label">
        {label} {optional && <span class="field-optional">(optional)</span>}
      </label>
      {hint && <p id={`${id}-hint`} class="field-hint">{hint}</p>}
      {children(describedBy)}
      {error && (
        <p id={`${id}-error`} class="field-error">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
          {error}
        </p>
      )}
    </div>
  );
}

interface ChoiceGroupProps {
  name: string;
  legend: string;
  options: readonly { value: string; label: string }[];
  selected: string[];
  multiple?: boolean;
  error?: string | undefined;
  onChange: (values: string[]) => void;
}

/** Chips that behave as checkboxes (multiple) or radios (single). */
export function ChoiceGroup({ name, legend, options, selected, multiple = false, error, onChange }: ChoiceGroupProps) {
  const errorId = `${name}-error`;
  return (
    <fieldset class="field" aria-describedby={error ? errorId : undefined}>
      <legend class="field-label">{legend}</legend>
      <div class="chip-group">
        {options.map((o) => {
          const checked = selected.includes(o.value);
          const toggle = () => {
            if (!multiple) return onChange([o.value]);
            onChange(checked ? selected.filter((v) => v !== o.value) : [...selected, o.value]);
          };
          const invalid = error ? { 'aria-invalid': 'true' as const } : {};
          return (
            <label class="choice-chip" key={o.value}>
              {multiple ? (
                <input type="checkbox" name={name} value={o.value} checked={checked} onChange={toggle} {...invalid} />
              ) : (
                <input type="radio" name={name} value={o.value} checked={checked} onChange={toggle} {...invalid} />
              )}
              <span>{o.label}</span>
            </label>
          );
        })}
      </div>
      {error && <p id={errorId} class="field-error">{error}</p>}
    </fieldset>
  );
}

export function Honeypot({ value, onInput }: { value: string; onInput: (v: string) => void }) {
  // Hidden from people and screen readers; bots tend to fill every field.
  return (
    <div class="hp" aria-hidden="true">
      <label for="website">Leave this field empty</label>
      <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" value={value} onInput={(e) => onInput(e.currentTarget.value)} />
    </div>
  );
}

export function ErrorSummary({ errors, labels }: { errors: Record<string, string | undefined>; labels: Record<string, string> }) {
  const entries = Object.entries(errors).filter(([, v]) => v);
  if (!entries.length) return null;
  return (
    <div class="error-summary" role="alert" tabIndex={-1} id="error-summary">
      <p class="font-semibold">Please fix {entries.length === 1 ? 'this' : `these ${entries.length}`} before continuing:</p>
      <ul>
        {entries.map(([key, message]) => (
          <li key={key}><a href={`#${key}`}>{labels[key] ?? key}: {message}</a></li>
        ))}
      </ul>
    </div>
  );
}

export function SuccessPanel({ reference, name, replyTime }: { reference: string; name: string; replyTime: string }) {
  const firstName = name.trim().split(/\s+/)[0] ?? '';
  return (
    <div class="success-panel" role="status" tabIndex={-1} id="form-success">
      <svg class="success-check" width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
        <circle cx="28" cy="28" r="26" fill="none" stroke="currentColor" stroke-width="2.5" opacity="0.25" />
        <path d="M17 29l7 7 15-16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" pathLength="1" />
      </svg>
      <h2 class="text-2xl font-semibold">Thanks{firstName ? `, ${firstName}` : ''}. We've got it.</h2>
      <p>Your reference is <strong>{reference}</strong>. We reply {replyTime}.</p>
      <ol class="success-steps">
        <li>We read your request and note any questions.</li>
        <li>We reply by your preferred method to arrange a short call.</li>
        <li>You receive a written proposal and quotation.</li>
      </ol>
      <a href="/" class="font-medium text-accent underline underline-offset-4">Back to the homepage</a>
    </div>
  );
}

export function FailurePanel({ message, email }: { message: string; email: string | null }) {
  async function copy() {
    if (!email) return;
    try {
      await navigator.clipboard.writeText(email);
    } catch {
      // Clipboard not allowed; the address is still visible and selectable.
    }
  }
  return (
    <div class="failure-panel" role="alert">
      <p>{message}</p>
      {email && (
        <p class="flex flex-wrap items-center gap-2 text-sm">
          Or email us at <span class="select-all font-medium">{email}</span>
          <button type="button" class="copy-btn" onClick={copy}>Copy</button>
        </p>
      )}
    </div>
  );
}
