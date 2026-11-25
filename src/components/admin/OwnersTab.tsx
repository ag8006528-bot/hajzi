'use client';

import { useCallback, useEffect, useState } from 'react';
import { fmt, loc } from '@/lib/i18n';
import { useLang } from '@/lib/i18n/LanguageProvider';
import type { Field } from '@/lib/types';
import { FormField } from '../ui/FormField';
import { SpinnerIcon, TrashIcon, WhatsAppIcon } from '../ui/icons';

interface Owner {
  id: string;
  email: string;
  name: string;
  fieldIds: string[];
  createdAt: string;
  lastLoginAt: string | null;
}

/** Admin only: create / remove field-owner accounts. The server enforces every rule. */
export function OwnersTab({ fields }: { fields: Field[] }) {
  const { t, lang } = useLang();
  const o = t.admin.owners;
  const [owners, setOwners] = useState<Owner[] | null>(null);
  const [form, setForm] = useState({ email: '', name: '', fieldId: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<{ email: string; password: string; fieldId: string } | null>(null);

  const fieldName = (id: string) => {
    const f = fields.find((x) => x.id === id);
    return f ? loc(f.name, lang) : id;
  };

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/owners', { cache: 'no-store' });
    setOwners(res.ok ? (await res.json()).owners : []);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const res = await fetch('/api/admin/owners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.email, name: form.name, fieldIds: form.fieldId ? [form.fieldId] : [] }),
    }).catch(() => null);
    setBusy(false);
    const data = await res?.json().catch(() => ({}));
    if (res?.ok) {
      setCreated({ email: data.owner.email, password: data.tempPassword, fieldId: form.fieldId });
      setForm({ email: '', name: '', fieldId: '' });
      load();
    } else {
      setError(data?.code === 'exists' ? o.errExists : data?.code === 'no_fields' ? o.errNoField : o.errGeneric);
    }
  };

  const remove = async (owner: Owner) => {
    if (!window.confirm(fmt(o.confirmRemove, { email: owner.email }))) return;
    const res = await fetch(`/api/admin/owners?id=${owner.id}`, { method: 'DELETE' });
    if (res.ok) load();
    else window.alert(t.admin.error);
  };

  const shareText = created
    ? fmt(o.shareMessage, { field: fieldName(created.fieldId), url: `${window.location.origin}/admin/login`, email: created.email, password: created.password })
    : '';
  const fieldPhone = created ? fields.find((f) => f.id === created.fieldId)?.whatsapp : undefined;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="panel p-5 sm:p-6" aria-labelledby="owners-new">
        <h2 id="owners-new" className="text-xl font-bold">
          {o.newTitle}
        </h2>
        <p className="mt-1 text-sm text-ink/70">{o.newHelp}</p>
        <form onSubmit={create} className="mt-4 space-y-4">
          <FormField id="ow-field" label={o.field}>
            <select id="ow-field" className="input" required value={form.fieldId} onChange={(e) => setForm({ ...form, fieldId: e.target.value })}>
              <option value="">{o.chooseField}</option>
              {fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {loc(f.name, lang)}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="ow-name" label={o.name}>
            <input className="input" maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </FormField>
          <FormField id="ow-email" label={o.email}>
            <input className="input" type="email" dir="ltr" required maxLength={254} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </FormField>
          {error && (
            <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? <SpinnerIcon width={18} height={18} /> : null} {o.create}
          </button>
        </form>

        {created && (
          <div role="status" className="mt-5 rounded-2xl border-2 border-pitch/30 bg-pitch/[0.06] p-4">
            <p className="font-bold text-pitch-dark">{o.createdTitle}</p>
            <p className="mt-1 text-sm text-ink/75">{o.createdHelp}</p>
            <dl className="mt-3 grid gap-1 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink/70">{o.email}</dt>
                <dd dir="ltr" className="font-semibold">
                  {created.email}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink/70">{o.tempPassword}</dt>
                <dd dir="ltr" className="font-mono text-base font-bold">
                  {created.password}
                </dd>
              </div>
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn-ghost !min-h-[40px]" onClick={() => navigator.clipboard?.writeText(shareText)}>
                {o.copyMessage}
              </button>
              {fieldPhone && (
                <a
                  className="btn !min-h-[40px] bg-[#25D366] text-ink hover:bg-[#3ee07b]"
                  href={`https://wa.me/${fieldPhone}?text=${encodeURIComponent(shareText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <WhatsAppIcon width={18} height={18} /> {o.sendWhatsApp}
                </a>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="panel p-5 sm:p-6" aria-labelledby="owners-list">
        <h2 id="owners-list" className="text-xl font-bold">
          {o.listTitle}
        </h2>
        {owners === null ? (
          <p className="mt-4 text-ink/70">
            <SpinnerIcon width={18} height={18} />
          </p>
        ) : owners.length === 0 ? (
          <p className="mt-4 text-ink/70">{o.none}</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {owners.map((ow) => (
              <li key={ow.id} className="flex items-start justify-between gap-3 rounded-xl bg-pitch/[0.06] p-3">
                <div className="min-w-0">
                  <p className="font-bold">{ow.fieldIds.map(fieldName).join('، ')}</p>
                  <p className="truncate text-sm text-ink/75" dir="ltr">
                    {ow.name ? `${ow.name} · ` : ''}
                    {ow.email}
                  </p>
                  <p className="text-xs text-ink/60">{ow.lastLoginAt ? fmt(o.lastLogin, { date: ow.lastLoginAt.slice(0, 10) }) : o.neverLoggedIn}</p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(ow)}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-red-700 hover:bg-red-50"
                  aria-label={fmt(o.remove, { email: ow.email })}
                >
                  <TrashIcon width={18} height={18} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
