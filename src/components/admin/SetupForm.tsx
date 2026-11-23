'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useLang } from '@/lib/i18n/LanguageProvider';
import { FormField } from '../ui/FormField';
import { SpinnerIcon, UsersIcon } from '../ui/icons';

export function SetupForm() {
  const { t } = useLang();
  const s = t.admin.setup;
  const router = useRouter();
  const [v, setV] = useState({ email: '', password: '', confirm: '', code: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (v.password !== v.confirm) return setError(s.errors.mismatch);
    if (v.password.length < 12) return setError(s.errors.short);
    setLoading(true);
    const res = await fetch('/api/admin/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: v.email, password: v.password, code: v.code }),
    }).catch(() => null);
    if (res?.ok) {
      try {
        sessionStorage.setItem('hajzi_account_created', '1');
      } catch {
        /* storage unavailable */
      }
      router.push('/admin/login');
      return;
    }
    const data = await res?.json().catch(() => ({}));
    setError(res?.status === 429 ? t.booking.errors.rateLimited : s.errors[data?.code] ?? s.errors.generic);
    setLoading(false);
  };

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md items-center px-4 py-12">
      <form onSubmit={submit} className="panel w-full space-y-4 p-6 sm:p-8">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-pitch text-card">
          <UsersIcon />
        </span>
        <div className="text-center">
          <h1 className="text-2xl font-bold">{s.title}</h1>
          <p className="mt-1 text-sm text-ink/70">{s.subtitle}</p>
        </div>
        <FormField id="setup-email" label={s.email}>
          <input className="input" type="email" autoComplete="username" dir="ltr" required maxLength={254} value={v.email} onChange={set('email')} />
        </FormField>
        <FormField id="setup-password" label={s.password}>
          <input className="input" type="password" autoComplete="new-password" required minLength={12} maxLength={200} value={v.password} onChange={set('password')} />
        </FormField>
        <FormField id="setup-confirm" label={s.confirm}>
          <input className="input" type="password" autoComplete="new-password" required maxLength={200} value={v.confirm} onChange={set('confirm')} />
        </FormField>
        <FormField id="setup-code" label={s.code} hint={s.codeHint}>
          <input className="input font-mono uppercase tracking-widest" dir="ltr" autoComplete="off" required maxLength={100} value={v.code} onChange={set('code')} />
        </FormField>
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">
            {error}
          </p>
        )}
        <button type="submit" disabled={loading} className="btn-dark w-full">
          {loading ? (
            <>
              <SpinnerIcon width={18} height={18} /> {s.creating}
            </>
          ) : (
            s.create
          )}
        </button>
        <p className="text-center text-sm">
          <Link href="/admin/login" className="font-semibold text-pitch underline">
            {s.backToLogin}
          </Link>
        </p>
      </form>
    </div>
  );
}
