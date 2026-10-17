import { useEffect, useRef, useState } from 'preact/hooks';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id: string) => void;
    };
  }
}

interface Props {
  siteKey: string;
  onToken: (token: string) => void;
}

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const LOAD_TIMEOUT_MS = 10_000;

/** Cloudflare Turnstile spam check. Loaded only on form pages. */
export default function Turnstile({ siteKey, onToken }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let widgetId: string | undefined;
    const render = () => {
      if (!box.current || !window.turnstile || widgetId) return;
      widgetId = window.turnstile.render(box.current, {
        sitekey: siteKey,
        appearance: 'interaction-only',
        callback: (token: string) => onToken(token),
        'expired-callback': () => onToken(''),
        'error-callback': () => setFailed(true),
      });
    };

    if (window.turnstile) render();
    else {
      let script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_URL}"]`);
      if (!script) {
        script = document.createElement('script');
        script.src = SCRIPT_URL;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener('load', render);
      script.addEventListener('error', () => setFailed(true));
    }
    const timer = setTimeout(() => !widgetId && setFailed(true), LOAD_TIMEOUT_MS);
    return () => {
      clearTimeout(timer);
      if (widgetId) window.turnstile?.remove(widgetId);
    };
  }, [siteKey]);

  return (
    <div>
      <div ref={box} />
      {failed && (
        <p class="field-error" role="alert">
          Our spam check could not load. Disable any blocker for this page and refresh, or contact us another way.
        </p>
      )}
    </div>
  );
}
