'use client';

import { useEffect, useState } from 'react';
import { useLang } from '@/lib/i18n/LanguageProvider';
import type { AuditEntry } from '@/lib/types';
import { SpinnerIcon } from '../ui/icons';

export function ActivityTab() {
  const { t, lang } = useLang();
  const c = t.admin.activity;
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);

  useEffect(() => {
    fetch('/api/admin/audit', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { entries: [] }))
      .then((d) => setEntries(d.entries))
      .catch(() => setEntries([]));
  }, []);

  const fmt = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-JO-u-nu-latn' : 'en-GB', { dateStyle: 'short', timeStyle: 'medium' });

  return (
    <div className="panel overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-pitch-dark text-white">
          <tr>
            {[c.when, c.who, c.action, c.target, c.details].map((h) => (
              <th key={h} scope="col" className="px-3 py-3 text-start font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink/10" dir="ltr">
          {!entries ? (
            <tr>
              <td colSpan={5} className="p-8 text-center">
                <SpinnerIcon className="mx-auto" />
              </td>
            </tr>
          ) : (
            entries.map((e) => (
              <tr key={e.id} className={/fail|locked|blocked/.test(e.action) ? 'bg-red-50' : ''}>
                <td className="whitespace-nowrap px-3 py-2">{fmt.format(new Date(e.at))}</td>
                <td className="px-3 py-2">{e.actor}</td>
                <td className="px-3 py-2 font-mono font-semibold">{e.action}</td>
                <td className="px-3 py-2">{e.target}</td>
                <td className="px-3 py-2 text-xs text-ink/70">
                  {e.details && Object.entries(e.details).map(([k, v]) => `${k}=${v}`).join(' · ')}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
