'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useLang } from '@/lib/i18n/LanguageProvider';
import type { PublicUser } from '@/lib/types';
import { LockIcon } from '../ui/icons';

const post = (body: unknown) =>
  fetch('/api/admin/totp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export function AccountTab({ user }: { user: PublicUser }) {
  const { t } = useLang();
  const a = t.admin.account;
  const router = useRouter();
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const start = async () => {
    setMsg(null);
    const res = await post({ action: 'setup' });
    if (res.ok) setSetup(await res.json());
    else setMsg({ ok: false, text: t.admin.error });
  };

  const enable = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await post({ action: 'enable', code });
    setCode('');
    if (res.ok) {
      setSetup(null);
      setMsg({ ok: true, text: a.done });
      router.refresh();
    } else setMsg({ ok: false, text: a.invalid });
  };

  const disable = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await post({ action: 'disable', password, code });
    setCode('');
    setPassword('');
    if (res.ok) {
      setMsg({ ok: true, text: a.done });
      router.refresh();
    } else setMsg({ ok: false, text: a.invalid });
  };

  return (
    <section className="panel max-w-2xl p-6" aria-labelledby="twofa-title">
      <h2 id="twofa-title" className="flex items-center gap-2 text-xl font-bold">
        <LockIcon className="text-pitch" /> {a.title}
      </h2>
      <p className={`mt-3 font-semibold ${user.totpEnabled ? 'text-pitch-dark' : 'text-ink/80'}`}>{user.totpEnabled ? a.on : a.off}</p>

      {!user.totpEnabled && !setup && (
        <button type="button" onClick={start} className="btn-dark mt-5">
          {a.enable}
        </button>
      )}

      {!user.totpEnabled && setup && (
        <form onSubmit={enable} className="mt-5 space-y-4">
          <p className="text-sm">{a.step1}</p>
          <code dir="ltr" className="block select-all break-all rounded-xl bg-ink/5 p-3 text-center font-mono text-lg tracking-widest">
            {setup.secret.match(/.{1,4}/g)?.join(' ')}
          </code>
          <a href={setup.uri} className="text-sm font-semibold text-pitch underline">
            {a.openApp}
          </a>
          <label htmlFor="totp-enable" className="block text-sm">
            {a.step2}
          </label>
          <input
            id="totp-enable"
            className="input max-w-[200px] tracking-[0.4em]"
            inputMode="numeric"
            autoComplete="one-time-code"
            dir="ltr"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          <button type="submit" className="btn-dark" disabled={code.length !== 6}>
            {a.confirm}
          </button>
        </form>
      )}

      {user.totpEnabled && (
        <form onSubmit={disable} className="mt-5 space-y-3">
          <p className="text-sm text-ink/75">{a.disableHelp}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="totp-pw" className="label">
                {t.admin.password}
              </label>
              <input id="totp-pw" type="password" autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div>
              <label htmlFor="totp-code" className="label">
                {t.admin.totpCode}
              </label>
              <input
                id="totp-code"
                className="input tracking-[0.4em]"
                inputMode="numeric"
                autoComplete="one-time-code"
                dir="ltr"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          </div>
          <button type="submit" className="btn-ghost !border-red-300 !text-red-700" disabled={!password || code.length !== 6}>
            {a.disable}
          </button>
        </form>
      )}

      {msg && (
        <p role="status" className={`mt-4 rounded-xl p-3 text-sm font-semibold ${msg.ok ? 'bg-pitch/10 text-pitch-dark' : 'bg-red-50 text-red-800'}`}>
          {msg.text}
        </p>
      )}
    </section>
  );
}
