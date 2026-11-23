'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useLang } from '@/lib/i18n/LanguageProvider';
import type { Field, PublicUser } from '@/lib/types';
import { AccountTab } from './AccountTab';
import { ActivityTab } from './ActivityTab';
import { AvailabilityTab } from './AvailabilityTab';
import { BookingsTab } from './BookingsTab';
import { FieldsTab } from './FieldsTab';
import { MessagesTab } from './MessagesTab';

type Tab = 'bookings' | 'fields' | 'availability' | 'messages' | 'activity' | 'account';

/**
 * Tabs are shown per role for convenience only — every action is ALSO enforced
 * server-side in the API routes (staff calling an admin API get 403).
 */
export function AdminDashboard({ initialFields, user }: { initialFields: Field[]; user: PublicUser }) {
  const { t } = useLang();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('bookings');
  const [fields, setFields] = useState(initialFields);
  const isAdmin = user.role === 'admin';

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.replace('/admin/login');
    router.refresh();
  };

  const tabs: Tab[] = isAdmin
    ? ['bookings', 'fields', 'availability', 'messages', 'activity', 'account']
    : ['bookings', 'availability', 'messages', 'account'];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="heading text-4xl sm:text-5xl">{t.admin.title}</h1>
          <p className="mt-1 text-sm text-white/80" dir="ltr">
            {user.email} · <span className="font-bold text-card">{t.admin.roles[user.role]}</span>
          </p>
        </div>
        <button type="button" onClick={logout} className="btn-outline !min-h-[40px]">
          {t.admin.logout}
        </button>
      </div>

      <div role="tablist" aria-label={t.admin.title} className="scrollbar-none mt-6 flex max-w-full gap-1 overflow-x-auto rounded-full bg-pitch-dark/70 p-1 sm:inline-flex">
        {tabs.map((k) => (
          <button
            key={k}
            role="tab"
            id={`tab-${k}`}
            aria-selected={tab === k}
            aria-controls={`panel-${k}`}
            onClick={() => setTab(k)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition sm:px-5 ${tab === k ? 'bg-card text-ink' : 'text-white hover:bg-white/10'}`}
          >
            {t.admin.tabs[k]}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-6">
        {tab === 'bookings' && <BookingsTab fields={fields} />}
        {tab === 'fields' && isAdmin && <FieldsTab fields={fields} onChange={setFields} />}
        {tab === 'availability' && <AvailabilityTab fields={fields} />}
        {tab === 'messages' && <MessagesTab />}
        {tab === 'activity' && isAdmin && <ActivityTab />}
        {tab === 'account' && <AccountTab user={user} />}
      </div>
    </div>
  );
}
