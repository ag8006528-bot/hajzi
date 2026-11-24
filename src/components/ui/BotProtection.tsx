'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { useLang } from '@/lib/i18n/LanguageProvider';

/**
 * Honeypot: a field humans never see. Bots that auto-fill every input get rejected server-side.
 */
export function Honeypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    // Hidden by clipping, not by pushing it off-screen: a far-left position makes right-to-left (Arabic)
    // pages scroll sideways by 10,000px.
    <div
      aria-hidden="true"
      style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap', opacity: 0, pointerEvents: 'none' }}
    >
      <label htmlFor="hp-website">Website</label>
      <input id="hp-website" name="website" type="text" tabIndex={-1} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';
let scriptPromise: Promise<void> | null = null;
function loadScript() {
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error('turnstile'));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export interface TurnstileHandle {
  reset: () => void;
}

/** Cloudflare Turnstile (privacy-friendly CAPTCHA). Renders nothing when no site key is configured. */
export const Turnstile = forwardRef<TurnstileHandle, { onToken: (t: string) => void }>(function Turnstile({ onToken }, ref) {
  const { lang } = useLang();
  const el = useRef<HTMLDivElement>(null);
  const widget = useRef<string | undefined>(undefined);
  const cb = useRef(onToken);
  cb.current = onToken;

  useImperativeHandle(ref, () => ({
    reset: () => {
      cb.current('');
      if (widget.current) window.turnstile?.reset(widget.current);
    },
  }));

  useEffect(() => {
    if (!SITE_KEY || !el.current) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !el.current || !window.turnstile) return;
        widget.current = window.turnstile.render(el.current, {
          sitekey: SITE_KEY,
          language: lang,
          theme: 'light',
          callback: (t: string) => cb.current(t),
          'expired-callback': () => cb.current(''),
          'error-callback': () => cb.current(''),
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = undefined;
    };
  }, [lang]);

  if (!SITE_KEY) return null;
  return <div ref={el} className="min-h-[65px]" />;
});

export const turnstileEnabled = !!SITE_KEY;
