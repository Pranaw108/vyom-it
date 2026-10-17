import { useEffect, useRef, useState } from 'preact/hooks';
import type { FieldErrors } from '../../lib/leads/validation';

export type SubmitState =
  | { phase: 'idle' }
  | { phase: 'sending' }
  | { phase: 'success'; reference: string }
  | { phase: 'error'; message: string };

const TIMEOUT_MS = 15_000;

function newSubmissionId(): string {
  return crypto.randomUUID();
}

function readSource() {
  const url = new URL(location.href);
  return {
    referrer: document.referrer || null,
    utmSource: url.searchParams.get('utm_source'),
    utmMedium: url.searchParams.get('utm_medium'),
    utmCampaign: url.searchParams.get('utm_campaign'),
    landingPage: url.pathname,
  };
}

/** Submits a lead form. Retries reuse the same submissionId, so the server never stores it twice. */
export function useLeadSubmit() {
  const [state, setState] = useState<SubmitState>({ phase: 'idle' });
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const submissionId = useRef<string>('');
  const startedAt = useRef<number>(0);

  useEffect(() => {
    submissionId.current = newSubmissionId();
    startedAt.current = Date.now();
  }, []);

  async function submit(payload: Record<string, unknown>) {
    if (state.phase === 'sending') return;
    if (!payload.turnstileToken) {
      setState({ phase: 'error', message: "We're still checking this browser isn't a bot. Please wait a few seconds and press send again." });
      return;
    }
    if (!navigator.onLine) {
      setState({ phase: 'error', message: "You seem to be offline. Your details are kept here; try again when you're connected." });
      return;
    }
    setState({ phase: 'sending' });
    setServerErrors({});
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          submissionId: submissionId.current,
          elapsedMs: Date.now() - startedAt.current,
          source: readSource(),
        }),
        signal: controller.signal,
      });
      const data = (await response.json().catch(() => ({}))) as { reference?: string; message?: string; errors?: FieldErrors };
      if (response.status === 201 && data.reference) {
        setState({ phase: 'success', reference: data.reference });
        return;
      }
      if (response.status === 422 && data.errors) {
        setServerErrors(data.errors);
        setState({ phase: 'error', message: 'Please check the highlighted fields.' });
        return;
      }
      setState({ phase: 'error', message: data.message ?? 'Something went wrong sending the form. Please try again.' });
    } catch (error) {
      const timedOut = (error as Error).name === 'AbortError';
      setState({
        phase: 'error',
        message: timedOut
          ? 'This is taking longer than usual. Please try again; it is safe to resend and will not create a duplicate.'
          : "We couldn't reach our server. Check your connection and try again.",
      });
    } finally {
      clearTimeout(timer);
    }
  }

  return { state, serverErrors, submit };
}
