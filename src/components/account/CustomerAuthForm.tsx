'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useLang } from '@/lib/i18n/LanguageProvider';
import { safeNext } from '@/lib/safe-next';
import { Honeypot, Turnstile, type TurnstileHandle } from '../ui/BotProtection';
import { FormField } from '../ui/FormField';
import { SpinnerIcon, UsersIcon } from '../ui/icons';

/** Customer sign-in and sign-up (mode decides which). */
export function CustomerAuthForm({ mode, next = '/account' }: { mode: 'login' | 'register'; next?: string }) {
  const { t } = useLang();
  const a = t.auth;
  const router = useRouter();
  const [v, setV] = useState({ name: '', phone: '', email: '', password: '', confirm: '' });
  const [honeypot, setHoneypot] = useState('');
  const [captcha, setCaptcha] = useState('');
  const captchaRef = useRef<TurnstileHandle>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const isRegister = mode === 'register';
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (isRegister) {
      if (v.password !== v.confirm) return setError(a.errors.mismatch);
      if (v.password.length < 8) return setError(a.errors.short);
    }
    setLoading(true);
    const body = isRegister
      ? { name: v.name, phone: v.phone, email: v.email, password: v.password, website: honeypot || undefined, turnstileToken: captcha || undefined }
      : { email: v.email, password: v.password };
    const res = await fetch(isRegister ? '/api/account/register' : '/api/account/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (res?.ok) {
      router.replace(safeNext(next)); // re-checked on the client too
      router.refresh();
      return;
    }
    const data = await res?.json().catch(() => ({}));
    const code = data?.code === 'INVALID' && isRegister ? 'INVALID_FORM' : data?.code;
    setError(res?.status === 429 ? a.errors.rateLimited : a.errors[code] ?? a.errors.generic);
    captchaRef.current?.reset();
    setLoading(false);
  };

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md items-center px-4 py-12">
      <form onSubmit={submit} noValidate className="panel w-full space-y-4 p-6 sm:p-8">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-card text-ink">
          <UsersIcon />
        </span>
        <div className="text-center">
          <h1 className="text-2xl font-bold">{isRegister ? a.register : a.customerLogin}</h1>
          {isRegister && <p className="mt-1 text-sm text-ink/70">{a.registerSubtitle}</p>}
        </div>

        {isRegister && (
          <>
            <FormField id="cu-name" label={a.name}>
              <input className="input" autoComplete="name" required maxLength={80} value={v.name} onChange={set('name')} />
            </FormField>
            <FormField id="cu-phone" label={a.phone} hint={t.booking.phoneHint}>
              <input className="input" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" required maxLength={30} value={v.phone} onChange={set('phone')} />
            </FormField>
          </>
        )}
        <FormField id="cu-email" label={a.email}>
          <input className="input" type="email" autoComplete="email" dir="ltr" required maxLength={254} value={v.email} onChange={set('email')} />
        </FormField>
        <FormField id="cu-password" label={isRegister ? a.passwordNew : a.password}>
          <input
            className="input"
            type="password"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            required
            maxLength={200}
            value={v.password}
            onChange={set('password')}
          />
        </FormField>
        {isRegister && (
          <>
            <FormField id="cu-confirm" label={a.confirm}>
              <input className="input" type="password" autoComplete="new-password" required maxLength={200} value={v.confirm} onChange={set('confirm')} />
            </FormField>
            <Honeypot value={honeypot} onChange={setHoneypot} />
            <Turnstile ref={captchaRef} onToken={setCaptcha} />
          </>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">
            {error}
          </p>
        )}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? (
            <>
              <SpinnerIcon width={18} height={18} /> {isRegister ? a.creating : a.signingIn}
            </>
          ) : isRegister ? (
            a.create
          ) : (
            a.signIn
          )}
        </button>
        <div className="border-t border-ink/10 pt-4 text-center text-sm">
          <p className="text-ink/70">{isRegister ? a.haveAccount : a.noAccount}</p>
          <Link
            href={`${isRegister ? '/account/login' : '/account/register'}${next !== '/account' ? `?next=${encodeURIComponent(next)}` : ''}`}
            className="btn-ghost mt-2 w-full"
          >
            {isRegister ? a.signIn : a.register}
          </Link>
          <Link href="/login" className="mt-3 inline-block font-semibold text-pitch underline">
            {a.back}
          </Link>
        </div>
      </form>
    </div>
  );
}
