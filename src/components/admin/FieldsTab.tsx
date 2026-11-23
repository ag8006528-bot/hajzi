'use client';

import { useState } from 'react';
import { fmt, formatPrice, loc } from '@/lib/i18n';
import { useLang } from '@/lib/i18n/LanguageProvider';
import type { Field, FieldInput } from '@/lib/types';
import { defaultFieldInput } from '@/lib/validation';
import { TypeBadge } from '../fields/TypeBadge';
import { EditIcon, PlusIcon, TrashIcon } from '../ui/icons';
import { FieldForm } from './FieldForm';

export function FieldsTab({ fields, onChange }: { fields: Field[]; onChange: (f: Field[]) => void }) {
  const { t, lang } = useLang();
  const [editing, setEditing] = useState<{ id: string | null; data: FieldInput } | null>(null);

  const remove = async (f: Field) => {
    if (!window.confirm(fmt(t.admin.confirmDelete, { name: loc(f.name, lang) }))) return;
    const res = await fetch(`/api/fields/${f.id}`, { method: 'DELETE' });
    if (res.ok) onChange(fields.filter((x) => x.id !== f.id));
    else window.alert(t.admin.error);
  };

  const saved = (field: Field) => {
    onChange(editing?.id ? fields.map((f) => (f.id === field.id ? field : f)) : [...fields, field]);
    setEditing(null);
  };

  return (
    <div>
      <button type="button" className="btn-primary" onClick={() => setEditing({ id: null, data: defaultFieldInput() })}>
        <PlusIcon width={18} height={18} />
        {t.admin.addField}
      </button>

      <ul className="mt-5 grid gap-4 md:grid-cols-2">
        {fields.map((f) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id, createdAt, ...data } = f;
          return (
            <li key={f.id} className="panel flex items-start justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <TypeBadge type={f.type} className="!px-2 !py-0.5 !text-sm" />
                  {f.featured && <span className="rounded-full bg-card/40 px-2 py-0.5 text-xs font-bold">★</span>}
                </div>
                <h3 className="mt-2 truncate text-lg font-bold">{loc(f.name, lang)}</h3>
                <p className="text-sm text-ink/70">
                  {loc(f.area, lang)} · {formatPrice(f.pricePerHour, lang)} {t.field.perHour}
                </p>
                <p className="text-sm text-ink/70" dir="ltr">
                  {f.phone}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => setEditing({ id: f.id, data })}
                  className="grid h-10 w-10 place-items-center rounded-full text-ink hover:bg-ink/5"
                  aria-label={`${t.admin.edit}: ${loc(f.name, lang)}`}
                >
                  <EditIcon width={18} height={18} />
                </button>
                <button
                  type="button"
                  onClick={() => remove(f)}
                  className="grid h-10 w-10 place-items-center rounded-full text-red-700 hover:bg-red-50"
                  aria-label={`${t.admin.delete}: ${loc(f.name, lang)}`}
                >
                  <TrashIcon width={18} height={18} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {editing && <FieldForm id={editing.id} initial={editing.data} onClose={() => setEditing(null)} onSaved={saved} />}
    </div>
  );
}
