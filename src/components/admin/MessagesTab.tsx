'use client';

import { useEffect, useState } from 'react';
import { useLang } from '@/lib/i18n/LanguageProvider';
import type { ContactMessage } from '@/lib/types';
import { SpinnerIcon } from '../ui/icons';

export function MessagesTab() {
  const { t, lang } = useLang();
  const [messages, setMessages] = useState<ContactMessage[] | null>(null);

  useEffect(() => {
    fetch('/api/admin/messages', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((d) => setMessages(d.messages))
      .catch(() => setMessages([]));
  }, []);

  const fmt = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-JO-u-nu-latn' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  if (!messages) return <SpinnerIcon className="mx-auto" />;
  if (!messages.length) return <p className="panel-glass p-6">{t.admin.noMessages}</p>;
  return (
    <ul className="space-y-3">
      {messages.map((m) => (
        <li key={m.id} className="panel p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-bold">{m.name}</p>
            <p className="text-xs text-ink/60">{fmt.format(new Date(m.createdAt))}</p>
          </div>
          <p className="text-sm text-pitch" dir="ltr">
            {m.contact}
          </p>
          {/* Rendered as text by React (escaped) — never as HTML. */}
          <p className="mt-2 whitespace-pre-line text-sm text-ink/85">{m.message}</p>
        </li>
      ))}
    </ul>
  );
}
