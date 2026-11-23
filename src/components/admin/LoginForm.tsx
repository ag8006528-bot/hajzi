'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/i18n/LanguageProvider';
import { FormField } from '../ui/FormField';
import { LockIcon, SpinnerIcon } from '../ui/icons';

export function LoginForm() {
  const { t } = useLang();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [needTotp, setNeedTotp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);

  // Show "Account created!" once, after coming from the Create account page.
  useEffect(() => {
    try {
      if (sessionStorage.getItem('hajzi_account_created')) {
        sessionStorage.removeItem('hajzi_account_created');
        setCreated(true);
      }
    } catch {
      /* storage unavailable */
    }
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, ...(needTotp && totp ? { totp } : {}) }),
    }).catch(() => null);
    if (res?.ok) {
      setPassword('');
      router.replace('/admin');
      router.refresh();
      return;
    }
    const data = await res?.json().catch(() => ({}));
    if (data?.code === 'TOTP_REQUIRED') {
      setNeedTotp(true);
      setError(needTotp ? t.admin.wrongPassword : '');
    } else if (res?.status === 429) {
      setError(t.booking.errors.rateLimited);
    } else if (res?.status === 401) {
      setError(t.admin.wrongPassword);
      setTotp('');
    } else {
      setError(t.admin.error);
    }
    setLoading(false);
  };

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-sm items-center px-4 py-16">
      <form onSubmit={submit} className="panel w-full space-y-4 p-6 sm:p-8">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-pitch text-card">
          <LockIcon />
        </span>
        <h1 className="text-center text-2xl font-bold">{t.admin.login}</h1>
        {created && (
          <p role="status" className="rounded-xl bg-pitch/10 p-3 text-sm font-semibold text-pitch-dark">
            {t.admin.created}
          </p>
        )}
        <FormField id="admin-email" label={t.admin.email}>
          <input
            className="input"
            type="email"
            autoComplete="username"
            dir="ltr"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </FormField>
        <FormField id="admin-password" label={t.admin.password} error={!needTotp && error ? error : undefined}>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            required
            maxLength={200}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </FormField>
        {needTotp && (
          <FormField id="admin-totp" label={t.admin.totpCode} hint={t.admin.totpPrompt} error={error || undefined}>
            <input
              className="input tracking-[0.4em]"
              inputMode="numeric"
              autoComplete="one-time-code"
              dir="ltr"
              pattern="\d{6}"
              maxLength={6}
              required
              autoFocus
              value={totp}
              onChange={(e) => setTotp(e.target.value.replace(/\D/g, ''))}
            />
          </FormField>
        )}
        <button type="submit" disabled={loading || !email || !password || (needTotp && totp.length !== 6)} className="btn-dark w-full">
          {loading ? (
            <>
              <SpinnerIcon width={18} height={18} /> {t.admin.signingIn}
            </>
          ) : (
            t.admin.signIn
          )}
        </button>
        <div className="border-t border-ink/10 pt-4 text-center">
          <p className="text-sm text-ink/70">{t.admin.noAccount}</p>
          <Link href="/admin/setup" className="btn-ghost mt-2 w-full">
            {t.admin.createAccount}
          </Link>
        </div>
      </form>
    </div>
  );
}
